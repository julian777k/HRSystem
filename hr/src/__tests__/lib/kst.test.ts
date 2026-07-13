/** @jest-environment node */
import { kstStartOfDay, kstTimeToday, kstYear, kstDateString } from '@/lib/kst';

// Cloudflare Workers(UTC)에서 KST 기준 근태 판정이 맞는지 검증한다.
// 회귀 배경: setHours(9,0) 이 UTC 09:00(= KST 18:00)을 지각 임계값으로 만들어,
// KST 오후 6시 이후 출근해야만 지각으로 잡혔다.
describe('KST 시각 계산 (Workers는 UTC로 동작)', () => {
    test('KST 오전 8:30 출근 → KST 기준 그날 자정이 나온다 (전날로 밀리지 않는다)', () => {
        // KST 2026-07-14 08:30 = UTC 2026-07-13 23:30
        const now = new Date('2026-07-13T23:30:00Z');
        // KST 2026-07-14 00:00 = UTC 2026-07-13 15:00
        expect(kstStartOfDay(now).toISOString()).toBe('2026-07-13T15:00:00.000Z');
        expect(kstDateString(now)).toBe('2026-07-14');
    });

    test('지각 판정 — KST 11:00 출근은 지각이다 (09:00 기준)', () => {
        const now = new Date('2026-07-14T02:00:00Z'); // KST 11:00
        const threshold = kstTimeToday(9, 0, now); // KST 09:00 = UTC 00:00
        expect(threshold.toISOString()).toBe('2026-07-14T00:00:00.000Z');
        expect(now > threshold).toBe(true); // LATE
    });

    test('지각 아님 — KST 08:30 출근은 정상이다 (09:00 기준)', () => {
        const now = new Date('2026-07-13T23:30:00Z'); // KST 07-14 08:30
        const threshold = kstTimeToday(9, 0, now);
        expect(now > threshold).toBe(false); // NORMAL
    });

    test('조퇴 판정 — KST 18:30 퇴근은 조퇴가 아니다 (18:00 기준)', () => {
        const now = new Date('2026-07-14T09:30:00Z'); // KST 18:30
        const threshold = kstTimeToday(18, 0, now); // KST 18:00 = UTC 09:00
        expect(threshold.toISOString()).toBe('2026-07-14T09:00:00.000Z');
        expect(now < threshold).toBe(false); // 조퇴 아님
    });

    test('조퇴 판정 — KST 17:00 퇴근은 조퇴다 (18:00 기준)', () => {
        const now = new Date('2026-07-14T08:00:00Z'); // KST 17:00
        const threshold = kstTimeToday(18, 0, now);
        expect(now < threshold).toBe(true); // EARLY_LEAVE
    });

    test('연도 — KST 새해 첫날 오전은 새해로 잡힌다', () => {
        // KST 2026-01-01 08:00 = UTC 2025-12-31 23:00
        const now = new Date('2025-12-31T23:00:00Z');
        expect(kstYear(now)).toBe(2026); // UTC로 읽으면 2025가 되어 연차가 작년에 부여된다
    });

    test('연도 — KST 연말 밤은 그해로 잡힌다', () => {
        // KST 2026-12-31 23:00 = UTC 2026-12-31 14:00
        const now = new Date('2026-12-31T14:00:00Z');
        expect(kstYear(now)).toBe(2026);
    });
});
