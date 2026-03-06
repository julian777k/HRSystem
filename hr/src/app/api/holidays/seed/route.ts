import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';

interface HolidayEntry {
  name: string;
  date: string; // YYYY-MM-DD
}

function getKoreanHolidays(year: number): HolidayEntry[] {
  const fixed: HolidayEntry[] = [
    { name: '신정', date: `${year}-01-01` },
    { name: '삼일절', date: `${year}-03-01` },
    { name: '어린이날', date: `${year}-05-05` },
    { name: '현충일', date: `${year}-06-06` },
    { name: '광복절', date: `${year}-08-15` },
    { name: '개천절', date: `${year}-10-03` },
    { name: '한글날', date: `${year}-10-09` },
    { name: '성탄절', date: `${year}-12-25` },
  ];

  // Lunar-based holidays + substitute holidays (pre-calculated)
  const lunarHolidays: Record<number, HolidayEntry[]> = {
    2025: [
      { name: '설날 연휴', date: '2025-01-28' },
      { name: '설날', date: '2025-01-29' },
      { name: '설날 연휴', date: '2025-01-30' },
      { name: '부처님오신날', date: '2025-05-05' },
      { name: '대체공휴일(삼일절)', date: '2025-03-03' },
      { name: '추석 연휴', date: '2025-10-05' },
      { name: '추석', date: '2025-10-06' },
      { name: '추석 연휴', date: '2025-10-07' },
      { name: '대체공휴일(추석)', date: '2025-10-08' },
    ],
    2026: [
      { name: '설날 연휴', date: '2026-02-16' },
      { name: '설날', date: '2026-02-17' },
      { name: '설날 연휴', date: '2026-02-18' },
      { name: '대체공휴일(삼일절)', date: '2026-03-02' },
      { name: '부처님오신날', date: '2026-05-24' },
      { name: '대체공휴일(부처님오신날)', date: '2026-05-25' },
      { name: '대체공휴일(광복절)', date: '2026-08-17' },
      { name: '추석 연휴', date: '2026-09-24' },
      { name: '추석', date: '2026-09-25' },
      { name: '추석 연휴', date: '2026-09-26' },
      { name: '대체공휴일(개천절)', date: '2026-10-05' },
    ],
    2027: [
      { name: '설날 연휴', date: '2027-02-05' },
      { name: '설날', date: '2027-02-06' },
      { name: '설날 연휴', date: '2027-02-07' },
      { name: '대체공휴일(설날)', date: '2027-02-08' },
      { name: '부처님오신날', date: '2027-05-13' },
      { name: '추석 연휴', date: '2027-09-14' },
      { name: '추석', date: '2027-09-15' },
      { name: '추석 연휴', date: '2027-09-16' },
    ],
  };

  const lunar = lunarHolidays[year] || [];
  return [...fixed, ...lunar];
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: '인증 필요' }, { status: 401 });

    if (!['SYSTEM_ADMIN', 'COMPANY_ADMIN'].includes(user.role)) {
      return NextResponse.json({ message: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const body = await request.json();
    const year = body.year || new Date().getFullYear();

    const holidays = getKoreanHolidays(year);

    let created = 0;
    let skipped = 0;

    for (const h of holidays) {
      const dateObj = new Date(h.date);
      // Check if already exists for this date
      const existing = await prisma.holiday.findFirst({
        where: {
          date: dateObj,
          name: h.name,
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await prisma.holiday.create({
        data: {
          name: h.name,
          date: dateObj,
          isRecurring: false,
        },
      });
      created++;
    }

    return NextResponse.json({
      message: `${year}년 법정공휴일이 생성되었습니다.`,
      created,
      skipped,
      total: holidays.length,
    });
  } catch (error) {
    console.error('Holiday seed error:', error);
    return NextResponse.json(
      { message: '공휴일 자동생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
