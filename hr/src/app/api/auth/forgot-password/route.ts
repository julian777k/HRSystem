import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantIdSafe } from '@/lib/tenant-context';
import { checkRateLimit } from '@/lib/rate-limit';
import { sendEmail, passwordResetEmail } from '@/lib/email';
import { checkResetEmailQuota } from '@/lib/email-quota';
import { isDemoRequestFrom } from '@/lib/demo-guard';

// 계정 열거 방지: 존재 여부와 무관하게 항상 동일 응답
const GENERIC = { message: '등록된 이메일이면 비밀번호 재설정 링크를 보내드렸습니다.' };

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get('cf-connecting-ip') ||
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      'unknown';

    // IP당 15분 5회 제한 (스팸·열거 방지)
    const rl = await checkRateLimit(`forgot:${ip}`, 5, 15 * 60 * 1000);
    if (!rl.success) {
      return NextResponse.json(
        { message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
        { status: 429 }
      );
    }

    const { email } = await request.json().catch(() => ({ email: '' }));
    if (!email || typeof email !== 'string') {
      return NextResponse.json(GENERIC);
    }

    // 서브도메인(x-tenant-subdomain 헤더)으로 테넌트 식별. self-hosted면 ''.
    const tenantId = await getTenantIdSafe();

    const employee = await prisma.employee.findFirst({
      where: { email, tenantId },
    });

    // 데모는 누구나 관리자 권한을 얻을 수 있어, 임의 주소로 직원을 만든 뒤
    // 이 API로 메일을 보내는 스팸 발송기로 악용될 수 있다. 데모에서는 발송하지 않는다.
    // (응답은 동일하게 유지 — 계정 열거·환경 판별 방지)
    const demo = isDemoRequestFrom(request);

    // 계정이 있을 때만 토큰 생성·발송. 응답은 항상 GENERIC.
    if (employee && !demo) {
      // 메일은 1건당 비용이 발생한다. IP 기반 제한은 isolate 메모리라
      // Workers에서 우회가 쉬우므로, D1 기록으로 실제 발송량을 통제한다.
      // 한도에 걸려도 응답은 동일하게 유지한다(계정 열거·상태 노출 방지).
      const quota = await checkResetEmailQuota(email);
      if (quota.allowed) {
        const token = generateToken();
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
        await prisma.passwordReset.create({
          data: { tenantId, email, token, expiresAt },
        });

        const host = request.headers.get('host') || 'keystonehr.app';
        const resetUrl = `https://${host}/reset-password?token=${token}`;
        const { subject, html, text } = passwordResetEmail(resetUrl);
        // 키 미설정이면 sendEmail이 false를 반환하지만 응답은 동일(열거 방지)
        await sendEmail({ to: email, subject, html, text });
      }
    }

    return NextResponse.json(GENERIC);
  } catch (error) {
    console.error('Forgot password error:', error);
    // 열거 방지를 위해 오류도 동일 응답
    return NextResponse.json(GENERIC);
  }
}
