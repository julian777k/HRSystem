import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { basePrismaClient } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';
import { calculateAnnualLeave, getYearsWorked } from '@/lib/leave-calculator';
import { getCompensationPolicy } from '@/lib/time-wallet';
import { getTenantId } from '@/lib/tenant-context';
import { updateStmt, type BatchStatement } from '@/lib/d1-client';

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

    // [배치화] 직원 수에 비례해 쿼리가 늘면 Workers subrequest 한도에 걸린다.
    // 조회는 위에서 전부 batch로 끝냈고, 여기서는 메모리에서 계산만 한 뒤
    // 확정된 쓰기만 모아 청크 단위로 실행한다.
    const existingBalances = await prisma.leaveBalance.findMany({
      where: { employeeId: { in: employees.map((e) => e.id) }, year },
    });
    const balanceKeys = new Set(existingBalances.map((b) => `${b.employeeId}:${b.leaveTypeCode}`));

    const existingWallets = await prisma.timeWallet.findMany({
      where: { employeeId: { in: employees.map((e) => e.id) }, year, type: 'ANNUAL' },
    });
    const walletMap = new Map(existingWallets.map((w) => [w.employeeId, w]));

    type NewGrant = { employeeId: string; leaveTypeCode: string; grantDays: number; remainDays: number; grantReason: string; periodStart: Date; periodEnd: Date };
    const newGrants: NewGrant[] = [];
    const newBalances: Array<Record<string, unknown>> = [];
    const newWallets: Array<Record<string, unknown>> = [];
    const updates: BatchStatement[] = [];

    let totalGranted = 0;
    let totalSkipped = 0;
    let totalSupplemented = 0;
    const errors: string[] = [];
    const grantedByType: Record<string, number> = {};

    for (const emp of employees) {
      const yearsWorked = getYearsWorked(emp.hireDate, referenceDate);

      for (const [typeCode, typePolicies] of policyByType) {
        // [STEP 1] 정책 기반 부여일수 계산
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
        const existingGrant = grantMap.get(`${emp.id}:${typeCode}`) || null;
        const hasBalance = balanceKeys.has(`${emp.id}:${typeCode}`);

        if (existingGrant) {
          if (existingGrant.grantDays >= grantDays) {
            totalSkipped++;
            continue;
          }

          // [STEP 2] 부족분 보충 — 차액만큼만 증분
          const diff = grantDays - existingGrant.grantDays;
          updates.push(
            updateStmt('leaveGrant', { id: existingGrant.id }, {
              grantDays,
              remainDays: { increment: diff },
            })
          );
          if (hasBalance) {
            updates.push(
              updateStmt('leaveBalance', { tenantId, employeeId: emp.id, year, leaveTypeCode: typeCode }, {
                totalGranted: { increment: diff },
                totalRemain: { increment: diff },
              })
            );
          } else {
            newBalances.push({
              employeeId: emp.id, year, leaveTypeCode: typeCode,
              totalGranted: grantDays, totalUsed: 0, totalRemain: grantDays,
            });
            balanceKeys.add(`${emp.id}:${typeCode}`);
          }
          totalSupplemented++;
        } else {
          // [STEP 3] 신규 부여
          // 중복은 leave_grants의 유니크 인덱스(0005)가 DB 레벨에서 막는다.
          newGrants.push({
            employeeId: emp.id,
            leaveTypeCode: typeCode,
            grantDays,
            remainDays: grantDays,
            grantReason: `${year}년 ${leaveTypeName} 자동부여`,
            periodStart,
            periodEnd,
          });
          if (hasBalance) {
            updates.push(
              updateStmt('leaveBalance', { tenantId, employeeId: emp.id, year, leaveTypeCode: typeCode }, {
                totalGranted: { increment: grantDays },
                totalRemain: { increment: grantDays },
              })
            );
          } else {
            newBalances.push({
              employeeId: emp.id, year, leaveTypeCode: typeCode,
              totalGranted: grantDays, totalUsed: 0, totalRemain: grantDays,
            });
            balanceKeys.add(`${emp.id}:${typeCode}`);
          }
          totalGranted++;
        }

        // ANNUAL은 TimeWallet 동기화 — 이미 쓴 시간은 보존해야 한다.
        if (typeCode === 'ANNUAL') {
          const totalHours = grantDays * compensationPolicy.dailyWorkHours;
          const wallet = walletMap.get(emp.id);
          if (!wallet) {
            newWallets.push({
              employeeId: emp.id, year, type: 'ANNUAL',
              totalEarned: totalHours, totalRemain: totalHours,
            });
            walletMap.set(emp.id, { employeeId: emp.id, totalEarned: totalHours, totalRemain: totalHours } as never);
          } else {
            const used = wallet.totalEarned - wallet.totalRemain;
            updates.push(
              updateStmt('timeWallet', { tenantId, employeeId: emp.id, year, type: 'ANNUAL' }, {
                totalEarned: totalHours,
                totalRemain: Math.max(0, totalHours - used),
              })
            );
          }
        }

        grantedByType[typeCode] = (grantedByType[typeCode] || 0) + 1;
      }
    }

    // [쓰기] 청크 단위 원자성 — 청크 하나가 실패해도 나머지는 진행하고 실패분만 보고한다.
    // 자동부여는 재실행해도 안전(이미 있으면 스킵·보충)하므로 실패분만 다시 돌리면 복구된다.
    const CHUNK = 50;

    const runUpdates = async () => {
      for (let i = 0; i < updates.length; i += CHUNK) {
        const chunk = updates.slice(i, i + CHUNK);
        try {
          await (prisma as any).$batch(chunk);
        } catch (err) {
          errors.push(`갱신 ${i + 1}~${i + chunk.length}건 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`);
        }
      }
    };

    const runCreates = async (
      model: 'leaveGrant' | 'leaveBalance' | 'timeWallet',
      rows: Array<Record<string, unknown>>,
      label: string
    ) => {
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        try {
          await (prisma as any)[model].createMany({ data: chunk });
        } catch (err) {
          errors.push(`${label} ${i + 1}~${i + chunk.length}건 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`);
        }
      }
    };

    // grant → balance → wallet 순서. 부여 기록이 먼저 남아야 중간 실패 시에도
    // 재실행에서 "이미 부여됨"으로 인식돼 이중 부여를 만들지 않는다.
    await runCreates('leaveGrant', newGrants as unknown as Array<Record<string, unknown>>, '휴가 부여');
    await runCreates('leaveBalance', newBalances, '잔여일수 생성');
    await runCreates('timeWallet', newWallets, '연차 지갑 생성');
    await runUpdates();

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
