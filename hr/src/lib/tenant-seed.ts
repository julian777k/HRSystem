/**
 * Tenant seed utility - creates default data for a new tenant
 *
 * Called when a super admin provisions a new tenant.
 * Seeds: positions, leave types, overtime policy, compensation policy, system configs
 */

import { basePrismaClient } from './prisma';
import { hashPassword } from '@/lib/password';

interface TenantSeedOptions {
  tenantId: string;
  companyName: string;
  adminEmail: string;
  adminPassword: string;
  adminName?: string;
}

export async function seedTenantData(options: TenantSeedOptions) {
  const { tenantId, companyName, adminEmail, adminPassword, adminName = '관리자' } = options;

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

  // 3. Create admin account
  const passwordHash = await hashPassword(adminPassword);
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
        passwordHash,
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

  // 5. Create default system configs
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

  // 6. Create default overtime policy
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

  // 7. Create default compensation policy
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
