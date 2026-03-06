import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isSetupComplete } from '@/lib/setup-config';

const departments = [
  { name: '경영지원', code: 'MGMT', sortOrder: 1 },
  { name: '개발', code: 'DEV', sortOrder: 2 },
  { name: '영업', code: 'SALES', sortOrder: 3 },
  { name: '인사', code: 'HR', sortOrder: 4 },
  { name: '마케팅', code: 'MKT', sortOrder: 5 },
];

const positions = [
  { name: '사원', level: 1 },
  { name: '대리', level: 2 },
  { name: '과장', level: 3 },
  { name: '차장', level: 4 },
  { name: '부장', level: 5 },
  { name: '이사', level: 6 },
  { name: '대표', level: 7 },
];

const leaveTypes = [
  { name: '연차', code: 'ANNUAL', isPaid: true, requiresDoc: false, isAnnualDeduct: true, sortOrder: 1 },
  { name: '오전반차', code: 'AM_HALF', isPaid: true, requiresDoc: false, isAnnualDeduct: true, sortOrder: 2 },
  { name: '오후반차', code: 'PM_HALF', isPaid: true, requiresDoc: false, isAnnualDeduct: true, sortOrder: 3 },
  { name: '경조사', code: 'FAMILY', isPaid: true, requiresDoc: true, isAnnualDeduct: false, sortOrder: 4 },
  { name: '병가', code: 'SICK', isPaid: true, requiresDoc: true, isAnnualDeduct: false, sortOrder: 5 },
  { name: '출산휴가', code: 'MATERNITY', isPaid: true, requiresDoc: true, isAnnualDeduct: false, sortOrder: 6, maxDays: 90 },
  { name: '배우자출산', code: 'PATERNITY', isPaid: true, requiresDoc: true, isAnnualDeduct: false, sortOrder: 7, maxDays: 10 },
  { name: '공가', code: 'PUBLIC', isPaid: true, requiresDoc: true, isAnnualDeduct: false, sortOrder: 8 },
];

export async function POST() {
  try {
    // Guard: block if setup already completed
    if (await isSetupComplete()) {
      return NextResponse.json(
        { success: false, message: '이미 초기 설정이 완료되었습니다.' },
        { status: 403 }
      );
    }

    // === Departments (Prisma upsert - works on both PG and SQLite) ===
    for (const dept of departments) {
      await prisma.department.upsert({
        where: { code: dept.code },
        update: { name: dept.name },
        create: dept,
      });
    }

    // === Positions ===
    for (const pos of positions) {
      const byLevel = await prisma.position.findUnique({ where: { level: pos.level } });
      if (byLevel) {
        if (byLevel.name !== pos.name) {
          const conflicting = await prisma.position.findUnique({ where: { name: pos.name } });
          if (conflicting && conflicting.id !== byLevel.id) {
            await prisma.employee.updateMany({
              where: { positionId: conflicting.id },
              data: { positionId: byLevel.id },
            });
            await prisma.position.delete({ where: { id: conflicting.id } });
          }
          await prisma.position.update({
            where: { id: byLevel.id },
            data: { name: pos.name },
          });
        }
        continue;
      }

      const byName = await prisma.position.findUnique({ where: { name: pos.name } });
      if (byName) {
        await prisma.position.update({
          where: { id: byName.id },
          data: { level: pos.level },
        });
        continue;
      }

      await prisma.position.create({
        data: { name: pos.name, level: pos.level },
      });
    }

    // === Leave Types (Prisma upsert) ===
    for (const lt of leaveTypes) {
      await prisma.leaveType.upsert({
        where: { code: lt.code },
        update: { name: lt.name },
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

    // === Overtime Policy ===
    const policyCount = await prisma.overtimePolicy.count();
    if (policyCount === 0) {
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

    // === Leave Policies (병가, 경조사, 공가) ===
    const sickType = await prisma.leaveType.findUnique({ where: { code: 'SICK' } });
    const familyType = await prisma.leaveType.findUnique({ where: { code: 'FAMILY' } });
    const publicType = await prisma.leaveType.findUnique({ where: { code: 'PUBLIC' } });
    const annualType = await prisma.leaveType.findUnique({ where: { code: 'ANNUAL' } });

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

    for (const policy of defaultPolicies) {
      const existing = await prisma.leavePolicy.findFirst({ where: { name: policy.name } });
      if (!existing) {
        await prisma.leavePolicy.create({ data: policy });
      }
    }

    const deptCount = await prisma.department.count();
    const posCount = await prisma.position.count();
    const ltCount = await prisma.leaveType.count();

    return NextResponse.json({
      success: true,
      departments: deptCount,
      positions: posCount,
      leaveTypes: ltCount,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '알 수 없는 오류';
    console.error('Seed error:', error);
    return NextResponse.json(
      { success: false, message: `기본 데이터 생성 실패: ${msg}` },
      { status: 500 }
    );
  }
}
