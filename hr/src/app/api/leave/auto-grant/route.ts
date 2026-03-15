import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { basePrismaClient } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';
import { calculateAnnualLeave, getYearsWorked } from '@/lib/leave-calculator';
import { initAnnualWallet, getCompensationPolicy } from '@/lib/time-wallet';
import { getTenantId } from '@/lib/tenant-context';

/** 기본 휴가 정책이 없는 기존 테넌트를 위한 자동 시드 */
async function seedDefaultPolicies(tenantId: string) {
  const db = basePrismaClient;
  const annualType = await db.leaveType.findFirst({ where: { tenantId, code: 'ANNUAL' } });
  const sickType = await db.leaveType.findFirst({ where: { tenantId, code: 'SICK' } });
  const familyType = await db.leaveType.findFirst({ where: { tenantId, code: 'FAMILY' } });
  const publicType = await db.leaveType.findFirst({ where: { tenantId, code: 'PUBLIC' } });

  const policies: Array<Record<string, unknown>> = [];

  if (annualType) {
    policies.push(
      { tenantId, leaveTypeId: annualType.id, name: '1년 미만 월차', description: '입사 1년 미만 직원 월 1일 부여', yearFrom: 0, yearTo: 1, grantDays: 1, grantType: 'MONTHLY' },
      { tenantId, leaveTypeId: annualType.id, name: '1년차 연차', description: '1년 이상 근무 시 15일 부여', yearFrom: 1, yearTo: 3, grantDays: 15, grantType: 'YEARLY' },
      { tenantId, leaveTypeId: annualType.id, name: '3년차 이상 연차', description: '3년 이상 근무 시 매 2년마다 1일 추가 (최대 25일)', yearFrom: 3, yearTo: null, grantDays: 16, grantType: 'YEARLY' },
    );
  }
  if (sickType) {
    policies.push({ tenantId, leaveTypeId: sickType.id, name: '병가', description: '연 11일 유급 병가', yearFrom: 0, yearTo: null, grantDays: 11, grantType: 'YEARLY' });
  }
  if (familyType) {
    policies.push({ tenantId, leaveTypeId: familyType.id, name: '경조사 휴가', description: '연 5일 경조사 휴가', yearFrom: 0, yearTo: null, grantDays: 5, grantType: 'YEARLY' });
  }
  if (publicType) {
    policies.push({ tenantId, leaveTypeId: publicType.id, name: '공가', description: '연 5일 공가', yearFrom: 0, yearTo: null, grantDays: 5, grantType: 'YEARLY' });
  }

  if (policies.length > 0) {
    await db.leavePolicy.createMany({ data: policies as any[] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: '인증 필요' }, { status: 401 });

    if (!['SYSTEM_ADMIN', 'COMPANY_ADMIN'].includes(user.role)) {
      return NextResponse.json({ message: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const tenantId = await getTenantId();
    const body = await request.json();
    const year = body.year || new Date().getFullYear();
    const selectedTypes: string[] | undefined = body.leaveTypeCodes;

    // [FIX] 빈 배열 방어: [] 전달 시 전체 처리로 fallback
    const periodStart = new Date(year, 0, 1);
    const periodEnd = new Date(year, 11, 31);
    const referenceDate = new Date(year, 0, 1);

    // 활성화된 모든 LeavePolicy 조회 (leaveType 포함)
    let allPolicies = await prisma.leavePolicy.findMany({
      where: { isActive: true },
      include: { leaveType: true },
    });

    // 정책이 하나도 없으면 기본 정책 자동 생성
    if (allPolicies.length === 0) {
      await seedDefaultPolicies(tenantId);
      allPolicies = await prisma.leavePolicy.findMany({
        where: { isActive: true },
        include: { leaveType: true },
      });
    }

    // isAnnualDeduct: true인 타입(AM_HALF, PM_HALF)은 제외 (연차 잔여 공유)
    const policies = allPolicies.filter(
      (p) => !p.leaveType.isAnnualDeduct || p.leaveType.code === 'ANNUAL'
    );

    // [FIX] 선택된 타입 필터링 - 빈 배열은 전체 처리
    const filteredPolicies = (selectedTypes && selectedTypes.length > 0)
      ? policies.filter((p) => selectedTypes.includes(p.leaveType.code))
      : policies;

    // 유형별로 정책 그룹화
    const policyByType = new Map<string, typeof filteredPolicies>();
    for (const p of filteredPolicies) {
      const code = p.leaveType.code;
      if (!policyByType.has(code)) policyByType.set(code, []);
      policyByType.get(code)!.push(p);
    }

    // 전직원 조회
    const employees = await prisma.employee.findMany({
      where: { status: 'ACTIVE' },
    });

    // [FIX] getCompensationPolicy를 루프 밖에서 1회만 호출 (N+1 해소)
    const compensationPolicy = await getCompensationPolicy();

    // Batch load all existing grants for the year (N+1 해소)
    const allExistingGrants = await prisma.leaveGrant.findMany({
      where: {
        employeeId: { in: employees.map(e => e.id) },
        periodStart,
        periodEnd,
        grantReason: { endsWith: '자동부여' },
      },
    });
    const grantMap = new Map<string, typeof allExistingGrants[0]>();
    for (const g of allExistingGrants) {
      grantMap.set(`${g.employeeId}:${g.leaveTypeCode}`, g);
    }

    let totalGranted = 0;
    let totalSkipped = 0;
    let totalSupplemented = 0;
    const errors: string[] = [];
    const grantedByType: Record<string, number> = {};

    for (const emp of employees) {
      const yearsWorked = getYearsWorked(emp.hireDate, referenceDate);

      for (const [typeCode, typePolicies] of policyByType) {
        try {
          // [STEP 1] 정책 기반 부여일수 계산 (중복 체크 이전에 수행)
          const matchingPolicies = typePolicies.filter(
            (p) => yearsWorked >= p.yearFrom && (p.yearTo === null || yearsWorked < p.yearTo)
          );

          if (matchingPolicies.length === 0) {
            totalSkipped++;
            continue;
          }

          let grantDays = Math.max(...matchingPolicies.map((p) => p.grantDays));

          // ANNUAL 타입: 근로기준법 법정 최소일수 보장
          if (typeCode === 'ANNUAL') {
            const legalDays = calculateAnnualLeave(emp.hireDate, periodEnd);
            grantDays = Math.max(grantDays, legalDays);
          }

          if (grantDays <= 0) {
            totalSkipped++;
            continue;
          }

          const leaveTypeName = typePolicies[0].leaveType.name;

          // [STEP 2] 기존 부여 확인 — 부족분 보충 지원 (batch에서 조회, N+1 해소)
          const existingGrant = grantMap.get(`${emp.id}:${typeCode}`) || null;

          if (existingGrant) {
            if (existingGrant.grantDays >= grantDays) {
              // 이미 충분히 부여됨 → 스킵
              totalSkipped++;
              continue;
            }

            // [FIX] 부족분 보충: 기존 부여가 계산값보다 적으면 차액만큼 보충
            const diff = grantDays - existingGrant.grantDays;

            await prisma.$transaction(async (tx) => {
              // 기존 grant 업데이트
              await tx.leaveGrant.update({
                where: { id: existingGrant.id },
                data: {
                  grantDays,
                  remainDays: { increment: diff },
                },
              });

              // balance 보충
              await tx.leaveBalance.upsert({
                where: {
                  tenantId_employeeId_year_leaveTypeCode: {
                    tenantId,
                    employeeId: emp.id,
                    year,
                    leaveTypeCode: typeCode,
                  },
                },
                create: {
                  employeeId: emp.id,
                  year,
                  leaveTypeCode: typeCode,
                  totalGranted: grantDays,
                  totalUsed: 0,
                  totalRemain: grantDays,
                },
                update: {
                  totalGranted: { increment: diff },
                  totalRemain: { increment: diff },
                },
              });
            });

            if (typeCode === 'ANNUAL') {
              await initAnnualWallet(emp.id, year, grantDays * compensationPolicy.dailyWorkHours);
            }

            totalSupplemented++;
            grantedByType[typeCode] = (grantedByType[typeCode] || 0) + 1;
            continue;
          }

          // [STEP 3] 신규 부여 — 트랜잭션으로 grant + balance 원자적 처리
          await prisma.$transaction(async (tx) => {
            // 트랜잭션 내 이중 체크 (동시 요청 방어)
            const doubleCheck = await tx.leaveGrant.findFirst({
              where: {
                employeeId: emp.id,
                leaveTypeCode: typeCode,
                periodStart,
                periodEnd,
                grantReason: { startsWith: `${year}년`, endsWith: '자동부여' },
              },
            });
            if (doubleCheck) {
              if (doubleCheck.grantDays >= grantDays) {
                throw new Error('SKIP_DUPLICATE');
              }
              // 동시 요청으로 부족하게 생성된 경우 보충
              const diff = grantDays - doubleCheck.grantDays;
              await tx.leaveGrant.update({
                where: { id: doubleCheck.id },
                data: { grantDays, remainDays: { increment: diff } },
              });
              await tx.leaveBalance.upsert({
                where: {
                  tenantId_employeeId_year_leaveTypeCode: {
                    tenantId, employeeId: emp.id, year, leaveTypeCode: typeCode,
                  },
                },
                create: {
                  employeeId: emp.id, year, leaveTypeCode: typeCode,
                  totalGranted: grantDays, totalUsed: 0, totalRemain: grantDays,
                },
                update: {
                  totalGranted: { increment: diff },
                  totalRemain: { increment: diff },
                },
              });
              return;
            }

            // Grant 생성
            await tx.leaveGrant.create({
              data: {
                employeeId: emp.id,
                leaveTypeCode: typeCode,
                grantDays,
                remainDays: grantDays,
                grantReason: `${year}년 ${leaveTypeName} 자동부여`,
                periodStart,
                periodEnd,
              },
            });

            // Balance upsert
            await tx.leaveBalance.upsert({
              where: {
                tenantId_employeeId_year_leaveTypeCode: {
                  tenantId,
                  employeeId: emp.id,
                  year,
                  leaveTypeCode: typeCode,
                },
              },
              create: {
                employeeId: emp.id,
                year,
                leaveTypeCode: typeCode,
                totalGranted: grantDays,
                totalUsed: 0,
                totalRemain: grantDays,
              },
              update: {
                totalGranted: { increment: grantDays },
                totalRemain: { increment: grantDays },
              },
            });
          });

          // ANNUAL에만 TimeWallet 초기화
          if (typeCode === 'ANNUAL') {
            await initAnnualWallet(emp.id, year, grantDays * compensationPolicy.dailyWorkHours);
          }

          totalGranted++;
          grantedByType[typeCode] = (grantedByType[typeCode] || 0) + 1;
        } catch (err) {
          if (err instanceof Error && err.message === 'SKIP_DUPLICATE') {
            totalSkipped++;
            continue;
          }
          errors.push(`${emp.name}(${emp.employeeNumber}) ${typeCode}: ${err instanceof Error ? err.message : '알 수 없는 오류'}`);
        }
      }
    }

    // 유형별 결과 메시지 생성
    const typeDetails = Object.entries(grantedByType)
      .map(([code, count]) => `${code}: ${count}건`)
      .join(', ');

    const supplementMsg = totalSupplemented > 0 ? `, ${totalSupplemented}건 보충` : '';
    return NextResponse.json({
      message: `자동부여 완료: ${totalGranted}건 부여${supplementMsg}, ${totalSkipped}건 스킵`,
      granted: totalGranted,
      supplemented: totalSupplemented,
      skipped: totalSkipped,
      grantedByType,
      errors,
      details: typeDetails,
    });
  } catch (error) {
    console.error('Auto grant error:', error);
    return NextResponse.json(
      { message: '자동부여 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
