import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: '인증 필요' }, { status: 401 });

    if (!['SYSTEM_ADMIN', 'COMPANY_ADMIN'].includes(user.role)) {
      return NextResponse.json({ message: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const body = await request.json();
    const { fromYear } = body;

    if (!fromYear) {
      return NextResponse.json({ message: 'fromYear는 필수입니다.' }, { status: 400 });
    }

    const toYear = fromYear + 1;

    // Check carry-over policy from SystemConfig
    const carryOverEnabled = await prisma.systemConfig.findUnique({
      where: { key: 'leave_carry_over_enabled' },
    });
    const maxCarryOverDays = await prisma.systemConfig.findUnique({
      where: { key: 'leave_carry_over_max_days' },
    });
    const carryOverExpiryMonths = await prisma.systemConfig.findUnique({
      where: { key: 'leave_carry_over_expiry_months' },
    });

    if (carryOverEnabled?.value !== 'true') {
      return NextResponse.json(
        { message: '이월 기능이 비활성화되어 있습니다.' },
        { status: 400 }
      );
    }

    const maxDays = maxCarryOverDays ? parseFloat(maxCarryOverDays.value) : 0;
    const expiryMonths = carryOverExpiryMonths ? parseInt(carryOverExpiryMonths.value) : 3;

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

    let carryOverCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const balance of balances) {
      try {
        // Check if already carried over
        const existingCarryOver = await prisma.leaveGrant.findFirst({
          where: {
            employeeId: balance.employeeId,
            leaveTypeCode: 'ANNUAL',
            grantReason: { contains: `${fromYear}년 이월` },
            periodStart: { gte: new Date(toYear, 0, 1) },
          },
        });

        if (existingCarryOver) {
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

        // Create carry-over grant
        await prisma.leaveGrant.create({
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

        // Update or create balance for toYear
        const existingBalance = await prisma.leaveBalance.findUnique({
          where: {
            employeeId_year_leaveTypeCode: {
              employeeId: balance.employeeId,
              year: toYear,
              leaveTypeCode: 'ANNUAL',
            },
          },
        });

        if (existingBalance) {
          await prisma.leaveBalance.update({
            where: { id: existingBalance.id },
            data: {
              totalGranted: { increment: carryDays },
              totalRemain: { increment: carryDays },
            },
          });
        } else {
          await prisma.leaveBalance.create({
            data: {
              employeeId: balance.employeeId,
              year: toYear,
              leaveTypeCode: 'ANNUAL',
              totalGranted: carryDays,
              totalUsed: 0,
              totalRemain: carryDays,
            },
          });
        }

        carryOverCount++;
      } catch (err) {
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
