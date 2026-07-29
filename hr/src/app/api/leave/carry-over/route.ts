import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';
import { getTenantId } from '@/lib/tenant-context';
import { findInChunks } from '@/lib/db-utils';
import { updateStmt, type BatchStatement } from '@/lib/d1-client';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: '인증 필요' }, { status: 401 });

    if (!['SYSTEM_ADMIN', 'COMPANY_ADMIN'].includes(user.role)) {
      return NextResponse.json({ message: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const tenantId = await getTenantId();
    const body = await request.json();
    const { fromYear } = body;

    if (!fromYear) {
      return NextResponse.json({ message: 'fromYear는 필수입니다.' }, { status: 400 });
    }

    const toYear = fromYear + 1;

    // Check carry-over policy from SystemConfig (3 queries → 1 query)
    const configs = await prisma.systemConfig.findMany({
      where: { key: { in: ['leave_carry_over_enabled', 'leave_carry_over_max_days', 'leave_carry_over_expiry_months'] } },
    });
    const configMap = Object.fromEntries(configs.map(c => [c.key, c.value]));
    const carryOverEnabledValue = configMap['leave_carry_over_enabled'];
    const maxCarryOverDaysValue = configMap['leave_carry_over_max_days'];
    const carryOverExpiryMonthsValue = configMap['leave_carry_over_expiry_months'];

    if (carryOverEnabledValue !== 'true') {
      return NextResponse.json(
        { message: '이월 기능이 비활성화되어 있습니다.' },
        { status: 400 }
      );
    }

    const maxDays = maxCarryOverDaysValue ? parseFloat(maxCarryOverDaysValue) : 0;
    const expiryMonths = carryOverExpiryMonthsValue ? parseInt(carryOverExpiryMonthsValue) : 3;

    if (maxDays <= 0) {
      return NextResponse.json(
        { message: '최대 이월 일수가 0입니다.' },
        { status: 400 }
      );
    }

    // Get all active employees with remaining balance for fromYear
    const balances = await prisma.leaveBalance.findMany({
      where: {
        year: fromYear,
        leaveTypeCode: 'ANNUAL',
        totalRemain: { gt: 0 },
        employee: { status: 'ACTIVE' },
      },
      include: {
        employee: true,
      },
    });

    // Batch load existing carry-overs (N+1 해소)
    // D1 파라미터 한도(100) 때문에 ID 목록은 나눠 조회한다.
    const balanceEmployeeIds = balances.map((b) => b.employeeId);
    const existingCarryOvers = await findInChunks(balanceEmployeeIds, (ids) =>
      prisma.leaveGrant.findMany({
        where: {
          employeeId: { in: ids },
          leaveTypeCode: 'ANNUAL',
          grantReason: { contains: `${fromYear}년 이월` },
          periodStart: { gte: new Date(toYear, 0, 1) },
        },
      })
    );
    const carryOverSet = new Set(existingCarryOvers.map(g => g.employeeId));

    // 이월 대상의 기존 잔여일수도 미리 모아둔다 (upsert 판정용)
    const existingToYearBalances = await findInChunks(balanceEmployeeIds, (ids) =>
      prisma.leaveBalance.findMany({
        where: { employeeId: { in: ids }, year: toYear, leaveTypeCode: 'ANNUAL' },
      })
    );
    const toYearBalanceSet = new Set(existingToYearBalances.map((b) => b.employeeId));

    let carryOverCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    // [배치화] 직원마다 트랜잭션을 돌리면 100명 규모에서 subrequest 한도에 걸린다.
    // 판정은 메모리에서 끝내고, 확정된 쓰기만 모아 청크로 실행한다.
    const newGrants: Array<Record<string, unknown>> = [];
    const newBalances: Array<Record<string, unknown>> = [];
    const balanceUpdates: BatchStatement[] = [];

    const periodStart = new Date(toYear, 0, 1);
    const periodEnd = new Date(toYear, expiryMonths - 1, 28); // End of expiry month
    // Adjust to actual last day of month
    periodEnd.setDate(new Date(periodEnd.getFullYear(), periodEnd.getMonth() + 1, 0).getDate());

    for (const balance of balances) {
      // Check if already carried over (batch에서 조회, N+1 해소)
      if (carryOverSet.has(balance.employeeId)) {
        skippedCount++;
        continue;
      }

      // Calculate carry-over days (min of remaining and max allowed)
      const carryDays = Math.min(balance.totalRemain, maxDays);

      if (carryDays <= 0) {
        skippedCount++;
        continue;
      }

      newGrants.push({
        employeeId: balance.employeeId,
        leaveTypeCode: 'ANNUAL',
        grantDays: carryDays,
        remainDays: carryDays,
        grantReason: `${fromYear}년 이월`,
        periodStart,
        periodEnd,
      });

      if (toYearBalanceSet.has(balance.employeeId)) {
        balanceUpdates.push(
          updateStmt('leaveBalance', {
            tenantId,
            employeeId: balance.employeeId,
            year: toYear,
            leaveTypeCode: 'ANNUAL',
          }, {
            totalGranted: { increment: carryDays },
            totalRemain: { increment: carryDays },
          })
        );
      } else {
        newBalances.push({
          employeeId: balance.employeeId,
          year: toYear,
          leaveTypeCode: 'ANNUAL',
          totalGranted: carryDays,
          totalUsed: 0,
          totalRemain: carryDays,
        });
        toYearBalanceSet.add(balance.employeeId);
      }

      carryOverCount++;
    }

    // [쓰기] 청크 단위 원자성 — 실패한 청크만 보고하고 나머지는 진행한다.
    // 이월은 재실행해도 이미 이월된 직원을 건너뛰므로 실패분만 다시 돌리면 복구된다.
    const CHUNK = 50;

    for (let i = 0; i < newGrants.length; i += CHUNK) {
      const part = newGrants.slice(i, i + CHUNK);
      try {
        await (prisma as any).leaveGrant.createMany({ data: part });
      } catch (err) {
        errors.push(`이월 부여 ${i + 1}~${i + part.length}건 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`);
      }
    }
    for (let i = 0; i < newBalances.length; i += CHUNK) {
      const part = newBalances.slice(i, i + CHUNK);
      try {
        await (prisma as any).leaveBalance.createMany({ data: part });
      } catch (err) {
        errors.push(`잔여일수 생성 ${i + 1}~${i + part.length}건 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`);
      }
    }
    for (let i = 0; i < balanceUpdates.length; i += CHUNK) {
      const part = balanceUpdates.slice(i, i + CHUNK);
      try {
        await (prisma as any).$batch(part);
      } catch (err) {
        errors.push(`잔여일수 갱신 ${i + 1}~${i + part.length}건 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`);
      }
    }

    return NextResponse.json({
      message: `이월 처리 완료: ${carryOverCount}명 이월, ${skippedCount}명 스킵`,
      carryOverCount,
      skippedCount,
      errors,
    });
  } catch (error) {
    console.error('Carry over error:', error);
    return NextResponse.json(
      { message: '이월 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
