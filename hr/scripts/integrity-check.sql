-- 데이터 정합성 감지 (GitHub Actions cron이 매일 실행).
-- 트랜잭션 원자성이 D1에서 완벽히 보장되지 않으므로, 중간에 끊긴 쓰기를
-- 회계 불변식으로 사후 감지한다. 한 건이라도 나오면 알림 → 수동 조사.
--
-- 부동소수 오차를 감안해 0.001 이상 어긋난 것만 잡는다.

-- [1] 연차 잔액 불변식: totalGranted = totalUsed + totalRemain
SELECT 'leave_balance_mismatch' AS check_name, id, employeeId,
       totalGranted, totalUsed, totalRemain,
       ROUND(totalGranted - totalUsed - totalRemain, 4) AS diff
FROM leave_balances
WHERE ABS(totalGranted - totalUsed - totalRemain) > 0.001;

-- [2] 시간지갑 불변식: totalEarned = totalUsed + totalRemain
SELECT 'time_wallet_mismatch' AS check_name, id, employeeId, type,
       totalEarned, totalUsed, totalRemain,
       ROUND(totalEarned - totalUsed - totalRemain, 4) AS diff
FROM time_wallets
WHERE ABS(totalEarned - totalUsed - totalRemain) > 0.001;

-- [3] 음수 잔액 (어떤 경로로도 나오면 안 됨)
SELECT 'negative_leave_remain' AS check_name, id, employeeId, totalRemain
FROM leave_balances WHERE totalRemain < -0.001;

SELECT 'negative_wallet_remain' AS check_name, id, employeeId, type, totalRemain
FROM time_wallets WHERE totalRemain < -0.001;

-- 참고: "승인됐는데 차감 안 됨"은 별도 검사가 필요 없다.
-- 차감이 누락되면 반드시 [1] 잔액 불변식(granted = used + remain)이 깨지므로 거기서 잡힌다.
-- (time_deductions 유무로 판정하면 시간지갑 없이 leaveBalance만 깎이는 정상 케이스를 오탐한다.)
