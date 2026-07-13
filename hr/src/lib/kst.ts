// Cloudflare Workers는 UTC로 동작한다.
// new Date().getHours() / setHours() 는 전부 UTC 기준이므로,
// 한국 시각(KST, UTC+9)을 전제로 한 근태·연차 계산이 9시간 어긋난다.
//
// 실제 사고: workStartTime '09:00' 에 setHours(9,0) 을 쓰면 UTC 09:00 = KST 18:00 이
// 지각 임계값이 되어, KST 오후 6시 이후 출근해야만 지각으로 잡혔다.
//
// 이 모듈의 함수는 모두 **UTC Date 객체**를 반환한다. DB 저장·비교에 그대로 쓰면 된다.

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 지금 시각을 KST로 본 달력값 (연·월·일·시 추출용. DB 저장에 쓰지 말 것) */
function asKstCalendar(now: Date): Date {
    return new Date(now.getTime() + KST_OFFSET_MS);
}

/** KST 기준 '오늘'의 자정을 UTC Date로 반환한다. 근태 date 컬럼의 기준값. */
export function kstStartOfDay(now: Date = new Date()): Date {
    const kst = asKstCalendar(now);
    return new Date(
        Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) - KST_OFFSET_MS
    );
}

/** KST 기준 오늘의 HH:mm 시각을 UTC Date로 반환한다. 출퇴근 임계값 계산용. */
export function kstTimeToday(hours: number, minutes: number, now: Date = new Date()): Date {
    return new Date(kstStartOfDay(now).getTime() + (hours * 60 + minutes) * 60_000);
}

/** KST 기준 연도. 연차 부여·보상시간 적립 연도 판정용. */
export function kstYear(now: Date = new Date()): number {
    return asKstCalendar(now).getUTCFullYear();
}

/** KST 기준 'YYYY-MM-DD' 문자열. */
export function kstDateString(now: Date = new Date()): string {
    return asKstCalendar(now).toISOString().slice(0, 10);
}
