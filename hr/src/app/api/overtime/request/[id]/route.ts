import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';
import { accrueCompTime } from '@/lib/time-wallet';

const ADMIN_ROLES = ['SYSTEM_ADMIN', 'COMPANY_ADMIN'];

/**
 * PUT /api/overtime/request/[id] - 시간외근무 승인/반려/수정
 */
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

    const existing = await prisma.overtimeRequest.findUnique({
      where: { id },
      include: { employee: true },
    });
    if (!existing) {
      return NextResponse.json({ message: '시간외근무 신청을 찾을 수 없습니다.' }, { status: 404 });
    }

    // Admin approval/rejection
    if (body.status && ['APPROVED', 'REJECTED'].includes(body.status)) {
      if (!isAdmin) {
        return NextResponse.json({ message: '결재 권한이 없습니다.' }, { status: 403 });
      }
      if (!['PENDING', 'IN_PROGRESS'].includes(existing.status)) {
        return NextResponse.json({ message: '대기/진행 상태의 신청만 처리할 수 있습니다.' }, { status: 400 });
      }

      // 상태 전이를 먼저, 원자적으로 선점한다 (낙관적 잠금).
      // read-then-write 사이에 다른 요청이 끼면 보상시간이 이중 적립되므로,
      // status 를 조건에 건 UPDATE 로 승자를 하나만 정하고, 진 요청은 여기서 멈춘다.
      const claimed = await prisma.overtimeRequest.updateMany({
        where: { id, status: { in: ['PENDING', 'IN_PROGRESS'] } },
        data: { status: body.status },
      });
      if (claimed.count === 0) {
        return NextResponse.json({ message: '이미 처리된 신청입니다.' }, { status: 409 });
      }

      // 상태 선점에 성공한 요청만 적립한다
      let earnedHours = 0;
      if (body.status === 'APPROVED') {
        const result = await accrueCompTime(
          existing.employeeId,
          existing.hours,
          existing.overtimeType,
          existing.id
        );
        earnedHours = result.earnedHours;
      }

      // 결재 레코드 업데이트
      await prisma.approval.updateMany({
        where: { overtimeId: id, action: 'PENDING' },
        data: {
          action: body.status,
          comment: body.comment || null,
          processedAt: new Date(),
          approverId: user.id,
        },
      });

      const updated = await prisma.overtimeRequest.findUnique({
        where: { id },
        include: { employee: { select: { name: true, employeeNumber: true } } },
      });

      return NextResponse.json({
        ...updated,
        earnedHours,
        message: body.status === 'APPROVED'
          ? `승인 완료. ${earnedHours}시간 보상시간이 적립되었습니다.`
          : '반려되었습니다.',
      });
    }

    // 본인 수정 (PENDING 상태만)
    if (existing.employeeId !== user.id) {
      return NextResponse.json({ message: '권한이 없습니다.' }, { status: 403 });
    }
    if (existing.status !== 'PENDING') {
      return NextResponse.json({ message: '대기 상태의 신청만 수정할 수 있습니다.' }, { status: 400 });
    }

    const updated = await prisma.overtimeRequest.update({
      where: { id },
      data: {
        ...(body.date && { date: new Date(body.date) }),
        ...(body.overtimeType && { overtimeType: body.overtimeType }),
        ...(body.startTime && { startTime: body.startTime }),
        ...(body.endTime && { endTime: body.endTime }),
        ...(body.hours !== undefined && { hours: parseFloat(body.hours) }),
        ...(body.reason !== undefined && { reason: body.reason }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Overtime request update error:', error);
    return NextResponse.json(
      { message: '시간외근무 신청 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/overtime/request/[id] - 시간외근무 취소
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: '인증 필요' }, { status: 401 });

    const { id } = await params;
    const isAdmin = ADMIN_ROLES.includes(user.role);

    const existing = await prisma.overtimeRequest.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: '시간외근무 신청을 찾을 수 없습니다.' }, { status: 404 });
    }
    if (existing.employeeId !== user.id && !isAdmin) {
      return NextResponse.json({ message: '권한이 없습니다.' }, { status: 403 });
    }

    // 관리자: 어떤 상태든 삭제 가능 (DB에서 실제 삭제)
    if (isAdmin) {
      // 승인된 건이면 적립된 보상시간 회수
      if (existing.status === 'APPROVED') {
        const accrual = await prisma.compTimeAccrual.findFirst({
          where: { overtimeRequestId: id },
        });
        if (accrual) {
          const year = existing.date.getFullYear();
          const wallet = await prisma.timeWallet.findFirst({
            where: {
              employeeId: existing.employeeId,
              year,
              type: 'COMP_TIME',
            },
          });
          if (wallet) {
            // 음수 방지: totalRemain은 0 미만으로 내려가지 않도록 보호
            const newEarned = Math.max(0, wallet.totalEarned - accrual.earnedHours);
            const newRemain = Math.max(0, wallet.totalRemain - accrual.earnedHours);
            await prisma.timeWallet.update({
              where: { id: wallet.id },
              data: {
                totalEarned: newEarned,
                totalRemain: newRemain,
              },
            });
          }
          await prisma.compTimeAccrual.delete({ where: { id: accrual.id } });
        }
      }
      await prisma.approval.deleteMany({ where: { overtimeId: id } });
      await prisma.overtimeRequest.delete({ where: { id } });
      return NextResponse.json({ message: '삭제되었습니다.' });
    }

    // 일반 사용자: PENDING/IN_PROGRESS만 취소 가능
    if (!['PENDING', 'IN_PROGRESS'].includes(existing.status)) {
      return NextResponse.json({ message: '대기/진행 상태의 신청만 취소할 수 있습니다.' }, { status: 400 });
    }

    // Cancel approval records so they don't appear in approvers' pending list
    await prisma.approval.updateMany({
      where: { overtimeId: id, action: 'PENDING' },
      data: { action: 'CANCELLED', processedAt: new Date() },
    });

    const updated = await prisma.overtimeRequest.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Overtime request cancel error:', error);
    return NextResponse.json(
      { message: '시간외근무 취소 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
