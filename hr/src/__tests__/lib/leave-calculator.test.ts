/** @jest-environment node */
import { getMonthsWorked } from '@/lib/leave-calculator';

// 근속 개월 수 계산. 월차(1년 미만 매월 1일) 부여의 근거가 된다.
// 회귀 배경: 말일 보정이 없어 1/31 입사자가 2/28 평가 시 28 < 31 로
// 한 달이 깎여, 개근했는데 월차가 0이 됐다.
describe('getMonthsWorked — 말일 입사자 보정', () => {
    test('1/31 입사 → 2/28 평가는 1개월로 인정 (2월 말일이므로)', () => {
        expect(getMonthsWorked(new Date('2026-01-31'), new Date('2026-02-28'))).toBe(1);
    });

    test('1/31 입사 → 3/31 평가는 2개월', () => {
        expect(getMonthsWorked(new Date('2026-01-31'), new Date('2026-03-31'))).toBe(2);
    });

    test('일반 케이스 — 1/15 입사 → 3/20 평가는 2개월', () => {
        expect(getMonthsWorked(new Date('2026-01-15'), new Date('2026-03-20'))).toBe(2);
    });

    test('아직 한 달 안 참 — 1/15 입사 → 2/10 평가는 0개월', () => {
        expect(getMonthsWorked(new Date('2026-01-15'), new Date('2026-02-10'))).toBe(0);
    });

    test('말일이 아닌데 일자가 모자라면 여전히 한 달 깎인다 — 1/31 입사 → 3/30 평가는 1개월', () => {
        // 3/30 은 3월 말일(31)이 아니므로 30 < 31 로 한 달 깎임
        expect(getMonthsWorked(new Date('2026-01-31'), new Date('2026-03-30'))).toBe(1);
    });

    test('입사 당일은 0개월', () => {
        expect(getMonthsWorked(new Date('2026-01-15'), new Date('2026-01-15'))).toBe(0);
    });
});
