// 메일 발송 남용 방어.
//
// lib/rate-limit.ts는 isolate 메모리 기반이라 Workers에서는 사실상 무력하다
// (요청마다 다른 isolate에 배정되고, 엣지마다 카운터가 따로 존재한다).
// 메일은 1건당 비용이 발생하므로 영속 저장소(D1)로 세야 실효가 있다.
//
// password_resets 테이블을 그대로 카운터로 쓴다. 별도 테이블이 필요 없고,
// "토큰을 발급했다 = 메일을 보냈다"가 1:1이라 계산이 정확하다.
import { basePrismaClient } from '@/lib/prisma';

/** 같은 이메일로 연속 요청 시 최소 간격 */
export const EMAIL_COOLDOWN_MS = 3 * 60 * 1000;
/** 같은 이메일의 24시간 발송 상한 */
export const EMAIL_DAILY_LIMIT = 5;
/** 서비스 전체의 24시간 발송 상한 — 비용 폭주 최종 방어선 */
export const GLOBAL_DAILY_LIMIT = 100;

export type QuotaResult =
    | { allowed: true }
    | { allowed: false; reason: 'cooldown' | 'email_daily' | 'global_daily' };

/**
 * 재설정 메일을 보내도 되는지 판정한다.
 * 호출측은 결과와 무관하게 동일한 응답을 반환해야 한다(계정 열거 방지).
 */
export async function checkResetEmailQuota(email: string): Promise<QuotaResult> {
    const now = Date.now();
    const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const cooldownAgo = new Date(now - EMAIL_COOLDOWN_MS);

    // 전역 상한을 먼저 본다. 비용 방어가 가장 우선이고,
    // 이미 한도에 닿았으면 나머지 조회를 할 이유가 없다.
    const globalToday = await basePrismaClient.passwordReset.count({
        where: { createdAt: { gte: dayAgo } },
    });
    if (globalToday >= GLOBAL_DAILY_LIMIT) {
        console.error(
            `[email-quota] 전역 일일 상한 도달: ${globalToday}/${GLOBAL_DAILY_LIMIT} — 발송을 중단합니다.`
        );
        return { allowed: false, reason: 'global_daily' };
    }

    const recent = await basePrismaClient.passwordReset.count({
        where: { email, createdAt: { gte: cooldownAgo } },
    });
    if (recent > 0) {
        return { allowed: false, reason: 'cooldown' };
    }

    const emailToday = await basePrismaClient.passwordReset.count({
        where: { email, createdAt: { gte: dayAgo } },
    });
    if (emailToday >= EMAIL_DAILY_LIMIT) {
        return { allowed: false, reason: 'email_daily' };
    }

    return { allowed: true };
}
