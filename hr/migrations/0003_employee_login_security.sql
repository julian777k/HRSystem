-- 일반 직원 로그인 무차별 대입 방어 (super_admins의 0002 패턴과 동일)
-- failedLoginCount: 연속 실패 횟수, lockedUntil: 잠금 해제 시각, lastLoginAt: 최근 로그인
ALTER TABLE "employees" ADD COLUMN "failedLoginCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "employees" ADD COLUMN "lockedUntil" TEXT;
ALTER TABLE "employees" ADD COLUMN "lastLoginAt" TEXT;
