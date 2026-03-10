import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';
import { notifyRequestResult } from '@/lib/notifications';
import { createLeaveAttendance } from '@/lib/attendance-utils';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: '인증 필요' }, { status: 401 });
    }

    const body = await request.json();
    const { approvalId, action, comment } = body;

    if (!approvalId || !action) {
      return NextResponse.json(
        { message: '필수 항목을 모두 입력해주세요.' },
        { status: 400 }
      );
    }

    if (!['APPROVED', 'REJECTED'].includes(action)) {
      return NextResponse.json(
        { message: '올바른 결재 액션이 아닙니다.' },
        { status: 400 }
      );
    }

    const approval = await prisma.approval.findUnique({
      where: { id: approvalId },
      include: {
        leaveRequest: true,
        overtime: true,
      },
    });

    if (!approval) {
      return NextResponse.json({ message: '결재를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (approval.approverId !== user.id) {
      return NextResponse.json({ message: '결재 권한이 없습니다.' }, { status: 403 });
    }

    if (approval.action !== 'PENDING') {
      return NextResponse.json({ message: '이미 처리된 결재입니다.' }, { status: 400 });
    }

    // Wrap entire approval processing in a transaction
    await prisma.$transaction(async (tx) => {
      // Update the approval
      await tx.approval.update({
        where: { id: approvalId },
        data: {
          action,
          comment: comment || null,
          processedAt: new Date(),
        },
      });

      if (action === 'REJECTED') {
        // Reject the request
        if (approval.leaveRequestId) {
          await tx.leaveRequest.update({
            where: { id: approval.leaveRequestId },
            data: { status: 'REJECTED' },
          });
        }
        if (approval.overtimeId) {
          await tx.overtimeRequest.update({
            where: { id: approval.overtimeId },
            data: { status: 'REJECTED' },
          });
        }
      } else {
        // APPROVED - 상위 레벨 선승인 시 하위 단계 자동 건너뛰기
        const whereClause = approval.leaveRequestId
          ? { leaveRequestId: approval.leaveRequestId }
          : { overtimeId: approval.overtimeId };

        const allApprovals = await tx.approval.findMany({
          where: whereClause,
          orderBy: { stepOrder: 'asc' },
        });

        // 현재 승인자보다 하위 단계 중 PENDING인 건을 SKIPPED 처리
        const lowerPending = allApprovals.filter(
          (a) => a.stepOrder < approval.stepOrder && a.action === 'PENDING'
        );
        if (lowerPending.length > 0) {
          await tx.approval.updateMany({
            where: { id: { in: lowerPending.map((a) => a.id) } },
            data: { action: 'SKIPPED', processedAt: new Date() },
          });
        }

        const nextStep = allApprovals.find(
          (a) => a.stepOrder > approval.stepOrder && a.action === 'PENDING'
        );

        if (nextStep) {
          // Move to next step
          if (approval.leaveRequestId) {
            await tx.leaveRequest.update({
              where: { id: approval.leaveRequestId },
              data: {
                currentStep: nextStep.stepOrder,
                status: 'IN_PROGRESS',
              },
            });
          }
        } else {
          // 마지막 단계 또는 상위자가 선승인 → 최종 승인
          if (approval.leaveRequestId && approval.leaveRequest) {
            // Double-deduction guard: skip if already approved
            if (approval.leaveRequest.status === 'APPROVED') {
              return;
            }

            await tx.leaveRequest.update({
              where: { id: approval.leaveRequestId },
              data: { status: 'APPROVED' },
            });

            // Deduct from leave balance
            const lr = approval.leaveRequest;
            const leaveType = await tx.leaveType.findUnique({ where: { id: lr.leaveTypeId } });
            if (leaveType) {
              const year = lr.startDate.getFullYear();
              const balanceCode = (leaveType.isAnnualDeduct && leaveType.code !== 'ANNUAL')
                ? 'ANNUAL' : leaveType.code;
              await tx.leaveBalance.updateMany({
                where: {
                  employeeId: lr.employeeId,
                  year,
                  leaveTypeCode: balanceCode,
                },
                data: {
                  totalUsed: { increment: lr.requestDays },
                  totalRemain: { decrement: lr.requestDays },
                },
              });
            }
          }
          if (approval.overtimeId) {
            await tx.overtimeRequest.update({
              where: { id: approval.overtimeId },
              data: { status: 'APPROVED' },
            });
          }
        }
      }
    });

    // Post-transaction side effects (notifications, attendance creation)
    if (action === 'REJECTED' && approval.leaveRequestId) {
      notifyRequestResult(approval.leaveRequestId, 'REJECTED', comment).catch(() => {});
    } else if (action === 'APPROVED') {
      if (approval.leaveRequestId && approval.leaveRequest) {
        // Check if this was the final approval (no more pending steps)
        const remainingPending = await prisma.approval.count({
          where: { leaveRequestId: approval.leaveRequestId, action: 'PENDING' },
        });
        if (remainingPending === 0) {
          notifyRequestResult(approval.leaveRequestId, 'APPROVED').catch(() => {});
          const lr = approval.leaveRequest;
          const leaveType = await prisma.leaveType.findUnique({ where: { id: lr.leaveTypeId } });
          const leaveTypeName = leaveType?.name || '휴가';
          await createLeaveAttendance(
            lr.employeeId,
            lr.startDate,
            lr.endDate,
            lr.useUnit,
            leaveTypeName
          );
        }
      }
    }

    return NextResponse.json({ message: '결재가 처리되었습니다.' });
  } catch (error) {
    console.error('Approval process error:', error);
    return NextResponse.json(
      { message: '결재 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
