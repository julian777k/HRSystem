# MSA HR - 사내 인사관리 시스템

> 사내 인트라넷 환경에서 운영하는 인사관리 시스템

## 주요 기능

- **전자결재 시스템** - 직급별 결재선, 다단계 승인/반려/전결
- **휴가 관리** - 연차 자동계산, 신청/승인, 관리대장
- **시간외근무 관리** - 야간/주말/공휴일 근무 신청 및 승인
- **출퇴근 관리** - 출퇴근 기록, 근태현황 조회, 연장근무 신청/승인
- **직원 관리** - CRUD, 엑셀 import/export, 부서/직급 관리
- **구글 캘린더 연동** - 휴가 일정 자동 동기화 (선택)

## 기술 스택

| 구분 | 기술 |
|------|------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui |
| Backend | Next.js API Routes (App Router), Prisma ORM 7 |
| Database | PostgreSQL 16 |
| 상태관리 | Zustand, TanStack React Query |
| 폼/유효성검사 | React Hook Form, Zod |
| 인프라 | Docker, Docker Compose |
| 인증 | JWT (jose) + bcryptjs |
| 기타 | xlsx (엑셀), node-cron (스케줄링), lucide-react (아이콘) |

## 빠른 시작

### 사전 요구사항

- **Node.js 18+** (권장: 22 LTS)
- **Docker Desktop** (PostgreSQL 실행용)
- **Git**

### 1. 프로젝트 클론 및 의존성 설치

```bash
git clone <repository-url>
cd msa-hr
npm install
```

### 2. Docker로 PostgreSQL 실행

```bash
docker compose up -d db
```

이 명령어를 실행하면 PostgreSQL 16 데이터베이스가 자동으로 생성됩니다.

- DB 이름: `msa_hr`
- 사용자: `msa`
- 비밀번호: `msa_password`
- 포트: `5432`

### 3. Prisma 클라이언트 생성

```bash
npx prisma generate
```

### 4. 개발 서버 실행

```bash
npm run dev
```

### 5. 브라우저 접속

```
http://localhost:3000
```

- 첫 접속 시 **Setup Wizard**가 자동으로 표시됩니다
- 5단계 설정 마법사를 따라 DB 연결, 회사 정보, 관리자 계정을 설정하세요
- 설정 완료 후 로그인 페이지로 자동 이동됩니다

## Setup Wizard 단계

| 단계 | 내용 | 설명 |
|------|------|------|
| 1단계 | DB 설정 | PostgreSQL 연결 정보 입력 및 연결 테스트 |
| 2단계 | 회사 정보 | 회사명, 근무시간, 점심시간, 서버 URL 설정 |
| 3단계 | 관리자 | 최초 관리자 계정 생성 (사번, 이름, 이메일, 비밀번호) |
| 4단계 | 규정 | 연차 기준, 반차 시간, 결재 단계, 미사용 연차 정책 |
| 5단계 | 완료 | 설정 내용 확인 후 시스템 초기화 실행 |

## 프로젝트 구조

```
msa-hr/
├── prisma/
│   └── schema.prisma          # 데이터베이스 스키마 정의
├── src/
│   ├── app/
│   │   ├── (main)/            # 인증 후 메인 레이아웃
│   │   │   ├── layout.tsx     # 사이드바 + 헤더 레이아웃
│   │   │   └── dashboard/     # 대시보드
│   │   │   ├── attendance/    # 출퇴근 관리
│   │   │   │   ├── clock/     # 오늘 근무 (출퇴근 기록)
│   │   │   │   ├── my/        # 내 근태현황
│   │   │   │   └── overtime/  # 연장근무
│   │   │   │       ├── page.tsx
│   │   │   │       └── requests/ # 연장근무 현황
│   │   ├── api/               # API 라우트
│   │   │   ├── auth/
│   │   │   │   └── login/     # 로그인 API
│   │   │   └── setup/         # Setup Wizard API
│   │   │       ├── test-db/   # DB 연결 테스트
│   │   │       ├── initialize/# DB 스키마 초기화
│   │   │       ├── complete/  # 설정 완료 및 시드 데이터 생성
│   │   │       └── status/    # 설정 상태 확인
│   │   ├── login/             # 로그인 페이지
│   │   ├── setup/             # Setup Wizard 페이지
│   │   ├── layout.tsx         # 루트 레이아웃
│   │   └── page.tsx           # 루트 페이지 (리다이렉트)
│   ├── components/
│   │   ├── layout/
│   │   │   ├── header.tsx     # 상단 네비게이션 바
│   │   │   └── sidebar.tsx    # 좌측 사이드바 메뉴
│   │   └── ui/                # shadcn/ui 컴포넌트
│   │       ├── alert.tsx
│   │       ├── badge.tsx
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── checkbox.tsx
│   │       ├── dialog.tsx
│   │       ├── form.tsx
│   │       ├── input.tsx
│   │       ├── label.tsx
│   │       ├── progress.tsx
│   │       ├── radio-group.tsx
│   │       ├── select.tsx
│   │       ├── separator.tsx
│   │       ├── sonner.tsx
│   │       ├── tabs.tsx
│   │       └── textarea.tsx
│   ├── lib/
│   │   ├── prisma.ts          # Prisma 클라이언트 싱글턴
│   │   ├── setup-config.ts    # Setup 설정 관리
│   │   └── utils.ts           # 유틸리티 (cn 함수 등)
│   └── middleware.ts          # 인증 및 Setup 리다이렉트 미들웨어
├── public/                    # 정적 파일
├── data/                      # 런타임 설정 파일 (자동 생성)
├── backups/                   # DB 백업 파일 (Docker 볼륨)
├── docker-compose.yml         # Docker Compose 설정
├── Dockerfile                 # 프로덕션 Docker 이미지
├── prisma.config.ts           # Prisma 설정
├── package.json
├── tsconfig.json
└── .env                       # 환경 변수 (Setup Wizard에서 자동 생성)
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
| 연장근무 현황 | `/attendance/overtime/requests` | 승인/반려 |

### 기본설정

| 메뉴 | 경로 | 설명 |
|------|------|------|
| 권한/결재선 설정 | `/settings/approval` | 결재선 및 권한 관리 |
| 휴가규정 관리 | `/settings/leave-policy` | 연차 규정 및 정책 설정 |
| 시간외근무 설정 | `/settings/overtime` | 시간외근무 정책 관리 |
| 직원관리 | `/settings/employees` | 직원 등록/수정/퇴사처리 |
| 외부서비스 연동 | `/settings/integration` | 구글 캘린더 등 외부 서비스 |

## 데이터베이스 모델

### 핵심 모델

| 모델 | 테이블 | 설명 |
|------|--------|------|
| `Employee` | `employees` | 직원 정보 (사번, 이름, 이메일, 부서, 직급 등) |
| `Department` | `departments` | 부서 (트리 구조, 상위/하위 부서) |
| `Position` | `positions` | 직급 (이사, 상무, 부장, 차장, 과장, 대리, 사원) |
| `LeaveRequest` | `leave_requests` | 휴가 신청 |
| `LeaveBalance` | `leave_balances` | 연차 잔여/사용 현황 |
| `LeaveGrant` | `leave_grants` | 연차 부여/차감 이력 |
| `LeaveType` | `leave_types` | 휴가 종류 (연차, 병가, 경조사 등) |
| `LeavePolicy` | `leave_policies` | 연차 정책 (근속연수별 부여일수) |
| `ApprovalLine` | `approval_lines` | 결재선 설정 |
| `ApprovalStep` | `approval_steps` | 결재 단계별 결재자 |
| `Approval` | `approvals` | 결재 처리 이력 |
| `OvertimeRequest` | `overtime_requests` | 시간외근무 신청 |
| `OvertimePolicy` | `overtime_policies` | 시간외근무 정책 |
| `Attendance` | `attendances` | 출퇴근 기록 |
| `Session` | `sessions` | 로그인 세션 |
| `SystemConfig` | `system_configs` | 시스템 설정 (key-value) |
| `AuditLog` | `audit_logs` | 감사 로그 |
| `ExternalIntegration` | `external_integrations` | 외부 서비스 연동 토큰 |
| `ViewPermission` | `view_permissions` | 조회 권한 |

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

## 개발 명령어

| 명령어 | 설명 |
|--------|------|
| `npm run dev` | 개발 서버 실행 (http://localhost:3000) |
| `npm run build` | 프로덕션 빌드 |
| `npm start` | 프로덕션 서버 실행 |
| `npm run lint` | ESLint 코드 검사 |
| `docker compose up -d` | 전체 서비스 실행 (DB + App) |
| `docker compose up -d db` | DB만 실행 |
| `docker compose down` | 전체 서비스 중지 |
| `npx prisma studio` | DB 관리 UI (http://localhost:5555) |
| `npx prisma db push` | 스키마를 DB에 반영 |
| `npx prisma generate` | Prisma 클라이언트 생성 |
| `npx prisma migrate dev` | 마이그레이션 생성 및 적용 |

## 환경 변수 (.env)

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `DATABASE_URL` | PostgreSQL 연결 URL | `postgresql://msa:msa_password@localhost:5432/msa_hr` |
| `NEXTAUTH_SECRET` | JWT 시크릿 키 | Setup Wizard에서 자동 생성 |
| `NEXTAUTH_URL` | 서버 URL | `http://localhost:3000` |
| `JWT_EXPIRES_IN` | JWT 토큰 만료 시간 | `1h` |
| `REFRESH_TOKEN_EXPIRES_IN` | 리프레시 토큰 만료 시간 | `7d` |
| `ENCRYPTION_KEY` | 암호화 키 (32바이트) | Setup Wizard에서 자동 생성 |
| `COMPANY_NAME` | 회사명 | Setup Wizard에서 입력 |
| `DAILY_WORK_HOURS` | 1일 근무시간 | `8` |

> **참고**: `.env` 파일은 Setup Wizard 완료 시 자동으로 생성됩니다. 수동으로 미리 생성할 필요가 없습니다.

## 배포

### Docker Compose (권장)

프로덕션 환경에서는 Docker Compose를 사용하여 DB와 앱을 함께 실행합니다.

```bash
# 전체 서비스 실행 (DB + App)
docker compose up -d

# 백업 서비스 포함 실행 (매일 자동 백업)
docker compose --profile production up -d
```

서버 IP로 접속:

```
http://192.168.x.x:3000
```

### 수동 배포

```bash
# 1. 빌드
npm run build

# 2. 실행
npm start
```

### DB 백업/복원

```bash
# 수동 백업
docker exec msa-hr-db pg_dump -U msa msa_hr > backup_$(date +%Y%m%d).sql

# 복원
docker exec -i msa-hr-db psql -U msa msa_hr < backup_20260213.sql
```

## 문서

- [설치 가이드](docs/SETUP-GUIDE.md) - 비개발자를 위한 상세 설치 안내
- [사용자 매뉴얼](docs/USER-MANUAL.md) - 일반 직원용 사용법
- [관리자 매뉴얼](docs/ADMIN-MANUAL.md) - 시스템 관리자용 매뉴얼

## 라이선스

Private - (주)엠에스에이 내부 사용
