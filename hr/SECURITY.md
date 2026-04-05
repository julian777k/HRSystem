# KeystoneHR 보안 및 운영 안정성 가이드

> 최종 업데이트: 2026-04-05
> 대상 시스템: keystonehr.app (Cloudflare Workers + D1)

---

## 1. 보안 아키텍처 개요

```
사용자 요청
    ↓
┌─────────────────────────────────────────┐
│  Cloudflare Edge (인프라 레벨)            │
│  ├─ DDoS L3/L4/L7 자동 차단             │
│  ├─ Bot Fight Mode (봇넷 차단)           │
│  ├─ SSL/TLS Full (strict)               │
│  ├─ Custom Rule: Setup API 차단          │
│  └─ Custom Rule: 해외 접근 캡차           │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│  Middleware (애플리케이션 레벨)             │
│  ├─ API Rate Limiting (100req/60s/IP)   │
│  ├─ Security Headers (CSP, HSTS, etc.)  │
│  ├─ 테넌트 서브도메인 해석                  │
│  └─ 인증 쿠키 검증                        │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│  API Route (비즈니스 로직)                 │
│  ├─ JWT 인증/인가                        │
│  ├─ 테넌트 격리 (withD1TenantScope)       │
│  ├─ 입력 검증 및 파라미터 바인딩             │
│  └─ 감사 로그                            │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│  D1 Database (SQLite)                    │
│  ├─ 테넌트별 자동 WHERE 주입              │
│  ├─ 파라미터 바인딩 (SQL Injection 방지)   │
│  └─ UNIQUE 제약조건                      │
└─────────────────────────────────────────┘
```

---

## 2. 인증 및 세션 관리

### 2.1 일반 사용자 인증

| 항목 | 설정 |
|------|------|
| 토큰 방식 | JWT (HS256, jose 라이브러리) |
| 저장 위치 | httpOnly 쿠키 (`auth_token`) |
| 만료 시간 | 24시간 |
| 자동 갱신 | 만료 4시간 이내 시 자동 리프레시 |
| 쿠키 설정 | `httpOnly: true`, `secure: true` (production), `sameSite: strict` |
| 쿠키 도메인 | 미설정 (host-only: 서브도메인 간 쿠키 격리) |
| 비밀번호 해싱 | PBKDF2-SHA256, 600,000 iterations, 16byte salt (NIST SP 800-132) |
| 비밀번호 정책 | `validatePasswordPolicy()` — 최소 길이, 복잡성 검증 |

**관련 파일:**
- `src/lib/auth.ts` — JWT 서명/검증, 토큰 리프레시
- `src/lib/auth-actions.ts` — 쿠키 설정, 사용자 조회, 테넌트 교차 검증
- `src/lib/password.ts` — PBKDF2 해싱/검증

### 2.2 Super Admin 인증

| 항목 | 설정 |
|------|------|
| 별도 쿠키 | `super_admin_token` |
| JWT Secret | SaaS: `SUPER_ADMIN_JWT_SECRET` (필수), Self-hosted: SHA-256 파생 |
| 계정 잠금 | 5회 실패 → 30분, 10회 실패 → 2시간 잠금 |
| 초기 비밀번호 | 첫 로그인 시 비밀번호 변경 강제 (`mustChangePassword`) |
| DB 검증 | 매 요청마다 super admin 존재 확인 |

**관련 파일:**
- `src/lib/super-admin-auth.ts` — JWT 파생 (crypto.subtle SHA-256), 검증

### 2.3 Cross-Tenant 세션 보호

SaaS 모드에서 JWT의 `tenantId`와 서브도메인의 `tenantId`가 불일치 시:
- 인증 쿠키 즉시 삭제 (`clearAuthCookie()`)
- 경고 로그 기록
- `null` 반환 (인증 실패 처리)

```typescript
// src/lib/auth-actions.ts
if (!subdomainTenantId || result.user.tenantId !== subdomainTenantId) {
  await clearAuthCookie();
  console.warn(`[Auth] Cross-tenant mismatch — jwt.tenantId=${result.user.tenantId}, subdomain.tenantId=${subdomainTenantId}`);
  return null;
}
```

---

## 3. Rate Limiting (속도 제한)

### 3.1 구현 방식

- **In-memory Map**: 모든 환경에서 사용 (KV 쓰기 1K/일 제한으로 KV 미사용)
- **30초 주기 cleanup**: 만료된 엔트리 정리
- **LRU 퇴출**: 1000건 초과 시 oldest 500건 제거 (전체 clear 대신 — 공격자 악용 방지)
- **관련 파일**: `src/lib/rate-limit.ts`

### 3.2 적용 현황

| 엔드포인트 | 기준 | 제한 | 시간 | 근거 |
|-----------|------|------|------|------|
| `/api/*` (미들웨어) | IP | 100회 | 60초 | 글로벌 방어 |
| `/api/auth/login` | IP + 이메일 | 20/5회 | 15분 | 브루트포스 차단 |
| `/api/super-admin/auth/login` | IP + 이메일 | 10/5회 | 15분 | 관리자 보호 |
| `/api/auth/register` | IP | 5회 | 1시간 | 스팸 가입 방지 |
| `/api/auth/register-company` | IP | 3회 | 1시간 | 테넌트 남용 방지 |
| `/api/auth/reset-password` | 토큰 | 5회 | 15분 | 토큰 브루트포스 |
| `/api/payments/request` | IP | 5회 | 1시간 | 결제 남용 방지 |
| `/api/payments/confirm` | IP | 10회 | 15분 | 이중 결제 방지 |
| `/api/employees/import` | 사용자 | 3회 | 15분 | D1 쓰기 쿼터 보호 |
| `/api/employees/export` | 사용자 | 10회 | 15분 | 대량 조회 방지 |
| `/api/leave/export` | 사용자 | 10회 | 15분 | 대량 조회 방지 |
| `/api/approval/process` | 사용자 | 30회 | 15분 | 비즈니스 로직 보호 |
| `/api/leave/request` | 사용자 | 20회 | 15분 | 신청 스팸 방지 |
| `/api/overtime/request` | 사용자 | 20회 | 15분 | 신청 스팸 방지 |
| `/api/absence/request` | 사용자 | 10회 | 15분 | 휴직 스팸 방지 |
| `/api/attendance/clock-in` | 사용자 | 10회 | 15분 | 출퇴근 스팸 방지 |
| `/api/attendance/clock-out` | 사용자 | 10회 | 15분 | 출퇴근 스팸 방지 |

### 3.3 제한 사항

- In-memory Map은 Worker isolate 재시작 시 리셋됨 (수분~수시간 주기)
- 분산 환경에서 isolate 간 카운터 공유 불가 — "최선의 노력" 수준
- 완벽한 원자적 rate limiting은 Durable Objects 필요 (유료)

---

## 4. 멀티테넌트 격리

### 4.1 테넌트 스코핑

`withD1TenantScope()` 프록시가 모든 DB 쿼리에 `tenantId`를 자동 주입:

| 작업 | 주입 방식 |
|------|----------|
| `create` | `data.tenantId = tenantId` |
| `findMany` / `findFirst` / `count` | `where.tenantId = tenantId` |
| `update` / `delete` | `where.tenantId = tenantId` |
| `findUnique` | 복합키 내 `tenantId` 강제 설정 |
| `upsert` | `where` + `create` 양쪽에 주입 |

**예외 (글로벌 모델):** `tenant`, `superAdmin`, `payment`, `passwordReset` — 테넌트 필터 미적용

**관련 파일:**
- `src/lib/d1-client.ts` (lines 1208-1320) — `withD1TenantScope` 프록시
- `src/lib/tenant-context.ts` — 서브도메인→tenantId 해석 (1분 캐시)

### 4.2 테넌트 해석 흐름

```
요청 → middleware: Host 헤더에서 subdomain 추출
     → x-tenant-subdomain 헤더에 저장
     → API route: getTenantId() 호출
     → tenant-context: 캐시 확인 → 미스 시 D1 조회
     → 트라이얼 만료 자동 체크/정지
```

---

## 5. 결제 보안

### 5.1 결제 흐름 (Toss Payments 연동)

```
1. 클라이언트 → POST /api/payments/request (결제 생성, PENDING)
2. Toss 위젯에서 결제 진행
3. 클라이언트 → POST /api/payments/confirm (결제 확인)
4. 서버 → Toss API 호출 (server-to-server, Secret Key 인증)
5. 결과에 따라 SUCCESS / FAILED 상태 업데이트
```

### 5.2 경쟁조건 방지 (원자적 상태 전환)

동시에 같은 결제를 확인하는 요청이 들어와도 하나만 처리:

```sql
-- 원자적 CLAIM: 한 요청만 성공
UPDATE payments SET status = 'PROCESSING', updatedAt = ?
WHERE orderId = ? AND status = 'PENDING'
-- affected rows = 0이면 이미 다른 요청이 처리 중
```

**관련 파일:** `src/app/api/payments/confirm/route.ts`

### 5.3 자동 환불

결제 승인 후 테넌트 생성 실패 시 (서브도메인/이메일 충돌) Toss 환불 API 자동 호출:

```typescript
// 서브도메인 충돌 시
const refund = await cancelPayment(paymentKey, '서브도메인 충돌로 인한 자동 환불');
// payment 상태를 REFUNDED 또는 REFUND_FAILED로 업데이트
```

**관련 파일:** `src/lib/toss.ts` — `cancelPayment()` 함수

### 5.4 Toss API 타임아웃

모든 Toss API 호출에 10초 타임아웃 적용:

```typescript
signal: AbortSignal.timeout(10_000)
```

---

## 6. 데이터 정합성

### 6.1 D1 Upsert (INSERT ON CONFLICT)

기존 `findFirst → create/update` 2단계 패턴 → 단일 SQL로 변경:

```sql
INSERT INTO "table" (...) VALUES (...)
ON CONFLICT (conflictCol1, conflictCol2) DO UPDATE SET ...
```

동시 요청 시 UNIQUE 제약 위반 없이 안전하게 처리.

**관련 파일:** `src/lib/d1-client.ts` (upsert 메서드)

### 6.2 $executeRaw 반환값

`$executeRaw`가 영향받은 행 수를 반환하도록 수정:

```typescript
const result = await db.prepare(sql).bind(...params).run();
return result.meta?.changes ?? 0;
```

결제 원자적 처리, clock-out TOCTOU 가드 등에서 활용.

### 6.3 Clock-out 이중 처리 방지

```sql
UPDATE attendances SET "clockOut" = ?, ...
WHERE id = ? AND "clockOut" IS NULL
-- affected rows = 0이면 이미 퇴근 처리됨 → 409 반환
```

### 6.4 부서 순환 계층구조 방지

부서 parentId 업데이트 시:
1. 자기 자신 참조 차단
2. Parent chain 순회하여 cycle 감지 (max depth 20)

```typescript
// src/app/api/departments/[id]/route.ts
let currentParentId = parentId;
const visited = new Set([id]);
for (let depth = 0; depth < 20 && currentParentId; depth++) {
  if (visited.has(currentParentId)) → 400 에러
}
```

### 6.5 D1 트랜잭션 한계

D1(SQLite)의 `$transaction`은 **진정한 원자성을 보장하지 않음**:
- Callback 형식: 같은 client 참조 전달 (BEGIN/COMMIT 없음)
- Array 형식: 순차 실행, 중간 실패 시 롤백 불가

**대응:** 핵심 경로(결제)는 원자적 UPDATE로 우회. `db.batch()`는 `createMany`에서 사용 중.

### 6.6 Race Condition 방어 (2026-04-05 추가)

동시 요청으로 인한 데이터 무결성 훼손을 방지하기 위한 다층 방어:

| 공격 시나리오 | 방어 | 관련 파일 |
|-------------|------|----------|
| 동시 휴가 신청 → 잔여일 음수 | `WHERE totalRemain >= days` 조건부 UPDATE | `leave/request/route.ts` |
| 승인 처리 이중 차감 | `WHERE totalRemain >= requestDays` 가드 | `approval/process/route.ts` |
| 이월 이중 실행 | `$transaction` + 내부 이중 체크 | `leave/carry-over/route.ts` |
| 자동부여 이중 실행 | `$transaction` + `SKIP_DUPLICATE` 가드 | `leave/auto-grant/route.ts` |
| 음수 휴가일수로 잔여일 증가 | `requestDays > 0 && requestDays <= 365` 검증 | `leave/request/route.ts` |
| 퇴근 음수 근무시간 | `Math.max(0, Math.min(rawHours, 24))` 클램핑 | `attendance/clock-out/route.ts` |

### 6.7 역할 계층 (2026-04-05 추가)

```
SYSTEM_ADMIN → 모든 역할 부여 가능
COMPANY_ADMIN → BASIC, MANAGER만 부여 가능 (관리자 역할 부여 불가)
MANAGER / BASIC → 역할 부여 불가
모든 사용자 → 본인 역할 변경 불가
```

---

## 7. 보안 헤더

미들웨어에서 모든 응답에 적용:

```
X-Frame-Options: DENY                    → 클릭재킹 방지
X-Content-Type-Options: nosniff           → MIME 스니핑 방지
Referrer-Policy: strict-origin-when-cross-origin
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload  → HSTS
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://js.tosspayments.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  connect-src 'self' https://api.tosspayments.com https://*.tosspayments.com;
  frame-src https://*.tosspayments.com;
  frame-ancestors 'none'
```

**관련 파일:** `src/middleware.ts` — `addSecurityHeaders()`

### 7.1 CSP 제한 사항

`script-src 'unsafe-inline'`이 포함되어 있음:
- **원인**: Next.js on CF Workers가 hydration용 인라인 스크립트 생성
- **영향**: XSS 발견 시 인라인 스크립트 실행 가능
- **완화**: React의 자동 이스케이프 + CSP의 다른 지시어(frame-ancestors 'none' 등)

---

## 8. 셋업 엔드포인트 보안

### 8.1 Setup Guard

모든 변경 가능한 셋업 API에 통합 가드 적용:

```typescript
// src/lib/setup-guard.ts
export async function checkSetupGuard(request) {
  // 1. 셋업 완료 시 차단 (403)
  // 2. SETUP_SECRET 필수 (모든 환경 — NODE_ENV 무관)
  // 3. x-setup-secret 헤더 검증
}
```

### 8.2 적용 라우트

| 라우트 | 가드 | 비고 |
|--------|------|------|
| `POST /api/setup/initialize` | `checkSetupGuard` | DB 초기화 |
| `POST /api/setup/seed` | `checkSetupGuard` | 시드 데이터 |
| `POST /api/setup/complete` | `checkSetupGuard` | 셋업 완료 |
| `POST /api/setup/test-db` | `checkSetupGuard` | DB 연결 테스트 |
| `GET /api/setup/status` | 없음 (읽기 전용) | UI에서 필요 |

### 8.3 Cloudflare Custom Rule

추가로 Cloudflare 레벨에서 Setup API 외부 접근 차단:
```
(http.request.uri.path contains "/api/setup/initialize")
or (http.request.uri.path contains "/api/setup/seed")
or (http.request.uri.path contains "/api/setup/test-db")
→ Action: Block
```

---

## 9. 셀프 등록 보안

| 항목 | 설정 |
|------|------|
| 활성화 제어 | `self_register_enabled` systemConfig (`false` 시 등록/옵션 엔드포인트 차단) |
| 등록 시 상태 | `self_register_auto_approve` 설정에 따라 ACTIVE 또는 PENDING |
| Rate Limit | IP당 5회/시간 |
| 비밀번호 정책 | `validatePasswordPolicy()` — 8자 이상, 숫자, 특수문자 |
| 이메일 중복 | 테넌트 내 고유성 검증 (크로스테넌트 차단) |
| 사번 중복 | 테넌트 내 고유성 검증 |
| 역할 | 항상 `BASIC` (관리자 역할 자가 부여 불가) |

**관련 파일:** `src/app/api/auth/register/route.ts`, `src/app/api/auth/register/options/route.ts`

---

## 10. Cloudflare 인프라 보안 설정

### 10.1 현재 적용 상태

| 설정 | 상태 | 위치 |
|------|------|------|
| DDoS L3/L4 자동 차단 | Active | Security → DDoS protection |
| DDoS L7 (HTTP) 자동 차단 | Always enabled | Security → DDoS protection |
| Bot Fight Mode | ON | Security → Settings |
| SSL/TLS | Full (strict) | SSL/TLS → Overview |
| Always Use HTTPS | ON | SSL/TLS → Edge Certificates |
| Setup API 차단 규칙 | Active | Security → Security rules |
| 해외 접근 캡차 | Active | Security → Security rules |

### 10.2 Custom Rules (Free 플랜)

| 규칙 | 조건 | 액션 |
|------|------|------|
| Block Setup API | URI contains `/api/setup/initialize` or `/seed` or `/test-db` | Block |
| Block Non-KR Countries | Country is not KR | Managed Challenge |

### 10.3 Pro 플랜 업그레이드 시 추가 가능

| 기능 | 효과 |
|------|------|
| WAF Managed Rules | OWASP Top 10 자동 차단 (SQLi, XSS, RCE 등) |
| Rate Limiting Rules | Cloudflare 레벨 세밀한 속도 제한 |
| Credential Leak Detection | 유출된 비밀번호 자동 감지 |

---

## 11. 성능 최적화

### 11.1 Auth Context Provider

`/api/auth/me` 중복 호출 제거:

| 이전 | 이후 |
|------|------|
| 페이지당 3~4회 독립 호출 (Header, Sidebar, Page, TrialBanner) | AuthProvider에서 1회 호출 → Context로 공유 |

**관련 파일:**
- `src/contexts/auth-context.tsx` — AuthProvider, useAuth hook
- `src/app/(main)/layout.tsx` — Provider 적용
- `src/components/layout/sidebar.tsx` — useAuth() 사용
- `src/components/layout/header.tsx` — useAuth() 사용

### 11.2 Leave Calendar 쿼리 제한

`/api/leave/calendar` 조회 시:
- `take: 500` — 최대 500건 제한
- year/month 범위 검증 (2000~2100)

---

## 12. 프론트엔드 안정성

### 12.1 localStorage 크래시 방지

```typescript
// src/components/layout/sidebar.tsx
let initial = {};
try {
  const saved = localStorage.getItem("sidebar-groups");
  if (saved) initial = JSON.parse(saved);
} catch {
  localStorage.removeItem("sidebar-groups");
}
```

### 12.2 setTimeout Cleanup

비밀번호 변경 후 리다이렉트 타이머에 cleanup 적용:

```typescript
// src/components/layout/header.tsx
const redirectTimeoutRef = useRef();
// 컴포넌트 언마운트 시 clearTimeout
useEffect(() => () => { if (redirectTimeoutRef.current) clearTimeout(redirectTimeoutRef.current); }, []);
```

---

## 13. 외부 API 연동 보안

### 13.1 Toss Payments

| 항목 | 설정 |
|------|------|
| 인증 | Basic Auth (Secret Key base64) |
| 타임아웃 | 10초 (`AbortSignal.timeout`) |
| 환경분리 | `TOSS_SECRET_KEY` / `TOSS_CLIENT_KEY` (wrangler secret) |

### 13.2 Webhook 발신

| 항목 | 설정 |
|------|------|
| 타임아웃 | 5초 (`AbortSignal.timeout`) |
| 테스트 발신 | 동일 5초 타임아웃 적용 |

**관련 파일:** `src/lib/webhook.ts`, `src/app/api/settings/webhooks/route.ts`

---

## 14. 알려진 제한 사항

| 제한 | 원인 | 영향 | 대응 |
|------|------|------|------|
| CSP `unsafe-inline` | Next.js + CF Workers 인라인 스크립트 | XSS 시 인라인 실행 가능 | React 자동 이스케이프로 완화 |
| D1 트랜잭션 비원자성 | SQLite/D1 한계 | 복합 작업 부분 성공 가능 | 핵심 경로는 원자적 UPDATE + 조건부 WHERE 사용 |
| Rate limit isolate 리셋 | Worker isolate 수명 한계 | 재시작 시 카운터 초기화 | LRU 퇴출로 악용 방지, 분산 환경은 Durable Objects 권장 |
| 에러 모니터링 | 번들 3MB 제한으로 Sentry 불가 | console.error만 사용 | Cloudflare Logpush 또는 Observability 설정 권장 |
| 테넌트 캐시 | 1분 TTL | D1 장애 시 1분 후 전면 장애 가능 | 캐시 TTL 확대 검토 (5~10분) |
| PBKDF2 600K wall-clock | 네이티브 crypto.subtle 사용 | 로그인 ~200-500ms 소요 | CPU 시간에 미포함 (네이티브), 30s wall-clock 한도 내 |
| JWT 즉시 폐기 불가 | Stateless JWT 특성 | 퇴사 후 최대 24시간 유효 | 세션 테이블 삭제로 부분 완화, 향후 토큰 블랙리스트 검토 |

---

## 15. 보안 점검 체크리스트

정기적으로 확인해야 할 항목:

**인프라**
- [ ] Cloudflare Security → Analytics에서 차단된 요청 확인
- [ ] Cloudflare Security → Security rules에서 Custom Rules 활성 확인
- [ ] `wrangler secret list`로 JWT_SECRET, SUPER_ADMIN_JWT_SECRET, ENCRYPTION_KEY 설정 확인
- [ ] `npm audit` 실행하여 의존성 CVE 확인

**데이터 무결성**
- [ ] D1 Console: `SELECT COUNT(*) FROM sessions` — 세션 테이블 비대화 확인
- [ ] D1 Console: `SELECT * FROM leave_balances WHERE totalRemain < 0` — 음수 잔여일 확인
- [ ] Super Admin 로그인 → 테넌트 목록에서 만료 트라이얼 확인

**접근 제어**
- [ ] `.env` 파일에 기본 비밀번호 남아있지 않은지 확인
- [ ] 프로덕션에서 SETUP_SECRET이 설정되었는지 확인
- [ ] 프로덕션에서 CRON_SECRET이 설정되었는지 확인
- [ ] 자가등록 설정 (`self_register_enabled`) 의도대로 설정되었는지 확인

**테스트**
- [ ] `/qa-test` 실행하여 E2E + 보안 회귀 테스트

---

## 16. 수정 이력

### 2026-04-05 — 3단계 심층 보안 감사 (코드 + 화이트해커 + 외부 공격)

**감사 프로세스:** 7개 에이전트 투입 (테넌트 격리 / Rate Limit / 시크릿 노출 / OWASP / 비즈니스 로직 우회 / 인프라 DoS / 외부 공격자 침투)
- 1단계 (코드 레벨): CRITICAL 11건, HIGH 20건, MEDIUM 9건 발견
- 2단계 (화이트해커): Race Condition 6건, 상태 머신 위반 2건, 인프라 장애 4건
- 3단계 (외부 공격자): 비인증 공격 벡터 5건, 결제 흐름 조작 3건

**수정 파일 22개, 총 30건:**

| 분류 | 수정 내용 |
|------|----------|
| **테넌트 격리 (5건)** | |
| Critical | `absence/request/[id]` — SELECT/UPDATE에 tenantId WHERE 조건 추가 |
| Critical | `employees/route.ts` — 이메일/사번 중복 확인 시 tenantId 필터 추가 |
| Critical | `employees/[id]/route.ts` — 이메일 변경 시 같은 테넌트 내 검증 |
| **Rate Limit (10건)** | |
| High | 9개 미보호 라우트에 사용자별 rate limit 추가 (import/export/approval/leave/overtime/clock) |
| High | Rate limit map 전체 clear → LRU oldest 제거로 변경 (공격자 악용 방지) |
| **시크릿/인증 (5건)** | |
| Critical | Setup guard — NODE_ENV 무관 SETUP_SECRET 항상 필수 |
| Critical | Webhook — CRON_SECRET 미설정 시 cron 요청 거부 |
| Critical | PBKDF2 — 100K → 600K iterations (NIST SP 800-132 권장) |
| High | Toss — test 키 fallback 제거 + 프로덕션 test 키 차단 |
| High | JWT_SECRET / ENCRYPTION_KEY — 강력한 랜덤 값으로 교체 |
| **역할/권한 (2건)** | |
| High | COMPANY_ADMIN이 관리자 역할 부여 불가 (SYSTEM_ADMIN만 가능) |
| High | 본인 역할 변경 차단 (자기 승격 방지) |
| **입력 검증 (3건)** | |
| High | absence GET — status allowlist + employeeId UUID 형식 검증 |
| High | absence POST — ISO 8601 날짜 형식 검증 + 2년 초과 차단 |
| Critical | leave request — `requestDays > 0` 검증 (음수 일수로 잔여일 증가 방지) |
| **Race Condition (3건)** | |
| Critical | leave balance 차감 — `totalRemain >= days` 조건부 UPDATE (동시 요청 음수 방지) |
| Critical | carry-over — 트랜잭션 래핑 + 이중 실행 가드 |
| High | approval/process balance 차감 — `totalRemain >= requestDays` 가드 |
| **상태/데이터 무결성 (2건)** | |
| High | clock-out — 음수/24시간 초과 workHours 클램핑 (`Math.max(0, Math.min(raw, 24))`) |
| Medium | Cookie — `sameSite: 'strict'` (CSRF 강화) |
| **외부 공격 방어 (2건)** | |
| High | 자가등록 — `self_register_enabled: false` 시 register/options 엔드포인트 차단 |
| Medium | npm audit fix — 안전한 의존성 업데이트 (33건 → 3건) |

---

### 2026-03-29 — 종합 보안 점검 및 수정

**감사 프로세스:** 6개 에이전트 투입 (백엔드/프론트엔드/인프라 감사 × 교차 검증)
- 1차 감사: 68건 발견
- 교차 검증: 10건 거짓양성 제거 (38% false positive rate)
- 방어력 테스트: 14건 검증 통과 + 5건 추가 발견 즉시 수정

**수정 파일 23개, 총 22건:**

| 분류 | 수정 내용 |
|------|----------|
| Critical | 결제 확인 경쟁조건 → 원자적 상태 전환 |
| Critical | Setup API 보안 → 통합 가드 + Cloudflare 차단 |
| High | 로그인 IP rate limit 추가 (20회/15분) |
| High | Super admin IP rate limit 추가 (10회/15분) |
| High | 게스트 결제 요청 rate limit (5회/시간) |
| High | 결제 확인 rate limit (10회/15분) |
| High | D1 upsert → INSERT ON CONFLICT 원자적 처리 |
| High | Leave calendar → take: 500 + 날짜 검증 |
| Medium | Super admin JWT → SHA-256 해시 파생 |
| Medium | Cross-tenant → 쿠키 삭제 + 로깅 |
| Medium | Toss API → 10초 타임아웃 |
| Medium | Webhook 테스트 → 5초 타임아웃 |
| Medium | 셀프등록 → PENDING 상태 (관리자 승인) |
| Medium | 결제 실패 시 → Toss 자동 환불 API |
| Medium | 부서 → 순환 계층구조 검증 |
| Medium | Auth Context → /api/auth/me 중복 호출 제거 |
| Low | Clock-out → TOCTOU 가드 (WHERE clockOut IS NULL) |
| Low | $executeRaw → 영향 행 수 반환 |
| Low | localStorage → JSON.parse try-catch |
| Low | Header → setTimeout cleanup |
| Infra | Cloudflare Bot Fight Mode 활성화 |
| Infra | Cloudflare SSL Full (strict) + HTTPS 강제 |
