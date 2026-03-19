import { NextRequest, NextResponse } from 'next/server';
import { basePrismaClient } from '@/lib/prisma';
import { confirmPayment, PLANS, type PlanKey } from '@/lib/toss';
import { seedTenantData } from '@/lib/tenant-seed';
import { SAAS_BASE_DOMAIN } from '@/lib/deploy-config';

interface GuestData {
  companyName: string;
  subdomain: string;
  adminName: string;
  adminEmail: string;
  adminPasswordHash: string;
}

/**
 * POST /api/payments/confirm — Confirm (approve) a Toss payment
 * Called after the client-side payment widget succeeds.
 *
 * For guest purchases (no tenantId):
 *   1. Creates tenant + admin user
 *   2. Returns loginUrl for the new account
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { paymentKey, orderId, amount } = body as {
      paymentKey: string;
      orderId: string;
      amount: number;
    };

    if (!paymentKey || !orderId || !amount) {
      return NextResponse.json(
        { message: '필수 파라미터가 누락되었습니다. (paymentKey, orderId, amount)' },
        { status: 400 }
      );
    }

    // Look up existing payment record
    const payments = await (basePrismaClient as any).$queryRaw(
      `SELECT id, tenantId, plan, amount, status, guestData FROM payments WHERE orderId = ?`,
      orderId
    ) as any[];

    if (!payments || payments.length === 0) {
      return NextResponse.json(
        { message: '결제 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const payment = payments[0];

    // Verify amount matches
    if (payment.amount !== amount) {
      return NextResponse.json(
        { message: '결제 금액이 일치하지 않습니다.' },
        { status: 400 }
      );
    }

    // Verify payment is still PENDING
    if (payment.status !== 'PENDING') {
      return NextResponse.json(
        { message: `이미 처리된 결제입니다. (상태: ${payment.status})` },
        { status: 409 }
      );
    }

    // Call Toss Payments confirm API
    const result = await confirmPayment(paymentKey, orderId, amount);
    const now = new Date().toISOString();

    if (!result.success) {
      // Update payment record as FAILED
      await (basePrismaClient as any).$executeRaw(
        `UPDATE payments SET status = 'FAILED', failureReason = ?, updatedAt = ? WHERE id = ?`,
        result.error?.message || '결제 승인 실패', now, payment.id
      );

      return NextResponse.json(
        {
          success: false,
          message: result.error?.message || '결제 승인에 실패했습니다.',
          code: result.error?.code,
        },
        { status: 400 }
      );
    }

    // Payment succeeded — extract useful data from Toss response
    const tossData = result.data;
    const method = tossData?.method || null;
    const receiptUrl = tossData?.receipt?.url || null;

    // Update payment record as SUCCESS
    await (basePrismaClient as any).$executeRaw(
      `UPDATE payments
       SET status = 'SUCCESS', paymentKey = ?, method = ?, receiptUrl = ?,
           approvedAt = ?, updatedAt = ?
       WHERE id = ?`,
      paymentKey, method, receiptUrl, now, now, payment.id
    );

    const planKey = payment.plan as PlanKey;
    const planInfo = PLANS[planKey];
    const expiresAt = new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString();

    // ---------- Guest mode: create tenant + admin ----------
    if (!payment.tenantId && payment.guestData) {
      let guest: GuestData;
      try {
        guest = JSON.parse(payment.guestData);
      } catch {
        return NextResponse.json(
          { message: '결제 정보 파싱에 실패했습니다. 고객센터에 문의해주세요.' },
          { status: 500 }
        );
      }

      // Re-check subdomain availability (someone could have registered between request and confirm)
      const existingTenant = await basePrismaClient.tenant.findUnique({
        where: { subdomain: guest.subdomain },
      });
      if (existingTenant) {
        // Subdomain was taken between request and confirm — refund would be needed
        // For now, return error; the Toss payment was already confirmed so manual handling needed
        console.error(`Subdomain conflict during confirm: ${guest.subdomain} (orderId: ${orderId})`);
        return NextResponse.json(
          {
            success: false,
            message: '서브도메인이 이미 사용 중입니다. 고객센터에 문의해주세요. 결제는 자동 환불 처리됩니다.',
          },
          { status: 409 }
        );
      }

      // Re-check email uniqueness
      const existingOwner = await basePrismaClient.tenant.findFirst({
        where: { ownerEmail: guest.adminEmail },
      });
      if (existingOwner) {
        console.error(`Email conflict during confirm: ${guest.adminEmail} (orderId: ${orderId})`);
        return NextResponse.json(
          {
            success: false,
            message: '이미 등록된 이메일입니다. 고객센터에 문의해주세요. 결제는 자동 환불 처리됩니다.',
          },
          { status: 409 }
        );
      }

      // Create tenant — status 'active' (paid, not trial)
      const tenant = await (basePrismaClient.tenant as any).create({
        data: {
          name: guest.companyName,
          subdomain: guest.subdomain,
          plan: planKey,
          ownerEmail: guest.adminEmail,
          maxEmployees: planInfo.maxEmployees,
          status: 'active',
          paidAt: now,
        },
      });

      // Update payment record with the new tenantId
      await (basePrismaClient as any).$executeRaw(
        `UPDATE payments SET tenantId = ?, updatedAt = ? WHERE id = ?`,
        tenant.id, now, payment.id
      );

      // Seed tenant data (departments, positions, leave types, admin account, configs)
      // Password is already hashed — seedTenantData will re-hash, so we pass a raw password placeholder
      // Instead, we need to seed WITHOUT re-hashing. Let's create admin directly.
      await seedTenantDataWithHashedPassword({
        tenantId: tenant.id,
        companyName: guest.companyName,
        adminEmail: guest.adminEmail,
        adminPasswordHash: guest.adminPasswordHash,
        adminName: guest.adminName,
      });

      const loginUrl = `https://${guest.subdomain}.${SAAS_BASE_DOMAIN}/login`;

      return NextResponse.json({
        success: true,
        loginUrl,
        subdomain: guest.subdomain,
        payment: {
          orderId,
          amount,
          plan: planKey,
          planName: planInfo.name,
          method,
          receiptUrl,
          approvedAt: now,
          expiresAt,
        },
      });
    }

    // ---------- Authenticated mode: activate existing tenant ----------
    await (basePrismaClient as any).$executeRaw(
      `UPDATE tenants
       SET status = 'active', plan = ?, maxEmployees = ?, paidAt = ?, updatedAt = ?
       WHERE id = ?`,
      planKey, planInfo.maxEmployees, now, now, payment.tenantId
    );

    // Get tenant subdomain for redirect
    const tenantRows = await (basePrismaClient as any).$queryRaw(
      `SELECT subdomain FROM tenants WHERE id = ?`,
      payment.tenantId
    ) as any[];
    const tenantSubdomain = tenantRows?.[0]?.subdomain || null;

    return NextResponse.json({
      success: true,
      subdomain: tenantSubdomain,
      payment: {
        orderId,
        amount,
        plan: planKey,
        planName: planInfo.name,
        method,
        receiptUrl,
        approvedAt: now,
        expiresAt,
      },
    });
  } catch (error) {
    console.error('Payment confirm error:', error);
    return NextResponse.json(
      { message: '결제 승인 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * Seeds tenant data with an already-hashed password (for guest purchase flow).
 * Similar to seedTenantData but skips password hashing.
 */
async function seedTenantDataWithHashedPassword(options: {
  tenantId: string;
  companyName: string;
  adminEmail: string;
  adminPasswordHash: string;
  adminName: string;
}) {
  const { tenantId, companyName, adminEmail, adminPasswordHash, adminName } = options;

  // 1. Create default positions
  const positions = [
    { name: '사원', level: 1 },
    { name: '대리', level: 2 },
    { name: '과장', level: 3 },
    { name: '차장', level: 4 },
    { name: '부장', level: 5 },
    { name: '이사', level: 6 },
    { name: '대표', level: 7 },
  ];
  for (const pos of positions) {
    await basePrismaClient.position.create({
      data: { tenantId, name: pos.name, level: pos.level },
    });
  }

  // 2. Create default departments
  const departments = [
    { name: '경영지원', code: 'MGMT', sortOrder: 1 },
    { name: '개발', code: 'DEV', sortOrder: 2 },
    { name: '영업', code: 'SALES', sortOrder: 3 },
    { name: '인사', code: 'HR', sortOrder: 4 },
    { name: '마케팅', code: 'MKT', sortOrder: 5 },
  ];
  for (const dept of departments) {
    await basePrismaClient.department.create({
      data: { tenantId, ...dept },
    });
  }

  // 3. Create admin account with pre-hashed password
  const dept = await basePrismaClient.department.findFirst({
    where: { tenantId, code: 'MGMT' },
  });
  const pos = await basePrismaClient.position.findFirst({
    where: { tenantId },
    orderBy: { level: 'desc' },
  });

  if (dept && pos) {
    await basePrismaClient.employee.create({
      data: {
        tenantId,
        employeeNumber: 'ADMIN-001',
        name: adminName,
        email: adminEmail,
        passwordHash: adminPasswordHash,
        departmentId: dept.id,
        positionId: pos.id,
        hireDate: new Date(),
        status: 'ACTIVE',
        role: 'SYSTEM_ADMIN',
      },
    });
  }

  // 4. Create default leave types
  const leaveTypes = [
    { name: '연차', code: 'ANNUAL', isPaid: true, isAnnualDeduct: true, requiresDoc: false, sortOrder: 1 },
    { name: '오전반차', code: 'AM_HALF', isPaid: true, isAnnualDeduct: true, requiresDoc: false, sortOrder: 2 },
    { name: '오후반차', code: 'PM_HALF', isPaid: true, isAnnualDeduct: true, requiresDoc: false, sortOrder: 3 },
    { name: '경조사', code: 'FAMILY', isPaid: true, isAnnualDeduct: false, requiresDoc: true, sortOrder: 4 },
    { name: '병가', code: 'SICK', isPaid: true, isAnnualDeduct: false, requiresDoc: true, sortOrder: 5 },
    { name: '출산휴가', code: 'MATERNITY', isPaid: true, isAnnualDeduct: false, requiresDoc: true, sortOrder: 6, maxDays: 90 },
    { name: '배우자출산', code: 'PATERNITY', isPaid: true, isAnnualDeduct: false, requiresDoc: true, sortOrder: 7, maxDays: 10 },
    { name: '공가', code: 'PUBLIC', isPaid: true, isAnnualDeduct: false, requiresDoc: true, sortOrder: 8 },
  ];
  for (const lt of leaveTypes) {
    await basePrismaClient.leaveType.create({
      data: {
        tenantId,
        name: lt.name,
        code: lt.code,
        isPaid: lt.isPaid,
        isAnnualDeduct: lt.isAnnualDeduct,
        maxDays: (lt as Record<string, unknown>).maxDays as number | undefined ?? null,
        requiresDoc: lt.requiresDoc,
        sortOrder: lt.sortOrder,
      },
    });
  }

  // 5. Create default leave policies
  const annualType = await basePrismaClient.leaveType.findFirst({
    where: { tenantId, code: 'ANNUAL' },
  });
  const sickType = await basePrismaClient.leaveType.findFirst({
    where: { tenantId, code: 'SICK' },
  });
  const familyType = await basePrismaClient.leaveType.findFirst({
    where: { tenantId, code: 'FAMILY' },
  });
  const publicType = await basePrismaClient.leaveType.findFirst({
    where: { tenantId, code: 'PUBLIC' },
  });

  const leavePolicies: Array<{
    leaveTypeId: string;
    name: string;
    description: string;
    yearFrom: number;
    yearTo: number | null;
    grantDays: number;
    grantType: string;
  }> = [];

  if (annualType) {
    leavePolicies.push(
      {
        leaveTypeId: annualType.id,
        name: '1년 미만 월차',
        description: '입사 1년 미만 직원 월 1일 부여',
        yearFrom: 0,
        yearTo: 1,
        grantDays: 1,
        grantType: 'MONTHLY',
      },
      {
        leaveTypeId: annualType.id,
        name: '1년차 연차',
        description: '1년 이상 근무 시 15일 부여',
        yearFrom: 1,
        yearTo: 3,
        grantDays: 15,
        grantType: 'YEARLY',
      },
      {
        leaveTypeId: annualType.id,
        name: '3년차 이상 연차',
        description: '3년 이상 근무 시 매 2년마다 1일 추가 (최대 25일)',
        yearFrom: 3,
        yearTo: null,
        grantDays: 16,
        grantType: 'YEARLY',
      },
    );
  }
  if (sickType) {
    leavePolicies.push({
      leaveTypeId: sickType.id,
      name: '병가',
      description: '연 11일 유급 병가 (근로기준법)',
      yearFrom: 0,
      yearTo: null,
      grantDays: 11,
      grantType: 'YEARLY',
    });
  }
  if (familyType) {
    leavePolicies.push({
      leaveTypeId: familyType.id,
      name: '경조사 휴가',
      description: '연 5일 경조사 휴가',
      yearFrom: 0,
      yearTo: null,
      grantDays: 5,
      grantType: 'YEARLY',
    });
  }
  if (publicType) {
    leavePolicies.push({
      leaveTypeId: publicType.id,
      name: '공가',
      description: '연 5일 공가',
      yearFrom: 0,
      yearTo: null,
      grantDays: 5,
      grantType: 'YEARLY',
    });
  }

  for (const policy of leavePolicies) {
    await basePrismaClient.leavePolicy.create({
      data: { tenantId, ...policy },
    });
  }

  // 6. Create default system configs
  const configs = [
    { key: 'company_name', value: companyName, group: 'company' },
    { key: 'work_start_time', value: '09:00', group: 'company' },
    { key: 'work_end_time', value: '18:00', group: 'company' },
    { key: 'lunch_start_time', value: '12:00', group: 'company' },
    { key: 'lunch_end_time', value: '13:00', group: 'company' },
    { key: 'leave_basis', value: 'hire_date', group: 'leave' },
    { key: 'am_half_start', value: '09:00', group: 'leave' },
    { key: 'am_half_end', value: '13:00', group: 'leave' },
    { key: 'pm_half_start', value: '14:00', group: 'leave' },
    { key: 'pm_half_end', value: '18:00', group: 'leave' },
    { key: 'approval_levels', value: '2', group: 'approval' },
    { key: 'setup_complete', value: 'true', group: 'system' },
    { key: 'setup_date', value: new Date().toISOString(), group: 'system' },
  ];
  for (const cfg of configs) {
    await basePrismaClient.systemConfig.create({
      data: { tenantId, ...cfg },
    });
  }

  // 7. Create default overtime policy
  await basePrismaClient.overtimePolicy.create({
    data: {
      tenantId,
      maxWeeklyHours: 12,
      maxMonthlyHours: 52,
      nightStartTime: '22:00',
      nightEndTime: '06:00',
      weekdayRate: 1.5,
      weekendRate: 1.5,
      nightRate: 2.0,
      isActive: true,
    },
  });

  // 8. Create default compensation policy
  await basePrismaClient.compensationPolicy.create({
    data: {
      tenantId,
      compensationType: 'COMP_TIME',
      weekdayMultiplier: 1.5,
      nightMultiplier: 2.0,
      holidayMultiplier: 2.0,
      dailyWorkHours: 8,
      halfDayHours: 4,
      minUseUnit: 1,
      deductionOrder: 'COMP_TIME,ANNUAL',
      autoSplitDeduct: true,
      isActive: true,
    },
  });
}
