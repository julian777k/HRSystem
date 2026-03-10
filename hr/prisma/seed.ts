import { PrismaClient } from '@prisma/client'

const isSQLite = process.env.DB_PROVIDER === 'sqlite'

function createClient() {
  if (isSQLite) {
    return new PrismaClient()
  }
  const { PrismaPg } = require('@prisma/adapter-pg')
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
  return new PrismaClient({ adapter })
}

const prisma = createClient()

async function main() {
  console.log('Seeding database...')

  // 직급 (사원 ~ 대표)
  const positions = [
    { name: '사원', level: 1 },
    { name: '대리', level: 2 },
    { name: '과장', level: 3 },
    { name: '차장', level: 4 },
    { name: '부장', level: 5 },
    { name: '이사', level: 6 },
    { name: '대표', level: 7 },
  ]

  for (const pos of positions) {
    await prisma.position.upsert({
      where: { tenantId_name: { tenantId: '', name: pos.name } },
      update: {},
      create: pos,
    })
  }
  console.log(`  Created ${positions.length} positions`)

  // 부서
  const departments = [
    { name: '경영지원', code: 'MGMT', sortOrder: 1 },
    { name: '개발', code: 'DEV', sortOrder: 2 },
    { name: '영업', code: 'SALES', sortOrder: 3 },
    { name: '인사', code: 'HR', sortOrder: 4 },
    { name: '마케팅', code: 'MKT', sortOrder: 5 },
  ]

  for (const dept of departments) {
    await prisma.department.upsert({
      where: { tenantId_code: { tenantId: '', code: dept.code } },
      update: {},
      create: dept,
    })
  }
  console.log(`  Created ${departments.length} departments`)

  // 휴가 유형
  const leaveTypes = [
    { name: '연차', code: 'ANNUAL', isPaid: true, isAnnualDeduct: true, maxDays: null, requiresDoc: false, sortOrder: 1 },
    { name: '오전반차', code: 'AM_HALF', isPaid: true, isAnnualDeduct: true, maxDays: null, requiresDoc: false, sortOrder: 2 },
    { name: '오후반차', code: 'PM_HALF', isPaid: true, isAnnualDeduct: true, maxDays: null, requiresDoc: false, sortOrder: 3 },
    { name: '경조사', code: 'FAMILY', isPaid: true, isAnnualDeduct: false, maxDays: null, requiresDoc: true, sortOrder: 4 },
    { name: '병가', code: 'SICK', isPaid: true, isAnnualDeduct: false, maxDays: null, requiresDoc: true, sortOrder: 5 },
    { name: '출산휴가', code: 'MATERNITY', isPaid: true, isAnnualDeduct: false, maxDays: 90, requiresDoc: true, sortOrder: 6 },
    { name: '배우자출산', code: 'PATERNITY', isPaid: true, isAnnualDeduct: false, maxDays: 10, requiresDoc: true, sortOrder: 7 },
    { name: '공가', code: 'PUBLIC', isPaid: true, isAnnualDeduct: false, maxDays: null, requiresDoc: true, sortOrder: 8 },
  ]

  for (const lt of leaveTypes) {
    await prisma.leaveType.upsert({
      where: { tenantId_code: { tenantId: '', code: lt.code } },
      update: {},
      create: lt,
    })
  }
  console.log(`  Created ${leaveTypes.length} leave types`)

  // 연차 부여 정책 (근로기준법 기반)
  const annualLeaveType = await prisma.leaveType.findFirst({ where: { code: 'ANNUAL' } })
  const sickLeaveType = await prisma.leaveType.findFirst({ where: { code: 'SICK' } })
  const familyLeaveType = await prisma.leaveType.findFirst({ where: { code: 'FAMILY' } })
  const publicLeaveType = await prisma.leaveType.findFirst({ where: { code: 'PUBLIC' } })

  const leavePolicies: { leaveTypeId: string; name: string; description: string; yearFrom: number; yearTo: number | null; grantDays: number; grantType: 'MONTHLY' | 'YEARLY' | 'ONCE' }[] = []

  if (annualLeaveType) {
    leavePolicies.push(
      {
        leaveTypeId: annualLeaveType.id,
        name: '1년 미만 월차',
        description: '입사 1년 미만 직원 월 1일 부여',
        yearFrom: 0,
        yearTo: 1,
        grantDays: 1,
        grantType: 'MONTHLY',
      },
      {
        leaveTypeId: annualLeaveType.id,
        name: '1년차 연차',
        description: '1년 이상 근무 시 15일 부여',
        yearFrom: 1,
        yearTo: 3,
        grantDays: 15,
        grantType: 'YEARLY',
      },
      {
        leaveTypeId: annualLeaveType.id,
        name: '3년차 이상 연차',
        description: '3년 이상 근무 시 매 2년마다 1일 추가 (최대 25일)',
        yearFrom: 3,
        yearTo: null,
        grantDays: 16,
        grantType: 'YEARLY',
      },
    )
  }

  if (sickLeaveType) {
    leavePolicies.push({
      leaveTypeId: sickLeaveType.id,
      name: '병가',
      description: '연 11일 유급 병가 (근로기준법)',
      yearFrom: 0,
      yearTo: null,
      grantDays: 11,
      grantType: 'YEARLY',
    })
  }

  if (familyLeaveType) {
    leavePolicies.push({
      leaveTypeId: familyLeaveType.id,
      name: '경조사 휴가',
      description: '연 5일 경조사 휴가',
      yearFrom: 0,
      yearTo: null,
      grantDays: 5,
      grantType: 'YEARLY',
    })
  }

  if (publicLeaveType) {
    leavePolicies.push({
      leaveTypeId: publicLeaveType.id,
      name: '공가',
      description: '연 5일 공가',
      yearFrom: 0,
      yearTo: null,
      grantDays: 5,
      grantType: 'YEARLY',
    })
  }

  for (const policy of leavePolicies) {
    const existing = await prisma.leavePolicy.findFirst({
      where: { name: policy.name },
    })
    if (!existing) {
      await prisma.leavePolicy.create({ data: policy })
    }
  }
  console.log(`  Created ${leavePolicies.length} leave policies`)

  // 시간외근무 기본 정책
  const existingOvertimePolicy = await prisma.overtimePolicy.findFirst({
    where: { isActive: true },
  })
  if (!existingOvertimePolicy) {
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
    })
    console.log('  Created default overtime policy')
  }

  // 기본 휴가 결재선
  const existingApprovalLine = await prisma.approvalLine.findFirst({
    where: { isDefault: true, type: 'LEAVE' },
  })
  if (!existingApprovalLine) {
    await prisma.approvalLine.create({
      data: {
        name: '기본 휴가 결재선',
        type: 'LEAVE',
        isDefault: true,
        isActive: true,
        steps: {
          create: [
            {
              stepOrder: 1,
              approverRole: 'DEPT_HEAD',
              actionType: 'APPROVE',
            },
          ],
        },
      },
    })
    console.log('  Created default approval line')
  }

  console.log('Seeding completed.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
