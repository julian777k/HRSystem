import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: '인증 필요' }, { status: 401 });
    }

    if (!['SYSTEM_ADMIN', 'COMPANY_ADMIN', 'DEPT_ADMIN'].includes(user.role)) {
      return NextResponse.json({ message: '권한이 없습니다.' }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const departmentId = searchParams.get('departmentId');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};

    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    } else if (startDate) {
      where.date = { gte: new Date(startDate) };
    } else if (endDate) {
      where.date = { lte: new Date(endDate) };
    }

    if (departmentId) {
      where.employee = { departmentId };
    }

    if (status) {
      where.status = status;
    }

    // DEPT_ADMIN can only see their department
    if (user.role === 'DEPT_ADMIN') {
      where.employee = { ...((where.employee as Record<string, unknown>) || {}), departmentId: user.departmentId };
    }

    const requests = await prisma.overtimeRequest.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            employeeNumber: true,
            department: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    return NextResponse.json({ requests });
  } catch (error) {
    console.error('Overtime requests list error:', error);
    return NextResponse.json(
      { message: '시간외근무 신청 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
