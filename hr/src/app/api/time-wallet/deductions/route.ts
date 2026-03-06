import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';

/**
 * GET /api/time-wallet/deductions - 차감/적립 이력 조회
 * query: ?year=2026&employeeId=xxx&limit=20
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: '인증 필요' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));
    const limit = parseInt(searchParams.get('limit') || '30');
    let employeeId = user.id;

    const requestedId = searchParams.get('employeeId');
    if (requestedId) {
      if (!['SYSTEM_ADMIN', 'COMPANY_ADMIN'].includes(user.role)) {
        return NextResponse.json({ message: '권한이 없습니다.' }, { status: 403 });
      }
      employeeId = requestedId;
    }

    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year + 1, 0, 1);

    // 차감 이력
    const deductions = await prisma.timeDeduction.findMany({
      where: {
        employeeId,
        createdAt: { gte: startOfYear, lt: endOfYear },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // 적립 이력
    const accruals = await prisma.compTimeAccrual.findMany({
      where: {
        employeeId,
        createdAt: { gte: startOfYear, lt: endOfYear },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // 통합 타임라인
    const timeline = [
      ...deductions.map((d) => ({
        id: d.id,
        type: 'DEDUCTION' as const,
        walletType: d.walletType,
        hours: -d.hours,
        description: d.description,
        createdAt: d.createdAt,
      })),
      ...accruals.map((a) => ({
        id: a.id,
        type: 'ACCRUAL' as const,
        walletType: 'COMP_TIME' as const,
        hours: a.earnedHours,
        description: `연장근무 ${a.overtimeHours}h × ${a.multiplier}배 = +${a.earnedHours}h 적립`,
        createdAt: a.createdAt,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ timeline: timeline.slice(0, limit) });
  } catch (error) {
    console.error('Time wallet deductions error:', error);
    return NextResponse.json(
      { message: '이력 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
