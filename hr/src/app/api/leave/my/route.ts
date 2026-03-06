import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';
import { getWalletBalance } from '@/lib/time-wallet';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: '인증 필요' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));

    const [balances, requests] = await Promise.all([
      prisma.leaveBalance.findMany({
        where: { employeeId: user.id, year },
      }),
      prisma.leaveRequest.findMany({
        where: { employeeId: user.id },
        include: { leaveType: true },
        orderBy: { appliedAt: 'desc' },
      }),
    ]);

    // Summary (전체 합산)
    const totalGranted = balances.reduce((sum, b) => sum + b.totalGranted, 0);
    const totalUsed = balances.reduce((sum, b) => sum + b.totalUsed, 0);
    const totalRemain = balances.reduce((sum, b) => sum + b.totalRemain, 0);
    const usageRate = totalGranted > 0 ? Math.round((totalUsed / totalGranted) * 100) : 0;

    // 유형별 잔여 정보
    const balancesByType = balances.map((b) => ({
      leaveTypeCode: b.leaveTypeCode,
      totalGranted: b.totalGranted,
      totalUsed: b.totalUsed,
      totalRemain: b.totalRemain,
    }));

    // Time wallet balance (시간 지갑 잔액)
    const timeWallet = await getWalletBalance(user.id, year);

    return NextResponse.json({
      summary: { totalGranted, totalUsed, totalRemain, usageRate },
      timeWallet,
      balances,
      balancesByType,
      requests: requests.map((r) => ({
        id: r.id,
        leaveTypeName: r.leaveType.name,
        leaveTypeCode: r.leaveType.code,
        startDate: r.startDate,
        endDate: r.endDate,
        useUnit: r.useUnit,
        requestDays: r.requestDays,
        reason: r.reason,
        status: r.status,
        appliedAt: r.appliedAt,
        cancelReason: r.cancelReason,
      })),
    });
  } catch (error) {
    console.error('Leave my error:', error);
    return NextResponse.json(
      { message: '내 휴가 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
