import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';
import { getWorkSettings } from '@/lib/attendance-utils';
import { getTenantId } from '@/lib/tenant-context';
import { checkRateLimit } from '@/lib/rate-limit';
import { kstStartOfDay, kstTimeToday } from '@/lib/kst';

// 수동 출퇴근 모드에서 직원이 직접 출근을 기록하는 API
// 회사 설정의 attendance_mode가 MANUAL일 때 사용
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: '인증 필요' }, { status: 401 });
    }

    // Rate limit: 10 clock-in per 15 minutes per user
    const rl = await checkRateLimit(`clockin:${user.id}`, 10, 15 * 60 * 1000);
    if (!rl.success) {
      return NextResponse.json(
        { message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
        { status: 429 }
      );
    }

    const tenantId = await getTenantId();
    const now = new Date();
    // Workers는 UTC로 동작한다. KST 기준으로 날짜·임계값을 계산하지 않으면
    // KST 09:00 이전 출근이 전날 레코드로 저장되고 지각 판정이 9시간 어긋난다.
    const today = kstStartOfDay(now);

    const existing = await prisma.attendance.findUnique({
      where: {
        tenantId_employeeId_date: {
          tenantId,
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

    // 지각 판정: 근무시간 설정 기준 (개인 → 부서 → 회사)
    const settings = await getWorkSettings(user.id);
    const [startH, startM] = settings.workStartTime.split(':').map(Number);
    // setHours 는 UTC 기준이라 09:00 설정이 KST 18:00 임계값이 됐다 (지각이 거의 안 잡힘)
    const lateThreshold = kstTimeToday(startH, startM, now);
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
