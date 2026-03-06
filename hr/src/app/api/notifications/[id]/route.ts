import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: '인증 필요' }, { status: 401 });
    }

    const { id } = await params;

    const notification = await prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      return NextResponse.json(
        { message: '알림을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (notification.employeeId !== user.id) {
      return NextResponse.json(
        { message: '권한이 없습니다.' },
        { status: 403 }
      );
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Read notification error:', error);
    return NextResponse.json(
      { message: '알림 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
