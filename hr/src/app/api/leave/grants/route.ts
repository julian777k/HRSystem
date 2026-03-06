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
    const employeeId = searchParams.get('employeeId');

    const where: Record<string, unknown> = {};
    if (employeeId) {
      where.employeeId = employeeId;
    }

    const grants = await prisma.leaveGrant.findMany({
      where,
      include: {
        employee: {
          include: { department: true, position: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const data = grants.map((g) => ({
      id: g.id,
      employeeId: g.employeeId,
      employeeName: g.employee.name,
      departmentName: g.employee.department.name,
      positionName: g.employee.position.name,
      leaveTypeCode: g.leaveTypeCode,
      grantDays: g.grantDays,
      usedDays: g.usedDays,
      remainDays: g.remainDays,
      grantReason: g.grantReason,
      periodStart: g.periodStart,
      periodEnd: g.periodEnd,
      isExpired: g.isExpired,
      createdAt: g.createdAt,
    }));

    return NextResponse.json(data);
  } catch (error) {
    console.error('Leave grants error:', error);
    return NextResponse.json(
      { message: '휴가 부여 내역 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
