import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: '인증 필요' }, { status: 401 });

    const leaveTypes = await prisma.leaveType.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json(leaveTypes);
  } catch (error) {
    console.error('Leave types error:', error);
    return NextResponse.json(
      { message: '휴가 유형 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
