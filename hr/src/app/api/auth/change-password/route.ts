import { NextRequest, NextResponse } from 'next/server';
import { hashPassword, verifyPassword, validatePasswordPolicy } from '@/lib/password';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, clearAuthCookie } from '@/lib/auth-actions';
import { checkRateLimit } from '@/lib/rate-limit';
import { writeAuditLog } from '@/lib/audit-log';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: '인증 필요' }, { status: 401 });
    }

    // Rate limit: 5 attempts per user per 15 minutes
    const rateResult = await checkRateLimit(`change-password:${user.id}`, 5, 900_000);
    if (!rateResult.success) {
      return NextResponse.json(
        { message: `비밀번호 변경 시도가 너무 많습니다. ${Math.ceil((rateResult.retryAfterMs || 0) / 1000)}초 후 다시 시도해주세요.` },
        { status: 429 }
      );
    }

    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { message: '현재 비밀번호와 새 비밀번호를 입력해주세요.' },
        { status: 400 }
      );
    }

    const pwError = validatePasswordPolicy(newPassword);
    if (pwError) {
      return NextResponse.json({ message: pwError }, { status: 400 });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: user.id },
    });

    if (!employee) {
      return NextResponse.json(
        { message: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const isValid = await verifyPassword(currentPassword, employee.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { message: '현재 비밀번호가 올바르지 않습니다.' },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(newPassword);

    await prisma.employee.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    // Invalidate all sessions for this user
    await prisma.session.deleteMany({
      where: { employeeId: user.id },
    });

    writeAuditLog({ action: 'CHANGE_PASSWORD', target: 'employee', targetId: user.id });

    // Clear current session cookie so user must re-login
    await clearAuthCookie();

    return NextResponse.json({
      message: '비밀번호가 성공적으로 변경되었습니다. 다시 로그인해주세요.',
    });
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json(
      { message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
