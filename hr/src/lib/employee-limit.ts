// 테넌트별 직원 등록 한도.
//
// tenants.maxEmployees는 저장만 되고 실제 등록 시 검증되지 않고 있었다.
// 50명·100명으로 나눠 파는 상품인데 한도가 강제되지 않으면
// (1) 판매 조건이 무의미해지고
// (2) 공개 데모에서 무제한 생성으로 D1 쓰기 한도를 소모시킬 수 있다.
import { basePrismaClient } from '@/lib/prisma';
import { DEMO_SUBDOMAIN } from '@/lib/demo-guard';

// 데모 상한. 시드 직원이 약 52명이므로 그보다 넉넉히 잡아
// 방문자가 직원 등록 기능을 체험할 수 있게 하되, 무제한 생성은 막는다.
// 매일 리셋되므로 누적되지 않는다.
export const DEMO_MAX_EMPLOYEES = 75;

export interface LimitCheck {
    allowed: boolean;
    current: number;
    max: number;
    isDemo: boolean;
}

/**
 * 직원을 count명 더 등록할 수 있는지 확인한다.
 * 한도가 설정돼 있지 않으면 기본값(50)을 적용한다.
 */
export async function checkEmployeeLimit(tenantId: string, adding = 1): Promise<LimitCheck> {
    const tenant = (await basePrismaClient.tenant.findUnique({
        where: { id: tenantId },
    })) as { maxEmployees?: number; subdomain?: string } | null;

    const configured = tenant?.maxEmployees && tenant.maxEmployees > 0 ? tenant.maxEmployees : 50;
    const isDemo = tenant?.subdomain === DEMO_SUBDOMAIN;
    // 데모는 설정값과 무관하게 상한을 낮게 고정한다(무제한 생성 방지).
    const max = isDemo ? Math.min(configured, DEMO_MAX_EMPLOYEES) : configured;

    const current = await basePrismaClient.employee.count({
        where: { tenantId, status: 'ACTIVE' },
    });

    return { allowed: current + adding <= max, current, max, isDemo };
}

export function limitMessage(check: LimitCheck): string {
    if (check.isDemo) {
        // 체험자는 "등록이 어떻게 되는지" 확인하려는 것뿐이므로 기다리게 할 이유가 없다.
        // 직원을 삭제하거나 퇴직 처리하면 활성 인원이 줄어 곧바로 다시 등록할 수 있다.
        // (삭제 기능까지 함께 체험하게 되는 이점도 있다)
        return '체험 환경의 등록 한도에 도달했습니다. 등록해 보신 직원을 삭제하거나 퇴직 처리하시면 바로 다시 등록해 보실 수 있습니다.';
    }
    return `등록 가능한 직원 수를 초과했습니다. (현재 ${check.current}명 / 한도 ${check.max}명)`;
}
