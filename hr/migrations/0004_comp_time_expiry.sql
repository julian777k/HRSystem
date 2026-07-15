-- 보상시간 소멸(연도 기반) 지원
-- compTimeExpiryYears: 적립연도로부터 N년 후 만료 (NULL = 소멸 없음, 기존 동작)
-- totalExpired: 만료 소멸된 시간 누적 (사용분과 구분해 직원 잔액에 오표시 방지)
ALTER TABLE "compensation_policies" ADD COLUMN "compTimeExpiryYears" INTEGER;
ALTER TABLE "time_wallets" ADD COLUMN "totalExpired" REAL NOT NULL DEFAULT 0;
