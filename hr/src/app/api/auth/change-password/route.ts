import { NextRequest, NextResponse } from 'next/server';
import bcryptjs from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: '인증 필요' }, { status: 401 });
    }

    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { message: '현재 비밀번호와 새 비밀번호를 입력해주세요.' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { message: '새 비밀번호는 6자 이상이어야 합니다.' },
        { status: 400 }
      );
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

    const isValid = await bcryptjs.compare(currentPassword, employee.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { message: '현재 비밀번호가 올바르지 않습니다.' },
        { status: 400 }
      );
    }

    const passwordHash = await bcryptjs.hash(newPassword, 10);

    await prisma.employee.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    // Invalidate all sessions for this user
    await prisma.session.deleteMany({
      where: { employeeId: user.id },
    });

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
