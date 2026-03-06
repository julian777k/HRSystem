import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';

async function getWorkStartTime(): Promise<string> {
  const config = await prisma.systemConfig.findUnique({
    where: { key: 'work_start_time' },
  });
  return config?.value || '09:00';
}

// 자동 근태 기록 시스템: 수동 출근은 더 이상 사용되지 않음
// 이 API는 관리자 또는 시스템 내부에서 수동 기록이 필요할 때 사용
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: '인증 필요' }, { status: 401 });
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const existing = await prisma.attendance.findUnique({
      where: {
        employeeId_date: {
          employeeId: user.id,
          date: today,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { message: '이미 오늘 출근 기록이 있습니다.' },
        { status: 400 }
      );
    }

    // 지각 판정: 회사 설정의 출근시간 기준
    const workStartTime = await getWorkStartTime();
    const [startH, startM] = workStartTime.split(':').map(Number);
    const lateThreshold = new Date(today);
    lateThreshold.setHours(startH, startM, 0, 0);
    const status = now > lateThreshold ? 'LATE' : 'NORMAL';

    const attendance = await prisma.attendance.create({
      data: {
        employeeId: user.id,
        date: today,
        clockIn: now,
        status,
      },
    });

    return NextResponse.json({ attendance }, { status: 201 });
  } catch (error) {
    console.error('Clock-in error:', error);
    return NextResponse.json(
      { message: '출근 기록 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
