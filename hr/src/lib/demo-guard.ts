// 공개 데모 테넌트 방어.
//
// demo.keystonehr.app은 인증 없이 자동 로그인되고, 그 계정이 SYSTEM_ADMIN이다.
// 즉 "누구나 관리자 권한을 가진 테넌트"이므로, 관리자 권한으로 할 수 있는 일 중
// 비용이 발생하거나 외부에 영향을 주는 동작은 데모에서 막아야 한다.
//
// 데이터가 망가지는 것은 매일 리셋으로 복구되지만,
// 외부로 나간 메일과 청구된 비용은 되돌릴 수 없다.
import { headers } from 'next/headers';

export const DEMO_SUBDOMAIN = 'demo';

/** 현재 요청이 공개 데모 테넌트에서 온 것인지 */
export async function isDemoRequest(): Promise<boolean> {
    try {
        const h = await headers();
        return h.get('x-tenant-subdomain') === DEMO_SUBDOMAIN;
    } catch {
        return false;
    }
}

/**
 * 데모에서 금지되는 동작의 표준 응답 본문.
 * 체험자에게는 이유를 알려주되, 내부 정책 수치는 노출하지 않는다.
 */
export const DEMO_BLOCKED_MESSAGE =
    '체험 환경에서는 사용할 수 없는 기능입니다. 실제 도입 후 이용하실 수 있습니다.';
