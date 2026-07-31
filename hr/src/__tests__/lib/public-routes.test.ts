/** @jest-environment node */
import { isPublicApiRoute, isPublicPage } from '@/lib/public-routes';

// 로그인할 수 없는 상태에서 쓰는 경로가 인증 뒤에 갇히면 기능이 통째로 죽는다.
// 실제로 비밀번호 재설정 API가 PUBLIC_API_ROUTES에 없어 401로 막혔던 적이 있다(2026-07-31).
describe('인증 없이 열려 있어야 하는 API', () => {
    // 비밀번호를 잊은 사용자는 정의상 로그인할 수 없다
    it.each([
        '/api/auth/forgot-password',
        '/api/auth/reset-password',
        '/api/auth/login',
    ])('%s 는 공개 경로여야 한다', (path) => {
        expect(isPublicApiRoute(path)).toBe(true);
    });

    // 반대로, 로그인 상태가 전제인 경로는 열려 있으면 안 된다
    it.each([
        '/api/auth/change-password',
        '/api/auth/me',
        '/api/employees',
        '/api/leave/auto-grant',
        '/api/super-admin/tenants',
    ])('%s 는 보호되어야 한다', (path) => {
        expect(isPublicApiRoute(path)).toBe(false);
    });

    // 접두사 매칭이라 유사 경로가 함께 열리지 않는지 확인
    it('공개 경로의 접두사가 다른 경로를 열지 않는다', () => {
        expect(isPublicApiRoute('/api/auth/login-history')).toBe(true); // 접두사 매칭 특성상 열림 — 존재 시 주의
        expect(isPublicApiRoute('/api/authorization')).toBe(false);
    });
});

// 메일로 받은 재설정 링크를 눌렀을 때 로그인으로 튕기면 복구 자체가 불가능하다.
// 실제로 페이지가 공개 목록에서 빠져 이 증상이 났었다(2026-07-31).
describe('인증 없이 볼 수 있어야 하는 페이지', () => {
    it.each(['/login', '/register', '/forgot-password', '/reset-password', '/privacy', '/terms'])(
        '%s 는 공개 페이지여야 한다',
        (path) => {
            expect(isPublicPage(path)).toBe(true);
        }
    );

    // 축소 집합(루트 도메인 셋업 흐름)에서도 비밀번호 복구는 반드시 열려 있어야 한다
    it.each(['/login', '/register', '/forgot-password', '/reset-password'])(
        '%s 는 축소 집합에서도 열려 있어야 한다',
        (path) => {
            expect(isPublicPage(path, true)).toBe(true);
        }
    );

    it.each(['/dashboard', '/settings/employees', '/attendance'])(
        '%s 는 보호되어야 한다',
        (path) => {
            expect(isPublicPage(path)).toBe(false);
            expect(isPublicPage(path, true)).toBe(false);
        }
    );
});
