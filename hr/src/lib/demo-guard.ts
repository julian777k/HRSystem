// 공개 데모 테넌트 방어.
//
// demo.keystonehr.app은 인증 없이 자동 로그인되고, 그 계정이 SYSTEM_ADMIN이다.
// 즉 "누구나 관리자 권한을 가진 테넌트"이므로, 관리자 권한으로 할 수 있는 일 중
// 비용이 발생하거나 외부에 영향을 주는 동작은 데모에서 막아야 한다.
//
// 데이터가 망가지는 것은 매일 리셋으로 복구되지만,
// 외부로 나간 메일과 청구된 비용은 되돌릴 수 없다.
export const DEMO_SUBDOMAIN = 'demo';

/**
 * 요청 객체에서 데모 여부를 직접 판정한다.
 *
 * next/headers의 headers()를 쓰는 방식은 Workers 런타임에서 실패해
 * 조용히 false가 되고 보호가 통째로 무력화됐다(2026-07-31 실측).
 * 미들웨어가 x-tenant-subdomain을 심어주므로 요청 헤더에서 바로 읽는 것이 확실하다.
 */
export function isDemoRequestFrom(request: { headers: { get(name: string): string | null } }): boolean {
    return request.headers.get('x-tenant-subdomain') === DEMO_SUBDOMAIN;
}

/**
 * 요청 객체를 넘길 수 없는 곳에서 쓰는 보조 경로 (라우트 핸들러 전용).
 * 가능하면 isDemoRequestFrom을 쓸 것 — 이쪽은 런타임에 따라 실패할 수 있다.
 */
export async function isDemoRequest(): Promise<boolean> {
    try {
        const { headers } = await import('next/headers');
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

// ─── 데모 쓰기 허용 목록 (화이트리스트) ───
//
// 블랙리스트로 "위험한 것만" 막으면 API가 추가될 때마다 누락된다.
// 기본을 차단으로 두고, 체험에 실제로 필요한 쓰기만 연다.
//
// 조회(GET/HEAD)는 데이터를 바꾸지도 비용을 만들지도 않으므로 전부 허용한다.
// 아래는 쓰기(POST/PUT/PATCH/DELETE) 기준이다.
const DEMO_ALLOWED_WRITE_PREFIXES = [
    // 체험의 핵심 흐름 — 이게 막히면 데모의 의미가 없다
    '/api/attendance/clock-in',
    '/api/attendance/clock-out',
    '/api/leave/request',
    '/api/overtime/request',
    '/api/welfare/requests',
    '/api/absence/request',
    '/api/approval/process',

    // 관리자 기능 체험 (등록 자체는 인원 한도가 별도로 막는다)
    '/api/employees',
    '/api/departments',
    '/api/positions',
    '/api/welfare/categories',
    '/api/welfare/items',
    '/api/holidays',
    '/api/leave/types',
    '/api/leave/grant',
    '/api/approval/lines',
    '/api/compensation-policy',
    '/api/company/settings',

    // 세션 유지에 필요
    '/api/auth/logout',
    '/api/demo/login',
];

// 위 접두사에 해당해도 개별로 막아야 하는 경로.
// 비용이 발생하거나(메일·스토리지) 외부로 요청이 나가거나(웹훅)
// 대량 생성으로 자원을 소모하는 것들이다.
const DEMO_BLOCKED_EXACT = [
    '/api/employees/import',   // 대량 생성 — CPU·D1 쓰기 소모
    '/api/employees/export',   // 전체 명부 반출
    '/api/leave/export',
    '/api/company/logo',       // R2 스토리지 비용
    '/api/leave/auto-grant',   // 반복 실행 시 subrequest 소모
    '/api/leave/carry-over',
    '/api/holidays/seed',
];

// 경로 중간에 [id]가 들어가 정확 매칭이 안 되는 위험 동작.
// 예: /api/employees/{id}/anonymize 는 개인정보를 되돌릴 수 없게 익명화한다.
const DEMO_BLOCKED_SUFFIXES = ['/anonymize'];

/**
 * 데모에서 건드리면 안 되는 계정인지.
 *
 * 데모 자동 로그인은 demo@keystonehr.app 계정을 찾아 세션을 발급한다.
 * 방문자가 그 계정을 퇴직 처리하면 다음 방문자는 데모에 진입조차 못 하고,
 * 다음 리셋(6시간)까지 데모가 죽는다.
 * 다른 관리자 계정도 마찬가지로 관리 기능 체험을 불가능하게 만든다.
 *
 * 일반 직원(BASIC)은 자유롭게 지울 수 있어야 한다 —
 * 인원 한도에 걸린 체험자가 스스로 정리하고 다시 등록해 보는 경로다.
 */
export function isProtectedDemoAccount(role: string | null | undefined): boolean {
    return role === 'SYSTEM_ADMIN' || role === 'COMPANY_ADMIN';
}

export const DEMO_PROTECTED_ACCOUNT_MESSAGE =
    '체험 환경에서는 관리자 계정을 변경하거나 삭제할 수 없습니다. 일반 직원 계정으로 시도해 주세요.';

/**
 * 데모에서 이 요청을 허용할지 판정한다.
 * 조회는 모두 허용, 쓰기는 화이트리스트에 있고 개별 차단 목록에 없어야 한다.
 */
export function isDemoWriteAllowed(pathname: string, method: string): boolean {
    const m = method.toUpperCase();
    if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return true;

    if (DEMO_BLOCKED_EXACT.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
        return false;
    }
    if (DEMO_BLOCKED_SUFFIXES.some((s) => pathname.endsWith(s))) {
        return false;
    }
    return DEMO_ALLOWED_WRITE_PREFIXES.some(
        (p) => pathname === p || pathname.startsWith(`${p}/`)
    );
}
