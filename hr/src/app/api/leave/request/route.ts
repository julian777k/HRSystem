import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';
import { notifyApprovers } from '@/lib/notifications';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: '인증 필요' }, { status: 401 });

    const body = await request.json();
    const { leaveTypeId, startDate, endDate, useUnit, requestDays, reason } = body;

    if (!leaveTypeId || !startDate || !endDate || !useUnit || !requestDays) {
      return NextResponse.json({ message: '필수 항목을 입력해주세요.' }, { status: 400 });
    }

    // Validate endDate >= startDate
    if (new Date(endDate) < new Date(startDate)) {
      return NextResponse.json({ message: '종료일은 시작일 이후여야 합니다.' }, { status: 400 });
    }

    // Validate leave type
    const leaveType = await prisma.leaveType.findUnique({ where: { id: leaveTypeId } });
    if (!leaveType || !leaveType.isActive) {
      return NextResponse.json({ message: '유효하지 않은 휴가 유형입니다.' }, { status: 400 });
    }

    // Check remaining balance
    // isAnnualDeduct가 true인 휴가 유형(오전반차, 오후반차 등)은 연차(ANNUAL) 잔여에서 차감
    const year = new Date(startDate).getFullYear();
    const balanceLookupCode = (leaveType.isAnnualDeduct && leaveType.code !== 'ANNUAL') ? 'ANNUAL' : leaveType.code;
    const balance = await prisma.leaveBalance.findUnique({
      where: {
        employeeId_year_leaveTypeCode: {
          employeeId: user.id,
          year,
          leaveTypeCode: balanceLookupCode,
        },
      },
    });

    if (!balance) {
      return NextResponse.json(
        { message: '해당 휴가 유형의 잔여 일수가 부여되지 않았습니다. 관리자에게 문의하세요.' },
        { status: 400 }
      );
    }

    if (balance.totalRemain < requestDays) {
      return NextResponse.json(
        { message: `잔여 휴가가 부족합니다. (잔여: ${balance.totalRemain}일, 신청: ${requestDays}일)` },
        { status: 400 }
      );
    }

    // Check date conflicts
    const conflict = await prisma.leaveRequest.findFirst({
      where: {
        employeeId: user.id,
        status: { in: ['PENDING', 'IN_PROGRESS', 'APPROVED'] },
        startDate: { lte: new Date(endDate) },
        endDate: { gte: new Date(startDate) },
      },
    });

    if (conflict) {
      return NextResponse.json({ message: '해당 기간에 이미 신청된 휴가가 있습니다.' }, { status: 400 });
    }

    const requestHours = requestDays * 8;

    // Find default approval line for LEAVE
    const approvalLine = await prisma.approvalLine.findFirst({
      where: { type: 'LEAVE', isDefault: true, isActive: true },
      include: {
        steps: { orderBy: { stepOrder: 'asc' } },
      },
    });

    // Resolve approvers for each step
    const approvalRecords: { stepOrder: number; approverId: string }[] = [];
    if (approvalLine) {
      const employee = await prisma.employee.findUnique({
        where: { id: user.id },
        select: { departmentId: true },
      });

      for (const step of approvalLine.steps) {
        let approverId: string | null = null;

        if (step.approverRole === 'FIXED' && step.approverId) {
          approverId = step.approverId;
        } else if (step.approverRole === 'POSITION' && step.positionLevel != null) {
          // Find employee in same department with matching position level
          const approver = await prisma.employee.findFirst({
            where: {
              departmentId: employee?.departmentId,
              position: { level: step.positionLevel },
              status: 'ACTIVE',
              id: { not: user.id },
            },
          });
          approverId = approver?.id || null;
        } else if (step.approverRole === 'DEPT_HEAD') {
          const approver = await prisma.employee.findFirst({
            where: {
              departmentId: employee?.departmentId,
              role: { in: ['DEPT_ADMIN', 'COMPANY_ADMIN', 'SYSTEM_ADMIN'] },
              status: 'ACTIVE',
              id: { not: user.id },
            },
            include: { position: true },
            orderBy: { position: { level: 'desc' } },
          });
          approverId = approver?.id || null;
        }

        if (approverId) {
          approvalRecords.push({ stepOrder: step.stepOrder, approverId });
        }
      }
    }

    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        employeeId: user.id,
        leaveTypeId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        useUnit,
        requestDays: parseFloat(String(requestDays)),
        requestHours,
        reason: reason || null,
        status: approvalRecords.length > 0 ? 'PENDING' : 'APPROVED',
        approvalLineId: approvalLine?.id || null,
        currentStep: 1,
      },
      include: { leaveType: true },
    });

    // Create approval records
    if (approvalRecords.length > 0) {
      await prisma.approval.createMany({
        data: approvalRecords.map((rec) => ({
          leaveRequestId: leaveRequest.id,
          stepOrder: rec.stepOrder,
          approverId: rec.approverId,
          action: 'PENDING',
        })),
      });
    } else {
      // No approval line → auto-approve and deduct balance
      const balanceCode2 = (leaveType.isAnnualDeduct && leaveType.code !== 'ANNUAL') ? 'ANNUAL' : leaveType.code;
      await prisma.leaveBalance.updateMany({
        where: {
          employeeId: user.id,
          year,
          leaveTypeCode: balanceCode2,
        },
        data: {
          totalUsed: { increment: parseFloat(String(requestDays)) },
          totalRemain: { decrement: parseFloat(String(requestDays)) },
        },
      });
    }

    // Notify approvers (async, don't block response)
    notifyApprovers(leaveRequest.id).catch(() => {});

    return NextResponse.json(leaveRequest, { status: 201 });
  } catch (error) {
    console.error('Leave request error:', error);
    return NextResponse.json(
      { message: '휴가 신청 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
