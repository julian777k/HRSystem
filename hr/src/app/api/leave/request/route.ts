import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';
import { notifyApprovers } from '@/lib/notifications';
import { getTenantId } from '@/lib/tenant-context';
import { checkRateLimit } from '@/lib/rate-limit';
import { calculateWorkingDays } from '@/lib/leave-calculator';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: '인증 필요' }, { status: 401 });

    // Rate limit: 20 leave requests per 15 minutes per user
    const rl = await checkRateLimit(`leave-req:${user.id}`, 20, 15 * 60 * 1000);
    if (!rl.success) {
      return NextResponse.json(
        { message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
        { status: 429 }
      );
    }

    const tenantId = await getTenantId();
    const body = await request.json();
    const { leaveTypeId, startDate, endDate, useUnit, requestDays, reason } = body;

    if (!leaveTypeId || !startDate || !endDate || !useUnit || !requestDays) {
      return NextResponse.json({ message: '필수 항목을 입력해주세요.' }, { status: 400 });
    }

    // Validate requestDays is positive and reasonable
    const days = parseFloat(String(requestDays));
    if (!Number.isFinite(days) || days <= 0 || days > 365) {
      return NextResponse.json({ message: '유효하지 않은 휴가 일수입니다.' }, { status: 400 });
    }

    // Validate endDate >= startDate
    if (new Date(endDate) < new Date(startDate)) {
      return NextResponse.json({ message: '종료일은 시작일 이후여야 합니다.' }, { status: 400 });
    }

    // 연도를 걸친 휴가는 차단한다. 연도별로 나눠 신청하면 각 연도 잔여에서 정확히 차감된다.
    // (연도 걸침을 자동 분할하면 차감 4개 지점 + 복원 로직이 얽혀 잔여 손상 위험이 크다)
    if (new Date(startDate).getFullYear() !== new Date(endDate).getFullYear()) {
      return NextResponse.json(
        { message: '연도를 걸친 휴가는 연도별로 나눠 신청해주세요. (예: 12/29~12/31 신청 후 1/2~ 별도 신청)' },
        { status: 400 }
      );
    }

    // Validate leave type (with tenantId to prevent cross-tenant access)
    const leaveType = await prisma.leaveType.findUnique({ where: { id: leaveTypeId, tenantId } });
    if (!leaveType || !leaveType.isActive) {
      return NextResponse.json({ message: '유효하지 않은 휴가 유형입니다.' }, { status: 400 });
    }

    // 클라이언트가 보낸 requestDays 를 신뢰하지 않고 서버에서 재계산해 검증한다.
    // 이 검증이 없으면 직원이 API를 직접 호출해 requestDays: 0.5 로 열흘 휴가를
    // 승인받고 잔여는 0.5일만 차감시킬 수 있다.
    const isHalfDay = useUnit === 'AM_HALF' || useUnit === 'PM_HALF';
    if (isHalfDay) {
      // 반차는 하루짜리여야 한다
      if (String(startDate).slice(0, 10) !== String(endDate).slice(0, 10)) {
        return NextResponse.json({ message: '반차는 하루만 신청할 수 있습니다.' }, { status: 400 });
      }
      if (days !== 0.5) {
        return NextResponse.json({ message: '반차 일수가 올바르지 않습니다.' }, { status: 400 });
      }
    } else {
      // 종일 휴가: 서버가 근무일(주말·공휴일 제외)을 직접 세어 클라이언트 값과 대조
      const holidayRows = await prisma.holiday.findMany({
        where: { tenantId, date: { gte: new Date(startDate), lte: new Date(endDate) } },
        select: { date: true },
      });
      const serverDays = calculateWorkingDays(
        new Date(startDate),
        new Date(endDate),
        holidayRows.map((h) => h.date)
      );
      if (serverDays <= 0) {
        return NextResponse.json({ message: '신청 가능한 근무일이 없습니다. (주말·공휴일만 포함)' }, { status: 400 });
      }
      if (days !== serverDays) {
        return NextResponse.json(
          { message: `휴가 일수가 올바르지 않습니다. (신청 기간의 근무일: ${serverDays}일)` },
          { status: 400 }
        );
      }
    }

    // Check remaining balance
    // isAnnualDeduct가 true인 휴가 유형(오전반차, 오후반차 등)은 연차(ANNUAL) 잔여에서 차감
    const year = new Date(startDate).getFullYear();
    const balanceLookupCode = (leaveType.isAnnualDeduct && leaveType.code !== 'ANNUAL') ? 'ANNUAL' : leaveType.code;
    const balance = await prisma.leaveBalance.findUnique({
      where: {
        tenantId_employeeId_year_leaveTypeCode: {
          tenantId,
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

    // Fetch dailyWorkHours from CompensationPolicy (default 8)
    const compPolicy = await prisma.compensationPolicy.findFirst({
      where: { isActive: true },
      select: { dailyWorkHours: true, minUseUnit: true },
    });
    const dailyWorkHours = compPolicy?.dailyWorkHours ?? 8;
    const requestHours = requestDays * dailyWorkHours;

    // 최소 사용 단위 강제 — 신청 시간이 minUseUnit의 배수여야 한다.
    // 기본 1시간이면 항상 배수라 기존 동작 그대로(무동작). 회사가 값을 올릴 때만 제약.
    const minUseUnit = compPolicy?.minUseUnit ?? 1;
    if (minUseUnit > 0) {
      const ratio = requestHours / minUseUnit;
      if (Math.abs(ratio - Math.round(ratio)) > 1e-6) {
        return NextResponse.json(
          { message: `최소 사용 단위(${minUseUnit}시간) 단위로만 신청할 수 있습니다.` },
          { status: 400 }
        );
      }
    }

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
        requestDays: days,
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
      // Use conditional update to prevent negative balance (race condition guard)
      const balanceCode2 = (leaveType.isAnnualDeduct && leaveType.code !== 'ANNUAL') ? 'ANNUAL' : leaveType.code;
      const updated = await prisma.leaveBalance.updateMany({
        where: {
          employeeId: user.id,
          year,
          leaveTypeCode: balanceCode2,
          totalRemain: { gte: days },
        },
        data: {
          totalUsed: { increment: days },
          totalRemain: { decrement: days },
        },
      });
      if (updated.count === 0) {
        // Race condition: balance was already deducted by concurrent request
        await prisma.leaveRequest.update({
          where: { id: leaveRequest.id },
          data: { status: 'CANCELLED' },
        });
        return NextResponse.json({ message: '잔여 휴가가 부족합니다. (동시 요청으로 잔여일 변경)' }, { status: 409 });
      }
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
