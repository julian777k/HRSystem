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
      date: {
        gte: start,
        lte: end,
      },
    },
  });
  const set = new Set<string>();
  for (const h of holidays) {
    const d = new Date(h.date);
    set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
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

function buildDateTime(date: Date, timeStr: string): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setHours(hours, minutes, 0, 0);
  return result;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: '인증 필요' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: Record<string, unknown> = { employeeId: user.id };

    let rangeStart: Date | null = null;
    let rangeEnd: Date | null = null;

    if (startDate || endDate) {
      const dateFilter: Record<string, Date> = {};
      if (startDate) {
        rangeStart = new Date(startDate);
        dateFilter.gte = rangeStart;
      }
      if (endDate) {
        rangeEnd = new Date(endDate);
        rangeEnd.setHours(23, 59, 59, 999);
        dateFilter.lte = rangeEnd;
      }
      where.date = dateFilter;
    }

    const attendances = await prisma.attendance.findMany({
      where,
      orderBy: { date: 'asc' },
    });

    // If date range is specified, fill in missing workdays with virtual records
    if (rangeStart && rangeEnd) {
      const workSettings = await getCompanyWorkSettings();
      const dailyWorkHours = await getDailyWorkHours();
      const holidays = await getHolidaysInRange(rangeStart, rangeEnd);

      // Build a set of dates that already have records
      const existingDates = new Set<string>();
      for (const att of attendances) {
        const d = new Date(att.date);
        existingDates.add(dateKey(d));
      }

      // Generate virtual records for missing workdays (only past and today)
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      const virtualRecords: typeof attendances = [];

      const cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate());
      const endBound = new Date(Math.min(rangeEnd.getTime(), today.getTime()));

      while (cursor <= endBound) {
        const key = dateKey(cursor);
        if (isWeekday(cursor) && !holidays.has(key) && !existingDates.has(key)) {
          const clockIn = buildDateTime(cursor, workSettings.workStartTime);
          const clockOut = buildDateTime(cursor, workSettings.workEndTime);
          virtualRecords.push({
            id: `virtual-${key}`,
            employeeId: user.id,
            date: new Date(cursor),
            clockIn,
            clockOut,
            workHours: dailyWorkHours,
            overtimeHours: 0,
            status: 'NORMAL',
            note: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as typeof attendances[0]);
        }
        cursor.setDate(cursor.getDate() + 1);
      }

      // Merge and sort
      const merged = [...attendances, ...virtualRecords].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      return NextResponse.json({ attendances: merged });
    }

    return NextResponse.json({ attendances });
  } catch (error) {
    console.error('My attendance error:', error);
    return NextResponse.json(
      { message: '근태 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
