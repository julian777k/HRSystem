import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';
import { getWalletBalance } from '@/lib/time-wallet';
import { getWorkSettings, getDailyWorkHours, isWorkday as checkIsWorkday, buildDateTime } from '@/lib/attendance-utils';
import { getTenantId } from '@/lib/tenant-context';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: '인증 필요' }, { status: 401 });
    }

    const tenantId = await getTenantId();
    const currentYear = new Date().getFullYear();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const isAdmin = ['SYSTEM_ADMIN', 'COMPANY_ADMIN'].includes(user.role);

    // Run independent queries in parallel
    const [
      leaveBalances,
      pendingApprovals,
      deptMembers,
      overtimeRequests,
      recentLeaves,
      pendingItems,
      timeWallet,
      welfareResults,
    ] = await Promise.all([
      // 1. Leave balance
      prisma.leaveBalance.findMany({
        where: { employeeId: user.id, year: currentYear },
      }),
      // 2. Pending approvals count — pendingItems.length로 대체 (중복 쿼리 제거)
      Promise.resolve(0),
      // 3. Department headcount
      prisma.employee.count({
        where: { departmentId: user.departmentId, status: 'ACTIVE' },
      }),
      // 4. Monthly overtime
      prisma.overtimeRequest.findMany({
        where: {
          employeeId: user.id,
          date: { gte: monthStart, lte: monthEnd },
          status: 'APPROVED',
        },
      }),
      // 5. Recent leave requests
      prisma.leaveRequest.findMany({
        where: { employeeId: user.id },
        include: { leaveType: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      // 6. Pending approval items
      prisma.approval.findMany({
        where: { approverId: user.id, action: 'PENDING' },
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
      }),
      // 7. Time wallet balance
      getWalletBalance(user.id, currentYear),
      // 2b. Pending welfare requests (admin only)
      isAdmin
        ? Promise.all([
            prisma.welfareRequest.count({ where: { status: 'PENDING' } }).catch(() => 0),
            prisma.welfareRequest.findMany({
              where: { status: 'PENDING' },
              include: {
                employee: { select: { name: true, employeeNumber: true } },
                item: { select: { name: true, category: { select: { name: true } } } },
              },
              orderBy: { createdAt: 'desc' },
              take: 5,
            }).catch(() => []),
          ])
        : Promise.resolve([0, []] as [number, any[]]),
    ]);

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

    const monthlyOvertime = overtimeRequests.reduce(
      (sum, o) => sum + o.hours,
      0
    );

    const [pendingWelfareCount, rawWelfareItems] = welfareResults;
    // Filter out welfare requests with missing relations (orphaned items/categories)
    const pendingWelfareItems = (rawWelfareItems as any[]).filter(
      (w: any) => w?.employee && w?.item && w?.item?.category
    );
    const actualPendingApprovals = pendingItems.length;

    // 8. Today's attendance (auto-record system compatible)
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const isWorkday = await checkIsWorkday(today, user.departmentId);

    let todayAttendance: any;
    if (!isWorkday) {
      todayAttendance = { clockIn: null, clockOut: null, workHours: null, status: 'DAY_OFF', isWorkday: false };
    } else {
      // Auto-create attendance if not exists (same logic as /api/attendance/today)
      let attendance = await prisma.attendance.findUnique({
        where: { tenantId_employeeId_date: { tenantId, employeeId: user.id, date: today } },
      });

      if (!attendance) {
        // Get work settings (Employee → Department → Company priority)
        try {
          const workSettings = await getWorkSettings(user.id);
          const dailyHours = await getDailyWorkHours();

          const clockIn = buildDateTime(today, workSettings.workStartTime);
          const clockOut = buildDateTime(today, workSettings.workEndTime);

          attendance = await prisma.attendance.create({
            data: { employeeId: user.id, date: today, clockIn, clockOut, workHours: dailyHours, overtimeHours: 0, status: 'NORMAL' },
          });
        } catch {
          // Race condition: another request may have created it — re-fetch
          attendance = await prisma.attendance.findUnique({
            where: { tenantId_employeeId_date: { tenantId, employeeId: user.id, date: today } },
          });
        }
      }

      if (!attendance) {
        // Fallback: neither create nor re-fetch succeeded
        todayAttendance = { clockIn: null, clockOut: null, workHours: null, status: 'NOT_CLOCKED_IN', isWorkday: true };
      } else {
        // Determine actual status: if current time is before clockOut, user is still working
        const attendanceStatus = (attendance.clockOut && now < attendance.clockOut) ? 'CLOCKED_IN' : 'CLOCKED_OUT';

        todayAttendance = {
          clockIn: attendance.clockIn,
          clockOut: attendanceStatus === 'CLOCKED_IN' ? null : attendance.clockOut,
          workHours: attendanceStatus === 'CLOCKED_IN' ? null : attendance.workHours,
          overtimeHours: attendance.overtimeHours,
          status: attendanceStatus,
          isWorkday: true,
        };
      }
    }

    return NextResponse.json({
      leaveBalance: totalRemain,
      leaveBalancesByType,
      pendingApprovals: actualPendingApprovals,
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
