# KeystoneHR - HR 관리 SaaS

> **keystonehr.app** | 인사관리 SaaS 플랫폼 (v0.2.0)
>
> 셀프호스팅(Docker/데스크톱 설치) 및 SaaS(Cloudflare Workers + D1) 이중 배포를 지원하는 HR 관리 시스템

## 주요 기능

| 기능 | 설명 |
|------|------|
| **전자결재 시스템** | 직급별 다단계 결재선 설정, 승인/반려/전결 |
| **휴가 관리** | 연차 자동계산 및 자동부여, 신청/승인, 관리대장, 이월, 특별부여/차감 |
| **시간외근무 관리** | 평일야간/주말/공휴일 근무 신청 및 승인 |
| **출퇴근 관리** | 출퇴근 기록, 월별 근태현황, 연장근무 추적 |
| **직원 관리** | CRUD, 엑셀 Import/Export, 부서/직급 관리 |
| **복지/혜택 관리** | 건강검진, 교육비, 경조금 등 카테고리별 복지 신청/승인/사용 추적 |
| **웹훅 알림** | Slack, Kakao Work, Microsoft Teams, 커스텀 웹훅 연동 |
| **휴가 요약 자동발송** | 일간/주간 휴가 현황 자동 발송 (Lazy Cron 스케줄링) + 수동 발송 버튼 |
| **슈퍼 관리자** | 멀티 테넌트 관리, 생성/정지, 사용량 통계, 강제 비밀번호 변경 |
| **보안** | JWT 분리(일반/슈퍼관리자), 비밀번호 최대 128자, Rate Limiting, CSRF, 보안 헤더 |
| **대시보드** | 오늘의 출퇴근 현황, 휴가 요약, 미처리 결재, 공지사항 |
| **멀티테넌트 SaaS** | 서브도메인 기반 테넌트 격리 (`company.keystonehr.app`) |

## 기술 스택

| 구분 | 기술 |
|------|------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui |
| Backend | Next.js API Routes (App Router), Prisma ORM 7 |
| Database | PostgreSQL 16 (셀프호스팅) / SQLite D1 (SaaS) |
| 상태관리 | Zustand, TanStack React Query |
| 폼/유효성검사 | React Hook Form, Zod |
| 인증 | JWT (jose) + PBKDF2 비밀번호 해싱 (Edge 호환) |
| 인프라 (SaaS) | Cloudflare Workers, D1 (SQLite), R2 (파일 저장), KV (캐시) |
| 인프라 (셀프호스팅) | Docker Compose / 데스크톱 설치 프로그램 (Electron) |
| 빌드 (SaaS) | OpenNext (@opennextjs/cloudflare) |
| 기타 | xlsx (엑셀), lucide-react (아이콘), Playwright (E2E 테스트) |

## 비즈니스 모델

- **1회 구매, 10년 라이선스** (구독 모델이 아님)
- 단일 "Standard" 플랜에 모든 기능 포함
- 트라이얼 상태 지원 (만료 시 자동 정지)

## 배포 모드

KeystoneHR은 세 가지 방식으로 배포할 수 있습니다.

### 1. 셀프호스팅 (Docker Compose)

```bash
# 전체 서비스 실행 (PostgreSQL + App)
docker compose up -d

# 백업 서비스 포함 실행 (매일 자동 백업)
docker compose --profile production up -d

# 접속
# http://localhost:3000
```

### 2. 셀프호스팅 (데스크톱 설치 프로그램)

Electron 기반 데스크톱 앱으로, 별도 서버 없이 로컬에서 실행됩니다.

| 플랫폼 | 파일명 |
|--------|--------|
| Windows | `HRInstall-x.x.x-x64.exe` |
| macOS (Apple Silicon) | `HRInstall-x.x.x-arm64.dmg` |
| macOS (Intel) | `HRInstall-x.x.x-x64.dmg` |
| Docker/NAS | `HRInstall-x.x.x-docker.zip` |

데스크톱 빌드:

```bash
# macOS (Apple Silicon)
npm run electron:dist:mac

# Windows
npm run electron:dist:win
```

### 3. SaaS (Cloudflare Workers)

멀티테넌트 SaaS 모드로, `*.keystonehr.app` 와일드카드 서브도메인을 사용합니다.

```bash
# 빌드 및 배포
npm run cf:build
# 또는 수동으로:
npm run build
npx opennextjs-cloudflare build
python3 scripts/patch-wasm-r2.py
npx wrangler deploy
```

> **참고**: SaaS 모드에서는 Prisma WASM을 번들에서 제거하고 커스텀 D1 클라이언트(`d1-client.ts`)가 모든 쿼리를 처리합니다. 번들 크기 제한은 3 MiB(gzip)입니다.

## 빠른 시작 (개발 환경)

### 사전 요구사항

- **Node.js 22+** (LTS 권장)
- **Docker Desktop** (PostgreSQL 실행용)

### 1. 의존성 설치

```bash
cd hr
npm install
```

### 2. PostgreSQL 실행

```bash
docker compose up -d db
```

### 3. Prisma 클라이언트 생성

```bash
npx prisma generate
```

### 4. 개발 서버 실행

```bash
npm run dev
# http://localhost:3000
```

첫 접속 시 **Setup Wizard**가 자동으로 표시됩니다. 5단계 설정 마법사를 따라 DB 연결, 회사 정보, 관리자 계정을 설정하세요.

## Setup Wizard

| 단계 | 내용 | 설명 |
|------|------|------|
| 1단계 | DB 설정 | PostgreSQL 연결 정보 입력 및 연결 테스트 |
| 2단계 | 회사 정보 | 회사명, 근무시간, 점심시간, 서버 URL 설정 |
| 3단계 | 관리자 | 최초 관리자 계정 생성 (사번, 이름, 이메일, 비밀번호) |
| 4단계 | 규정 | 연차 기준, 반차 시간, 결재 단계, 미사용 연차 정책 |
| 5단계 | 완료 | 설정 내용 확인 후 시스템 초기화 실행 |

## 프로젝트 구조

```
hr/
├── prisma/
│   ├── schema.prisma              # PostgreSQL 스키마
│   └── schema.sqlite.prisma       # SQLite/D1 스키마
├── migrations/                    # D1 마이그레이션 SQL 파일
├── scripts/
│   ├── build-cloudflare.sh        # Cloudflare 빌드 파이프라인
│   ├── build-electron.ts          # Electron 데스크톱 빌드
│   ├── patch-wasm-r2.py           # Prisma WASM 제거 (번들 크기 최적화)
│   └── html-to-pdf.js             # PDF 생성 유틸리티
├── src/
│   ├── app/
│   │   ├── (landing)/             # 랜딩/마케팅 페이지, 개인정보처리방침, 이용약관
│   │   ├── (main)/                # 인증 후 메인 레이아웃
│   │   │   ├── dashboard/         # 대시보드
│   │   │   ├── attendance/        # 출퇴근 관리
│   │   │   │   ├── clock/         # 오늘 근무 (출퇴근 기록)
│   │   │   │   ├── my/            # 내 근태현황
│   │   │   │   └── overtime/      # 연장근무 신청 및 현황
│   │   │   ├── leave/             # 휴가 관리
│   │   │   │   ├── my/            # 나의 휴가
│   │   │   │   ├── usage/         # 휴가사용현황
│   │   │   │   ├── requests/      # 휴가신청관리
│   │   │   │   ├── register/      # 휴가관리대장
│   │   │   │   └── grant/         # 휴가부여
│   │   │   ├── welfare/           # 복지/혜택
│   │   │   └── settings/          # 기본설정 (11개 페이지)
│   │   │       ├── approval/      # 결재선 설정
│   │   │       ├── leave-policy/  # 휴가규정 관리
│   │   │       ├── overtime/      # 시간외근무 설정
│   │   │       ├── employees/     # 직원관리
│   │   │       ├── departments/   # 부서관리
│   │   │       ├── positions/     # 직급관리
│   │   │       ├── holidays/      # 공휴일관리
│   │   │       ├── welfare/       # 복지 설정
│   │   │       ├── company/       # 회사 설정
│   │   │       ├── integration/   # 외부서비스 연동 (웹훅)
│   │   │       └── compensation/  # 보상 정책
│   │   ├── (super-admin)/         # 슈퍼 관리자 패널
│   │   ├── api/                   # API 라우트
│   │   │   ├── auth/              # 인증 (로그인, 비밀번호 변경/초기화)
│   │   │   ├── leave/             # 휴가 API
│   │   │   ├── attendance/        # 출퇴근 API
│   │   │   ├── overtime/          # 시간외근무 API
│   │   │   ├── welfare/           # 복지 API (카테고리, 신청)
│   │   │   ├── employees/         # 직원 API (Import 포함)
│   │   │   ├── departments/       # 부서 API
│   │   │   ├── positions/         # 직급 API
│   │   │   ├── webhooks/          # 웹훅 API (휴가 요약 발송)
│   │   │   ├── company/           # 회사 설정 API
│   │   │   ├── settings/          # 설정 API
│   │   │   ├── super-admin/       # 슈퍼 관리자 API (인증, 통계)
│   │   │   ├── setup/             # Setup Wizard API
│   │   │   └── internal/          # 내부 API (테넌트 조회)
│   │   ├── login/                 # 로그인 페이지
│   │   └── setup/                 # Setup Wizard 페이지
│   ├── components/
│   │   ├── layout/                # Header, Sidebar
│   │   └── ui/                    # shadcn/ui 컴포넌트
│   └── lib/
│       ├── prisma.ts              # Prisma 클라이언트 (프록시 기반 자동 전환)
│       ├── d1-client.ts           # D1 SQL 클라이언트 (Prisma 호환 API)
│       ├── tenant-context.ts      # 서브도메인 → tenantId 해석 + 캐싱
│       ├── auth.ts                # JWT 인증 유틸리티
│       ├── super-admin-auth.ts    # 슈퍼 관리자 인증 (별도 JWT)
│       ├── password.ts            # PBKDF2 비밀번호 해싱
│       ├── webhook.ts             # 웹훅 포맷팅 및 발송
│       ├── notifications.ts       # 알림 로직 + 스케줄 요약 발송
│       ├── rate-limit.ts          # Rate Limiting
│       ├── audit-log.ts           # 감사 로그
│       └── auth-actions.ts        # 인증 관련 서버 액션
├── electron/                      # Electron 메인 프로세스 코드
├── wrangler.toml                  # Cloudflare Workers 설정
├── docker-compose.yml             # Docker Compose 설정
├── Dockerfile                     # 프로덕션 Docker 이미지
├── prisma.config.ts               # Prisma 설정
└── package.json
```

## 사이드바 메뉴 구조

### 휴가

| 메뉴 | 경로 | 설명 |
|------|------|------|
| 나의 휴가 | `/leave/my` | 개인 연차 현황 및 신청 |
| 휴가사용현황 | `/leave/usage` | 부서/전사 휴가 사용 현황 |
| 휴가신청관리 | `/leave/requests` | 결재 대기 목록 및 승인/반려 |
| 휴가관리대장 | `/leave/register` | 전사 휴가 기록 관리 |
| 휴가부여 | `/leave/grant` | 특별 연차 부여/차감 |

### 근태관리

| 메뉴 | 경로 | 설명 |
|------|------|------|
| 오늘 근무 | `/attendance/clock` | 출퇴근 기록 |
| 내 근태현황 | `/attendance/my` | 개인 월별 근태 기록 |
| 연장근무 신청 | `/attendance/overtime` | 시간외 추가근무 신청 |
| 연장근무 현황 | `/attendance/overtime/requests` | 승인/반려 현황 |

### 복지

| 메뉴 | 경로 | 설명 |
|------|------|------|
| 복지 혜택 | `/welfare` | 이용 가능한 복지 항목 |
| 복지 신청 | `/welfare/request` | 복지 혜택 신청 |

### 기본설정

| 메뉴 | 경로 | 설명 |
|------|------|------|
| 결재선 설정 | `/settings/approval` | 결재선 및 권한 관리 |
| 휴가규정 관리 | `/settings/leave-policy` | 연차 규정 및 정책 설정 |
| 시간외근무 설정 | `/settings/overtime` | 시간외근무 정책 관리 |
| 직원관리 | `/settings/employees` | 직원 등록/수정/퇴사처리 |
| 부서관리 | `/settings/departments` | 부서 트리 구조 관리 |
| 직급관리 | `/settings/positions` | 직급 관리 |
| 공휴일관리 | `/settings/holidays` | 공휴일 캘린더 관리 |
| 복지 설정 | `/settings/welfare` | 복지 카테고리/항목 관리 |
| 회사 설정 | `/settings/company` | 회사 정보, 로고 업로드 |
| 외부서비스 연동 | `/settings/integration` | 웹훅 연동 (Slack/KakaoWork/Teams) |
| 보상 정책 | `/settings/compensation` | 보상 정책 관리 |

## 데이터베이스 모델

### 핵심 모델

| 모델 | 설명 |
|------|------|
| `Employee` | 직원 정보 (사번, 이름, 이메일, 부서, 직급 등) |
| `Department` | 부서 (트리 구조, 상위/하위 부서) |
| `Position` | 직급 (이사, 상무, 부장, 차장, 과장, 대리, 사원) |
| `LeaveRequest` | 휴가 신청 |
| `LeaveBalance` | 연차 잔여/사용 현황 |
| `LeaveGrant` | 연차 부여/차감 이력 |
| `LeaveType` | 휴가 종류 (연차, 병가, 경조사 등) |
| `LeavePolicy` | 연차 정책 (근속연수별 부여일수) |
| `ApprovalLine` | 결재선 설정 |
| `ApprovalStep` | 결재 단계별 결재자 |
| `Approval` | 결재 처리 이력 |
| `OvertimeRequest` | 시간외근무 신청 |
| `OvertimePolicy` | 시간외근무 정책 |
| `Attendance` | 출퇴근 기록 |
| `WelfareCategory` | 복지 카테고리 |
| `WelfareItem` | 복지 항목 |
| `WelfareRequest` | 복지 신청 |
| `WebhookConfig` | 웹훅 설정 (Slack/KakaoWork/Teams/커스텀) |
| `SystemConfig` | 시스템 설정 (key-value, 웹훅 스케줄 포함) |
| `AuditLog` | 감사 로그 |
| `Session` | 로그인 세션 |
| `ViewPermission` | 조회 권한 |

### SaaS 전용 모델

| 모델 | 설명 |
|------|------|
| `Tenant` | 테넌트 정보 (서브도메인, 플랜, 상태, 만료일) |
| `SuperAdmin` | 슈퍼 관리자 (강제 비밀번호 변경, 로그인 시도 제한, 잠금) |

### 주요 Enum

| Enum | 값 | 설명 |
|------|----|------|
| `EmployeeStatus` | ACTIVE, ON_LEAVE, RESIGNED | 직원 상태 |
| `SystemRole` | SYSTEM_ADMIN, COMPANY_ADMIN, DEPT_ADMIN, BASIC | 시스템 권한 |
| `LeaveUnit` | FULL_DAY, AM_HALF, PM_HALF, HOURS | 휴가 단위 |
| `LeaveStatus` | PENDING, IN_PROGRESS, APPROVED, REJECTED, CANCELLED | 신청 상태 |
| `OvertimeType` | WEEKDAY_NIGHT, WEEKEND, HOLIDAY | 시간외근무 유형 |
| `ApprovalAction` | PENDING, APPROVED, REJECTED, SKIPPED | 결재 동작 |
| `GrantType` | MONTHLY, YEARLY, ONCE | 연차 부여 방식 |

## 환경 변수

### 공통

| 변수 | 설명 |
|------|------|
| `DATABASE_URL` | PostgreSQL 연결 URL |
| `JWT_SECRET` | JWT 시크릿 키 |
| `NEXT_PUBLIC_APP_URL` | 앱 URL |
| `COMPANY_NAME` | 회사명 |

### SaaS 모드 추가

| 변수 | 설명 |
|------|------|
| `DEPLOY_TARGET` | `"cloudflare"` 또는 빈 값 |
| `DEPLOY_MODE` | `"saas"` 또는 빈 값 |
| `SAAS_BASE_DOMAIN` | `"keystonehr.app"` |
| `SUPER_ADMIN_JWT_SECRET` | 슈퍼 관리자 전용 JWT 시크릿 (일반 JWT와 분리) |
| `DB_PROVIDER` | `"sqlite"` (D1 사용 시) |

> **주의**: `.env` 파일에 실제 시크릿 키를 커밋하지 마세요. SaaS 모드의 시크릿은 `npx wrangler secret put <NAME>` 명령으로 설정합니다.

## 개발 명령어

### 공통

| 명령어 | 설명 |
|--------|------|
| `npm run dev` | 개발 서버 실행 (http://localhost:3000) |
| `npm run build` | 프로덕션 빌드 |
| `npm start` | 프로덕션 서버 실행 |
| `npm run lint` | ESLint 코드 검사 |
| `npm test` | Jest 테스트 실행 |
| `npm run test:coverage` | 테스트 커버리지 리포트 |

### 데이터베이스

| 명령어 | 설명 |
|--------|------|
| `npm run db:push` | PostgreSQL 스키마 반영 |
| `npm run db:push:sqlite` | SQLite 스키마 반영 |
| `npm run db:generate` | PostgreSQL Prisma 클라이언트 생성 |
| `npm run db:generate:sqlite` | SQLite Prisma 클라이언트 생성 |
| `npm run db:studio` | Prisma Studio UI (http://localhost:5555) |
| `npm run db:seed` | 시드 데이터 생성 |

### Docker

| 명령어 | 설명 |
|--------|------|
| `npm run docker:up` | 전체 서비스 실행 (DB + App) |
| `npm run docker:down` | 전체 서비스 중지 |
| `npm run docker:db` | DB만 실행 |

### Cloudflare (SaaS)

| 명령어 | 설명 |
|--------|------|
| `npm run cf:build` | Cloudflare 빌드 파이프라인 (빌드 + 패치 + 배포) |
| `npm run cf:dev` | Wrangler 로컬 개발 서버 |
| `npm run cf:deploy` | Cloudflare Workers 배포 |

### Electron (데스크톱)

| 명령어 | 설명 |
|--------|------|
| `npm run electron:dev` | Electron 개발 모드 실행 |
| `npm run electron:dist` | 전체 플랫폼 배포 빌드 |
| `npm run electron:dist:mac` | macOS 배포 빌드 |
| `npm run electron:dist:win` | Windows 배포 빌드 |

## DB 백업/복원

### Docker (PostgreSQL)

```bash
# 수동 백업
docker exec msa-hr-db pg_dump -U msa msa_hr > backup_$(date +%Y%m%d).sql

# 복원
docker exec -i msa-hr-db psql -U msa msa_hr < backup_20260313.sql
```

### Cloudflare D1

```bash
# D1 백업 (Wrangler CLI)
npx wrangler d1 export hr-saas-db --output=backup.sql
```

## 아키텍처 참고사항

### 멀티테넌트 데이터 격리 (SaaS)

- 미들웨어에서 서브도메인 추출 후 `x-tenant-subdomain` 헤더 설정
- `tenant-context.ts`에서 서브도메인 -> tenantId 해석 (5분 캐시)
- `withD1TenantScope()`로 D1 클라이언트를 래핑하여 tenantId 자동 주입
- 글로벌 모델(Tenant, SuperAdmin 등)은 테넌트 필터링 우회

### Prisma 클라이언트 자동 전환

`prisma.ts`에서 프록시 패턴을 사용하여 실행 환경에 따라 자동 전환:
- **로컬/Docker**: Prisma ORM + PostgreSQL
- **Electron**: Prisma ORM + better-sqlite3
- **Cloudflare Workers**: 커스텀 D1 SQL 클라이언트 (Prisma 호환 API)

### 번들 크기 최적화 (Cloudflare)

Cloudflare Workers의 3 MiB 번들 제한을 맞추기 위해:
- `patch-wasm-r2.py`로 Prisma WASM을 번들에서 제거
- D1 클라이언트가 Prisma 없이 직접 SQL 쿼리 실행

## 라이선스

KeystoneHR - 1회 구매, 10년 라이선스
