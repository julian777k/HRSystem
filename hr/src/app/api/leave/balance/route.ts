import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: '인증 필요' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    let employeeId = searchParams.get('employeeId') || user.id;

    // Non-admin users can only see their own balance
    if (employeeId !== user.id && !['SYSTEM_ADMIN', 'COMPANY_ADMIN'].includes(user.role)) {
      employeeId = user.id;
    }

    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));

    const balances = await prisma.leaveBalance.findMany({
      where: { employeeId, year },
    });

    const grants = await prisma.leaveGrant.findMany({
      where: {
        employeeId,
        isExpired: false,
        periodEnd: { gte: new Date() },
      },
      orderBy: { periodEnd: 'asc' },
    });

    return NextResponse.json({ balances, grants });
  } catch (error) {
    console.error('Leave balance error:', error);
    return NextResponse.json(
      { message: '휴가 잔여일수 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
