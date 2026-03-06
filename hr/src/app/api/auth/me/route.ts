import { NextResponse } from 'next/server';
import { getCurrentUser, clearAuthCookie } from '@/lib/auth-actions';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { message: '인증되지 않았습니다.' },
        { status: 401 }
      );
    }

    // Verify employee still exists in DB (handles DB re-seed case)
    const employee = await prisma.employee.findUnique({
      where: { id: user.id },
      select: { id: true, customPermissions: true },
    });

    if (!employee) {
      await clearAuthCookie();
      return NextResponse.json(
        { message: '세션이 만료되었습니다. 다시 로그인해주세요.' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      user: {
        ...user,
        customPermissions: employee.customPermissions || null,
      },
    });
  } catch (error) {
    console.error('Auth me error:', error);
    return NextResponse.json(
      { message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
