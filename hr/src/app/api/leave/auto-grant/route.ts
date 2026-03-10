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

  for (const p of policies) {
    await db.leavePolicy.create({ data: p as any });
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

    let totalGranted = 0;
    let totalSkipped = 0;
    const errors: string[] = [];
    const grantedByType: Record<string, number> = {};

    for (const emp of employees) {
      const yearsWorked = getYearsWorked(emp.hireDate, referenceDate);

      for (const [typeCode, typePolicies] of policyByType) {
        try {
          // [FIX] 중복 체크: periodStart 정확 일치 + startsWith 패턴으로 견고하게
          const existingGrant = await prisma.leaveGrant.findFirst({
            where: {
              employeeId: emp.id,
              leaveTypeCode: typeCode,
              periodStart,
              periodEnd,
              grantReason: { startsWith: `${year}년` , endsWith: '자동부여' },
            },
          });

          if (existingGrant) {
            totalSkipped++;
            continue;
          }

          // 근속연수 조건에 맞는 정책 필터링
          const matchingPolicies = typePolicies.filter(
            (p) => yearsWorked >= p.yearFrom && (p.yearTo === null || yearsWorked < p.yearTo)
          );

          if (matchingPolicies.length === 0) {
            totalSkipped++;
            continue;
          }

          // 매칭되는 정책 중 가장 높은 grantDays 적용
          let grantDays = Math.max(...matchingPolicies.map((p) => p.grantDays));

          // ANNUAL 타입: 근로기준법 법정 최소일수 보장
          if (typeCode === 'ANNUAL') {
            // periodEnd(12/31) 기준으로 계산하여 해당 연도 전체 근무 개월수 반영
            // (referenceDate=1/1 사용 시 연중 입사자의 근무월수가 0으로 계산됨)
            const legalDays = calculateAnnualLeave(emp.hireDate, periodEnd);
            grantDays = Math.max(grantDays, legalDays);
          }

          if (grantDays <= 0) {
            totalSkipped++;
            continue;
          }

          const leaveTypeName = typePolicies[0].leaveType.name;

          // [FIX] 트랜잭션으로 grant + balance를 원자적으로 처리 (race condition 방지)
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
              throw new Error('SKIP_DUPLICATE');
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

            // [FIX] Balance upsert로 변경 (findUnique+create race condition 해소)
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

          // ANNUAL에만 TimeWallet 초기화 (트랜잭션 외부 - initAnnualWallet이 내부에서 prisma 직접 사용)
          if (typeCode === 'ANNUAL') {
            await initAnnualWallet(emp.id, year, grantDays * compensationPolicy.dailyWorkHours);
          }

          totalGranted++;
          grantedByType[typeCode] = (grantedByType[typeCode] || 0) + 1;
        } catch (err) {
          // 트랜잭션 내 이중 체크에서 발생한 중복은 스킵 처리
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

    return NextResponse.json({
      message: `자동부여 완료: ${totalGranted}건 부여, ${totalSkipped}건 스킵`,
      granted: totalGranted,
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
