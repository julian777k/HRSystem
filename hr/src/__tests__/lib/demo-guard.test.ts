/** @jest-environment node */
import { isDemoWriteAllowed } from '@/lib/demo-guard';

// 데모는 인증 없이 SYSTEM_ADMIN 권한이 주어진다.
// 블랙리스트로 "위험한 것만" 막으면 API가 추가될 때마다 누락되므로
// 기본 차단 + 체험에 필요한 것만 허용하는 화이트리스트로 운영한다.

describe('데모 쓰기 허용 판정', () => {
    describe('조회는 모두 허용한다', () => {
        it.each([
            ['/api/employees', 'GET'],
            ['/api/employees/export', 'GET'],
            ['/api/dashboard', 'GET'],
            ['/api/settings/webhooks', 'GET'],
        ])('%s %s', (path, method) => {
            expect(isDemoWriteAllowed(path, method)).toBe(true);
        });
    });

    describe('체험 핵심 흐름은 쓰기를 허용한다', () => {
        it.each([
            ['/api/attendance/clock-in', 'POST'],
            ['/api/attendance/clock-out', 'POST'],
            ['/api/leave/request', 'POST'],
            ['/api/leave/request/abc123', 'PUT'],
            ['/api/overtime/request', 'POST'],
            ['/api/welfare/requests', 'POST'],
            ['/api/approval/process', 'POST'],
            ['/api/employees', 'POST'],
            ['/api/departments', 'POST'],
        ])('%s %s', (path, method) => {
            expect(isDemoWriteAllowed(path, method)).toBe(true);
        });
    });

    describe('비용·외부영향·대량생성 경로는 막는다', () => {
        it.each([
            ['/api/auth/forgot-password', 'POST'],   // 메일 발송 = 비용, 스팸 악용
            ['/api/employees/import', 'POST'],       // 대량 생성
            ['/api/employees/export', 'POST'],       // 명부 반출
            ['/api/company/logo', 'POST'],           // R2 스토리지 비용
            ['/api/settings/webhooks', 'POST'],      // 외부 요청 유발
            ['/api/leave/auto-grant', 'POST'],       // subrequest 소모
            ['/api/leave/carry-over', 'POST'],
            ['/api/holidays/seed', 'POST'],
            ['/api/payments/request', 'POST'],       // 결제
            ['/api/employees/abc/anonymize', 'POST'],
        ])('%s %s', (path, method) => {
            expect(isDemoWriteAllowed(path, method)).toBe(false);
        });
    });

    it('허용 접두사 아래 개별 차단 경로가 우선한다', () => {
        // /api/employees 는 허용이지만 import·export 는 막혀야 한다
        expect(isDemoWriteAllowed('/api/employees', 'POST')).toBe(true);
        expect(isDemoWriteAllowed('/api/employees/import', 'POST')).toBe(false);
        expect(isDemoWriteAllowed('/api/employees/export', 'POST')).toBe(false);
    });

    it('목록에 없는 새 API는 기본 차단된다', () => {
        expect(isDemoWriteAllowed('/api/some/new/feature', 'POST')).toBe(false);
        expect(isDemoWriteAllowed('/api/some/new/feature', 'DELETE')).toBe(false);
    });

    it('접두사 부분일치로 다른 경로가 열리지 않는다', () => {
        // '/api/employees' 접두사가 '/api/employees-secret' 을 열면 안 된다
        expect(isDemoWriteAllowed('/api/employees-secret', 'POST')).toBe(false);
    });
});
