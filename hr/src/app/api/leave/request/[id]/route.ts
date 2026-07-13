import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';
import { notifyRequestResult } from '@/lib/notifications';
import { deductFromWallet, getCompensationPolicy } from '@/lib/time-wallet';
import { createLeaveAttendance, removeLeaveAttendance } from '@/lib/attendance-utils';

const ADMIN_ROLES = ['SYSTEM_ADMIN', 'COMPANY_ADMIN'];

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: '인증 필요' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const isAdmin = ADMIN_ROLES.includes(user.role);

    const existing = await prisma.leaveRequest.findUnique({
      where: { id },
      include: { leaveType: true },
    });
    if (!existing) {
      return NextResponse.json({ message: '휴가 신청을 찾을 수 없습니다.' }, { status: 404 });
    }

    // Admin approval/rejection flow
    if (body.status && ['APPROVED', 'REJECTED'].includes(body.status)) {
      if (!isAdmin) {
        return NextResponse.json({ message: '결재 권한이 없습니다.' }, { status: 403 });
      }
      if (!['PENDING', 'IN_PROGRESS'].includes(existing.status)) {
        return NextResponse.json({ message: '대기/진행 상태의 신청만 처리할 수 있습니다.' }, { status: 400 });
      }

      const updateData: Record<string, unknown> = {
        status: body.status,
      };

      // If approved, deduct from time wallet (hours-based) and leave balance (days-based)
      if (body.status === 'APPROVED' && existing.leaveType) {
        const year = existing.startDate.getFullYear();
        const policy = await getCompensationPolicy();
        const deductHours = existing.requestDays * policy.dailyWorkHours;

        const balanceCode = (existing.leaveType.isAnnualDeduct && existing.leaveType.code !== 'ANNUAL')
          ? 'ANNUAL' : existing.leaveType.code;

        // 잔여 검증을 승인 시점에도 한 번 더 한다.
        // 신청 후 다른 건이 먼저 승인되면 잔여가 부족해질 수 있는데, where 에 잔여 조건을
        // 넣지 않으면 totalRemain 이 음수로 내려간다. gte 조건으로 차감이 0건이면 잔여 부족이다.
        const deducted = await prisma.leaveBalance.updateMany({
          where: {
            employeeId: existing.employeeId,
            year,
            leaveTypeCode: balanceCode,
            totalRemain: { gte: existing.requestDays },
          },
          data: {
            totalUsed: { increment: existing.requestDays },
            totalRemain: { decrement: existing.requestDays },
          },
        });

        if (deducted.count === 0) {
          return NextResponse.json(
            { message: '승인할 수 없습니다. 신청자의 잔여 휴가가 부족합니다.' },
            { status: 409 }
          );
        }

        // 잔여 검증을 통과한 뒤에만 시간 지갑을 차감한다 (보상시간 → 연차 순서)
        await deductFromWallet(existing.employeeId, deductHours, year, existing.id);

        // 휴가 승인 → 근태 자동 생성
        await createLeaveAttendance(
          existing.employeeId,
          existing.startDate,
          existing.endDate,
          existing.useUnit,
          existing.leaveType.name
        );
      }

      // Also update any pending approval records
      await prisma.approval.updateMany({
        where: { leaveRequestId: id, action: 'PENDING' },
        data: {
          action: body.status,
          comment: body.comment || null,
          processedAt: new Date(),
          approverId: user.id,
        },
      });

      const updated = await prisma.leaveRequest.update({
        where: { id },
        data: updateData,
        include: { leaveType: true },
      });

      // Notify requester about approval/rejection
      notifyRequestResult(id, body.status, body.comment).catch(() => {});

      return NextResponse.json(updated);
    }

    // Regular user editing their own request
    if (existing.employeeId !== user.id) {
      return NextResponse.json({ message: '권한이 없습니다.' }, { status: 403 });
    }

    if (existing.status !== 'PENDING') {
      return NextResponse.json({ message: '대기 상태의 신청만 수정할 수 있습니다.' }, { status: 400 });
    }

    const { leaveTypeId, startDate, endDate, useUnit, requestDays, reason } = body;

    // Validate endDate >= startDate if both provided
    const newStart = startDate ? new Date(startDate) : existing.startDate;
    const newEnd = endDate ? new Date(endDate) : existing.endDate;
    if (newEnd < newStart) {
      return NextResponse.json({ message: '종료일은 시작일 이후여야 합니다.' }, { status: 400 });
    }

    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: {
        ...(leaveTypeId && { leaveTypeId }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(useUnit && { useUnit }),
        ...(requestDays !== undefined && {
          requestDays: parseFloat(String(requestDays)),
          requestHours: parseFloat(String(requestDays)) * (await getCompensationPolicy()).dailyWorkHours,
        }),
        ...(reason !== undefined && { reason }),
      },
      include: { leaveType: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Leave request update error:', error);
    return NextResponse.json(
      { message: '휴가 신청 수정 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: '인증 필요' }, { status: 401 });

    const { id } = await params;

    const existing = await prisma.leaveRequest.findUnique({
      where: { id },
      include: { leaveType: true },
    });
    if (!existing) {
      return NextResponse.json({ message: '휴가 신청을 찾을 수 없습니다.' }, { status: 404 });
    }

    const isAdmin = ['SYSTEM_ADMIN', 'COMPANY_ADMIN'].includes(user.role);

    if (existing.employeeId !== user.id && !isAdmin) {
      return NextResponse.json({ message: '권한이 없습니다.' }, { status: 403 });
    }

    // 승인된 건 → 잔여 복원 로직 (transaction으로 감싸서 원자성 보장)
    const restoreIfApproved = async () => {
      if (existing.status !== 'APPROVED') return;
      await prisma.$transaction(async (tx) => {
        const year = existing.startDate.getFullYear();
        const balanceCode = (existing.leaveType.isAnnualDeduct && existing.leaveType.code !== 'ANNUAL')
          ? 'ANNUAL' : existing.leaveType.code;
        await tx.leaveBalance.updateMany({
          where: {
            employeeId: existing.employeeId,
            year,
            leaveTypeCode: balanceCode,
          },
          data: {
            totalUsed: { decrement: existing.requestDays },
            totalRemain: { increment: existing.requestDays },
          },
        });
        const deductions = await tx.timeDeduction.findMany({
          where: { leaveRequestId: existing.id },
        });
        for (const d of deductions) {
          await tx.timeWallet.updateMany({
            where: {
              employeeId: existing.employeeId,
              year,
              type: d.walletType,
            },
            data: {
              totalUsed: { decrement: d.hours },
              totalRemain: { increment: d.hours },
            },
          });
        }
        await tx.timeDeduction.deleteMany({
          where: { leaveRequestId: existing.id },
        });
      });

      // 휴가 취소 → 근태 복원 (side effect, outside transaction)
      await removeLeaveAttendance(
        existing.employeeId,
        existing.startDate,
        existing.endDate
      );
    };

    // 관리자: 어떤 상태든 삭제 가능 (DB에서 실제 삭제)
    if (isAdmin) {
      await restoreIfApproved();
      await prisma.approval.deleteMany({ where: { leaveRequestId: id } });
      await prisma.leaveRequest.delete({ where: { id } });
      return NextResponse.json({ message: '삭제되었습니다.' });
    }

    // 일반 사용자: PENDING만 취소 가능
    if (existing.status !== 'PENDING') {
      return NextResponse.json({ message: '대기 상태의 신청만 취소할 수 있습니다.' }, { status: 400 });
    }

    // Cancel approval records so they don't appear in approvers' pending list
    await prisma.approval.updateMany({
      where: { leaveRequestId: id, action: 'PENDING' },
      data: { action: 'CANCELLED', processedAt: new Date() },
    });

    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: '사용자 취소',
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Leave request cancel error:', error);
    return NextResponse.json(
      { message: '휴가 취소 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
