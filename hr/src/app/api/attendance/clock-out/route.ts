import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';
import { getWorkSettings, getDailyWorkHours } from '@/lib/attendance-utils';
import { getTenantId } from '@/lib/tenant-context';
import { checkRateLimit } from '@/lib/rate-limit';

// 수동 출퇴근 모드에서 직원이 직접 퇴근을 기록하는 API
// 회사 설정의 attendance_mode가 MANUAL일 때 사용
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: '인증 필요' }, { status: 401 });
    }

    // Rate limit: 10 clock-out per 15 minutes per user
    const rl = await checkRateLimit(`clockout:${user.id}`, 10, 15 * 60 * 1000);
    if (!rl.success) {
      return NextResponse.json(
        { message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
        { status: 429 }
      );
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
    const rawHours = (clockOutTime - clockInTime) / (1000 * 60 * 60);
    // Prevent negative or absurdly large work hours
    const workHours = parseFloat(Math.max(0, Math.min(rawHours, 24)).toFixed(2));

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

    const updateResult = await (prisma as any).$executeRaw(
      `UPDATE attendances SET "clockOut" = ?, "workHours" = ?, "overtimeHours" = ?, status = ?, "updatedAt" = ? WHERE id = ? AND "clockOut" IS NULL`,
      now.toISOString(), workHours, overtimeHours, status, new Date().toISOString(), attendance.id
    );
    if (updateResult === 0) {
      return NextResponse.json({ message: '이미 퇴근 처리되었습니다.' }, { status: 409 });
    }

    const updated = await prisma.attendance.findUnique({ where: { id: attendance.id } });

    return NextResponse.json({ attendance: updated });
  } catch (error) {
    console.error('Clock-out error:', error);
    return NextResponse.json(
      { message: '퇴근 기록 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
