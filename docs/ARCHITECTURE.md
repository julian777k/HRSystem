# KeystoneHR — 사내 인사관리 SaaS 시스템 설계 문서

> **프로젝트명**: KeystoneHR (인사관리 SaaS)
> **작성일**: 2026-03-10
> **도메인**: keystonehr.app (와일드카드 서브도메인 멀티테넌트)
> **배포 방식**: Cloudflare Workers (OpenNext)

---

## 1. 시스템 개요

### 1.1 목적
클라우드 기반 멀티테넌트 SaaS 인사관리 시스템.
직급별 전자결재, 휴가 관리, 출퇴근 관리, 복지 관리 등 핵심 HR 업무를 자동화한다.

### 1.2 비즈니스 모델
- **1회 판매 모델** (one-time sale, 구독 아님)
- 단일 "standard" 플랜 — 모든 기능 활성화
- 트라이얼 상태 지원 (자동 만료: 매 요청 시 체크, 만료 시 자동 정지)
- 슈퍼 어드민: admin@admin.com (전체 테넌트 관리)

### 1.3 핵심 기능
| 번호 | 기능 | 설명 |
|------|------|------|
| 1 | 전자결재 시스템 | 직급별 결재선, 다단계 승인/반려/전결 |
| 2 | 휴가 관리 | 연차 자동생성 (근로기준법), 신청/승인/잔여일 관리 |
| 3 | 출퇴근 관리 | 출퇴근 기록, 근태현황 조회, 연장근무 신청/승인 |
| 4 | 웹훅 알림 | Slack, Kakao Work, Teams, Custom webhook (비용 무료) |
| 5 | 복지 관리 | 복지 카테고리/항목 관리, 예약/신청 |
| 6 | 직원 관리 | CRUD, 엑셀 import/export, 권한 관리 |
| 7 | 회사 로고 | 슈퍼어드민이 테넌트별 로고 업로드 (R2 저장) |

---

## 2. 기술 스택 및 아키텍처

### 2.1 기술 스택

```
┌─────────────────────────────────────────────────┐
│                    Frontend                      │
│  Next.js 16 (App Router) + TypeScript            │
│  Tailwind CSS + shadcn/ui                        │
├─────────────────────────────────────────────────┤
│                    Backend                        │
│  Next.js API Routes (Route Handlers)             │
│  Prisma ORM (로컬) / D1 SQL Client (CF)          │
│  Custom JWT (jose) + PBKDF2 비밀번호 해싱         │
├─────────────────────────────────────────────────┤
│                   Database                        │
│  Cloudflare D1 (SQLite) — 프로덕션               │
│  SQLite (Prisma) — 로컬 개발                      │
├─────────────────────────────────────────────────┤
│                Infrastructure                     │
│  Cloudflare Workers (OpenNext)                   │
│  Cloudflare R2 (파일 저장소)                      │
│  Cloudflare KV (캐시)                            │
└─────────────────────────────────────────────────┘
```

### 2.2 선택 근거

| 기술 | 선택 이유 |
|------|-----------|
| **Next.js 16** | 풀스택 프레임워크로 프론트/백엔드 통합, SSR/CSR 유연 |
| **TypeScript** | 타입 안전성, HR 시스템의 복잡한 비즈니스 로직 안정성 |
| **Cloudflare D1 (SQLite)** | 서버리스 환경, 글로벌 엣지 배포, 비용 효율 |
| **Custom D1 Client** | Prisma WASM이 번들 크기 초과 — 커스텀 SQL 클라이언트로 대체 |
| **Cloudflare Workers** | 엣지 배포, 자동 SSL, 글로벌 CDN, 서버 관리 불필요 |
| **PBKDF2** | bcrypt는 엣지 환경 미지원, PBKDF2는 Web Crypto API로 호환 |
| **jose (JWT)** | NextAuth.js 대비 경량, 엣지 환경 완벽 호환 |
| **Tailwind + shadcn/ui** | 빠른 UI 구현, 커스터마이징 용이 |

### 2.3 아키텍처 다이어그램

```
[브라우저] ── HTTPS ──→ [Cloudflare Edge]
                              │
                    ┌─────────┴─────────┐
                    │  Cloudflare Worker │
                    │  (Next.js via      │
                    │   OpenNext)        │
                    └────┬────┬────┬────┘
                         │    │    │
                    ┌────┘    │    └────┐
                    ▼         ▼         ▼
              ┌──────┐  ┌──────┐  ┌──────┐
              │  D1  │  │  R2  │  │  KV  │
              │(SQLite)│ │(파일)│  │(캐시)│
              └──────┘  └──────┘  └──────┘
```

### 2.4 멀티테넌트 SaaS 구조

```
acme.keystonehr.app    → 테넌트 "acme"
demo.keystonehr.app    → 테넌트 "demo"
keystonehr.app         → 랜딩 페이지
admin.keystonehr.app   → 슈퍼 어드민 (미래)
```

**테넌트 해석 흐름:**
1. `middleware.ts` — 요청 호스트에서 서브도메인 추출, `x-tenant-subdomain` 헤더 설정
2. `tenant-context.ts` — 서브도메인 → tenantId 매핑 (D1 직접 쿼리 + 5분 캐시)
3. `withD1TenantScope()` — D1 클라이언트 래핑, 모든 쿼리에 tenantId 자동 주입

> **주의**: Cloudflare Workers는 자기 자신의 URL을 fetch할 수 없음.
> 따라서 미들웨어에서 API 호출 불가 — 서버 함수 레이어에서 D1 직접 쿼리로 해결.

---

## 3. 삭제된 기능 (비용/호환성 이유)

| 삭제된 기능 | 이유 |
|-------------|------|
| **인앱 알림** (벨 아이콘, 알림 폴링) | D1 비용 절감 → 웹훅으로 대체 |
| **이메일 서비스** (Resend API, SMTP) | 비용 발생 → 삭제 |
| **비밀번호 찾기** | 이메일 없이 불가능 → 관리자가 직접 리셋 |
| **구글 캘린더 연동** | 복잡성 대비 사용빈도 낮음 → 삭제 |
| **bcrypt** | 엣지 환경 미지원 → PBKDF2로 대체 |
| **PostgreSQL** | 서버리스 비호환 → D1 (SQLite)로 대체 |
| **Docker** | 자체 서버 불필요 → Cloudflare Workers |
| **NextAuth.js** | 무거움 + 엣지 미지원 → Custom JWT (jose) |

---

## 4. 데이터베이스 스키마

### 4.1 ERD 개요

```
┌──────────┐     ┌──────────────┐     ┌──────────────────┐
│  Tenant  │     │  Department  │────<│   Employee       │
│ (테넌트)  │     │  (부서)       │     │  (직원)           │
└──────────┘     └──────────────┘     └──────┬───────────┘
                                              │
                  ┌──────────────┐     ┌──────┴───────────┐
                  │   Position   │     │  LeaveRequest    │
                  │  (직급)       │     │  (휴가신청)       │
                  └──────────────┘     └──────────────────┘
                                              │
                                     ┌────────▼───────────┐
                                     │  Approval          │
                                     │  (결재이력)         │
                                     └────────────────────┘

                  ┌──────────────┐     ┌──────────────────┐
                  │  Attendance  │     │ OvertimeRequest   │
                  │  (출퇴근)     │     │ (시간외근무)       │
                  └──────────────┘     └──────────────────┘

                  ┌──────────────┐     ┌──────────────────┐
                  │ WelfareCategory│   │  WelfareItem      │
                  │ (복지카테고리) │    │  (복지항목)        │
                  └──────────────┘     └──────────────────┘
```

### 4.2 Prisma 스키마 (로컬 개발용)

> D1 배포 시에는 `d1-client.ts`가 Prisma 호환 API를 제공하며,
> 스키마는 `prisma/schema.sqlite.prisma`(SQLite 버전)로 마이그레이션 생성.

```prisma
// prisma/schema.prisma (PostgreSQL — 로컬 개발)

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================
// SaaS Multi-tenant Models
// ============================================

model Tenant {
  id            String   @id @default(cuid())
  name          String
  subdomain     String   @unique
  customDomain  String?
  plan          String   @default("standard")
  maxEmployees  Int      @default(50)
  ownerEmail    String
  bizNumber     String?
  status        String   @default("active")
  trialExpiresAt DateTime?
  paidAt        DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  @@index([subdomain])
  @@index([status])
  @@map("tenants")
}

model SuperAdmin {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  name         String
  role         String   @default("SUPER_ADMIN")
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  @@map("super_admins")
}

// ============================================
// 1. 조직 관련 테이블
// ============================================

/// 부서
model Department {
  id          String       @id @default(cuid())
  name        String       @unique              // 부서명 (예: 영업, 개발, 인사)
  code        String       @unique              // 부서코드 (예: DEPT001)
  parentId    String?                            // 상위 부서 (트리구조)
  parent      Department?  @relation("DeptTree", fields: [parentId], references: [id])
  children    Department[] @relation("DeptTree")
  sortOrder   Int          @default(0)           // 정렬 순서
  isActive    Boolean      @default(true)
  workStartTime  String?                        // 부서 기본 출근 시간 (HH:mm)
  workEndTime    String?                        // 부서 기본 퇴근 시간
  lunchStartTime String?                        // 점심 시작
  lunchEndTime   String?                        // 점심 종료
  employees   Employee[]
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
  @@map("departments")
}

/// 직급
model Position {
  id         String     @id @default(cuid())
  name       String     @unique               // 직급명 (이사, 상무, 부장, 차장, 과장, 대리, 사원)
  level      Int        @unique               // 직급 레벨 (1=이사 최상위 ~ 7=사원 최하위)
  isActive   Boolean    @default(true)
  employees  Employee[]
  createdAt  DateTime   @default(now())
  updatedAt  DateTime   @updatedAt
  @@map("positions")
}

/// 직원
model Employee {
  id              String    @id @default(cuid())
  employeeNumber  String    @unique              // 사번
  name            String                         // 이름
  email           String    @unique              // 이메일 (로그인 ID)
  passwordHash    String                         // 비밀번호 해시 (PBKDF2)
  phone           String?                        // 전화번호
  departmentId    String                         // 부서
  department      Department @relation(fields: [departmentId], references: [id])
  positionId      String                         // 직급
  position        Position   @relation(fields: [positionId], references: [id])
  hireDate        DateTime                       // 입사일 ★ 연차 계산의 기준
  resignDate      DateTime?                      // 퇴사일
  status          EmployeeStatus @default(ACTIVE)
  role            SystemRole     @default(BASIC)
  profileImage    String?
  workType        String?                        // "FIXED" | "FLEXIBLE" | null=회사기본
  workStartTime   String?
  workEndTime     String?
  lunchStartTime  String?
  lunchEndTime    String?

  leaveRequests      LeaveRequest[]
  leaveBalances      LeaveBalance[]
  leaveGrants        LeaveGrant[]
  approvalSteps      ApprovalStep[]
  approvals          Approval[]
  overtimeRequests   OvertimeRequest[]
  attendances        Attendance[]
  sessions           Session[]

  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
  @@index([departmentId])
  @@index([positionId])
  @@index([status])
  @@map("employees")
}

enum EmployeeStatus {
  ACTIVE     // 재직
  ON_LEAVE   // 휴직
  RESIGNED   // 퇴직
}

enum SystemRole {
  SYSTEM_ADMIN   // 시스템 관리자
  COMPANY_ADMIN  // 회사관리
  DEPT_ADMIN     // 부서관리
  BASIC          // 기본권한
}

// ============================================
// 2. 인증/세션
// ============================================

model Session {
  id           String   @id @default(cuid())
  employeeId   String
  employee     Employee @relation(fields: [employeeId], references: [id])
  token        String   @unique
  expiresAt    DateTime
  ipAddress    String?
  userAgent    String?
  createdAt    DateTime @default(now())
  @@index([employeeId])
  @@index([expiresAt])
  @@map("sessions")
}

model Holiday {
  id          String   @id @default(cuid())
  name        String
  date        DateTime
  isRecurring Boolean  @default(false)
  type        String   @default("PUBLIC")      // PUBLIC | COMPANY | DEPARTMENT
  targetId    String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@index([date])
  @@index([type])
  @@map("holidays")
}

// ============================================
// 3. 휴가 관련 테이블
// ============================================

model LeaveType {
  id             String   @id @default(cuid())
  name           String   @unique
  code           String   @unique
  isPaid         Boolean  @default(true)
  isAnnualDeduct Boolean  @default(false)
  maxDays        Float?
  requiresDoc    Boolean  @default(false)
  isActive       Boolean  @default(true)
  sortOrder      Int      @default(0)
  leaveRequests  LeaveRequest[]
  leavePolicies  LeavePolicy[]
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  @@map("leave_types")
}

model LeavePolicy {
  id              String    @id @default(cuid())
  leaveTypeId     String
  leaveType       LeaveType @relation(fields: [leaveTypeId], references: [id])
  name            String
  description     String?
  yearFrom        Int
  yearTo          Int?
  grantDays       Float
  grantType       GrantType
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  @@map("leave_policies")
}

enum GrantType {
  MONTHLY     // 매월 부여 (입사 1년 미만)
  YEARLY      // 매년 부여 (입사 1년 이상)
  ONCE        // 1회 부여
}

model LeaveGrant {
  id            String    @id @default(cuid())
  employeeId    String
  employee      Employee  @relation(fields: [employeeId], references: [id])
  leaveTypeCode String
  grantDays     Float
  usedDays      Float     @default(0)
  remainDays    Float
  grantReason   String
  periodStart   DateTime
  periodEnd     DateTime
  isExpired     Boolean   @default(false)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  @@index([employeeId])
  @@index([periodEnd])
  @@map("leave_grants")
}

model LeaveBalance {
  id            String   @id @default(cuid())
  employeeId    String
  employee      Employee @relation(fields: [employeeId], references: [id])
  year          Int
  leaveTypeCode String
  totalGranted  Float    @default(0)
  totalUsed     Float    @default(0)
  totalRemain   Float    @default(0)
  updatedAt     DateTime @updatedAt
  @@unique([employeeId, year, leaveTypeCode])
  @@map("leave_balances")
}

model LeaveRequest {
  id              String        @id @default(cuid())
  employeeId      String
  employee        Employee      @relation(fields: [employeeId], references: [id])
  leaveTypeId     String
  leaveType       LeaveType     @relation(fields: [leaveTypeId], references: [id])
  startDate       DateTime
  endDate         DateTime
  useUnit         LeaveUnit
  requestDays     Float
  requestHours    Float
  dailyHours      Float         @default(8)
  reason          String?
  status          LeaveStatus   @default(PENDING)
  appliedAt       DateTime      @default(now())
  cancelReason    String?
  cancelledAt     DateTime?
  approvalLineId  String?
  currentStep     Int           @default(1)
  approvals       Approval[]
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  @@index([employeeId])
  @@index([status])
  @@index([startDate, endDate])
  @@map("leave_requests")
}

enum LeaveUnit {
  FULL_DAY       // 종일
  AM_HALF        // 오전 반차
  PM_HALF        // 오후 반차
  HOURS          // 시간 단위
}

enum LeaveStatus {
  PENDING
  IN_PROGRESS
  APPROVED
  REJECTED
  CANCELLED
}

// ============================================
// 4. 전자결재 시스템
// ============================================

model ApprovalLine {
  id          String          @id @default(cuid())
  name        String
  type        ApprovalLineType
  isDefault   Boolean         @default(false)
  isActive    Boolean         @default(true)
  steps       ApprovalStep[]
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt
  @@map("approval_lines")
}

enum ApprovalLineType {
  LEAVE
  OVERTIME
  WELFARE
  GENERAL
}

model ApprovalStep {
  id              String       @id @default(cuid())
  approvalLineId  String
  approvalLine    ApprovalLine @relation(fields: [approvalLineId], references: [id], onDelete: Cascade)
  stepOrder       Int
  approverId      String?
  approver        Employee?    @relation(fields: [approverId], references: [id])
  approverRole    ApproverRole
  actionType      ApprovalActionType
  @@unique([approvalLineId, stepOrder])
  @@map("approval_steps")
}

enum ApproverRole {
  FIXED
  DEPT_HEAD
  UPPER_POSITION
  SKIP_TO_HEAD
}

enum ApprovalActionType {
  APPROVE
  AGREE
  NOTIFY
}

model Approval {
  id              String          @id @default(cuid())
  leaveRequestId  String?
  leaveRequest    LeaveRequest?   @relation(fields: [leaveRequestId], references: [id])
  overtimeId      String?
  overtime        OvertimeRequest? @relation(fields: [overtimeId], references: [id])
  stepOrder       Int
  approverId      String
  approver        Employee        @relation(fields: [approverId], references: [id])
  action          ApprovalAction
  comment         String?
  processedAt     DateTime?
  createdAt       DateTime        @default(now())
  @@index([leaveRequestId])
  @@index([approverId])
  @@map("approvals")
}

enum ApprovalAction {
  PENDING
  APPROVED
  REJECTED
  SKIPPED
}

// ============================================
// 5. 시간외 근무
// ============================================

model OvertimeRequest {
  id            String          @id @default(cuid())
  employeeId    String
  employee      Employee        @relation(fields: [employeeId], references: [id])
  date          DateTime
  overtimeType  OvertimeType
  startTime     String
  endTime       String
  hours         Float
  reason        String
  status        LeaveStatus     @default(PENDING)
  approvals     Approval[]
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt
  @@index([employeeId])
  @@index([date])
  @@map("overtime_requests")
}

enum OvertimeType {
  WEEKDAY_NIGHT
  WEEKEND
  HOLIDAY
}

model OvertimePolicy {
  id              String   @id @default(cuid())
  maxWeeklyHours  Float    @default(12)
  maxMonthlyHours Float    @default(52)
  nightStartTime  String   @default("22:00")
  nightEndTime    String   @default("06:00")
  weekdayRate     Float    @default(1.5)
  weekendRate     Float    @default(1.5)
  nightRate       Float    @default(2.0)
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  @@map("overtime_policies")
}

// ============================================
// 6. 출퇴근 관리
// ============================================

model Attendance {
  id          String   @id @default(cuid())
  employeeId  String
  employee    Employee @relation(fields: [employeeId], references: [id])
  date        DateTime
  clockIn     DateTime?
  clockOut    DateTime?
  workHours   Float?
  status      AttendanceStatus @default(ABSENT)
  note        String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@unique([employeeId, date])
  @@index([employeeId])
  @@index([date])
  @@map("attendances")
}

enum AttendanceStatus {
  NORMAL
  LATE
  EARLY_LEAVE
  ABSENT
  LEAVE
  AM_HALF_LEAVE
  PM_HALF_LEAVE
  HOLIDAY
}
```

---

## 5. 핵심 비즈니스 로직

### 5.1 연차 자동 생성 (근로기준법 기준)

```
┌─────────────────────────────────────────────────────────────┐
│                    연차 부여 규칙                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  [입사 1년 미만]                                              │
│  - 매월 개근 시 1일 발생 (최대 11일)                            │
│  - 입사월 기준 매월 1일에 자동 부여                              │
│                                                              │
│  [입사 1년 이상]                                              │
│  - 1년차: 15일                                               │
│  - 3년차: 16일 (15 + 1)                                      │
│  - 5년차: 17일 (15 + 2)                                      │
│  - ...                                                       │
│  - 2년마다 1일씩 추가, 최대 25일                                │
│                                                              │
│  [계산 공식]                                                  │
│  근속연수 = (현재일 - 입사일) / 365                             │
│  추가일수 = floor((근속연수 - 1) / 2)                          │
│  연차일수 = min(15 + 추가일수, 25)                             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 전자결재 흐름

```
[신청자] ──→ [1단계 결재자] ──→ [2단계 결재자] ──→ [최종 결재자]
   │              │                  │                  │
   │          승인/반려            승인/반려           승인/반려
   │              │                  │                  │
   │         ┌────┴────┐       ┌────┴────┐       ┌────┴────┐
   │         │ 승인    │       │ 승인    │       │ 승인    │
   │         │→다음단계│       │→다음단계│       │→최종승인│
   │         │         │       │         │       │         │
   │         │ 반려    │       │ 반려    │       │ 반려    │
   │         │→신청자  │       │→신청자  │       │→신청자  │
   │         │ 에게통보│       │ 에게통보│       │ 에게통보│
   │         └─────────┘       └─────────┘       └─────────┘
   │
   └── 전결: 부서장의 결재 권한으로 중간 단계 생략 가능
```

**직급별 결재 권한:**

| 직급 | 결재 가능 범위 | 전결 권한 |
|------|---------------|-----------|
| 이사 | 전 직원 | 모든 결재 최종 승인 |
| 상무 | 전 직원 | 부장 이하 휴가 최종 승인 |
| 부장 | 부서 직원 | 과장 이하 휴가 최종 승인 |
| 차장 | 부서 직원 | 대리 이하 휴가 1차 승인 |
| 과장 | 하위 직급 | 1차 결재만 |
| 대리/사원 | 본인만 | 없음 (신청만 가능) |

### 5.3 휴가 차감 로직

```
[휴가 신청 시]
  1. 잔여 연차 확인 → 부족 시 신청 불가
  2. 중복 일자 체크 → 이미 휴가 있으면 신청 불가
  3. 결재선 자동 배정 → 부서/직급 기반 결재선 매핑
  4. 결재 요청 → 1단계 결재자에게 웹훅 알림

[결재 완료 시]
  1. LeaveGrant.usedDays 증가
  2. LeaveBalance 갱신
  3. 신청자에게 웹훅 알림
  4. 근태 자동 반영 (해당 기간 Attendance 레코드 생성)

[취소 시]
  1. 이미 시작된 휴가 → 취소 불가 (관리자만 가능)
  2. 미래 휴가 → 취소 결재 필요 여부 설정에 따름
  3. 취소 승인 → usedDays 복원, 잔여일수 복원
```

### 5.4 근태 자동 생성 및 휴가 연동

#### 근무시간 우선순위 체인
```
Employee 개인 설정 → Department 부서 설정 → SystemConfig 회사 설정
```
각 단계에서 값이 null이면 다음 우선순위로 fallback합니다.
`src/lib/attendance-utils.ts`의 `getWorkSettings(employeeId)` 함수가 이 체인을 구현합니다.

#### 휴일 통합 확인
`isHoliday(date, departmentId?)` 함수가 다음을 순서대로 확인합니다:
1. 공휴일 (PUBLIC) - 모든 직원 적용
2. 회사 휴무일 (COMPANY) - 전사 적용
3. 부서 휴무일 (DEPARTMENT) - 특정 부서만 적용

#### 휴가 승인 → 근태 자동 반영
휴가가 최종 승인되면 `createLeaveAttendance()` 함수가 자동으로:
- 해당 기간의 근무일마다 근태 레코드를 LEAVE/AM_HALF_LEAVE/PM_HALF_LEAVE 상태로 생성
- 기존 NORMAL 근태가 있으면 상태를 변경
- 비고(note)에 휴가 유형 기록

---

## 6. 보안

### 6.1 인증/인가

| 항목 | 구현 |
|------|------|
| 비밀번호 해싱 | PBKDF2 (Web Crypto API, 엣지 호환) |
| 세션 관리 | JWT (HS256, jose 라이브러리) + HttpOnly Secure SameSite Cookie |
| JWT 자동갱신 | 만료 4시간 전 자동 리프레시 |
| 권한 체계 | RBAC (SYSTEM_ADMIN / COMPANY_ADMIN / DEPT_ADMIN / BASIC) |
| 미들웨어 인증 | 모든 API 라우트에서 JWT 검증 |
| 로그인 제한 | Rate Limiting 적용 |

### 6.2 데이터 보호

| 항목 | 보호 방법 |
|------|-----------|
| 비밀번호 | PBKDF2 해싱 (절대 평문 저장 안함) |
| 세션 토큰 | HttpOnly + Secure + SameSite Cookie |
| SQL Injection | Prisma 파라미터 바인딩 / D1 prepared statements |
| XSS | React 자동 이스케이핑 |
| 응답 헤더 | X-Frame-Options: DENY, X-Content-Type-Options: nosniff |
| 웹훅 SSRF | HTTPS only, 사설 IP 차단 |
| 환경변수 | Wrangler secrets으로 관리 (JWT_SECRET, SUPER_ADMIN_JWT_SECRET) |

---

## 7. UI 구조

### 7.1 레이아웃

```
┌────────────────────────────────────────────────────────────┐
│  [로고] KeystoneHR    (주)회사명   홍길동 ▼   로그아웃      │
├──────────┬─────────────────────────────────────────────────┤
│          │                                                  │
│  ◎ 대시보드│  메인 콘텐츠 영역                                │
│          │                                                  │
│  ◎ 휴가   │  - 테이블 형태의 데이터 표시                      │
│  나의 휴가 │  - 필터/검색 기능                                │
│  휴가사용  │  - 엑셀 다운로드 버튼                             │
│  현황     │                                                  │
│  휴가신청  │                                                  │
│  관리     │                                                  │
│  휴가관리  │                                                  │
│  대장     │                                                  │
│  휴가부여  │                                                  │
│          │                                                  │
│  ⏱ 근태관리│                                                 │
│  오늘 근무 │                                                 │
│  내 근태   │                                                 │
│  현황     │                                                  │
│  연장근무  │                                                 │
│  신청     │                                                  │
│  연장근무  │                                                 │
│  현황     │                                                  │
│          │                                                  │
│  ◎ 복지   │                                                  │
│  복지 현황 │                                                  │
│  복지 신청 │                                                  │
│          │                                                  │
│  ⚙ 기본설정│                                                 │
│  회사 설정 │                                                  │
│  부서 관리 │                                                 │
│  직급 관리 │                                                 │
│  직원 관리 │                                                 │
│  권한/결재 │                                                  │
│  휴가 규정 │                                                 │
│  공휴일   │                                                  │
│  시간외근무│                                                 │
│  복지 설정 │                                                 │
│  웹훅 설정 │                                                  │
│          │                                                  │
│  ◎ 관리자 │                                                  │
│  비밀번호  │                                                 │
│  리셋     │                                                  │
│          │                                                  │
└──────────┴─────────────────────────────────────────────────┘
```

### 7.2 페이지 목록

| 경로 | 페이지명 | 설명 |
|------|----------|------|
| `/login` | 로그인 | 이메일/비밀번호 인증 |
| `/register` | 회원가입 | 직원 등록 (관리자 승인 필요) |
| `/setup` | 초기설정 | 최초 시스템 설정 |
| `/dashboard` | 대시보드 | 나의 휴가 현황 요약, 결재 대기 건수 |
| `/leave/my` | 나의 휴가 | 내 연차 잔여/사용 현황, 휴가 신청 |
| `/leave/usage` | 휴가사용현황 | 부서/전사 직원 휴가 사용 현황 |
| `/leave/requests` | 휴가신청관리 | 휴가 신청 목록, 승인/반려 처리 |
| `/leave/register` | 휴가관리대장 | 전체 휴가 기록 조회/관리 |
| `/leave/grant` | 휴가부여 | 수동 휴가 부여/조정 |
| `/attendance/clock` | 오늘 근무 | 출퇴근 기록 |
| `/attendance/my` | 내 근태현황 | 월별 출퇴근 기록 조회 |
| `/attendance/overtime` | 연장근무 신청 | 시간외 추가근무 신청 |
| `/attendance/overtime/requests` | 연장근무 현황 | 연장근무 승인/반려 |
| `/welfare` | 복지 현황 | 복지 항목 조회 |
| `/welfare/request` | 복지 신청 | 복지 항목 예약/신청 |
| `/settings/company` | 회사 설정 | 회사 정보 관리 |
| `/settings/departments` | 부서관리 | 부서 CRUD |
| `/settings/positions` | 직급관리 | 직급 CRUD |
| `/settings/employees` | 직원관리 | 직원 CRUD, 입퇴사 관리 |
| `/settings/approval` | 권한/결재선 설정 | 사용자별 권한, 결재선 설정 |
| `/settings/leave-policy` | 휴가규정 관리 | 연차 부여 규정 설정 |
| `/settings/holidays` | 공휴일 관리 | 공휴일/회사휴무 관리 |
| `/settings/overtime` | 시간외근무 설정 | OT 정책 설정 |
| `/settings/welfare` | 복지 설정 | 복지 카테고리/항목 관리 |
| `/settings/integration` | 웹훅 설정 | 웹훅 알림 연동 설정 |
| `/settings/compensation` | 보상정책 | 보상/수당 정책 설정 |
| `/admin` | 관리자 | 비밀번호 리셋 등 관리 기능 |

---

## 8. API 설계

### 8.1 API 엔드포인트

```
[인증]
POST   /api/auth/login              # 로그인
POST   /api/auth/logout             # 로그아웃
GET    /api/auth/me                 # 현재 사용자 정보
POST   /api/auth/register           # 회원가입
POST   /api/auth/change-password    # 비밀번호 변경
POST   /api/auth/reset-password     # 비밀번호 리셋 (관리자)

[직원 관리]
GET    /api/employees               # 직원 목록
GET    /api/employees/:id           # 직원 상세
PUT    /api/employees/:id           # 직원 수정
GET    /api/employees/export        # 엑셀 다운로드
POST   /api/employees/import        # 엑셀 업로드

[부서/직급 관리]
GET    /api/departments             # 부서 목록
POST   /api/departments             # 부서 등록
PUT    /api/departments/:id         # 부서 수정
DELETE /api/departments/:id         # 부서 삭제
GET    /api/positions               # 직급 목록
PUT    /api/positions/:id           # 직급 수정

[휴가]
GET    /api/leave/my                # 나의 휴가 현황
GET    /api/leave/balance           # 잔여 연차 조회
POST   /api/leave/request           # 휴가 신청
PUT    /api/leave/request/:id       # 휴가 수정/취소
GET    /api/leave/usage             # 휴가 사용 현황
GET    /api/leave/register          # 휴가 관리대장
POST   /api/leave/grant             # 휴가 수동 부여
GET    /api/leave/grants            # 휴가 부여 이력
POST   /api/leave/auto-grant        # 연차 자동 부여
POST   /api/leave/carry-over        # 연차 이월
GET    /api/leave/export            # 엑셀 다운로드
GET    /api/leave/calendar          # 캘린더 조회
GET    /api/leave/types             # 휴가 유형 목록

[전자결재]
GET    /api/approval/pending        # 결재 대기 목록
POST   /api/approval/process        # 결재 처리 (승인/반려)
GET    /api/approval/lines          # 결재선 목록
POST   /api/approval/lines          # 결재선 생성
PUT    /api/approval/lines/:id      # 결재선 수정

[시간외근무]
POST   /api/overtime/request        # 시간외근무 신청
PUT    /api/overtime/request/:id    # 시간외근무 수정
GET    /api/overtime/requests       # 시간외근무 목록
GET    /api/overtime/my             # 나의 시간외근무

[출퇴근 관리]
POST   /api/attendance/clock-in     # 출근 기록
POST   /api/attendance/clock-out    # 퇴근 기록
GET    /api/attendance/today        # 오늘 근무 상태
GET    /api/attendance/my           # 내 근태현황 (월별)
GET    /api/attendance/summary      # 근태 요약
GET    /api/attendance/department   # 부서별 근태

[복지]
GET    /api/welfare/categories      # 복지 카테고리 목록
POST   /api/welfare/categories      # 복지 카테고리 생성
PUT    /api/welfare/categories/:id  # 복지 카테고리 수정
GET    /api/welfare/items           # 복지 항목 목록
POST   /api/welfare/items           # 복지 항목 생성
PUT    /api/welfare/items/:id       # 복지 항목 수정
POST   /api/welfare/items/:id/reservations  # 복지 예약
GET    /api/welfare/requests        # 복지 신청 목록
PUT    /api/welfare/requests/:id    # 복지 신청 처리

[설정]
GET    /api/settings/leave-types         # 휴가유형 조회
PUT    /api/settings/leave-types/:id     # 휴가유형 수정
GET    /api/settings/leave-policy        # 휴가규정 조회
GET    /api/settings/overtime            # 시간외근무 설정
GET    /api/settings/permissions         # 권한 설정
POST   /api/settings/webhooks            # 웹훅 설정
GET    /api/company/settings             # 회사 설정
GET    /api/company/logo                 # 회사 로고
GET    /api/holidays                     # 공휴일 목록
POST   /api/holidays                     # 공휴일 등록
PUT    /api/holidays/:id                 # 공휴일 수정
DELETE /api/holidays/:id                 # 공휴일 삭제

[대시보드]
GET    /api/dashboard                    # 대시보드 데이터

[초기설정]
GET    /api/setup/status                 # 설정 상태 확인
POST   /api/setup/initialize            # 초기화
POST   /api/setup/seed                   # 시드 데이터
POST   /api/setup/complete               # 설정 완료
GET    /api/setup/verify                 # 설정 검증
GET    /api/setup/test-db                # DB 연결 테스트

[슈퍼 어드민]
POST   /api/super-admin/auth/login       # 슈퍼 어드민 로그인
GET    /api/super-admin/tenants          # 테넌트 목록
GET    /api/super-admin/tenants/:id      # 테넌트 상세
PUT    /api/super-admin/tenants/:id      # 테넌트 수정
GET    /api/super-admin/tenants/:id/usage # 테넌트 사용량
PUT    /api/super-admin/tenants/:id/logo # 테넌트 로고 업로드
GET    /api/super-admin/stats            # 통계

[내부]
GET    /api/internal/tenant-lookup       # 테넌트 조회 (내부용)

[기타]
GET    /api/time-wallet                  # 타임월렛
GET    /api/compensation-policy          # 보상정책
```

---

## 9. 주요 파일 구조

```
hr/
├── wrangler.toml                  # Cloudflare Workers 설정
├── open-next.config.ts            # OpenNext 설정
├── prisma/
│   ├── schema.prisma              # PostgreSQL 스키마 (로컬 개발)
│   ├── schema.sqlite.prisma       # SQLite 스키마 (CF D1 마이그레이션)
│   └── seed.ts                    # 시드 데이터
├── migrations/                    # D1 마이그레이션 파일
├── scripts/
│   ├── build-cloudflare.sh        # CF 빌드 스크립트
│   └── patch-wasm-r2.py           # Prisma WASM 제거 패치
├── src/
│   ├── app/
│   │   ├── layout.tsx             # 루트 레이아웃
│   │   ├── (landing)/             # 랜딩 페이지 (keystonehr.app)
│   │   ├── (main)/                # 메인 앱 (테넌트 서브도메인)
│   │   │   ├── dashboard/
│   │   │   ├── leave/
│   │   │   ├── attendance/
│   │   │   ├── welfare/
│   │   │   ├── settings/
│   │   │   └── admin/
│   │   ├── (super-admin)/         # 슈퍼 어드민 페이지
│   │   ├── login/
│   │   ├── register/
│   │   ├── setup/
│   │   └── api/                   # API Route Handlers
│   ├── components/
│   │   ├── layout/                # Header, Sidebar 등
│   │   └── ui/                    # shadcn/ui 컴포넌트
│   ├── lib/
│   │   ├── d1-client.ts           # D1 SQL 클라이언트 (~950줄, Prisma 호환 API)
│   │   ├── prisma.ts              # Proxy 기반 클라이언트 전환 (로컬 Prisma ↔ CF D1)
│   │   ├── prisma-tenant.ts       # 테넌트 스코프 Prisma 클라이언트
│   │   ├── tenant-context.ts      # 서브도메인→tenantId 해석 + 5분 캐시
│   │   ├── deploy-config.ts       # 배포 환경 감지 (로컬/CF)
│   │   ├── auth.ts                # JWT 인증 유틸리티
│   │   ├── auth-actions.ts        # 인증 서버 액션
│   │   ├── password.ts            # PBKDF2 비밀번호 해싱
│   │   ├── webhook.ts             # 웹훅 알림 (SSRF 방지)
│   │   ├── attendance-utils.ts    # 근태 유틸리티
│   │   ├── time-wallet.ts         # 타임월렛 로직
│   │   ├── super-admin-auth.ts    # 슈퍼 어드민 인증
│   │   ├── tenant-seed.ts         # 테넌트 초기 데이터
│   │   ├── session-cleanup.ts     # 세션 정리
│   │   └── setup-config.ts        # 초기설정 구성
│   └── middleware.ts              # 서브도메인 추출, 인증 체크 (fetch 호출 없음)
└── docs/
    └── ARCHITECTURE.md            # 이 문서
```

---

## 10. 배포

### 10.1 Cloudflare Workers 배포

```bash
# 빌드
cd hr
bash scripts/build-cloudflare.sh

# 배포
npx wrangler deploy
```

**빌드 파이프라인:**
1. `next build` → OpenNext로 Worker 번들 생성
2. `patch-wasm-r2.py` → Prisma WASM 파일을 번들에서 제거 (R2로 이동)
3. 번들 크기 확인 (~3059 KiB gzip, 제한: 3072 KiB)

### 10.2 Cloudflare 리소스

| 리소스 | 이름 | 용도 |
|--------|------|------|
| D1 Database | hr-saas-db | 메인 데이터베이스 (30 테이블) |
| R2 Bucket | HR_FILES | 회사 로고, 파일 첨부 |
| KV Namespace | HR_CACHE | 캐시 |
| Secrets | JWT_SECRET | JWT 서명 키 |
| Secrets | SUPER_ADMIN_JWT_SECRET | 슈퍼 어드민 JWT 키 |

### 10.3 도메인 라우팅

```toml
# wrangler.toml
routes = [
  { pattern = "keystonehr.app/*", zone_name = "keystonehr.app" },
  { pattern = "*.keystonehr.app/*", zone_name = "keystonehr.app" },
]
```

### 10.4 번들 크기 관리

> Cloudflare Workers 제한: 3 MiB (3072 KiB) gzip 압축 후
> 현재 번들: ~3059 KiB — **13 KiB 여유만 남음**

번들 크기 절감 조치:
- Prisma WASM을 R2로 분리 (`patch-wasm-r2.py`)
- 불필요한 의존성 제거 (bcrypt, nodemailer 등)
- 트리쉐이킹 최적화

---

## 11. 환경 변수

```env
# .env (로컬 개발)
DATABASE_URL="file:./dev.db"    # SQLite (로컬)
JWT_SECRET="your-secret-key"
SUPER_ADMIN_JWT_SECRET="your-super-admin-secret"

# Cloudflare (wrangler.toml [vars])
DEPLOY_TARGET=cloudflare
DEPLOY_MODE=saas
SAAS_BASE_DOMAIN=keystonehr.app
NODE_ENV=production
DB_PROVIDER=sqlite

# Cloudflare Secrets (wrangler secret put)
# JWT_SECRET
# SUPER_ADMIN_JWT_SECRET
```

---

## 12. 시드 데이터

```typescript
// 직급
const positions = [
  { name: '이사',   level: 1 },
  { name: '상무',   level: 2 },
  { name: '부장',   level: 3 },
  { name: '차장',   level: 4 },
  { name: '과장',   level: 5 },
  { name: '대리',   level: 6 },
  { name: '사원',   level: 7 },
];

// 부서
const departments = [
  { name: '영업', code: 'SALES' },
  { name: '개발', code: 'DEV' },
  { name: '인사', code: 'HR' },
  { name: '경영지원', code: 'MGMT' },
];

// 휴가 유형
const leaveTypes = [
  { name: '연차휴가', code: 'ANNUAL', isPaid: true, isAnnualDeduct: true },
  { name: '병가',     code: 'SICK',   isPaid: true, isAnnualDeduct: false },
  { name: '경조사',   code: 'FAMILY', isPaid: true, isAnnualDeduct: false },
  { name: '출산휴가', code: 'MATERNITY', isPaid: true, maxDays: 90 },
  { name: '배우자출산', code: 'PATERNITY', isPaid: true, maxDays: 10 },
  { name: '공가',     code: 'PUBLIC', isPaid: true, isAnnualDeduct: false },
  { name: '특별휴가', code: 'SPECIAL', isPaid: true, isAnnualDeduct: false },
];
```
