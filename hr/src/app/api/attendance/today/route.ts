import { NextResponse } from 'next/server';
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
    lunchStartTime: settings['lunch_start_time'] || '12:00',
    lunchEndTime: settings['lunch_end_time'] || '13:00',
  };
}

async function getDailyWorkHours(): Promise<number> {
  const policy = await prisma.compensationPolicy.findFirst({
    where: { isActive: true },
  });
  return policy?.dailyWorkHours ?? 8;
}

async function isHoliday(date: Date): Promise<boolean> {
  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

  const holiday = await prisma.holiday.findFirst({
    where: {
      date: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
  });
  return !!holiday;
}

function isWeekday(date: Date): boolean {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

function buildDateTime(date: Date, timeStr: string): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setHours(hours, minutes, 0, 0);
  return result;
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: '인증 필요' }, { status: 401 });
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Fetch company settings
    const workSettings = await getCompanyWorkSettings();
    const dailyWorkHours = await getDailyWorkHours();

    // Check existing attendance record
    let attendance = await prisma.attendance.findUnique({
      where: {
        employeeId_date: {
          employeeId: user.id,
          date: today,
        },
      },
    });

    // Auto-create for weekdays (not holidays) if no record exists
    if (!attendance && isWeekday(today) && !(await isHoliday(today))) {
      const clockIn = buildDateTime(today, workSettings.workStartTime);
      const clockOut = buildDateTime(today, workSettings.workEndTime);

      attendance = await prisma.attendance.create({
        data: {
          employeeId: user.id,
          date: today,
          clockIn,
          clockOut,
          workHours: dailyWorkHours,
          overtimeHours: 0,
          status: 'NORMAL',
        },
      });
    }

    // Check approved overtime for today
    let approvedOvertime = null;
    if (attendance) {
      const overtimeRequests = await prisma.overtimeRequest.findMany({
        where: {
          employeeId: user.id,
          date: {
            gte: today,
            lte: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999),
          },
          status: 'APPROVED',
        },
      });

      if (overtimeRequests.length > 0) {
        const totalOvertimeHours = overtimeRequests.reduce((sum, ot) => sum + ot.hours, 0);
        approvedOvertime = {
          totalHours: totalOvertimeHours,
          requests: overtimeRequests,
        };

        // Update attendance with overtime hours if different
        if (attendance.overtimeHours !== totalOvertimeHours) {
          attendance = await prisma.attendance.update({
            where: { id: attendance.id },
            data: { overtimeHours: totalOvertimeHours },
          });
        }
      }
    }

    return NextResponse.json({
      attendance: attendance || null,
      workSettings,
      dailyWorkHours,
      approvedOvertime,
      isWorkday: isWeekday(today) && !(await isHoliday(today)),
    });
  } catch (error) {
    console.error('Today attendance error:', error);
    return NextResponse.json(
      { message: '오늘 근태 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
