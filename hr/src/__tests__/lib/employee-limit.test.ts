/** @jest-environment node */

// tenants.maxEmployees가 저장만 되고 강제되지 않아, 50명 상품을 팔면서
// 무제한 등록이 가능했다. 공개 데모에서는 D1 쓰기 소모 경로이기도 하다.

const state = { tenant: null as Record<string, unknown> | null, activeCount: 0 };

jest.mock('@/lib/prisma', () => ({
    basePrismaClient: {
        tenant: { findUnique: jest.fn(async () => state.tenant) },
        employee: { count: jest.fn(async () => state.activeCount) },
    },
}));

import { checkEmployeeLimit, DEMO_MAX_EMPLOYEES } from '@/lib/employee-limit';

describe('직원 등록 한도', () => {
    it('한도 내에서는 허용한다', async () => {
        state.tenant = { maxEmployees: 50, subdomain: 'acme' };
        state.activeCount = 49;
        const r = await checkEmployeeLimit('t1');
        expect(r).toMatchObject({ allowed: true, current: 49, max: 50 });
    });

    it('한도에 정확히 도달하는 등록은 허용한다 (off-by-one)', async () => {
        state.tenant = { maxEmployees: 50, subdomain: 'acme' };
        state.activeCount = 49;
        expect((await checkEmployeeLimit('t1', 1)).allowed).toBe(true);
    });

    it('한도를 넘기면 막는다', async () => {
        state.tenant = { maxEmployees: 50, subdomain: 'acme' };
        state.activeCount = 50;
        expect((await checkEmployeeLimit('t1', 1)).allowed).toBe(false);
    });

    it('대량 등록도 합산해서 막는다 — 임포트 우회 방지', async () => {
        state.tenant = { maxEmployees: 50, subdomain: 'acme' };
        state.activeCount = 30;
        expect((await checkEmployeeLimit('t1', 30)).allowed).toBe(false);
        expect((await checkEmployeeLimit('t1', 20)).allowed).toBe(true);
    });

    it('한도 미설정 테넌트는 기본 50명', async () => {
        state.tenant = { subdomain: 'acme' };
        state.activeCount = 50;
        const r = await checkEmployeeLimit('t1');
        expect(r.max).toBe(50);
        expect(r.allowed).toBe(false);
    });

    it('데모는 설정값이 커도 낮은 상한이 적용된다', async () => {
        state.tenant = { maxEmployees: 100000, subdomain: 'demo' };
        state.activeCount = DEMO_MAX_EMPLOYEES;
        const r = await checkEmployeeLimit('demo-tenant');
        expect(r.max).toBe(DEMO_MAX_EMPLOYEES);
        expect(r.allowed).toBe(false);
    });

    it('100명 옵션 테넌트는 100명까지 허용한다', async () => {
        state.tenant = { maxEmployees: 100, subdomain: 'acme' };
        state.activeCount = 99;
        expect((await checkEmployeeLimit('t1')).allowed).toBe(true);
        state.activeCount = 100;
        expect((await checkEmployeeLimit('t1')).allowed).toBe(false);
    });
});
