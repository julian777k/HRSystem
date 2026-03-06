import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: '인증 필요' }, { status: 401 });
    }

    const requests = await prisma.overtimeRequest.findMany({
      where: { employeeId: user.id },
      include: {
        approvals: {
          include: {
            approver: {
              select: { id: true, name: true },
            },
          },
          orderBy: { stepOrder: 'asc' },
        },
      },
      orderBy: { date: 'desc' },
    });

    return NextResponse.json({ requests });
  } catch (error) {
    console.error('My overtime requests error:', error);
    return NextResponse.json(
      { message: '내 시간외근무 신청 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
