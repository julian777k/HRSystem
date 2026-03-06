import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: '인증 필요' }, { status: 401 });
    }

    const body = await request.json();
    const { date, overtimeType, startTime, endTime, hours, reason } = body;

    if (!date || !overtimeType || !hours || !reason) {
      return NextResponse.json(
        { message: '날짜, 근무 유형, 시간, 사유를 입력해주세요.' },
        { status: 400 }
      );
    }

    // Find default approval line for OVERTIME
    const approvalLine = await prisma.approvalLine.findFirst({
      where: { type: 'OVERTIME', isDefault: true, isActive: true },
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

    const overtimeRequest = await prisma.overtimeRequest.create({
      data: {
        employeeId: user.id,
        date: new Date(date),
        overtimeType,
        startTime: startTime || '',
        endTime: endTime || '',
        hours: parseFloat(hours),
        reason,
        status: approvalRecords.length > 0 ? 'PENDING' : 'APPROVED',
      },
      include: {
        employee: {
          select: { id: true, name: true, employeeNumber: true },
        },
      },
    });

    // Create approval records
    if (approvalRecords.length > 0) {
      await prisma.approval.createMany({
        data: approvalRecords.map((rec) => ({
          overtimeId: overtimeRequest.id,
          stepOrder: rec.stepOrder,
          approverId: rec.approverId,
          action: 'PENDING',
        })),
      });
    }

    return NextResponse.json({ overtimeRequest }, { status: 201 });
  } catch (error) {
    console.error('Overtime request create error:', error);
    return NextResponse.json(
      { message: '시간외근무 신청 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
