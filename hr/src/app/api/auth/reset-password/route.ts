import { NextRequest, NextResponse } from 'next/server';
import { hashPassword, validatePasswordPolicy } from '@/lib/password';
import { prisma } from '@/lib/prisma';
import { clearAuthCookie } from '@/lib/auth-actions';
import { checkRateLimit } from '@/lib/rate-limit';

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

    await prisma.$transaction([
      prisma.employee.update({
        where: { id: employee.id },
        data: { passwordHash },
      }),
      prisma.passwordReset.update({
        where: { id: resetRecord.id },
        data: { usedAt: new Date() },
      }),
      prisma.session.deleteMany({
        where: { employeeId: employee.id },
      }),
    ]);

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
