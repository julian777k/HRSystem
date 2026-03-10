/**
 * 시간 지갑 (Time Wallet) 자동 차감 엔진
 *
 * 보상시간(COMP_TIME) → 연차시간(ANNUAL) 순서로 자동 분할 차감
 * 관리자가 설정한 차감 순서(deductionOrder)를 따름
 */

import { prisma } from '@/lib/prisma';
import { getTenantId } from '@/lib/tenant-context';

interface DeductionResult {
  success: boolean;
  totalDeducted: number;
  details: { walletType: string; hours: number }[];
  error?: string;
}

/**
 * 보상 정책 조회 (캐시 없이 매번 DB 조회)
 */
export async function getCompensationPolicy() {
  let policy = await prisma.compensationPolicy.findFirst({
    where: { isActive: true },
  });

  if (!policy) {
    // 기본 정책 자동 생성
    policy = await prisma.compensationPolicy.create({
      data: {
        compensationType: 'COMP_TIME',
        weekdayMultiplier: 1.5,
        nightMultiplier: 2.0,
        holidayMultiplier: 2.0,
        dailyWorkHours: 8,
        halfDayHours: 4,
        minUseUnit: 1,
        deductionOrder: 'COMP_TIME,ANNUAL',
        autoSplitDeduct: true,
      },
    });
  }

  return policy;
}

/**
 * 시간 지갑에서 자동 차감
 * 차감 순서: 보상시간 → 연차 (또는 관리자 설정에 따라)
 */
export async function deductFromWallet(
  employeeId: string,
  hours: number,
  year: number,
  leaveRequestId?: string
): Promise<DeductionResult> {
  const tenantId = await getTenantId();
  const policy = await getCompensationPolicy();
  const order = policy.deductionOrder.split(',').map((s) => s.trim());
  const details: { walletType: string; hours: number }[] = [];
  let remaining = hours;

  for (const walletType of order) {
    if (remaining <= 0) break;

    const wallet = await prisma.timeWallet.findUnique({
      where: {
        tenantId_employeeId_year_type: {
          tenantId,
          employeeId,
          year,
          type: walletType as 'COMP_TIME' | 'ANNUAL',
        },
      },
    });

    if (!wallet || wallet.totalRemain <= 0) continue;

    const deductAmount = Math.min(remaining, wallet.totalRemain);

    // 지갑 잔액 차감
    await prisma.timeWallet.update({
      where: { id: wallet.id },
      data: {
        totalUsed: { increment: deductAmount },
        totalRemain: { decrement: deductAmount },
      },
    });

    // 차감 이력 기록
    await prisma.timeDeduction.create({
      data: {
        employeeId,
        leaveRequestId,
        walletType: walletType as 'COMP_TIME' | 'ANNUAL',
        hours: deductAmount,
        description:
          walletType === 'COMP_TIME'
            ? `보상시간 차감 ${deductAmount}시간`
            : `연차시간 차감 ${deductAmount}시간`,
      },
    });

    details.push({ walletType, hours: deductAmount });
    remaining -= deductAmount;
  }

  if (remaining > 0 && !policy.autoSplitDeduct) {
    return {
      success: false,
      totalDeducted: hours - remaining,
      details,
      error: `잔여 시간이 부족합니다. (부족: ${remaining}시간)`,
    };
  }

  return {
    success: remaining <= 0,
    totalDeducted: hours - remaining,
    details,
    error: remaining > 0 ? `잔여 시간이 부족합니다. (부족: ${remaining}시간)` : undefined,
  };
}

/**
 * 시간외근무 승인 시 보상시간 적립
 */
export async function accrueCompTime(
  employeeId: string,
  overtimeHours: number,
  overtimeType: string,
  overtimeRequestId?: string
): Promise<{ earnedHours: number }> {
  const policy = await getCompensationPolicy();

  // 수당 지급 방식이면 적립하지 않음
  if (policy.compensationType === 'ALLOWANCE') {
    return { earnedHours: 0 };
  }

  const tenantId = await getTenantId();
  let multiplier = policy.weekdayMultiplier;
  if (overtimeType === 'NIGHT') multiplier = policy.nightMultiplier;
  if (overtimeType === 'HOLIDAY') multiplier = policy.holidayMultiplier;
  if (overtimeType === 'WEEKEND') multiplier = policy.weekdayMultiplier;

  const earnedHours = Math.round(overtimeHours * multiplier * 10) / 10;
  const year = new Date().getFullYear();

  // 지갑에 적립
  await prisma.timeWallet.upsert({
    where: {
      tenantId_employeeId_year_type: {
        tenantId,
        employeeId,
        year,
        type: 'COMP_TIME',
      },
    },
    create: {
      employeeId,
      year,
      type: 'COMP_TIME',
      totalEarned: earnedHours,
      totalRemain: earnedHours,
    },
    update: {
      totalEarned: { increment: earnedHours },
      totalRemain: { increment: earnedHours },
    },
  });

  // 적립 이력 기록
  await prisma.compTimeAccrual.create({
    data: {
      employeeId,
      overtimeRequestId,
      overtimeHours,
      multiplier,
      earnedHours,
    },
  });

  return { earnedHours };
}

/**
 * 연차 시간 지갑 초기화 (연차 부여 시)
 */
export async function initAnnualWallet(
  employeeId: string,
  year: number,
  totalHours: number
) {
  const tenantId = await getTenantId();
  await prisma.timeWallet.upsert({
    where: {
      tenantId_employeeId_year_type: {
        tenantId,
        employeeId,
        year,
        type: 'ANNUAL',
      },
    },
    create: {
      employeeId,
      year,
      type: 'ANNUAL',
      totalEarned: totalHours,
      totalRemain: totalHours,
    },
    update: {
      totalEarned: totalHours,
      totalRemain: { set: totalHours },
    },
  });
}

/**
 * 직원의 시간 지갑 잔액 조회
 */
export async function getWalletBalance(employeeId: string, year: number) {
  const wallets = await prisma.timeWallet.findMany({
    where: { employeeId, year },
  });

  const compTime = wallets.find((w) => w.type === 'COMP_TIME');
  const annual = wallets.find((w) => w.type === 'ANNUAL');
  const policy = await getCompensationPolicy();

  return {
    compTime: {
      earned: compTime?.totalEarned ?? 0,
      used: compTime?.totalUsed ?? 0,
      remain: compTime?.totalRemain ?? 0,
    },
    annual: {
      earned: annual?.totalEarned ?? 0,
      used: annual?.totalUsed ?? 0,
      remain: annual?.totalRemain ?? 0,
    },
    totalRemainHours:
      (compTime?.totalRemain ?? 0) + (annual?.totalRemain ?? 0),
    totalRemainDays:
      Math.round(
        ((compTime?.totalRemain ?? 0) + (annual?.totalRemain ?? 0)) /
          policy.dailyWorkHours *
          10
      ) / 10,
    dailyWorkHours: policy.dailyWorkHours,
    halfDayHours: policy.halfDayHours,
  };
}
