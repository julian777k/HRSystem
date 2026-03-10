import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';
import { getWorkSettings, getDailyWorkHours } from '@/lib/attendance-utils';
import { getTenantId } from '@/lib/tenant-context';

// 자동 근태 기록 시스템: 수동 퇴근은 더 이상 사용되지 않음
// 이 API는 관리자 또는 시스템 내부에서 수동 기록이 필요할 때 사용
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: '인증 필요' }, { status: 401 });
    }

    const tenantId = await getTenantId();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const attendance = await prisma.attendance.findUnique({
      where: {
        tenantId_employeeId_date: {
          tenantId,
          employeeId: user.id,
          date: today,
        },
      },
    });

    if (!attendance) {
      return NextResponse.json(
        { message: '오늘 출근 기록이 없습니다.' },
        { status: 400 }
      );
    }

    if (attendance.clockOut) {
      return NextResponse.json(
        { message: '이미 퇴근 기록이 있습니다.' },
        { status: 400 }
      );
    }

    if (!attendance.clockIn) {
      return NextResponse.json(
        { message: '출근 기록이 없습니다.' },
        { status: 400 }
      );
    }

    const clockInTime = new Date(attendance.clockIn).getTime();
    const clockOutTime = now.getTime();
    const workHours = parseFloat(((clockOutTime - clockInTime) / (1000 * 60 * 60)).toFixed(2));

    // 연장근무 판정: CompensationPolicy의 dailyWorkHours 기준
    const standardHours = await getDailyWorkHours();
    const overtimeHours = workHours > standardHours
      ? parseFloat((workHours - standardHours).toFixed(2))
      : 0;

    // 조퇴 판정: 근무시간 설정 기준 (개인 → 부서 → 회사)
    const settings = await getWorkSettings(user.id);
    const [endH, endM] = settings.workEndTime.split(':').map(Number);
    const earlyLeaveThreshold = new Date(today);
    earlyLeaveThreshold.setHours(endH, endM, 0, 0);

    let status = attendance.status;
    if (now < earlyLeaveThreshold && status === 'NORMAL') {
      status = 'EARLY_LEAVE';
    }

    const updated = await prisma.attendance.update({
      where: { id: attendance.id },
      data: {
        clockOut: now,
        workHours,
        overtimeHours,
        status,
      },
    });

    return NextResponse.json({ attendance: updated });
  } catch (error) {
    console.error('Clock-out error:', error);
    return NextResponse.json(
      { message: '퇴근 기록 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
