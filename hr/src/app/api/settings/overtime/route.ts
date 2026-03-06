import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: '인증 필요' }, { status: 401 });
    }

    if (!['SYSTEM_ADMIN', 'COMPANY_ADMIN'].includes(user.role)) {
      return NextResponse.json({ message: '권한이 없습니다.' }, { status: 403 });
    }

    let policy = await prisma.overtimePolicy.findFirst({
      where: { isActive: true },
    });

    if (!policy) {
      // Create default policy
      policy = await prisma.overtimePolicy.create({
        data: {
          maxWeeklyHours: 12,
          maxMonthlyHours: 52,
          nightStartTime: '22:00',
          nightEndTime: '06:00',
          weekdayRate: 1.5,
          weekendRate: 1.5,
          nightRate: 2.0,
        },
      });
    }

    return NextResponse.json({ policy });
  } catch (error) {
    console.error('Overtime policy get error:', error);
    return NextResponse.json(
      { message: '시간외근무 정책 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: '인증 필요' }, { status: 401 });
    }

    if (!['SYSTEM_ADMIN', 'COMPANY_ADMIN'].includes(user.role)) {
      return NextResponse.json({ message: '권한이 없습니다.' }, { status: 403 });
    }

    const body = await request.json();
    const {
      maxWeeklyHours,
      maxMonthlyHours,
      nightStartTime,
      nightEndTime,
      weekdayRate,
      weekendRate,
      nightRate,
    } = body;

    let policy = await prisma.overtimePolicy.findFirst({
      where: { isActive: true },
    });

    if (policy) {
      policy = await prisma.overtimePolicy.update({
        where: { id: policy.id },
        data: {
          ...(maxWeeklyHours !== undefined && { maxWeeklyHours }),
          ...(maxMonthlyHours !== undefined && { maxMonthlyHours }),
          ...(nightStartTime !== undefined && { nightStartTime }),
          ...(nightEndTime !== undefined && { nightEndTime }),
          ...(weekdayRate !== undefined && { weekdayRate }),
          ...(weekendRate !== undefined && { weekendRate }),
          ...(nightRate !== undefined && { nightRate }),
        },
      });
    } else {
      policy = await prisma.overtimePolicy.create({
        data: {
          maxWeeklyHours: maxWeeklyHours ?? 12,
          maxMonthlyHours: maxMonthlyHours ?? 52,
          nightStartTime: nightStartTime ?? '22:00',
          nightEndTime: nightEndTime ?? '06:00',
          weekdayRate: weekdayRate ?? 1.5,
          weekendRate: weekendRate ?? 1.5,
          nightRate: nightRate ?? 2.0,
        },
      });
    }

    return NextResponse.json({ policy });
  } catch (error) {
    console.error('Overtime policy update error:', error);
    return NextResponse.json(
      { message: '시간외근무 정책 수정 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
