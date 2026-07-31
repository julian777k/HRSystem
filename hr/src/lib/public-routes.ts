// 인증 없이 접근할 수 있는 API 경로.
// middleware에서 분리한 이유: 이 목록은 순수 데이터인데 middleware는 jose 등
// 런타임 의존성을 끌고 있어 단독 테스트가 어렵다. 목록 자체를 테스트 가능하게 둔다.

export const PUBLIC_API_ROUTES = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/register-company',
    // 비밀번호 분실자가 쓰는 경로 — 로그인할 수 없는 상태이므로 인증을 요구하면 안 된다.
    // forgot-password는 자체 레이트리밋(IP당 15분 5회)과 계정 열거 방지를,
    // reset-password는 30분 만료 토큰 검증을 각각 수행한다.
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
    '/api/setup/',
    '/api/super-admin/auth/login',
    '/api/payments/',
    '/api/demo/login', // 공개 데모 자동 로그인 (demo 서브도메인에서만 동작)
];

export function isPublicApiRoute(pathname: string): boolean {
    return PUBLIC_API_ROUTES.some((route) => pathname.startsWith(route));
}

// 인증 없이 볼 수 있어야 하는 페이지.
// 비밀번호 재설정 화면이 빠져 있으면 메일 링크를 눌러도 로그인으로 튕긴다.
export const PUBLIC_PAGES = [
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/privacy',
    '/terms',
];

/** 인증 없이 접근 가능한 페이지인지 (셋업 흐름용 최소 집합은 minimal=true) */
export function isPublicPage(pathname: string, minimal = false): boolean {
    if (minimal) {
        // 루트 도메인 셋업 흐름 등에서 쓰는 축소 집합.
        // 비밀번호 복구는 어느 흐름에서도 막히면 안 되므로 항상 포함한다.
        return ['/login', '/register', '/forgot-password', '/reset-password'].includes(pathname);
    }
    return PUBLIC_PAGES.includes(pathname);
}
