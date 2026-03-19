import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: '인증 필요' }, { status: 401 });

    if (!['SYSTEM_ADMIN', 'COMPANY_ADMIN'].includes(user.role)) {
      return NextResponse.json({ message: '권한이 없습니다.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const departmentId = searchParams.get('departmentId');
    const employeeId = searchParams.get('employeeId');
    const leaveTypeId = searchParams.get('leaveTypeId');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);

    const where: Record<string, any> = {};

    if (startDate) where.startDate = { gte: new Date(startDate) };
    if (endDate) where.endDate = { lte: new Date(endDate) };
    if (employeeId) where.employeeId = employeeId;
    if (leaveTypeId) where.leaveTypeId = leaveTypeId;
    if (status) where.status = status as string;

    if (departmentId) {
      where.employee = { departmentId };
    }

    const [total, requests] = await Promise.all([
      prisma.leaveRequest.count({ where }),
      prisma.leaveRequest.findMany({
        where,
        include: {
          employee: {
            include: { department: true, position: true },
          },
          leaveType: true,
        },
        orderBy: { appliedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const data = requests.map((r) => ({
      id: r.id,
      employeeName: r.employee.name,
      departmentName: r.employee.department.name,
      positionName: r.employee.position.name,
      leaveTypeName: r.leaveType.name,
      startDate: r.startDate,
      endDate: r.endDate,
      useUnit: r.useUnit,
      requestDays: r.requestDays,
      reason: r.reason,
      status: r.status,
      appliedAt: r.appliedAt,
    }));

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Leave register error:', error);
    return NextResponse.json(
      { message: '휴가관리대장 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
