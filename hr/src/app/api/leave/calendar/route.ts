import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: '인증 필요' }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));
    const departmentId = searchParams.get('departmentId');

    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59);

    // Employee filter - 캘린더는 일정 조율 목적이므로 전체 직원 휴가 표시
    // 부서 필터가 지정되면 해당 부서만, 아니면 전체 표시
    const employeeWhere: Record<string, unknown> = { status: 'ACTIVE' };
    if (departmentId) {
      employeeWhere.departmentId = departmentId;
    }

    // Get approved leave requests that overlap with this month
    const leaveRequests = await prisma.leaveRequest.findMany({
      where: {
        status: 'APPROVED',
        employee: employeeWhere,
        OR: [
          { startDate: { gte: startOfMonth, lte: endOfMonth } },
          { endDate: { gte: startOfMonth, lte: endOfMonth } },
          { AND: [{ startDate: { lte: startOfMonth } }, { endDate: { gte: endOfMonth } }] },
        ],
      },
      include: {
        employee: { select: { id: true, name: true, department: { select: { id: true, name: true } } } },
        leaveType: { select: { name: true, code: true } },
      },
      orderBy: { startDate: 'asc' },
    });

    // Get holidays for this month
    const holidays = await prisma.holiday.findMany({
      where: {
        date: { gte: startOfMonth, lte: endOfMonth },
      },
    });

    return NextResponse.json({
      leaveRequests: leaveRequests.map(lr => ({
        id: lr.id,
        employeeName: lr.employee.name,
        employeeId: lr.employee.id,
        departmentName: lr.employee.department?.name ?? '',
        departmentId: lr.employee.department?.id ?? null,
        leaveTypeName: lr.leaveType.name,
        leaveTypeCode: lr.leaveType.code,
        startDate: lr.startDate,
        endDate: lr.endDate,
        useUnit: lr.useUnit,
        requestDays: lr.requestDays,
        reason: lr.reason,
      })),
      holidays: holidays.map(h => ({
        date: h.date,
        name: h.name,
      })),
    });
  } catch (error) {
    console.error('Leave calendar error:', error);
    return NextResponse.json({ message: '캘린더 데이터 조회 중 오류' }, { status: 500 });
  }
}
