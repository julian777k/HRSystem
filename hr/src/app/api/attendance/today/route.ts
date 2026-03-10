import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';
import { getWorkSettings, getDailyWorkHours, isWorkday, buildDateTime } from '@/lib/attendance-utils';
import { getTenantId } from '@/lib/tenant-context';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: '인증 필요' }, { status: 401 });
    }

    const tenantId = await getTenantId();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Fetch work settings (Employee → Department → Company priority)
    const workSettings = await getWorkSettings(user.id);
    const dailyWorkHours = await getDailyWorkHours();

    // Check existing attendance record
    let attendance = await prisma.attendance.findUnique({
      where: {
        tenantId_employeeId_date: {
          tenantId,
          employeeId: user.id,
          date: today,
        },
      },
    });

    // Auto-create for workdays if no record exists
    if (!attendance && await isWorkday(today, user.departmentId)) {
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
      isWorkday: await isWorkday(today, user.departmentId),
    });
  } catch (error) {
    console.error('Today attendance error:', error);
    return NextResponse.json(
      { message: '오늘 근태 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
