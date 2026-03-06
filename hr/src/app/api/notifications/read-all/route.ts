import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';

export async function PUT() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: '인증 필요' }, { status: 401 });
    }

    await prisma.notification.updateMany({
      where: { employeeId: user.id, isRead: false },
      data: { isRead: true },
    });

    return NextResponse.json({ message: '모든 알림을 읽음 처리했습니다.' });
  } catch (error) {
    console.error('Read all notifications error:', error);
    return NextResponse.json(
      { message: '알림 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
