import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';
import { getTenantId } from '@/lib/tenant-context';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: '인증 필요' }, { status: 401 });

    if (!['SYSTEM_ADMIN', 'COMPANY_ADMIN'].includes(user.role)) {
      return NextResponse.json({ message: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const tenantId = await getTenantId();
    const body = await request.json();
    const { employeeId, leaveTypeCode, grantDays, grantReason, periodStart, periodEnd } = body;

    if (!employeeId || !leaveTypeCode || !grantDays || !grantReason || !periodStart || !periodEnd) {
      return NextResponse.json({ message: '필수 항목을 입력해주세요.' }, { status: 400 });
    }

    // Validate periodEnd >= periodStart
    if (new Date(periodEnd) < new Date(periodStart)) {
      return NextResponse.json({ message: '종료일은 시작일 이후여야 합니다.' }, { status: 400 });
    }

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) {
      return NextResponse.json({ message: '직원을 찾을 수 없습니다.' }, { status: 404 });
    }

    // Check for duplicate grant (same employee, same leave type, overlapping period)
    const year = new Date(periodStart).getFullYear();
    const duplicateGrant = await prisma.leaveGrant.findFirst({
      where: {
        employeeId,
        leaveTypeCode,
        periodStart: { lte: new Date(periodEnd) },
        periodEnd: { gte: new Date(periodStart) },
      },
    });
    if (duplicateGrant) {
      return NextResponse.json(
        { message: '동일 기간에 이미 부여된 휴가가 있습니다.' },
        { status: 409 }
      );
    }

    // Create grant
    const grant = await prisma.leaveGrant.create({
      data: {
        employeeId,
        leaveTypeCode,
        grantDays: parseFloat(String(grantDays)),
        remainDays: parseFloat(String(grantDays)),
        grantReason,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
      },
    });

    // Update or create balance for the year
    const existingBalance = await prisma.leaveBalance.findUnique({
      where: {
        tenantId_employeeId_year_leaveTypeCode: {
          tenantId,
          employeeId,
          year,
          leaveTypeCode,
        },
      },
    });

    if (existingBalance) {
      await prisma.leaveBalance.update({
        where: { id: existingBalance.id },
        data: {
          totalGranted: { increment: parseFloat(String(grantDays)) },
          totalRemain: { increment: parseFloat(String(grantDays)) },
        },
      });
    } else {
      await prisma.leaveBalance.create({
        data: {
          employeeId,
          year,
          leaveTypeCode,
          totalGranted: parseFloat(String(grantDays)),
          totalUsed: 0,
          totalRemain: parseFloat(String(grantDays)),
        },
      });
    }

    return NextResponse.json(grant, { status: 201 });
  } catch (error) {
    console.error('Leave grant error:', error);
    return NextResponse.json(
      { message: '휴가 부여 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
