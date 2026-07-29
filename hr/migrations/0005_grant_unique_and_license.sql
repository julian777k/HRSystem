-- 1) 연차 자동부여 중복 방지
-- auto-grant 배치화로 "조회 → 판단 → 쓰기" 사이에 간격이 생기므로,
-- 애플리케이션 이중 체크 대신 DB가 중복을 막는다.
-- ⚠️ 기존에 동일 (테넌트·직원·휴가유형·기간) 조합이 2행 이상이면 이 인덱스 생성이 실패한다.
--    실패 시 배포가 중단되므로, 중복 행을 먼저 점검·정리한 뒤 재배포할 것.
CREATE UNIQUE INDEX "leave_grants_tenant_emp_type_period_key"
    ON "leave_grants" ("tenantId", "employeeId", "leaveTypeCode", "periodStart", "periodEnd");

-- 2) 테넌트 이용 기간 (결제일 기준 10년)
-- licenseExpiresAt  : 이용 종료일. paidAt + 10년이 기본이며, 연장·예외는 이 값을 직접 수정한다.
-- licenseNotifiedAt : 구독 전환 조건을 고지한 시각. 약관 제13조 4항(만료 6개월 전 고지) 이행 기록.
ALTER TABLE "tenants" ADD COLUMN "licenseExpiresAt" DATETIME;
ALTER TABLE "tenants" ADD COLUMN "licenseNotifiedAt" DATETIME;

-- 기존 유료 테넌트 백필: 결제일 + 10년
UPDATE "tenants"
   SET "licenseExpiresAt" = datetime("paidAt", '+10 years')
 WHERE "paidAt" IS NOT NULL
   AND "licenseExpiresAt" IS NULL;

-- 3) 구독 전환 (약관 제13조)
-- billingMode          : onetime = 1회 구매 이용권 / subscription = 월 구독 전환 완료
-- subscriptionStartedAt: 구독 전환 시행일
-- subscriptionFee      : 월 구독료(원). 전환 시점 조건을 테넌트별로 보존한다.
ALTER TABLE "tenants" ADD COLUMN "billingMode" TEXT NOT NULL DEFAULT 'onetime';
ALTER TABLE "tenants" ADD COLUMN "subscriptionStartedAt" DATETIME;
ALTER TABLE "tenants" ADD COLUMN "subscriptionFee" INTEGER;
