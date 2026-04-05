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
    const existingCarryOvers = await prisma.leaveGrant.findMany({
      where: {
        employeeId: { in: balances.map(b => b.employeeId) },
        leaveTypeCode: 'ANNUAL',
        grantReason: { contains: `${fromYear}년 이월` },
        periodStart: { gte: new Date(toYear, 0, 1) },
      },
    });
    const carryOverSet = new Set(existingCarryOvers.map(g => g.employeeId));

    let carryOverCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const balance of balances) {
      try {
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

        // Calculate expiry date
        const periodStart = new Date(toYear, 0, 1);
        const periodEnd = new Date(toYear, expiryMonths - 1, 28); // End of expiry month
        // Adjust to actual last day of month
        periodEnd.setDate(new Date(periodEnd.getFullYear(), periodEnd.getMonth() + 1, 0).getDate());

        // Transaction: grant + balance atomic (prevents double carry-over)
        await prisma.$transaction(async (tx) => {
          // Double-check inside transaction to prevent concurrent duplicates
          const existing = await tx.leaveGrant.findFirst({
            where: {
              employeeId: balance.employeeId,
              leaveTypeCode: 'ANNUAL',
              grantReason: { contains: `${fromYear}년 이월` },
              periodStart: { gte: new Date(toYear, 0, 1) },
            },
          });
          if (existing) {
            throw new Error('SKIP_DUPLICATE');
          }

          await tx.leaveGrant.create({
            data: {
              employeeId: balance.employeeId,
              leaveTypeCode: 'ANNUAL',
              grantDays: carryDays,
              remainDays: carryDays,
              grantReason: `${fromYear}년 이월`,
              periodStart,
              periodEnd,
            },
          });

          await tx.leaveBalance.upsert({
            where: {
              tenantId_employeeId_year_leaveTypeCode: {
                tenantId,
                employeeId: balance.employeeId,
                year: toYear,
                leaveTypeCode: 'ANNUAL',
              },
            },
            create: {
              employeeId: balance.employeeId,
              year: toYear,
              leaveTypeCode: 'ANNUAL',
              totalGranted: carryDays,
              totalUsed: 0,
              totalRemain: carryDays,
            },
            update: {
              totalGranted: { increment: carryDays },
              totalRemain: { increment: carryDays },
            },
          });
        });

        carryOverCount++;
      } catch (err) {
        if (err instanceof Error && err.message === 'SKIP_DUPLICATE') {
          skippedCount++;
          continue;
        }
        errors.push(
          `${balance.employee.name}(${balance.employee.employeeNumber}): ${err instanceof Error ? err.message : '알 수 없는 오류'}`
        );
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
