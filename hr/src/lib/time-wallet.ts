/**
 * 시간 지갑 (Time Wallet) 자동 차감 엔진
 *
 * 보상시간(COMP_TIME) → 연차시간(ANNUAL) 순서로 자동 분할 차감
 * 관리자가 설정한 차감 순서(deductionOrder)를 따름
 */

import { prisma } from '@/lib/prisma';
import { kstYear } from './kst';
import { getTenantId } from '@/lib/tenant-context';

interface DeductionResult {
  success: boolean;
  totalDeducted: number;
  details: { walletType: string; hours: number }[];
  error?: string;
}

/**
 * 보상 정책 조회 (5분 인메모리 캐시)
 */
interface CompensationPolicyData {
  id: string;
  compensationType: string;
  weekdayMultiplier: number;
  nightMultiplier: number;
  holidayMultiplier: number;
  dailyWorkHours: number;
  halfDayHours: number;
  minUseUnit: number;
  deductionOrder: string;
  autoSplitDeduct: boolean;
  compTimeExpiryYears: number | null;
  isActive: boolean;
}
let _policyCache: { data: CompensationPolicyData; expiresAt: number } | null = null;
const POLICY_CACHE_TTL = 5 * 60 * 1000; // 5분

export async function getCompensationPolicy() {
  if (_policyCache && Date.now() < _policyCache.expiresAt) {
    return _policyCache.data;
  }

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

  _policyCache = { data: policy, expiresAt: Date.now() + POLICY_CACHE_TTL };
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
  // KST 기준 연도. UTC로 읽으면 새해 첫날 오전 적립분이 작년으로 들어간다.
  const year = kstYear();

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

  // 이미 있는 지갑이면 사용분(totalEarned - totalRemain)을 보존해야 한다.
  // remain 을 totalHours 로 통째로 리셋하면 이미 쓴 연차가 부활한다.
  const existing = await prisma.timeWallet.findUnique({
    where: { tenantId_employeeId_year_type: { tenantId, employeeId, year, type: 'ANNUAL' } },
    select: { totalEarned: true, totalRemain: true },
  });

  if (!existing) {
    await prisma.timeWallet.create({
      data: { employeeId, year, type: 'ANNUAL', totalEarned: totalHours, totalRemain: totalHours },
    });
    return;
  }

  // 재부여: 새 부여량으로 earned 를 갱신하되, 이미 사용한 만큼은 remain 에서 뺀다.
  const used = existing.totalEarned - existing.totalRemain;
  await prisma.timeWallet.update({
    where: { tenantId_employeeId_year_type: { tenantId, employeeId, year, type: 'ANNUAL' } },
    data: { totalEarned: totalHours, totalRemain: Math.max(0, totalHours - used) },
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

/**
 * 보상시간 만료 관리 (연도 기반)
 * 적립연도 Y의 보상시간은 (Y + compTimeExpiryYears)년 말까지 유효. 이후 만료.
 */
export interface ExpiringCompTime {
  employeeId: string;
  employeeName: string;
  year: number;
  remain: number;
  expiryYear: number;
  status: 'EXPIRED' | 'EXPIRING';
}

// 만료됐거나 올해 말 만료 예정인 보상시간 목록. 소멸 미설정이면 빈 배열.
export async function listExpiringCompTime(): Promise<ExpiringCompTime[]> {
  const policy = await getCompensationPolicy();
  if (policy.compTimeExpiryYears == null) return [];
  const expiryYears = policy.compTimeExpiryYears;
  const currentYear = kstYear();

  const wallets = await prisma.timeWallet.findMany({
    where: { type: 'COMP_TIME', totalRemain: { gt: 0 } },
    include: { employee: { select: { name: true } } },
  });

  const result: ExpiringCompTime[] = [];
  for (const w of wallets) {
    const expiryYear = w.year + expiryYears;
    if (currentYear > expiryYear) {
      result.push({ employeeId: w.employeeId, employeeName: w.employee?.name ?? '', year: w.year, remain: w.totalRemain, expiryYear, status: 'EXPIRED' });
    } else if (currentYear === expiryYear) {
      result.push({ employeeId: w.employeeId, employeeName: w.employee?.name ?? '', year: w.year, remain: w.totalRemain, expiryYear, status: 'EXPIRING' });
    }
  }
  return result;
}

// 특정 연도 보상시간을 만료 소멸 (관리자 수동). 유효기간이 지난 것만 허용.
// 잔액을 0으로 내리고 totalExpired에 기록 — totalUsed는 건드리지 않아 '사용'과 구분된다.
export async function expireCompTime(employeeId: string, year: number): Promise<{ expired: number }> {
  const policy = await getCompensationPolicy();
  if (policy.compTimeExpiryYears == null) {
    throw new Error('소멸 정책이 설정되어 있지 않습니다.');
  }
  if (kstYear() <= year + policy.compTimeExpiryYears) {
    throw new Error('아직 만료되지 않은 보상시간입니다.');
  }
  const tenantId = await getTenantId();
  const wallet = await prisma.timeWallet.findUnique({
    where: { tenantId_employeeId_year_type: { tenantId, employeeId, year, type: 'COMP_TIME' } },
  });
  if (!wallet || wallet.totalRemain <= 0) return { expired: 0 };

  const amount = wallet.totalRemain;
  await prisma.timeWallet.update({
    where: { id: wallet.id },
    data: { totalRemain: 0, totalExpired: { increment: amount } },
  });
  await prisma.timeDeduction.create({
    data: {
      employeeId,
      walletType: 'COMP_TIME',
      hours: amount,
      description: `보상시간 만료 소멸 (${year}년 적립분, ${amount}시간)`,
    },
  });
  return { expired: amount };
}
