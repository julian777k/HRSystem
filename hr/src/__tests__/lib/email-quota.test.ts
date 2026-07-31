/** @jest-environment node */

// 메일 발송은 1건당 비용이 발생한다. 남용 방어가 실제로 막는지 검증한다.
// basePrismaClient를 모킹해 D1 없이 판정 로직만 확인한다.

const counts: { global: number; recent: number; emailToday: number } = {
    global: 0,
    recent: 0,
    emailToday: 0,
};

jest.mock('@/lib/prisma', () => ({
    basePrismaClient: {
        passwordReset: {
            count: jest.fn(async (args: { where: Record<string, unknown> }) => {
                const w = args.where || {};
                // email 조건이 없으면 전역 집계
                if (!('email' in w)) return counts.global;
                // createdAt.gte가 최근(3분)인지 하루인지로 구분
                const gte = (w.createdAt as { gte: Date })?.gte;
                const ageMs = Date.now() - new Date(gte).getTime();
                return ageMs < 10 * 60 * 1000 ? counts.recent : counts.emailToday;
            }),
        },
    },
}));

import {
    checkResetEmailQuota,
    EMAIL_DAILY_LIMIT,
    GLOBAL_DAILY_LIMIT,
} from '@/lib/email-quota';

describe('비밀번호 재설정 메일 남용 방어', () => {
    beforeEach(() => {
        counts.global = 0;
        counts.recent = 0;
        counts.emailToday = 0;
    });

    it('평상시에는 발송을 허용한다', async () => {
        const r = await checkResetEmailQuota('a@example.com');
        expect(r.allowed).toBe(true);
    });

    it('쿨다운 내 재요청을 막는다 — 메일 폭탄 방지', async () => {
        counts.recent = 1;
        const r = await checkResetEmailQuota('a@example.com');
        expect(r).toEqual({ allowed: false, reason: 'cooldown' });
    });

    it('같은 이메일의 일일 상한을 막는다', async () => {
        counts.emailToday = EMAIL_DAILY_LIMIT;
        const r = await checkResetEmailQuota('a@example.com');
        expect(r).toEqual({ allowed: false, reason: 'email_daily' });
    });

    it('전역 일일 상한을 막는다 — 비용 폭주 최종 방어선', async () => {
        counts.global = GLOBAL_DAILY_LIMIT;
        const r = await checkResetEmailQuota('a@example.com');
        expect(r).toEqual({ allowed: false, reason: 'global_daily' });
    });

    it('전역 상한이 개별 조건보다 먼저 적용된다', async () => {
        // 전역이 막힌 상태면 개별 조건이 통과여도 발송하지 않는다
        counts.global = GLOBAL_DAILY_LIMIT + 10;
        counts.recent = 0;
        counts.emailToday = 0;
        const r = await checkResetEmailQuota('fresh@example.com');
        expect(r).toEqual({ allowed: false, reason: 'global_daily' });
    });

    it('상한 직전까지는 허용한다 (off-by-one 확인)', async () => {
        counts.global = GLOBAL_DAILY_LIMIT - 1;
        counts.emailToday = EMAIL_DAILY_LIMIT - 1;
        const r = await checkResetEmailQuota('a@example.com');
        expect(r.allowed).toBe(true);
    });
});
