import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-actions';
import { getCompensationPolicy } from '@/lib/time-wallet';
import { prisma } from '@/lib/prisma';

const ADMIN_ROLES = ['SYSTEM_ADMIN', 'COMPANY_ADMIN'];

/**
 * GET /api/compensation-policy - 보상 정책 조회
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: '인증 필요' }, { status: 401 });
    }

    const policy = await getCompensationPolicy();
    return NextResponse.json(policy);
  } catch (error) {
    console.error('Compensation policy GET error:', error);
    return NextResponse.json(
      { message: '보상 정책 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/compensation-policy - 보상 정책 수정 (관리자 전용)
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: '인증 필요' }, { status: 401 });
    }
    if (!ADMIN_ROLES.includes(user.role)) {
      return NextResponse.json({ message: '권한이 없습니다.' }, { status: 403 });
    }

    const body = await request.json();
    const {
      compensationType,
      weekdayMultiplier,
      nightMultiplier,
      holidayMultiplier,
      dailyWorkHours,
      halfDayHours,
      minUseUnit,
      deductionOrder,
      autoSplitDeduct,
    } = body;

    const current = await getCompensationPolicy();

    const updated = await prisma.compensationPolicy.update({
      where: { id: current.id },
      data: {
        ...(compensationType !== undefined && { compensationType }),
        ...(weekdayMultiplier !== undefined && { weekdayMultiplier: parseFloat(String(weekdayMultiplier)) }),
        ...(nightMultiplier !== undefined && { nightMultiplier: parseFloat(String(nightMultiplier)) }),
        ...(holidayMultiplier !== undefined && { holidayMultiplier: parseFloat(String(holidayMultiplier)) }),
        ...(dailyWorkHours !== undefined && { dailyWorkHours: parseFloat(String(dailyWorkHours)) }),
        ...(halfDayHours !== undefined && { halfDayHours: parseFloat(String(halfDayHours)) }),
        ...(minUseUnit !== undefined && { minUseUnit: parseFloat(String(minUseUnit)) }),
        ...(deductionOrder !== undefined && { deductionOrder }),
        ...(autoSplitDeduct !== undefined && { autoSplitDeduct }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Compensation policy PUT error:', error);
    return NextResponse.json(
      { message: '보상 정책 수정 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
