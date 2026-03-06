import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';

async function getCompanyWorkSettings() {
  const configs = await prisma.systemConfig.findMany({
    where: { group: 'company' },
  });
  const settings: Record<string, string> = {};
  for (const cfg of configs) {
    settings[cfg.key] = cfg.value;
  }
  return {
    workStartTime: settings['work_start_time'] || '09:00',
    workEndTime: settings['work_end_time'] || '18:00',
  };
}

async function getDailyWorkHours(): Promise<number> {
  const policy = await prisma.compensationPolicy.findFirst({
    where: { isActive: true },
  });
  return policy?.dailyWorkHours ?? 8;
}

async function getHolidaysInRange(start: Date, end: Date): Promise<Set<string>> {
  const holidays = await prisma.holiday.findMany({
    where: {
      date: { gte: start, lte: end },
    },
  });
  const set = new Set<string>();
  for (const h of holidays) {
    const d = new Date(h.date);
    set.add(dateKey(d));
  }
  return set;
}

function isWeekday(date: Date): boolean {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: '인증 필요' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()), 10);
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1), 10);

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const attendances = await prisma.attendance.findMany({
      where: {
        employeeId: user.id,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // 자동 근태: DB에 없는 근무일도 기본 근무시간으로 카운트
    const dailyWorkHours = await getDailyWorkHours();
    const holidays = await getHolidaysInRange(startDate, endDate);

    const existingDates = new Set<string>();
    for (const att of attendances) {
      existingDates.add(dateKey(new Date(att.date)));
    }

    // 미래 날짜는 제외, 오늘까지만
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const endBound = new Date(Math.min(endDate.getTime(), today.getTime()));

    let virtualWorkDays = 0;
    let virtualWorkHours = 0;
    const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    while (cursor <= endBound) {
      const key = dateKey(cursor);
      if (isWeekday(cursor) && !holidays.has(key) && !existingDates.has(key)) {
        virtualWorkDays++;
        virtualWorkHours += dailyWorkHours;
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    const totalWorkDays = attendances.length + virtualWorkDays;
    const totalWorkHours = attendances.reduce((sum, a) => sum + (a.workHours || 0), 0) + virtualWorkHours;
    const totalOvertimeHours = attendances.reduce((sum, a) => sum + (a.overtimeHours || 0), 0);
    const lateCount = attendances.filter(a => a.status === 'LATE').length;
    const earlyLeaveCount = attendances.filter(a => a.status === 'EARLY_LEAVE').length;
    const absentCount = attendances.filter(a => a.status === 'ABSENT').length;

    return NextResponse.json({
      year,
      month,
      summary: {
        totalWorkDays,
        totalWorkHours: parseFloat(totalWorkHours.toFixed(2)),
        totalOvertimeHours: parseFloat(totalOvertimeHours.toFixed(2)),
        lateCount,
        earlyLeaveCount,
        absentCount,
      },
    });
  } catch (error) {
    console.error('Attendance summary error:', error);
    return NextResponse.json(
      { message: '근태 요약 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
