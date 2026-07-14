import { NextRequest, NextResponse } from 'next/server';
import { hashPassword, validatePasswordPolicy } from '@/lib/password';
import { prisma } from '@/lib/prisma';
import { clearAuthCookie } from '@/lib/auth-actions';
import { checkRateLimit } from '@/lib/rate-limit';
import { updateStmt, deleteStmt } from '@/lib/d1-client';
import { isSaaSMode } from '@/lib/deploy-config';

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json();

    // Rate limit: 5 attempts per token per 15 minutes
    if (token) {
      const rl = await checkRateLimit(`reset:${token}`, 5, 15 * 60 * 1000);
      if (!rl.success) {
        return NextResponse.json(
          { message: '비밀번호 재설정 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.' },
          { status: 429 }
        );
      }
    }

    if (!token || !password) {
      return NextResponse.json(
        { message: '토큰과 새 비밀번호를 입력해주세요.' },
        { status: 400 }
      );
    }

    const pwError = validatePasswordPolicy(password);
    if (pwError) {
      return NextResponse.json({ message: pwError }, { status: 400 });
    }

    const resetRecord = await prisma.passwordReset.findUnique({
      where: { token },
    });

    const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

    if (!resetRecord) {
      console.warn(`[Auth] Password reset: invalid token — ip=${ip}`);
      return NextResponse.json(
        { message: '유효하지 않은 토큰입니다.' },
        { status: 400 }
      );
    }

    if (resetRecord.usedAt) {
      console.warn(`[Auth] Password reset: already used token — email=${resetRecord.email}, ip=${ip}`);
      return NextResponse.json(
        { message: '이미 사용된 토큰입니다.' },
        { status: 400 }
      );
    }

    if (resetRecord.expiresAt < new Date()) {
      console.warn(`[Auth] Password reset: expired token — email=${resetRecord.email}, ip=${ip}`);
      return NextResponse.json(
        { message: '만료된 토큰입니다. 비밀번호 재설정을 다시 요청해주세요.' },
        { status: 400 }
      );
    }

    const employee = await prisma.employee.findFirst({
      where: { email: resetRecord.email, tenantId: resetRecord.tenantId },
    });

    if (!employee) {
      console.warn(`[Auth] Password reset: user not found — email=${resetRecord.email}, ip=${ip}`);
      return NextResponse.json(
        { message: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const passwordHash = await hashPassword(password);
    const now = new Date().toISOString();

    // 비밀번호 변경 + 리셋토큰 소진 + 세션 전체 삭제는 하나로 묶여야 한다.
    // (예: 비번만 바뀌고 토큰이 안 소진되면 같은 링크로 재변경 가능)
    if (isSaaSMode()) {
      // 프로덕션(D1): $batch로 원자 실행. 하나라도 실패하면 전체 롤백된다.
      // raw statement라 tenantId 자동 주입을 안 받으므로 where에 직접 명시한다.
      await (prisma as unknown as {
        $batch: (s: unknown[]) => Promise<unknown>;
      }).$batch([
        updateStmt('employee', { id: employee.id, tenantId: employee.tenantId }, { passwordHash, updatedAt: now }),
        updateStmt('passwordReset', { id: resetRecord.id }, { usedAt: now }),
        deleteStmt('session', { employeeId: employee.id }),
      ]);
    } else {
      // 로컬(진짜 Prisma): 배열형 $transaction이 이미 원자적이다.
      await prisma.$transaction([
        prisma.employee.update({ where: { id: employee.id }, data: { passwordHash } }),
        prisma.passwordReset.update({ where: { id: resetRecord.id }, data: { usedAt: new Date() } }),
        prisma.session.deleteMany({ where: { employeeId: employee.id } }),
      ]);
    }

    // Clear current session cookie so any logged-in browser must re-login
    await clearAuthCookie();

    return NextResponse.json({
      message: '비밀번호가 성공적으로 변경되었습니다. 새 비밀번호로 로그인해주세요.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
