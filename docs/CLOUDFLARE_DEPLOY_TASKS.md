# HR-SYSTEM SaaS Cloudflare 배포 태스크 문서

> 생성일: 2026-03-07
> 목표: Next.js 16 HR SaaS를 Cloudflare Workers 무료 티어로 배포

---

## 0. Cloudflare 계정 및 무료 티어 정보

### 계정 생성 정책

| 항목 | 내용 |
|------|------|
| 계정당 이메일 | 1 이메일 = 1 계정 (동일 이메일로 복수 계정 불가) |
| 복수 계정 생성 | 가능. 다른 이메일로 계정 생성 후 메인 이메일을 Super Admin으로 초대하면 하나의 로그인으로 양쪽 관리 가능 |
| Gmail + 트릭 | `user+tag@gmail.com` 방식 불가. 실제 다른 이메일 주소 필요 |
| 본인인증 | 불필요. 이메일 인증만 하면 즉시 사용 가능 |
| 결제수단 | 무료 플랜은 결제수단 등록 불필요 |

### 무료 티어 핵심 제한

| 리소스 | 무료 한도 | 비고 |
|--------|----------|------|
| **Workers 요청** | 100,000/일 | 자정(UTC) 리셋 |
| **CPU 시간** | 10ms/요청 | I/O 대기 미포함, 순수 연산만 |
| **번들 크기** | 3MB (gzip) | **가장 큰 제약** |
| **D1 읽기** | 5,000,000행/일 | |
| **D1 쓰기** | 100,000행/일 | |
| **D1 용량** | 500MB/DB, 최대 10개 DB (총 5GB) | |
| **KV 읽기** | 100,000/일 | |
| **KV 쓰기** | 1,000/일 | **세션 저장 시 주의** |
| **R2 저장** | 10GB/월 | 이그레스 무료 |
| **Cron Triggers** | 5개/계정 | |

### 와일드카드 서브도메인 (무료 플랜)

| 항목 | 지원 여부 |
|------|----------|
| `*.keystonehr.app` 와일드카드 DNS | **지원** |
| 와일드카드 프록시 (오렌지 클라우드) | **지원** |
| `*.keystonehr.app` SSL 인증서 | **무료 Universal SSL로 자동 지원** |
| `*.sub.keystonehr.app` 2단계 와일드카드 | 미지원 (유료 ACM 필요) |

### 주요 리스크

| 리스크 | 심각도 | 대응 방안 |
|--------|--------|----------|
| 번들 3MB 초과 | **CRITICAL** | 코드 스플리팅, 불필요 의존성 제거, xlsx 등 대용량 라이브러리 lazy import |
| CPU 10ms 초과 (bcrypt) | **HIGH** | bcrypt → Web Crypto PBKDF2 전환 또는 D1 기반 해싱 |
| KV 쓰기 1,000/일 | **MEDIUM** | 세션을 KV 대신 D1에 저장 |
| D1 쓰기 100,000행/일 | **LOW** | 소규모 운영 시 충분 |

---

## Phase 1: 인프라 준비 ✅ 완료

### Task 1.1: Cloudflare 계정 생성
- [x] https://dash.cloudflare.com/sign-up 접속 ✅
- [x] 이메일 + 비밀번호로 회원가입 ✅
- [x] 이메일 인증 완료 ✅
- [x] 대시보드 접속 확인 ✅
- [x] 봇 차단 설정 (Bot Fight Mode, Block AI Bots, AI Labyrinth, Managed robots.txt) ✅

### Task 1.2: 도메인 설정
- [x] 도메인 구매: `keystonehr.app` (Cloudflare Registrar, $12.18/년) ✅
- [x] Cloudflare DNS 자동 연결 (Registrar 구매로 네임서버 설정 불필요) ✅

### Task 1.3: DNS 레코드 설정
- [x] A 레코드: `@` → `192.0.2.1` (Proxied) ✅
- [x] A 레코드: `*` → `192.0.2.1` (Proxied) — 와일드카드 서브도메인 ✅
- [x] Universal SSL 활성화 확인 (Active) ✅
- [x] `*.keystonehr.app` SSL 커버리지 확인 ✅

### Task 1.4: Cloudflare 리소스 생성
- [x] **wrangler CLI 설치** (v4.71.0) ✅
- [x] **wrangler 로그인** ✅
- [x] **D1 데이터베이스 생성** ✅
  - DB명: `hr-saas-db`
  - ID: `1dc0b8ed-7949-4d65-af12-9c10fbbc0669`
  - Region: APAC
- [x] **KV 네임스페이스 생성** ✅
  - 이름: `HR_CACHE`
  - ID: `54f129537c3f4f3bb5bc595c6a7a821e`
- [x] **R2 버킷 생성** ✅
  - 이름: `hr-saas-files`
  - Storage class: Standard

---

## Phase 2: 프로젝트 Cloudflare 전환 ✅ 완료

### Task 2.1: 패키지 설치
- [x] `@opennextjs/cloudflare` 설치 ✅
- [x] `@prisma/adapter-d1` 설치 ✅
- [x] `wrangler` 설치 (devDependencies) ✅

### Task 2.2: wrangler.toml 생성
- [x] D1, KV, R2 바인딩 설정 ✅
- [x] `main = ".open-next/worker.js"` 설정 ✅
- [x] `[assets] directory = ".open-next/assets"` 설정 ✅
- [x] 환경변수 설정 (DEPLOY_TARGET, DEPLOY_MODE, SAAS_BASE_DOMAIN, DB_PROVIDER) ✅

### Task 2.3: next.config.ts 수정
- [x] Cloudflare 모드에서 `output: "standalone"` 제거 ✅
- [x] `serverExternalPackages` 조건부 분기 ✅
  - Cloudflare: `@prisma/client`, `.prisma/client`만 외부화
  - 로컬: pg, better-sqlite3 등 추가 외부화
- [x] pg-cloudflare esbuild 해결 에러 해결 ✅

### Task 2.4: open-next.config.ts 생성
- [x] `defineCloudflareConfig({})` 사용 ✅

### Task 2.5: Prisma D1 연동
- [x] `prisma.ts` D1 Proxy 패턴 구현 ✅
  - `getCloudflareClient()` → D1 바인딩으로 PrismaClient 생성
  - `createCloudflareProxy()` → 74개 API 라우트 변경 없이 투명 지원
- [x] `setup/test-db/route.ts` — fs/pg 동적 import로 변경 ✅
- [x] `setup/complete/route.ts` — pg 동적 require로 변경 ✅

### Task 2.6: 빌드 검증
- [x] TypeScript 0 에러 ✅
- [x] `DEPLOY_TARGET=cloudflare npx opennextjs-cloudflare build` 성공 ✅
- [x] handler.mjs gzip 크기: **1.73MB** (3MB 한도 내) ✅
- [x] `npx wrangler dev` 로컬 서버 정상 작동 (HTTP 307 → /dashboard) ✅
- [x] npm 스크립트 추가: `cf:build`, `cf:dev`, `cf:deploy` ✅

### Task 2.7: D1 스키마 마이그레이션
- [ ] `schema.sqlite.prisma`에서 SQL 마이그레이션 생성
  ```bash
  mkdir -p migrations
  npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.sqlite.prisma --script > migrations/0001_init.sql
  npx wrangler d1 migrations apply hr-saas-db
  ```
- [ ] D1에 마이그레이션 적용 확인

### Task 2.8: 환경변수/Secrets 설정
- [ ] Secrets 등록
  ```bash
  npx wrangler secret put JWT_SECRET
  npx wrangler secret put SUPER_ADMIN_JWT_SECRET
  ```

---

## Phase 3: Edge 호환 라이브러리 전환

### Task 3.1: bcryptjs → Web Crypto API
- [ ] `src/lib/password.ts` 생성 (PBKDF2 기반 해싱)
- [ ] 기존 `bcryptjs.hash()` / `bcryptjs.compare()` 호출부 전체 교체
- [ ] 대상 파일 (약 10개):
  - `api/auth/login/route.ts`
  - `api/auth/register/route.ts`
  - `api/auth/change-password/route.ts`
  - `api/auth/reset-password/route.ts`
  - `api/employees/route.ts`
  - `api/employees/[id]/route.ts`
  - `api/employees/import/route.ts`
  - `api/setup/complete/route.ts`
  - `api/setup/seed/route.ts`
  - `api/super-admin/auth/login/route.ts`
- [ ] 기존 bcrypt 해시와 호환되는 마이그레이션 전략 수립
  - 옵션 A: 로그인 시 자동 재해싱 (bcrypt 해시 감지 → 검증 → PBKDF2로 재저장)
  - 옵션 B: 전체 비밀번호 리셋 강제

### Task 3.2: nodemailer → REST API 기반 이메일
- [ ] 이메일 서비스 선택:
  - Resend (무료 100통/일) — 추천
  - SendGrid (무료 100통/일)
- [ ] `src/lib/email.ts` 수정: SMTP → REST API 호출
- [ ] nodemailer 패키지 제거

### Task 3.3: xlsx 라이브러리 최적화
- [ ] 번들 크기 영향 분석
- [ ] dynamic import로 코드 스플리팅 적용
- [ ] 또는 경량 CSV 라이브러리로 대체

### Task 3.4: node-cron → Cloudflare Cron Triggers
- [ ] 기존 cron 작업 식별
- [ ] `wrangler.toml`에 Cron Trigger 설정
- [ ] Worker의 `scheduled` 이벤트 핸들러 구현
- [ ] node-cron 패키지 제거

---

## Phase 4: 번들 크기 최적화

> 현재 번들 크기: **handler.mjs gzip 1.73MB** — 3MB 한도 내
> bcryptjs, nodemailer, xlsx 제거 후 더 줄어들 예정

### Task 4.1: Phase 3 이후 번들 크기 재측정
- [ ] `npm run cf:build` 후 gzip 크기 확인
- [ ] 3MB 초과 시 추가 최적화

### Task 4.2: 추가 최적화 (필요 시)
- [ ] 불필요한 Radix UI 컴포넌트 정리
- [ ] Tree shaking 확인
- [ ] 무거운 기능을 별도 Worker로 분리

---

## Phase 5: 배포 및 테스트

### Task 5.1: D1 마이그레이션 + 시드
- [ ] D1에 스키마 마이그레이션 적용 (리모트)
- [ ] Super Admin 계정 생성
- [ ] 기본 시스템 설정 시드

### Task 5.2: 스테이징 배포
- [ ] `npm run cf:build && npm run cf:deploy`
- [ ] `hr-saas.workers.dev` 접속 확인

### Task 5.3: 커스텀 도메인 연결
- [ ] Workers → Settings → Domains & Routes
- [ ] `keystonehr.app` 루트 도메인 연결
- [ ] `*.keystonehr.app` 와일드카드 라우트 연결

### Task 5.4: 기능 테스트
- [ ] **랜딩 페이지**: `keystonehr.app` 접속
- [ ] **Super Admin**: `keystonehr.app/super-admin/login` 로그인
- [ ] **테넌트 생성**: Super Admin에서 테스트 회사 생성
- [ ] **테넌트 접속**: `test.keystonehr.app` 접속 → 로그인
- [ ] **테넌트 격리**: 테넌트 A 데이터가 테넌트 B에서 보이지 않는지 확인
- [ ] **출퇴근/휴가/직원관리** 기능 테스트

### Task 5.5: 성능 모니터링
- [ ] 응답 시간 측정 (목표: <500ms)
- [ ] CPU 시간 모니터링 (한도: 10ms/요청)
- [ ] 일일 요청 수 추정 및 100K 한도 내 확인

---

## Phase 6: 프로덕션 안정화

### Task 6.1: 모니터링 설정
- [ ] Cloudflare Analytics 확인
- [ ] Workers Metrics 대시보드 설정
- [ ] 에러 알림 설정

### Task 6.2: 백업 정책
- [ ] D1 Time Travel 활성화 확인 (무료: 7일)
- [ ] 수동 백업 스크립트 작성

### Task 6.3: 문서 업데이트
- [ ] 배포 가이드 작성
- [ ] 환경변수 목록 정리
- [ ] 운영 매뉴얼 업데이트

---

## 진행 순서 및 의존성

```
Phase 1 (인프라 준비)        ✅ 완료
  ↓
Phase 2 (프로젝트 전환)      ✅ 완료 (D1 마이그레이션/시크릿 설정 남음)
  ↓
Phase 3 (라이브러리 전환)    ⬅ 현재 단계
  ↓
Phase 4 (번들 최적화)
  ↓
Phase 5 (배포 및 테스트)
  ↓
Phase 6 (프로덕션 안정화)
```

## 비용 요약

| 항목 | 비용 |
|------|------|
| Cloudflare 계정 | 무료 |
| Workers/D1/KV/R2 | 무료 (한도 내) |
| 도메인 (keystonehr.app) | 연 ~$12 |
| SSL 인증서 | 무료 (Universal SSL) |
| 이메일 발송 (Resend) | 무료 (100통/일) |
| **총 운영비** | **연 ~$12 (도메인비만)** |
