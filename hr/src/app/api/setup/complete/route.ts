import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { isSQLiteMode } from '@/lib/db-utils';
import { isSetupComplete } from '@/lib/setup-config';

async function seedDatabaseWithPrisma(
  admin: { employeeNumber: string; name: string; email: string; password: string; department: string; position: string },
  company: { name: string; bizNumber?: string; representative?: string; address?: string; workStartTime?: string; workEndTime?: string; lunchStartTime?: string; lunchEndTime?: string; serverUrl?: string },
  policies: { leaveBasis?: string; amHalfStart?: string; amHalfEnd?: string; pmHalfStart?: string; pmHalfEnd?: string; approvalLevels?: number; unusedLeavePolicy?: string }
) {
  // 1. Create positions
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
    await prisma.position.upsert({
      where: { name: pos.name },
      update: { level: pos.level },
      create: pos,
    });
  }

  // 2. Create departments
  const departments = [
    { name: '경영지원', code: 'MGMT', sortOrder: 1 },
    { name: '개발', code: 'DEV', sortOrder: 2 },
    { name: '영업', code: 'SALES', sortOrder: 3 },
    { name: '인사', code: 'HR', sortOrder: 4 },
    { name: '마케팅', code: 'MKT', sortOrder: 5 },
  ];
  for (const dept of departments) {
    await prisma.department.upsert({
      where: { code: dept.code },
      update: {},
      create: dept,
    });
  }

  // 3. Create admin account
  const passwordHash = await hash(admin.password, 12);
  const dept = await prisma.department.findFirst({ where: { code: 'MGMT' } });

  // Find position: exact name match → highest level fallback
  let pos = await prisma.position.findFirst({ where: { name: admin.position } });
  if (!pos) {
    pos = await prisma.position.findFirst({ orderBy: { level: 'desc' } });
  }

  if (dept && pos) {
    await prisma.employee.upsert({
      where: { email: admin.email },
      update: {
        passwordHash,
        name: admin.name,
        employeeNumber: admin.employeeNumber,
        departmentId: dept.id,
        positionId: pos.id,
        status: 'ACTIVE',
        role: 'SYSTEM_ADMIN',
      },
      create: {
        employeeNumber: admin.employeeNumber,
        name: admin.name,
        email: admin.email,
        passwordHash,
        departmentId: dept.id,
        positionId: pos.id,
        hireDate: new Date(),
        status: 'ACTIVE',
        role: 'SYSTEM_ADMIN',
      },
    });
  }

  // 4. Create leave types
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
    await prisma.leaveType.upsert({
      where: { code: lt.code },
      update: {},
      create: {
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

  // 5. Leave policies (연차 + 병가 + 경조사 + 공가)
  const annualType = await prisma.leaveType.findUnique({ where: { code: 'ANNUAL' } });
  const sickType = await prisma.leaveType.findUnique({ where: { code: 'SICK' } });
  const familyType = await prisma.leaveType.findUnique({ where: { code: 'FAMILY' } });
  const publicType = await prisma.leaveType.findUnique({ where: { code: 'PUBLIC' } });

  const defaultPolicies: { leaveTypeId: string; name: string; description: string; yearFrom: number; yearTo: number | null; grantDays: number; grantType: 'YEARLY' | 'MONTHLY' | 'ONCE' }[] = [];

  if (annualType) {
    defaultPolicies.push(
      { leaveTypeId: annualType.id, name: '1년 미만 월차', description: '입사 1년 미만 직원 월 1일 부여', yearFrom: 0, yearTo: 1, grantDays: 1, grantType: 'MONTHLY' },
      { leaveTypeId: annualType.id, name: '1년차 연차', description: '1년 이상 근무 시 15일 부여', yearFrom: 1, yearTo: 3, grantDays: 15, grantType: 'YEARLY' },
      { leaveTypeId: annualType.id, name: '3년차 이상 연차', description: '3년 이상 근무 시 매 2년마다 1일 추가 (최대 25일)', yearFrom: 3, yearTo: null, grantDays: 16, grantType: 'YEARLY' },
    );
  }
  if (sickType) {
    defaultPolicies.push({ leaveTypeId: sickType.id, name: '병가', description: '연 11일 유급 병가 (근로기준법)', yearFrom: 0, yearTo: null, grantDays: 11, grantType: 'YEARLY' });
  }
  if (familyType) {
    defaultPolicies.push({ leaveTypeId: familyType.id, name: '경조사 휴가', description: '연 5일 경조사 휴가', yearFrom: 0, yearTo: null, grantDays: 5, grantType: 'YEARLY' });
  }
  if (publicType) {
    defaultPolicies.push({ leaveTypeId: publicType.id, name: '공가', description: '연 5일 공가', yearFrom: 0, yearTo: null, grantDays: 5, grantType: 'YEARLY' });
  }

  for (const lp of defaultPolicies) {
    const existing = await prisma.leavePolicy.findFirst({ where: { name: lp.name } });
    if (!existing) {
      await prisma.leavePolicy.create({ data: lp });
    }
  }

  // 6. Store system configs
  const configs = [
    { key: 'company_name', value: company.name, group: 'company' },
    { key: 'biz_number', value: company.bizNumber || '', group: 'company' },
    { key: 'representative', value: company.representative || '', group: 'company' },
    { key: 'address', value: company.address || '', group: 'company' },
    { key: 'work_start_time', value: company.workStartTime || '09:00', group: 'company' },
    { key: 'work_end_time', value: company.workEndTime || '18:00', group: 'company' },
    { key: 'lunch_start_time', value: company.lunchStartTime || '12:00', group: 'company' },
    { key: 'lunch_end_time', value: company.lunchEndTime || '13:00', group: 'company' },
    { key: 'server_url', value: company.serverUrl || 'http://localhost:3000', group: 'company' },
    { key: 'leave_basis', value: policies.leaveBasis || 'hire_date', group: 'leave' },
    { key: 'am_half_start', value: policies.amHalfStart || '09:00', group: 'leave' },
    { key: 'am_half_end', value: policies.amHalfEnd || '13:00', group: 'leave' },
    { key: 'pm_half_start', value: policies.pmHalfStart || '14:00', group: 'leave' },
    { key: 'pm_half_end', value: policies.pmHalfEnd || '18:00', group: 'leave' },
    { key: 'approval_levels', value: String(policies.approvalLevels || 2), group: 'approval' },
    { key: 'unused_leave_policy', value: policies.unusedLeavePolicy || 'expire', group: 'leave' },
    { key: 'setup_complete', value: 'true', group: 'system' },
    { key: 'setup_date', value: new Date().toISOString(), group: 'system' },
  ];
  for (const cfg of configs) {
    await prisma.systemConfig.upsert({
      where: { key: cfg.key },
      update: { value: cfg.value },
      create: cfg,
    });
  }

  // 7. Default overtime policy
  const existingPolicy = await prisma.overtimePolicy.findFirst();
  if (!existingPolicy) {
    await prisma.overtimePolicy.create({
      data: {
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
  }
}

async function seedDatabaseWithPg(
  admin: { employeeNumber: string; name: string; email: string; password: string; department: string; position: string },
  company: { name: string; bizNumber?: string; representative?: string; address?: string; workStartTime?: string; workEndTime?: string; lunchStartTime?: string; lunchEndTime?: string; serverUrl?: string },
  policies: { leaveBasis?: string; amHalfStart?: string; amHalfEnd?: string; pmHalfStart?: string; pmHalfEnd?: string; approvalLevels?: number; unusedLeavePolicy?: string },
  connectionConfig: Record<string, unknown>
) {
  const { Client } = require('pg');
  const client = new Client(connectionConfig);
  await client.connect();

  try {
    // 1. Create positions
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
      await client.query(
        `INSERT INTO positions (id, name, level, "isActive", "createdAt", "updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, true, NOW(), NOW())
         ON CONFLICT (name) DO UPDATE SET level = $2, "updatedAt" = NOW()`,
        [pos.name, pos.level]
      );
      await client.query(
        `UPDATE positions SET name = $1, "updatedAt" = NOW() WHERE level = $2 AND name != $1`,
        [pos.name, pos.level]
      );
    }

    // 2. Create departments
    const departments = [
      { name: '경영지원', code: 'MGMT', sortOrder: 1 },
      { name: '개발', code: 'DEV', sortOrder: 2 },
      { name: '영업', code: 'SALES', sortOrder: 3 },
      { name: '인사', code: 'HR', sortOrder: 4 },
      { name: '마케팅', code: 'MKT', sortOrder: 5 },
    ];
    for (const dept of departments) {
      await client.query(
        `INSERT INTO departments (id, name, code, "sortOrder", "isActive", "createdAt", "updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, true, NOW(), NOW())
         ON CONFLICT (code) DO NOTHING`,
        [dept.name, dept.code, dept.sortOrder]
      );
    }

    // 3. Create admin account
    const passwordHash = await hash(admin.password, 12);
    const deptResult = await client.query(`SELECT id FROM departments WHERE code = 'MGMT'`);
    let posResult = await client.query(`SELECT id FROM positions WHERE name = $1`, [admin.position]);
    if (posResult.rows.length === 0) {
      posResult = await client.query(`SELECT id FROM positions WHERE name LIKE $1 ORDER BY level DESC LIMIT 1`, [`%${(admin.position || '대표').replace('이사', '')}%`]);
    }
    if (posResult.rows.length === 0) {
      posResult = await client.query(`SELECT id FROM positions ORDER BY level DESC LIMIT 1`);
    }

    if (deptResult.rows.length > 0 && posResult.rows.length > 0) {
      await client.query(
        `INSERT INTO employees (id, "employeeNumber", name, email, "passwordHash", "departmentId", "positionId", "hireDate", status, role, "createdAt", "updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, NOW(), 'ACTIVE', 'SYSTEM_ADMIN', NOW(), NOW())
         ON CONFLICT (email) DO UPDATE SET
           "passwordHash" = $4,
           name = $2,
           "employeeNumber" = $1,
           "departmentId" = $5,
           "positionId" = $6,
           "updatedAt" = NOW()`,
        [admin.employeeNumber, admin.name, admin.email, passwordHash, deptResult.rows[0].id, posResult.rows[0].id]
      );
    }

    // 4. Create leave types
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
      await client.query(
        `INSERT INTO leave_types (id, name, code, "isPaid", "isAnnualDeduct", "maxDays", "requiresDoc", "isActive", "sortOrder", "createdAt", "updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, true, $7, NOW(), NOW())
         ON CONFLICT (code) DO NOTHING`,
        [lt.name, lt.code, lt.isPaid, lt.isAnnualDeduct, (lt as Record<string, unknown>).maxDays ?? null, lt.requiresDoc, lt.sortOrder]
      );
    }

    // 5. Leave policies (연차 + 병가 + 경조사 + 공가)
    const policyLeaveTypes = [
      { code: 'ANNUAL', policies: [
        { name: '1년 미만 월차', description: '입사 1년 미만 직원 월 1일 부여', yearFrom: 0, yearTo: 1, grantDays: 1, grantType: 'MONTHLY' },
        { name: '1년차 연차', description: '1년 이상 근무 시 15일 부여', yearFrom: 1, yearTo: 3, grantDays: 15, grantType: 'YEARLY' },
        { name: '3년차 이상 연차', description: '3년 이상 근무 시 매 2년마다 1일 추가 (최대 25일)', yearFrom: 3, yearTo: null, grantDays: 16, grantType: 'YEARLY' },
      ]},
      { code: 'SICK', policies: [
        { name: '병가', description: '연 11일 유급 병가 (근로기준법)', yearFrom: 0, yearTo: null, grantDays: 11, grantType: 'YEARLY' },
      ]},
      { code: 'FAMILY', policies: [
        { name: '경조사 휴가', description: '연 5일 경조사 휴가', yearFrom: 0, yearTo: null, grantDays: 5, grantType: 'YEARLY' },
      ]},
      { code: 'PUBLIC', policies: [
        { name: '공가', description: '연 5일 공가', yearFrom: 0, yearTo: null, grantDays: 5, grantType: 'YEARLY' },
      ]},
    ];

    for (const group of policyLeaveTypes) {
      const ltResult = await client.query(`SELECT id FROM leave_types WHERE code = $1`, [group.code]);
      if (ltResult.rows.length === 0) continue;
      const leaveTypeId = ltResult.rows[0].id;

      for (const p of group.policies) {
        const existing = await client.query(`SELECT id FROM leave_policies WHERE name = $1`, [p.name]);
        if (existing.rows.length === 0) {
          await client.query(
            `INSERT INTO leave_policies (id, "leaveTypeId", name, description, "yearFrom", "yearTo", "grantDays", "grantType", "isActive", "createdAt", "updatedAt")
             VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())`,
            [leaveTypeId, p.name, p.description, p.yearFrom, p.yearTo, p.grantDays, p.grantType]
          );
        }
      }
    }

    // 6. Store system configs
    const configs = [
      { key: 'company_name', value: company.name, group: 'company' },
      { key: 'biz_number', value: company.bizNumber || '', group: 'company' },
      { key: 'representative', value: company.representative || '', group: 'company' },
      { key: 'address', value: company.address || '', group: 'company' },
      { key: 'work_start_time', value: company.workStartTime || '09:00', group: 'company' },
      { key: 'work_end_time', value: company.workEndTime || '18:00', group: 'company' },
      { key: 'lunch_start_time', value: company.lunchStartTime || '12:00', group: 'company' },
      { key: 'lunch_end_time', value: company.lunchEndTime || '13:00', group: 'company' },
      { key: 'server_url', value: company.serverUrl || 'http://localhost:3000', group: 'company' },
      { key: 'leave_basis', value: policies.leaveBasis || 'hire_date', group: 'leave' },
      { key: 'am_half_start', value: policies.amHalfStart || '09:00', group: 'leave' },
      { key: 'am_half_end', value: policies.amHalfEnd || '13:00', group: 'leave' },
      { key: 'pm_half_start', value: policies.pmHalfStart || '14:00', group: 'leave' },
      { key: 'pm_half_end', value: policies.pmHalfEnd || '18:00', group: 'leave' },
      { key: 'approval_levels', value: String(policies.approvalLevels || 2), group: 'approval' },
      { key: 'unused_leave_policy', value: policies.unusedLeavePolicy || 'expire', group: 'leave' },
      { key: 'setup_complete', value: 'true', group: 'system' },
      { key: 'setup_date', value: new Date().toISOString(), group: 'system' },
    ];
    for (const cfg of configs) {
      await client.query(
        `INSERT INTO system_configs (id, key, value, "group", "createdAt", "updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, NOW(), NOW())
         ON CONFLICT (key) DO UPDATE SET value = $2, "updatedAt" = NOW()`,
        [cfg.key, cfg.value, cfg.group]
      );
    }

    // 7. Default overtime policy
    const existingPolicy = await client.query(`SELECT id FROM overtime_policies LIMIT 1`);
    if (existingPolicy.rows.length === 0) {
      await client.query(
        `INSERT INTO overtime_policies (id, "maxWeeklyHours", "maxMonthlyHours", "nightStartTime", "nightEndTime", "weekdayRate", "weekendRate", "nightRate", "isActive", "createdAt", "updatedAt")
         VALUES (gen_random_uuid()::text, 12, 52, '22:00', '06:00', 1.5, 1.5, 2.0, true, NOW(), NOW())`
      );
    }
  } finally {
    await client.end();
  }
}

export async function POST(request: NextRequest) {
  try {
    // Guard: block if setup already completed
    if (await isSetupComplete()) {
      return NextResponse.json(
        { message: '이미 초기 설정이 완료되었습니다.' },
        { status: 403 }
      );
    }

    const data = await request.json();
    const { db, company, admin, policies } = data;

    if (isSQLiteMode()) {
      // SQLite mode: use Prisma client directly
      await seedDatabaseWithPrisma(admin, company, policies);
    } else {
      // PostgreSQL mode: use pg Client
      const connectionConfig = process.env.DATABASE_URL
        ? { connectionString: process.env.DATABASE_URL }
        : {
            host: db.host,
            port: parseInt(db.port),
            user: db.user,
            password: db.password,
            database: db.database,
          };

      await seedDatabaseWithPg(admin, company, policies, connectionConfig);
    }

    return NextResponse.json({
      success: true,
      message: '시스템 설정이 완료되었습니다. 로그인 페이지로 이동합니다.',
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '알 수 없는 오류';
    return NextResponse.json(
      { success: false, message: `설정 저장 실패: ${msg}` },
      { status: 500 }
    );
  }
}
