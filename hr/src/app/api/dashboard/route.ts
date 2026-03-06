import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';
import { getWalletBalance } from '@/lib/time-wallet';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: '인증 필요' }, { status: 401 });
    }

    const currentYear = new Date().getFullYear();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // 1. Leave balance (remaining annual leave)
    const leaveBalances = await prisma.leaveBalance.findMany({
      where: {
        employeeId: user.id,
        year: currentYear,
      },
    });

    const totalRemain = leaveBalances.reduce(
      (sum, b) => sum + b.totalRemain,
      0
    );

    // 유형별 잔여 정보
    const leaveBalancesByType: Record<string, { granted: number; used: number; remain: number }> = {};
    for (const b of leaveBalances) {
      leaveBalancesByType[b.leaveTypeCode] = {
        granted: b.totalGranted,
        used: b.totalUsed,
        remain: b.totalRemain,
      };
    }

    // 2. Pending approvals count (approvals where current user is approver and action is PENDING)
    const pendingApprovals = await prisma.approval.count({
      where: {
        approverId: user.id,
        action: 'PENDING',
      },
    });

    // 2b. Pending welfare requests (admin only)
    const isAdmin = ['SYSTEM_ADMIN', 'COMPANY_ADMIN'].includes(user.role);

    let pendingWelfareCount = 0;
    let pendingWelfareItems: any[] = [];

    if (isAdmin) {
      pendingWelfareCount = await prisma.welfareRequest.count({
        where: { status: 'PENDING' },
      });

      pendingWelfareItems = await prisma.welfareRequest.findMany({
        where: { status: 'PENDING' },
        include: {
          employee: { select: { name: true, employeeNumber: true } },
          item: { select: { name: true, category: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });
    }

    // 3. Department headcount
    const deptMembers = await prisma.employee.count({
      where: {
        departmentId: user.departmentId,
        status: 'ACTIVE',
      },
    });

    // 4. Monthly overtime hours
    const overtimeRequests = await prisma.overtimeRequest.findMany({
      where: {
        employeeId: user.id,
        date: { gte: monthStart, lte: monthEnd },
        status: 'APPROVED',
      },
    });

    const monthlyOvertime = overtimeRequests.reduce(
      (sum, o) => sum + o.hours,
      0
    );

    // 5. Recent leave requests (last 5 by current user)
    const recentLeaves = await prisma.leaveRequest.findMany({
      where: { employeeId: user.id },
      include: {
        leaveType: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // 6. Pending approval items for the user to process
    const pendingItems = await prisma.approval.findMany({
      where: {
        approverId: user.id,
        action: 'PENDING',
      },
      include: {
        leaveRequest: {
          include: {
            employee: { select: { name: true, employeeNumber: true } },
            leaveType: { select: { name: true } },
          },
        },
        overtime: {
          include: {
            employee: { select: { name: true, employeeNumber: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // 7. Time wallet balance (시간 지갑 잔액)
    const timeWallet = await getWalletBalance(user.id, currentYear);

    // 8. Today's attendance (auto-record system compatible)
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayOfWeek = today.getDay(); // 0=Sun, 6=Sat
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

    // Check if today is a holiday
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);
    const isHoliday = await prisma.holiday.count({
      where: { date: { gte: today, lte: todayEnd } },
    }) > 0;

    const isWorkday = isWeekday && !isHoliday;

    let todayAttendance: any;
    if (!isWorkday) {
      todayAttendance = { clockIn: null, clockOut: null, workHours: null, status: 'DAY_OFF', isWorkday: false };
    } else {
      // Auto-create attendance if not exists (same logic as /api/attendance/today)
      let attendance = await prisma.attendance.findUnique({
        where: { employeeId_date: { employeeId: user.id, date: today } },
      });

      if (!attendance) {
        // Get work settings
        const configs = await prisma.systemConfig.findMany({
          where: { key: { in: ['work_start_time', 'work_end_time'] } },
        });
        const configMap = new Map(configs.map(c => [c.key, c.value]));
        const workStart = configMap.get('work_start_time') || '09:00';
        const workEnd = configMap.get('work_end_time') || '18:00';

        const policy = await prisma.compensationPolicy.findFirst({ where: { isActive: true } });
        const dailyHours = policy?.dailyWorkHours ?? 8;

        const [sh, sm] = workStart.split(':').map(Number);
        const [eh, em] = workEnd.split(':').map(Number);
        const clockIn = new Date(today); clockIn.setHours(sh, sm, 0, 0);
        const clockOut = new Date(today); clockOut.setHours(eh, em, 0, 0);

        attendance = await prisma.attendance.create({
          data: { employeeId: user.id, date: today, clockIn, clockOut, workHours: dailyHours, overtimeHours: 0, status: 'NORMAL' },
        });
      }

      todayAttendance = {
        clockIn: attendance.clockIn,
        clockOut: attendance.clockOut,
        workHours: attendance.workHours,
        overtimeHours: attendance.overtimeHours,
        status: 'CLOCKED_OUT',
        isWorkday: true,
      };
    }

    return NextResponse.json({
      leaveBalance: totalRemain,
      leaveBalancesByType,
      pendingApprovals,
      pendingWelfareCount,
      pendingWelfareItems,
      deptMembers,
      monthlyOvertime,
      recentLeaves,
      pendingItems,
      timeWallet,
      todayAttendance,
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json(
      { message: '대시보드 데이터 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
