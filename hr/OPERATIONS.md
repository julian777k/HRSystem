# KeystoneHR 운영 아키텍처 문서

> 최종 업데이트: 2026-03-29
> 서비스: keystonehr.app

---

## 1. 시스템 개요

```
┌────────────────────────────────────────────────────────┐
│                    Cloudflare Edge                      │
│                                                        │
│  *.keystonehr.app ──→ Cloudflare Workers (hr-saas)     │
│                        ├─ Middleware (인증, 라우팅)      │
│                        ├─ Server Functions (API)        │
│                        └─ Static Assets (프론트엔드)     │
│                                                        │
│  바인딩:                                                │
│  ├─ D1 Database (hr-saas-db) ── SQLite               │
│  ├─ KV Namespace (HR_CACHE) ── Rate Limit 캐시        │
│  └─ R2 Bucket (hr-saas-files) ── 파일 스토리지         │
└────────────────────────────────────────────────────────┘
```

| 항목 | 기술 |
|------|------|
| 프레임워크 | Next.js 16.1.6 (Turbopack) |
| 런타임 | Cloudflare Workers (Edge) |
| 어댑터 | @opennextjs/cloudflare 1.17.1 |
| 데이터베이스 | Cloudflare D1 (SQLite), 30 테이블 |
| 캐시 | Cloudflare KV |
| 파일 저장 | Cloudflare R2 |
| 도메인 | keystonehr.app (와일드카드 서브도메인) |

---

## 2. 백엔드 아키텍처

### 2.1 디렉토리 구조

```
src/
├── app/
│   └── api/                    ← API 라우트 (백엔드)
│       ├── auth/               ← 인증 (login, register, reset-password)
│       ├── attendance/         ← 근태 (clock-in, clock-out, summary)
│       ├── leave/              ← 휴가 (request, calendar, balance, grant)
│       ├── absence/            ← 휴직 (request, my)
│       ├── overtime/           ← 초과근무 (request, requests)
│       ├── approval/           ← 결재 (lines, pending, process)
│       ├── employees/          ← 직원 (CRUD, import, export, anonymize)
│       ├── departments/        ← 부서 (CRUD)
│       ├── positions/          ← 직급 (CRUD)
│       ├── welfare/            ← 복지 (categories, items, requests)
│       ├── payments/           ← 결제 (request, confirm, status)
│       ├── settings/           ← 설정 (leave-types, overtime, webhooks)
│       ├── setup/              ← 초기 설정 (initialize, seed, complete)
│       ├── super-admin/        ← 슈퍼 관리자 (tenants, stats)
│       ├── dashboard/          ← 대시보드 데이터
│       ├── holidays/           ← 공휴일 관리
│       ├── company/            ← 회사 설정, 로고
│       ├── files/              ← R2 파일 서빙
│       ├── internal/           ← 내부 API (tenant-lookup)
│       └── webhooks/           ← 외부 웹훅 발신
│
├── lib/                        ← 핵심 라이브러리
│   ├── d1-client.ts            ← D1 SQL 클라이언트 (~1400줄, Prisma 호환 API)
│   ├── prisma.ts               ← 프록시 클라이언트 (로컬 Prisma vs CF D1 전환)
│   ├── prisma-cloudflare.ts    ← CF 전용 클라이언트 (빌드 시 swap)
│   ├── auth.ts                 ← JWT 서명/검증
│   ├── auth-actions.ts         ← 쿠키 관리, 사용자 조회
│   ├── super-admin-auth.ts     ← Super Admin JWT
│   ├── password.ts             ← PBKDF2 해싱
│   ├── tenant-context.ts       ← 서브도메인→tenantId 해석
│   ├── rate-limit.ts           ← KV/In-memory Rate Limiting
│   ├── toss.ts                 ← Toss Payments 연동
│   ├── webhook.ts              ← 웹훅 발신
│   ├── audit-log.ts            ← 감사 로그
│   ├── deploy-config.ts        ← 배포 모드 감지 (SaaS/Self-hosted)
│   ├── setup-guard.ts          ← 셋업 API 통합 가드
│   ├── setup-config.ts         ← 셋업 완료 상태 확인
│   ├── session-cleanup.ts      ← 만료 세션 정리
│   └── tenant-seed.ts          ← 테넌트 초기 데이터 시딩
│
├── middleware.ts               ← 미들웨어 (인증, 라우팅, 보안 헤더, Rate Limit)
└── contexts/
    └── auth-context.tsx        ← Auth Context Provider
```

### 2.2 DB 클라이언트 구조

```
┌─────────────────┐     ┌──────────────────────┐
│ API Route       │     │ prisma.ts            │
│ import { prisma }├────→│ createCloudflareProxy│
│                 │     │   ↓                  │
└─────────────────┘     │ getCloudflareTenantClient │
                        │   ↓                  │
                        │ withD1TenantScope()  │
                        │   ↓ (자동 tenantId 주입)│
                        │ createD1Client(db)   │
                        │   ↓                  │
                        │ D1 Database          │
                        └──────────────────────┘
```

**두 가지 클라이언트:**
- `prisma` — 테넌트 스코핑 적용 (일반 API에서 사용)
- `basePrismaClient` — 글로벌 (결제, 테넌트 관리, super admin에서 사용)

### 2.3 미들웨어 처리 흐름

```
요청 수신
  ↓
1. Rate Limiting (IP 기반, /api/* 대상, /api/auth/* 제외)
  ↓
2. 서브도메인 추출 → x-tenant-subdomain 헤더 설정
  ↓
3. SaaS 루트 도메인 라우팅 (keystonehr.app → 랜딩 페이지)
  ↓
4. 인증 리다이렉트 (/login, /setup 등)
  ↓
5. 보안 헤더 추가 (CSP, HSTS, X-Frame-Options 등)
  ↓
API Route 또는 페이지 렌더링
```

### 2.4 인증 흐름

```
로그인 요청 (POST /api/auth/login)
  ↓
1. IP Rate Limit 확인 (20회/15분)
2. Email Rate Limit 확인 (5회/15분)
3. 테넌트 해석 (SaaS: 서브도메인, Self-hosted: 단일)
4. 직원 조회 + 비밀번호 검증 (PBKDF2)
5. 상태 확인 (ACTIVE/ON_LEAVE만 허용)
6. JWT 생성 (tenantId, role 포함)
7. 기존 세션 삭제 → 새 세션 생성
8. httpOnly 쿠키 설정
9. 감사 로그 기록
```

### 2.5 API 엔드포인트 수 (총 91개)

| 카테고리 | 엔드포인트 수 |
|---------|-------------|
| 인증 | 9 |
| 근태 | 6 |
| 휴가 | 14 |
| 휴직 | 3 |
| 초과근무 | 4 |
| 결재 | 3 |
| 직원 | 5 |
| 부서/직급 | 4 |
| 복지 | 7 |
| 결제 | 3 |
| 설정 | 8 |
| 초기설정 | 6 |
| Super Admin | 7 |
| 기타 (대시보드, 공휴일, 파일 등) | 12 |

---

## 3. 프론트엔드 아키텍처

### 3.1 디렉토리 구조

```
src/app/
├── (landing)/                  ← 랜딩 페이지 (keystonehr.app)
│   ├── page.tsx                ← 메인 랜딩
│   ├── layout.tsx              ← 랜딩 레이아웃
│   ├── purchase/               ← 구매 페이지 (Toss 결제)
│   ├── start/                  ← 시작 페이지
│   ├── terms/                  ← 이용약관
│   └── privacy/                ← 개인정보처리방침
│
├── (main)/                     ← 메인 앱 (*.keystonehr.app)
│   ├── layout.tsx              ← 메인 레이아웃 (AuthProvider, Header, Sidebar)
│   ├── dashboard/              ← 대시보드
│   ├── attendance/             ← 근태 관리
│   │   ├── clock/              ← 출퇴근 기록
│   │   ├── my/                 ← 내 근태
│   │   └── overtime/           ← 초과근무
│   ├── leave/                  ← 휴가 관리
│   │   ├── my/                 ← 내 휴가
│   │   ├── register/           ← 휴가 신청
│   │   ├── requests/           ← 휴가 승인 (관리자)
│   │   ├── grant/              ← 휴가 부여
│   │   ├── usage/              ← 사용 현황
│   │   └── absence/            ← 휴직 관리
│   ├── welfare/                ← 복지
│   ├── billing/                ← 결제/구독
│   ├── settings/               ← 설정 (관리자)
│   │   ├── company/            ← 회사 정보
│   │   ├── employees/          ← 직원 관리
│   │   ├── departments/        ← 부서 관리
│   │   ├── positions/          ← 직급 관리
│   │   ├── holidays/           ← 공휴일
│   │   ├── leave-policy/       ← 휴가 정책
│   │   ├── overtime/           ← 초과근무 정책
│   │   ├── approval/           ← 결재 라인
│   │   ├── compensation/       ← 보상 정책
│   │   ├── welfare/            ← 복지 설정
│   │   └── integration/        ← 외부 연동
│   └── admin/                  ← 관리자 전용
│       └── absence/            ← 휴직 관리
│
├── super-admin/                ← 슈퍼 관리자
│   ├── login/                  ← SA 로그인
│   ├── dashboard/              ← SA 대시보드
│   └── tenants/                ← 테넌트 관리
│
├── login/                      ← 로그인
├── register/                   ← 회원가입
├── setup/                      ← 초기 설정 위자드
├── forgot-password/            ← 비밀번호 분실
├── reset-password/             ← 비밀번호 재설정
│
├── global-error.tsx            ← 글로벌 에러 바운더리
└── (main)/error.tsx            ← 메인 앱 에러 바운더리

src/components/
├── layout/
│   ├── header.tsx              ← 헤더 (사용자 정보, 비밀번호 변경)
│   └── sidebar.tsx             ← 사이드바 (메뉴, 권한 기반 필터링)
└── ui/                         ← shadcn/ui 컴포넌트
```

### 3.2 상태 관리

| 영역 | 방식 | 파일 |
|------|------|------|
| 인증 상태 | React Context (AuthProvider) | `src/contexts/auth-context.tsx` |
| 페이지 데이터 | 각 page.tsx의 useState + useEffect | 각 페이지 |
| 사이드바 상태 | localStorage + useState | `sidebar.tsx` |
| 폼 상태 | useState (controlled components) | 각 폼 컴포넌트 |

### 3.3 인증 상태 흐름 (프론트엔드)

```
App Mount
  ↓
AuthProvider (layout.tsx)
  ↓ fetch('/api/auth/me')
  ↓
┌─────────┬──────────┬──────────┐
│ Header  │ Sidebar  │  Page    │
│ useAuth │ useAuth  │ useAuth  │
└─────────┴──────────┴──────────┘
     ↑         ↑          ↑
     └─── 단일 API 호출로 공유 ───┘
```

### 3.4 권한 기반 UI

사이드바 메뉴는 역할에 따라 필터링:

| 역할 | 접근 가능 메뉴 |
|------|--------------|
| `BASIC` | 대시보드, 내 근태, 내 휴가, 복지 |
| `MANAGER` | + 부서 근태, 휴가 승인 |
| `COMPANY_ADMIN` | + 모든 설정 |
| `SYSTEM_ADMIN` | + 모든 기능 |

### 3.5 페이지 수 (총 37개)

| 카테고리 | 페이지 수 |
|---------|----------|
| 랜딩/마케팅 | 5 |
| 인증 | 5 |
| 대시보드 | 1 |
| 근태 | 4 |
| 휴가 | 6 |
| 복지 | 2 |
| 결제 | 3 |
| 설정 (관리자) | 11 |
| Super Admin | 4 |
| 초기 설정 | 1 |

---

## 4. 빌드 및 배포

### 4.1 빌드 파이프라인

```
scripts/build-cloudflare.sh 실행
  ↓
[1/5] Prisma 클라이언트 생성 (schema.sqlite.prisma)
  ↓
[1.5] prisma.ts → prisma-cloudflare.ts 교체 (번들에서 Prisma 제거)
  ↓
[2/5] OpenNext 빌드 (opennextjs-cloudflare)
  ↓
[3/5] 미들웨어 WASM stub (사용하지 않는 대형 WASM 8B로 교체)
  ↓
[4/5] Prisma WASM 패치 (patch-wasm-r2.py)
  ↓
[4.5] 불필요한 node_modules 제거 (@prisma, better-sqlite3, pg*)
  ↓
[5/5] 완료 — handler.mjs (gzip) 크기 확인
```

### 4.2 번들 사이즈

| 항목 | 크기 | 제한 |
|------|------|------|
| handler.mjs (gzip) | ~1.54 MB | 3 MB (Workers 제한) |
| 전체 .open-next | ~44 MB | - |

### 4.3 배포 명령

```bash
# 빌드 + 배포
bash scripts/build-cloudflare.sh && npx wrangler deploy

# 또는
npm run cf:build && npm run cf:deploy
```

### 4.4 환경 변수 / Secrets

**wrangler.toml에 설정된 환경 변수:**
```
DEPLOY_TARGET=cloudflare
DEPLOY_MODE=saas
SAAS_BASE_DOMAIN=keystonehr.app
NODE_ENV=production
DB_PROVIDER=sqlite
```

**wrangler secret으로 설정된 비밀 값:**
```bash
wrangler secret put JWT_SECRET
wrangler secret put SUPER_ADMIN_JWT_SECRET
wrangler secret put TOSS_SECRET_KEY
wrangler secret put TOSS_CLIENT_KEY
wrangler secret put SUPER_ADMIN_EMAIL
wrangler secret put SUPER_ADMIN_PASSWORD
```

### 4.5 바인딩

| 바인딩 | 타입 | 이름 | 용도 |
|--------|------|------|------|
| DB | D1 Database | hr-saas-db | 메인 데이터베이스 |
| HR_CACHE | KV Namespace | - | Rate limit, 캐시 |
| HR_FILES | R2 Bucket | hr-saas-files | 파일 업로드 |

---

## 5. 데이터베이스 스키마 (30 테이블)

### 5.1 핵심 테이블

| 테이블 | 용도 | 테넌트 스코핑 |
|--------|------|-------------|
| tenants | 테넌트(회사) 정보 | 글로벌 |
| employees | 직원 | tenantId |
| departments | 부서 | tenantId |
| positions | 직급 | tenantId |
| sessions | 로그인 세션 | tenantId |
| audit_logs | 감사 로그 | tenantId |

### 5.2 업무 테이블

| 테이블 | 용도 | 테넌트 스코핑 |
|--------|------|-------------|
| attendances | 출퇴근 기록 | tenantId |
| leave_types | 휴가 유형 | tenantId |
| leave_requests | 휴가 신청 | tenantId |
| leave_balances | 휴가 잔여 | tenantId |
| leave_policies | 휴가 정책 | tenantId |
| leave_of_absences | 휴직 | tenantId |
| overtime_requests | 초과근무 신청 | tenantId |

### 5.3 결재/설정 테이블

| 테이블 | 용도 | 테넌트 스코핑 |
|--------|------|-------------|
| approvals | 결재 | tenantId |
| approval_lines | 결재 라인 | tenantId |
| approval_steps | 결재 단계 | tenantId |
| system_configs | 시스템 설정 | tenantId |
| overtime_policies | 초과근무 정책 | tenantId |
| compensation_policies | 보상 정책 | tenantId |

### 5.4 복지/결제/기타

| 테이블 | 용도 | 테넌트 스코핑 |
|--------|------|-------------|
| welfare_categories | 복지 카테고리 | tenantId |
| welfare_items | 복지 항목 | tenantId |
| welfare_requests | 복지 신청 | tenantId |
| payments | 결제 | 글로벌 |
| super_admins | 슈퍼 관리자 | 글로벌 |
| holidays | 공휴일 | tenantId |
| notifications | 알림 | tenantId |
| time_wallets | 시간 지갑 | tenantId |
| external_integrations | 외부 연동 | tenantId |
| password_resets | 비밀번호 재설정 | 글로벌 |

---

## 6. 모니터링 및 운영

### 6.1 로그 확인

```bash
# 실시간 로그 스트리밍
npx wrangler tail

# 특정 상태코드 필터
npx wrangler tail --format=json | jq 'select(.outcome == "exception")'
```

### 6.2 D1 데이터베이스 관리

```bash
# 테이블 목록
npx wrangler d1 execute hr-saas-db --command "SELECT name FROM sqlite_master WHERE type='table'"

# 테넌트 목록
npx wrangler d1 execute hr-saas-db --command "SELECT id, name, subdomain, status FROM tenants"

# 세션 정리
npx wrangler d1 execute hr-saas-db --command "DELETE FROM sessions WHERE expiresAt < datetime('now')"
```

### 6.3 QA 테스트

```
/qa-test
```

보안 감사, E2E 테스트, 회귀 테스트, 성능 체크, 멀티테넌트 격리 검증을 자동 실행.

### 6.4 장애 대응

| 증상 | 확인 방법 | 대응 |
|------|----------|------|
| 로그인 불가 | `wrangler tail`로 에러 확인 | JWT_SECRET 설정 확인 |
| 결제 실패 | payments 테이블 status 확인 | TOSS_SECRET_KEY 확인 |
| 503 에러 | Workers 대시보드 → 에러율 | 번들 사이즈/메모리 확인 |
| 느린 응답 | Workers Analytics → 지연 시간 | D1 쿼리 최적화 |
| 테넌트 접근 불가 | tenants 테이블 status 확인 | suspended → active 변경 |
