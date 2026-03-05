# MSA 사내 인사관리 시스템 - 설계 문서

> **프로젝트명**: MSA HR (인트라넷 인사관리 시스템)
> **작성일**: 2026-02-13
> **참조 시스템**: 유니포스트(UNIPOST) / Flex
> **배포 방식**: 사내 인트라넷 (도메인 비용 없음)

---

## 1. 시스템 개요

### 1.1 목적
사내 인트라넷 환경에서 도메인 비용 없이 운영 가능한 인사관리 시스템 구축.
직급별 전자결재, 휴가 관리, 근태 관리 등 핵심 HR 업무를 자동화한다.

### 1.2 핵심 기능
| 번호 | 기능 | 설명 |
|------|------|------|
| 1 | 전자결재 시스템 | 직급별 결재선, 다단계 승인/반려/전결 |
| 2 | 휴가 관리 | 나의 휴가, 사용현황, 신청관리, 관리대장, 부여 |
| 3 | 연차 자동생성 | 입사일 기반 근속일수 계산, 근로기준법 연차 자동부여 |
| 4 | 기본설정 | 권한/결재선, 휴가규정, 시간외근무, 직원관리, 외부연동 |
| 5 | 출퇴근 관리 | 출퇴근 기록, 근태현황 조회, 연장근무 신청/승인 |

---

## 2. 기술 스택 및 아키텍처

### 2.1 기술 스택

```
┌─────────────────────────────────────────────────┐
│                    Frontend                      │
│  Next.js 14 (App Router) + TypeScript            │
│  Tailwind CSS + shadcn/ui                        │
│  React Query (서버 상태 관리)                      │
│  Zustand (클라이언트 상태 관리)                     │
├─────────────────────────────────────────────────┤
│                    Backend                        │
│  Next.js API Routes (Route Handlers)             │
│  Prisma ORM                                      │
│  NextAuth.js (인증/세션 관리)                      │
├─────────────────────────────────────────────────┤
│                   Database                        │
│  PostgreSQL 16                                    │
├─────────────────────────────────────────────────┤
│                Infrastructure                     │
│  Docker + Docker Compose                         │
│  사내 서버 (IP 직접 접속 또는 hosts 파일 설정)       │
└─────────────────────────────────────────────────┘
```

### 2.2 선택 근거

| 기술 | 선택 이유 |
|------|-----------|
| **Next.js 14** | 풀스택 프레임워크로 프론트/백엔드 통합, SSR/CSR 유연 |
| **TypeScript** | 타입 안전성, HR 시스템의 복잡한 비즈니스 로직 안정성 |
| **PostgreSQL** | 복잡한 관계형 데이터, JSON 지원, 트랜잭션 안정성 |
| **Prisma** | 타입 세이프 ORM, 마이그레이션 관리, 직관적 스키마 |
| **Docker** | 사내 서버 배포 일관성, 환경 독립성 |
| **Tailwind + shadcn/ui** | 유니포스트 유사 UI 빠른 구현, 커스터마이징 용이 |

### 2.3 아키텍처 다이어그램

```
[사내 PC 브라우저] ──── http://192.168.x.x:3000 ────┐
                      (또는 http://hr.local:3000)     │
                                                       ▼
                                            ┌──────────────────┐
                                            │   Docker Host     │
                                            │  (사내 서버/NAS)   │
                                            │                   │
                                            │ ┌───────────────┐ │
                                            │ │  Next.js App  │ │
                                            │ │   :3000       │ │
                                            │ └──────┬────────┘ │
                                            │        │          │
                                            │ ┌──────▼────────┐ │
                                            │ │  PostgreSQL   │ │
                                            │ │   :5432       │ │
                                            │ └───────────────┘ │
                                            └──────────────────┘
```

---

## 3. 인트라넷 + 외부 접속 (도메인 비용 없음)

### 3.1 사내 접속
사내 네트워크에서 **IP 주소**로 직접 접속:

```
http://192.168.x.x:3000
```

### 3.2 외부 접속 (집/모바일) - Cloudflare Tunnel

```
[집 PC / 모바일] ─── HTTPS ──→ [Cloudflare Edge] ─── 터널 ──→ [사내 서버:3000]
                     (무료)         (자동 SSL)         (암호화)
```

- 비용: 무료
- 도메인 불필요 (`*.cfargotunnel.com` 서브도메인 자동 제공)
- 사내 방화벽/공유기 설정 변경 불필요
- HTTPS 자동 적용

```yaml
# docker-compose.yml에 추가
  tunnel:
    image: cloudflare/cloudflared:latest
    command: tunnel --no-autoupdate run
    environment:
      - TUNNEL_TOKEN=${CLOUDFLARE_TUNNEL_TOKEN}
    restart: unless-stopped
```

### 3.3 모바일 대응
- UI를 **반응형(Responsive)**으로 구현
- 모바일에서 휴가 신청/결재 승인 가능
- 별도 앱 설치 불필요 (모바일 브라우저로 접속)

### 3.2 서버 요구 사양
| 항목 | 최소 | 권장 |
|------|------|------|
| CPU | 2 Core | 4 Core |
| RAM | 4 GB | 8 GB |
| 디스크 | 20 GB SSD | 50 GB SSD |
| OS | Ubuntu 22.04 / macOS | Ubuntu 22.04 LTS |
| 네트워크 | 고정 IP (사내) | 고정 IP + 사내 DNS |

### 3.3 Docker Compose 구성

```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://msa:${DB_PASSWORD}@db:5432/msa_hr
      - NEXTAUTH_SECRET=${AUTH_SECRET}
      - NEXTAUTH_URL=http://192.168.0.100:3000
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_DB=msa_hr
      - POSTGRES_USER=msa
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U msa -d msa_hr"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  # (선택) 자동 DB 백업
  backup:
    image: postgres:16-alpine
    volumes:
      - ./backups:/backups
    environment:
      - PGPASSWORD=${DB_PASSWORD}
    entrypoint: >
      sh -c "while true; do
        pg_dump -h db -U msa msa_hr > /backups/backup_$$(date +%Y%m%d_%H%M%S).sql;
        find /backups -name '*.sql' -mtime +30 -delete;
        sleep 86400;
      done"
    depends_on:
      - db
    restart: unless-stopped

volumes:
  pgdata:
```

---

## 4. DB 관리 접근성 (SQL 지식 불필요)

> PostgreSQL은 내부 엔진일 뿐, **관리자와 직원은 SQL을 전혀 몰라도 됩니다.**
> 모든 데이터 관리는 웹 화면에서 클릭/입력으로 처리합니다.

### 4.1 관리자용 웹 관리 기능

```
┌──────────────────────────────────────────────────────────┐
│                   관리자 웹 화면에서 가능한 것              │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  [직원관리] 화면                                          │
│  → 직원 등록/수정/퇴사처리 (폼 입력)                       │
│  → 엑셀 일괄 업로드 (기존 유니포스트 데이터 이관)            │
│  → 직원 목록 엑셀 다운로드                                 │
│                                                           │
│  [휴가관리] 화면                                          │
│  → 휴가 수동 부여/차감/조정 (숫자 입력)                     │
│  → 휴가 내역 엑셀 다운로드                                 │
│  → 휴가 일괄 등록                                         │
│                                                           │
│  [설정] 화면                                              │
│  → 부서 추가/수정/삭제 (폼)                                │
│  → 직급 관리 (폼)                                         │
│  → 휴가 규정 변경 (폼)                                    │
│  → 결재선 설정 (드래그 & 드롭)                             │
│  → 권한 설정 (체크박스 토글)                                │
│                                                           │
│  [데이터 관리]                                            │
│  → 엑셀 내보내기 (전체 데이터 백업용)                       │
│  → 엑셀 가져오기 (데이터 일괄 등록)                        │
│  → DB 백업/복원 (버튼 클릭)                                │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

### 4.2 핵심 원칙
- SQL 직접 실행 필요 없음: 모든 CRUD가 웹 UI로 제공됨
- 엑셀 import/export: 직원 데이터, 휴가 내역 등 엑셀로 입출력
- 원클릭 백업: 관리자 화면에서 DB 백업 파일 다운로드
- 원클릭 복원: 백업 파일 업로드로 복원
- 감사 로그: 누가 언제 무엇을 변경했는지 웹에서 조회

---

## 5. 데이터베이스 스키마

### 4.1 ERD 개요

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│  Department  │────<│   Employee   │────<│  LeaveRequest    │
│  (부서)       │     │  (직원)       │     │  (휴가신청)       │
└──────────────┘     └──────┬───────┘     └──────────────────┘
                            │
                     ┌──────┴───────┐     ┌──────────────────┐
                     │   Position   │     │  ApprovalLine    │
                     │  (직급)       │     │  (결재선)         │
                     └──────────────┘     └──────────────────┘
                                                   │
                                          ┌────────▼─────────┐
                                          │  ApprovalStep    │
                                          │  (결재단계)       │
                                          └──────────────────┘
                                                   │
                                          ┌────────▼─────────┐
                                          │  Approval        │
                                          │  (결재이력)       │
                                          └──────────────────┘

                     ┌──────────────┐
                     │  Attendance  │
                     │  (출퇴근)     │
                     └──────────────┘
```

### 4.2 Prisma 스키마

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
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
  passwordHash    String                         // 비밀번호 해시
  phone           String?                        // 전화번호
  departmentId    String                         // 부서
  department      Department @relation(fields: [departmentId], references: [id])
  positionId      String                         // 직급
  position        Position   @relation(fields: [positionId], references: [id])
  hireDate        DateTime                       // 입사일 ★ 연차 계산의 기준
  resignDate      DateTime?                      // 퇴사일
  status          EmployeeStatus @default(ACTIVE)  // 재직/휴직/퇴직
  role            SystemRole     @default(BASIC)   // 시스템 권한
  profileImage    String?                        // 프로필 이미지 경로

  // Relations
  leaveRequests      LeaveRequest[]       // 본인이 신청한 휴가
  leaveBalances      LeaveBalance[]       // 휴가 잔여
  leaveGrants        LeaveGrant[]         // 휴가 부여 이력
  approvalSteps      ApprovalStep[]       // 결재자로 지정된 단계
  approvals          Approval[]           // 결재 처리 이력
  overtimeRequests   OvertimeRequest[]    // 시간외근무 신청
  attendances        Attendance[]         // 출퇴근 기록
  sessions           Session[]            // 로그인 세션

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
  SYSTEM_ADMIN   // 시스템 관리자 (전체 관리)
  COMPANY_ADMIN  // 회사관리 (전 직원 휴가내역 관리)
  DEPT_ADMIN     // 부서관리 (부서 직원 휴가내역 관리)
  BASIC          // 기본권한 (휴가신청, 시간외근무 신청)
}

/// 조회 권한 (별도 매핑 테이블)
model ViewPermission {
  id          String          @id @default(cuid())
  employeeId  String
  scope       ViewScope                         // 회사 전체 / 부서
  createdAt   DateTime        @default(now())

  @@unique([employeeId, scope])
  @@map("view_permissions")
}

enum ViewScope {
  COMPANY   // 전 직원 휴가, 시간외근무 현황 조회
  DEPARTMENT // 부서 직원 휴가, 시간외근무 현황 조회
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

// ============================================
// 3. 휴가 관련 테이블
// ============================================

/// 휴가 유형 설정
model LeaveType {
  id             String   @id @default(cuid())
  name           String   @unique              // 연차휴가, 병가, 경조사, 출산휴가, 특별휴가 등
  code           String   @unique              // ANNUAL, SICK, FAMILY, MATERNITY, SPECIAL
  isPaid         Boolean  @default(true)       // 유급 여부
  isAnnualDeduct Boolean  @default(false)      // 연차 차감 여부
  maxDays        Float?                        // 최대 사용 가능일 (NULL=무제한)
  requiresDoc    Boolean  @default(false)      // 증빙서류 필요 여부
  isActive       Boolean  @default(true)
  sortOrder      Int      @default(0)

  leaveRequests  LeaveRequest[]
  leavePolicies  LeavePolicy[]
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@map("leave_types")
}

/// 휴가 규정 (근속연수별 연차 부여 기준)
model LeavePolicy {
  id              String    @id @default(cuid())
  leaveTypeId     String
  leaveType       LeaveType @relation(fields: [leaveTypeId], references: [id])
  name            String                       // 규정명
  description     String?                      // 설명

  // 근로기준법 기반 연차 부여 규칙
  // 입사 1년 미만: 매월 1일 (최대 11일)
  // 입사 1년 이상: 15일 + 2년마다 1일 추가 (최대 25일)
  yearFrom        Int                          // 근속 시작 연차 (0=입사 첫해)
  yearTo          Int?                         // 근속 종료 연차 (NULL=무한)
  grantDays       Float                        // 부여 일수
  grantType       GrantType                    // 부여 방식

  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@map("leave_policies")
}

enum GrantType {
  MONTHLY     // 매월 부여 (입사 1년 미만)
  YEARLY      // 매년 부여 (입사 1년 이상)
  ONCE        // 1회 부여 (경조사 등)
}

/// 휴가 부여 이력
model LeaveGrant {
  id            String    @id @default(cuid())
  employeeId    String
  employee      Employee  @relation(fields: [employeeId], references: [id])
  leaveTypeCode String                        // 휴가유형 코드
  grantDays     Float                         // 부여 일수
  usedDays      Float     @default(0)         // 사용 일수
  remainDays    Float                         // 잔여 일수 (computed)
  grantReason   String                        // 부여 사유 (자동부여/수동부여/이월 등)
  periodStart   DateTime                      // 사용 가능 시작일
  periodEnd     DateTime                      // 사용 가능 종료일 (만료일)
  isExpired     Boolean   @default(false)     // 만료 여부
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@index([employeeId])
  @@index([periodEnd])
  @@map("leave_grants")
}

/// 휴가 잔여 현황 (캐시 테이블 - 실시간 집계 성능용)
model LeaveBalance {
  id            String   @id @default(cuid())
  employeeId    String
  employee      Employee @relation(fields: [employeeId], references: [id])
  year          Int                            // 연도
  leaveTypeCode String                         // 휴가유형 코드
  totalGranted  Float    @default(0)           // 총 부여일수
  totalUsed     Float    @default(0)           // 총 사용일수
  totalRemain   Float    @default(0)           // 잔여일수
  updatedAt     DateTime @updatedAt

  @@unique([employeeId, year, leaveTypeCode])
  @@map("leave_balances")
}

/// 휴가 신청
model LeaveRequest {
  id              String        @id @default(cuid())
  employeeId      String
  employee        Employee      @relation(fields: [employeeId], references: [id])
  leaveTypeId     String
  leaveType       LeaveType     @relation(fields: [leaveTypeId], references: [id])

  // 휴가 기간
  startDate       DateTime                     // 시작일
  endDate         DateTime                     // 종료일
  useUnit         LeaveUnit                    // 사용 단위
  requestDays     Float                        // 신청일수 (0.5 = 반차)
  requestHours    Float                        // 신청시간 (4시간 = 반차)
  dailyHours      Float         @default(8)    // 일 기준시간

  reason          String?                      // 사유
  status          LeaveStatus   @default(PENDING) // 상태
  appliedAt       DateTime      @default(now())   // 신청일
  cancelReason    String?                      // 취소 사유
  cancelledAt     DateTime?                    // 취소일

  // 결재 관련
  approvalLineId  String?
  currentStep     Int           @default(1)    // 현재 결재 단계
  approvals       Approval[]                   // 결재 이력

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
  PENDING        // 결재 대기
  IN_PROGRESS    // 결재 진행중
  APPROVED       // 승인 완료
  REJECTED       // 반려
  CANCELLED      // 취소
}

// ============================================
// 4. 전자결재 시스템
// ============================================

/// 결재선 템플릿
model ApprovalLine {
  id          String          @id @default(cuid())
  name        String                           // 결재선명
  type        ApprovalLineType                 // 휴가/시간외근무/일반
  isDefault   Boolean         @default(false)  // 기본 결재선 여부
  isActive    Boolean         @default(true)
  steps       ApprovalStep[]
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  @@map("approval_lines")
}

enum ApprovalLineType {
  LEAVE        // 휴가 결재
  OVERTIME     // 시간외근무 결재
  GENERAL      // 일반 결재
}

/// 결재 단계
model ApprovalStep {
  id              String       @id @default(cuid())
  approvalLineId  String
  approvalLine    ApprovalLine @relation(fields: [approvalLineId], references: [id], onDelete: Cascade)
  stepOrder       Int                          // 결재 순서 (1, 2, 3...)
  approverId      String?                      // 고정 결재자
  approver        Employee?    @relation(fields: [approverId], references: [id])
  approverRole    ApproverRole                 // 결재자 결정 방식
  actionType      ApprovalActionType           // 결재/합의/통보

  @@unique([approvalLineId, stepOrder])
  @@map("approval_steps")
}

enum ApproverRole {
  FIXED          // 고정 결재자 (지정된 사람)
  DEPT_HEAD      // 부서장
  UPPER_POSITION // 차상위 직급
  SKIP_TO_HEAD   // 전결 (부서장까지 스킵)
}

enum ApprovalActionType {
  APPROVE    // 결재 (승인/반려 권한)
  AGREE      // 합의 (의견 제시)
  NOTIFY     // 통보 (열람만)
}

/// 결재 이력
model Approval {
  id              String          @id @default(cuid())
  leaveRequestId  String?
  leaveRequest    LeaveRequest?   @relation(fields: [leaveRequestId], references: [id])
  overtimeId      String?
  overtime        OvertimeRequest? @relation(fields: [overtimeId], references: [id])

  stepOrder       Int                          // 결재 단계
  approverId      String
  approver        Employee        @relation(fields: [approverId], references: [id])
  action          ApprovalAction               // 처리 결과
  comment         String?                      // 결재 의견
  processedAt     DateTime?                    // 처리 일시

  createdAt       DateTime        @default(now())

  @@index([leaveRequestId])
  @@index([approverId])
  @@map("approvals")
}

enum ApprovalAction {
  PENDING    // 대기
  APPROVED   // 승인
  REJECTED   // 반려
  SKIPPED    // 전결 (건너뜀)
}

// ============================================
// 5. 시간외 근무
// ============================================

/// 시간외 근무 신청
model OvertimeRequest {
  id            String          @id @default(cuid())
  employeeId    String
  employee      Employee        @relation(fields: [employeeId], references: [id])
  date          DateTime                       // 근무일
  overtimeType  OvertimeType                   // 유형
  startTime     String                         // 시작 시간 (HH:mm)
  endTime       String                         // 종료 시간 (HH:mm)
  hours         Float                          // 시간외 근무 시간
  reason        String                         // 사유
  status        LeaveStatus     @default(PENDING) // 상태 (재사용)
  approvals     Approval[]

  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt

  @@index([employeeId])
  @@index([date])
  @@map("overtime_requests")
}

enum OvertimeType {
  WEEKDAY_NIGHT  // 평일 야간
  WEEKEND        // 휴일 근무
  HOLIDAY        // 공휴일 근무
}

// ============================================
// 6. 시간외 근무 설정
// ============================================

model OvertimePolicy {
  id              String   @id @default(cuid())
  maxWeeklyHours  Float    @default(12)        // 주 최대 시간외근무 시간
  maxMonthlyHours Float    @default(52)        // 월 최대
  nightStartTime  String   @default("22:00")   // 야간근무 시작
  nightEndTime    String   @default("06:00")   // 야간근무 종료
  weekdayRate     Float    @default(1.5)       // 평일 시간외 수당 배율
  weekendRate     Float    @default(1.5)       // 휴일 수당 배율
  nightRate       Float    @default(2.0)       // 야간 수당 배율
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@map("overtime_policies")
}

// ============================================
// 출퇴근 관리
// ============================================

/// 출퇴근 기록
model Attendance {
  id          String   @id @default(cuid())
  employeeId  String
  employee    Employee @relation(fields: [employeeId], references: [id])
  date        DateTime                       // 근무일
  clockIn     DateTime?                      // 출근 시간
  clockOut    DateTime?                      // 퇴근 시간
  workHours   Float?                         // 실근무 시간
  status      AttendanceStatus @default(ABSENT) // 근무 상태
  note        String?                        // 비고
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([employeeId, date])
  @@index([employeeId])
  @@index([date])
  @@map("attendances")
}

enum AttendanceStatus {
  NORMAL     // 정상
  LATE       // 지각
  EARLY_LEAVE // 조퇴
  ABSENT     // 결근
}

// ============================================
// 7. 외부 서비스 연동
// ============================================

model ExternalIntegration {
  id           String   @id @default(cuid())
  employeeId   String
  service      String                          // google_calendar, slack 등
  accessToken  String                          // 암호화 저장
  refreshToken String?
  expiresAt    DateTime?
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@unique([employeeId, service])
  @@map("external_integrations")
}

// ============================================
// 8. 시스템 로그 (감사 추적)
// ============================================

model AuditLog {
  id          String   @id @default(cuid())
  employeeId  String?                          // 작업 수행자
  action      String                           // 작업 유형
  target      String                           // 대상 테이블
  targetId    String                           // 대상 레코드 ID
  before      Json?                            // 변경 전 데이터
  after       Json?                            // 변경 후 데이터
  ipAddress   String?
  createdAt   DateTime @default(now())

  @@index([employeeId])
  @@index([target, targetId])
  @@index([createdAt])
  @@map("audit_logs")
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
│  [자동 실행 시점]                                              │
│  - 매일 00:00 크론잡으로 입사일 도래 직원 체크                    │
│  - 입사 1년 미만: 매월 입사일에 1일 부여                         │
│  - 입사 1년 이상: 입사 기념일에 연간 연차 일괄 부여               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**구현 의사 코드:**

```typescript
// services/leave/annualLeaveGenerator.ts

interface AnnualLeaveResult {
  employeeId: string;
  grantDays: number;
  periodStart: Date;
  periodEnd: Date;
  reason: string;
}

function calculateAnnualLeave(hireDate: Date, referenceDate: Date): AnnualLeaveResult {
  const diffMs = referenceDate.getTime() - hireDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const yearsWorked = Math.floor(diffDays / 365);

  if (yearsWorked < 1) {
    // 입사 1년 미만: 매월 1일
    const monthsWorked = calculateMonthsDiff(hireDate, referenceDate);
    if (monthsWorked > 0 && monthsWorked <= 11) {
      return {
        grantDays: 1,
        periodStart: referenceDate,
        periodEnd: addYears(hireDate, 1), // 입사 1주년까지 사용 가능
        reason: `입사 ${monthsWorked}개월 - 월별 연차 자동부여`,
      };
    }
  } else {
    // 입사 1년 이상: 15일 + 2년마다 1일 추가 (최대 25일)
    const extraDays = Math.floor((yearsWorked - 1) / 2);
    const totalDays = Math.min(15 + extraDays, 25);

    return {
      grantDays: totalDays,
      periodStart: getAnniversaryDate(hireDate, yearsWorked),
      periodEnd: getAnniversaryDate(hireDate, yearsWorked + 1),
      reason: `입사 ${yearsWorked}년차 - 연차 ${totalDays}일 자동부여`,
    };
  }
}
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
  4. 결재 요청 → 1단계 결재자에게 알림

[결재 완료 시]
  1. LeaveGrant.usedDays 증가
  2. LeaveBalance 갱신
  3. 구글 캘린더 연동 시 일정 자동 등록
  4. 신청자에게 승인 알림

[취소 시]
  1. 이미 시작된 휴가 → 취소 불가 (관리자만 가능)
  2. 미래 휴가 → 취소 결재 필요 여부 설정에 따름
  3. 취소 승인 → usedDays 복원, 잔여일수 복원
```

---

## 6. 보안 및 안전장치

### 6.1 인증/인가

```
┌──────────────────────────────────────────┐
│              인증 체계                     │
├──────────────────────────────────────────┤
│                                           │
│  1. 비밀번호 정책                          │
│     - bcrypt (salt rounds: 12)            │
│     - 최소 8자, 영문+숫자+특수문자          │
│     - 90일 주기 변경 권고                   │
│     - 최근 3개 비밀번호 재사용 불가          │
│                                           │
│  2. 세션 관리                              │
│     - JWT + HttpOnly Cookie               │
│     - Access Token: 1시간                  │
│     - Refresh Token: 7일                   │
│     - 동시 세션 제한 (최대 3개)             │
│     - 세션 타임아웃 표시 (유니포스트 참고)    │
│                                           │
│  3. RBAC (역할 기반 접근 제어)              │
│     - 시스템관리자 / 회사관리 / 부서관리 /   │
│       기본권한                              │
│     - 미들웨어에서 라우트별 권한 체크         │
│     - 데이터 조회 시 부서/직급 필터링         │
│                                           │
└──────────────────────────────────────────┘
```

### 6.2 데이터 보호

| 항목 | 보호 방법 |
|------|-----------|
| 비밀번호 | bcrypt 해싱 (절대 평문 저장 안함) |
| 세션 토큰 | HttpOnly + Secure + SameSite Cookie |
| DB 접속 | 환경변수로 관리, .env 파일 gitignore |
| 외부 API 토큰 | AES-256 암호화 후 DB 저장 |
| SQL Injection | Prisma ORM 파라미터 바인딩 |
| XSS | React 자동 이스케이핑 + CSP 헤더 |
| CSRF | SameSite Cookie + CSRF 토큰 |
| 감사 로그 | 모든 중요 작업 AuditLog 테이블 기록 |

### 6.3 백업 전략

```
[자동 백업]
- 매일 새벽 3시: pg_dump → ./backups/ 폴더
- 30일 이상 된 백업 자동 삭제
- Docker volume으로 데이터 영속성 보장

[수동 백업]
- 관리자 화면에서 즉시 백업 버튼
- 백업 파일 다운로드 기능

[복구]
- pg_restore 명령으로 복구
- 관리자 화면에서 복구 기능 제공
```

---

## 7. UI 구조 (유니포스트 참고)

### 7.1 레이아웃

```
┌────────────────────────────────────────────────────────────┐
│  [로고] 인사관리     (주)엠에스에이  홍길동 ▼  로그아웃  00:00 │
├──────────┬─────────────────────────────────────────────────┤
│          │                                                  │
│  ◎ 휴가   │  Breadcrumb: 휴가 > 나의 휴가                    │
│  나의 휴가 │  ┌──────────────────────────────────────────┐  │
│  휴가사용  │  │                                           │  │
│  현황     │  │           메인 콘텐츠 영역                  │  │
│  휴가신청  │  │                                           │  │
│  관리     │  │  - 테이블 형태의 데이터 표시                 │  │
│  휴가관리  │  │  - 필터/검색 기능                           │  │
│  대장     │  │  - 엑셀 다운로드 버튼                       │  │
│  휴가부여  │  │                                           │  │
│          │  └──────────────────────────────────────────┘  │
│          │                                                  │
│  ⏱ 근태관리│                                                │
│  오늘 근무 │                                                 │
│  내 근태   │                                                 │
│  현황     │                                                 │
│  연장근무  │                                                 │
│  신청     │                                                 │
│  연장근무  │                                                 │
│  현황     │                                                 │
│          │                                                  │
│  ⚙ 기본설정│                                                │
│  권한/결재 │                                                 │
│  선 설정   │                                                │
│  휴가규정  │                                                 │
│  관리     │                                                 │
│  시간외근무│                                                 │
│  설정     │                                                 │
│  직원관리  │                                                │
│  외부서비스│                                                │
│  연동     │                                                 │
│          │                                                  │
├──────────┴─────────────────────────────────────────────────┤
│  ©UNIPOST → ©MSA HR                                        │
└────────────────────────────────────────────────────────────┘
```

### 7.2 페이지 목록

| 경로 | 페이지명 | 설명 |
|------|----------|------|
| `/login` | 로그인 | 이메일/비밀번호 인증 |
| `/dashboard` | 대시보드 | 나의 휴가 현황 요약, 결재 대기 건수 |
| `/leave/my` | 나의 휴가 | 내 연차 잔여/사용 현황, 휴가 신청 |
| `/leave/usage` | 휴가사용현황 | 부서/전사 직원 휴가 사용 현황 |
| `/leave/requests` | 휴가신청관리 | 휴가 신청 목록, 승인/반려 처리 |
| `/leave/register` | 휴가관리대장 | 전체 휴가 기록 조회/관리 |
| `/leave/grant` | 휴가부여 | 수동 휴가 부여/조정 |
| `/settings/approval` | 권한/결재선 설정 | 사용자별 권한, 결재선 설정 |
| `/settings/leave-policy` | 휴가규정 관리 | 연차 부여 규정 설정 |
| `/settings/overtime` | 시간외근무 설정 | OT 정책 설정 |
| `/settings/employees` | 직원관리 | 직원 CRUD, 입퇴사 관리 |
| `/settings/integration` | 외부서비스 연동 | 구글캘린더 등 연동 설정 |
| `/attendance/clock` | 오늘 근무 | 출퇴근 기록 |
| `/attendance/my` | 내 근태현황 | 월별 출퇴근 기록 조회 |
| `/attendance/overtime` | 연장근무 신청 | 시간외 추가근무 신청 |
| `/attendance/overtime/requests` | 연장근무 현황 | 연장근무 승인/반려 |

---

## 8. API 설계

### 8.1 API 엔드포인트

```
[인증]
POST   /api/auth/login          # 로그인
POST   /api/auth/logout         # 로그아웃
GET    /api/auth/me             # 현재 사용자 정보
PUT    /api/auth/password       # 비밀번호 변경

[직원 관리]
GET    /api/employees           # 직원 목록 (검색/필터/페이징)
GET    /api/employees/:id       # 직원 상세
POST   /api/employees           # 직원 등록
PUT    /api/employees/:id       # 직원 수정
DELETE /api/employees/:id       # 직원 비활성화 (soft delete)

[부서 관리]
GET    /api/departments         # 부서 목록 (트리 구조)
POST   /api/departments         # 부서 등록
PUT    /api/departments/:id     # 부서 수정
DELETE /api/departments/:id     # 부서 삭제

[휴가]
GET    /api/leave/my            # 나의 휴가 현황
GET    /api/leave/balance       # 잔여 연차 조회
POST   /api/leave/request       # 휴가 신청
PUT    /api/leave/request/:id   # 휴가 수정
DELETE /api/leave/request/:id   # 휴가 취소
GET    /api/leave/requests      # 휴가 신청 목록 (관리자)
GET    /api/leave/usage         # 휴가 사용 현황
GET    /api/leave/register      # 휴가 관리대장
POST   /api/leave/grant         # 휴가 수동 부여
GET    /api/leave/grants        # 휴가 부여 이력
GET    /api/leave/export        # 엑셀 다운로드

[전자결재]
GET    /api/approval/pending    # 결재 대기 목록
POST   /api/approval/process    # 결재 처리 (승인/반려)
GET    /api/approval/lines      # 결재선 목록
POST   /api/approval/lines      # 결재선 생성
PUT    /api/approval/lines/:id  # 결재선 수정

[시간외근무]
POST   /api/overtime/request    # 시간외근무 신청
GET    /api/overtime/requests   # 시간외근무 목록
GET    /api/overtime/my         # 나의 시간외근무

[출퇴근 관리]
POST   /api/attendance/clock-in      # 출근 기록
POST   /api/attendance/clock-out     # 퇴근 기록
GET    /api/attendance/today         # 오늘 근무 상태
GET    /api/attendance/my            # 내 근태현황 (월별)
POST   /api/attendance/overtime      # 연장근무 신청
GET    /api/attendance/overtime/requests  # 연장근무 현황

[설정]
GET    /api/settings/leave-policy   # 휴가규정 조회
PUT    /api/settings/leave-policy   # 휴가규정 수정
GET    /api/settings/overtime       # 시간외근무 설정 조회
PUT    /api/settings/overtime       # 시간외근무 설정 수정
GET    /api/settings/permissions    # 권한 설정 조회
PUT    /api/settings/permissions    # 권한 설정 수정

[외부연동]
POST   /api/integration/google/connect     # 구글 연동
DELETE /api/integration/google/disconnect   # 구글 연동 해제
POST   /api/integration/google/sync        # 구글 캘린더 동기화
```

---

## 9. 스케줄러 (크론잡)

자동화가 필요한 배치 작업:

| 주기 | 작업 | 설명 |
|------|------|------|
| 매일 00:00 | 연차 자동 부여 | 입사일 기준 월별/연별 연차 생성 |
| 매일 00:00 | 연차 만료 처리 | 사용기한 초과 연차 자동 만료 |
| 매일 00:00 | LeaveBalance 갱신 | 캐시 테이블 일일 정합성 체크 |
| 매일 03:00 | DB 백업 | PostgreSQL 전체 백업 |
| 매일 00:00 | 만료 세션 정리 | 기한 초과 세션 레코드 삭제 |

**구현**: `node-cron` 라이브러리 또는 Next.js API Route + 외부 cron trigger

---

## 10. 구글 캘린더 연동

### 10.1 연동 흐름

```
[직원] → [외부서비스 연동 페이지] → [Google OAuth 동의]
         → Access Token + Refresh Token 발급
         → DB 암호화 저장

[휴가 승인 시]
  → Google Calendar API 호출
  → 해당 직원 캘린더에 휴가 일정 자동 등록
  → 제목: "[연차] 홍길동 - 개인사유"
  → 종일 이벤트 / 반차는 오전·오후 구분

[휴가 취소 시]
  → 등록된 캘린더 이벤트 자동 삭제
```

### 10.2 필요한 Google API 스코프
- `https://www.googleapis.com/auth/calendar.events`

---

## 11. 프로젝트 디렉토리 구조

```
msa-hr/
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── .env                        # (gitignore)
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── prisma/
│   ├── schema.prisma           # DB 스키마
│   ├── migrations/             # 마이그레이션
│   └── seed.ts                 # 초기 데이터 시드
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx          # 루트 레이아웃
│   │   ├── page.tsx            # 메인 (→ 대시보드 리다이렉트)
│   │   ├── login/
│   │   │   └── page.tsx        # 로그인 페이지
│   │   ├── dashboard/
│   │   │   └── page.tsx        # 대시보드
│   │   ├── leave/
│   │   │   ├── my/page.tsx             # 나의 휴가
│   │   │   ├── usage/page.tsx          # 휴가사용현황
│   │   │   ├── requests/page.tsx       # 휴가신청관리
│   │   │   ├── register/page.tsx       # 휴가관리대장
│   │   │   └── grant/page.tsx          # 휴가부여
│   │   ├── attendance/
│   │   │   ├── clock/page.tsx        # 오늘 근무
│   │   │   ├── my/page.tsx           # 내 근태현황
│   │   │   └── overtime/
│   │   │       ├── page.tsx          # 연장근무 신청
│   │   │       └── requests/page.tsx # 연장근무 현황
│   │   ├── settings/
│   │   │   ├── approval/page.tsx       # 권한/결재선 설정
│   │   │   ├── leave-policy/page.tsx   # 휴가규정 관리
│   │   │   ├── overtime/page.tsx       # 시간외근무 설정
│   │   │   ├── employees/page.tsx      # 직원관리
│   │   │   └── integration/page.tsx    # 외부서비스 연동
│   │   └── api/
│   │       ├── auth/
│   │       ├── employees/
│   │       ├── departments/
│   │       ├── leave/
│   │       ├── approval/
│   │       ├── overtime/
│   │       ├── settings/
│   │       ├── integration/
│   │       └── cron/               # 스케줄러 트리거 엔드포인트
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx         # 좌측 사이드바
│   │   │   ├── Header.tsx          # 상단 헤더 (회사명, 사용자, 세션타이머)
│   │   │   ├── Breadcrumb.tsx      # 경로 표시
│   │   │   └── Footer.tsx          # 하단 푸터
│   │   ├── ui/                     # shadcn/ui 컴포넌트
│   │   ├── leave/                  # 휴가 관련 컴포넌트
│   │   ├── approval/               # 결재 관련 컴포넌트
│   │   ├── settings/               # 설정 관련 컴포넌트
│   │   └── common/                 # 공통 컴포넌트 (DataTable, Modal 등)
│   ├── lib/
│   │   ├── prisma.ts               # Prisma 클라이언트 싱글톤
│   │   ├── auth.ts                 # 인증 유틸리티
│   │   ├── utils.ts                # 공통 유틸리티
│   │   └── constants.ts            # 상수 정의
│   ├── services/
│   │   ├── leave/
│   │   │   ├── annualLeaveGenerator.ts   # 연차 자동 생성
│   │   │   ├── leaveCalculator.ts        # 휴가 일수 계산
│   │   │   ├── leaveValidator.ts         # 휴가 신청 유효성 검증
│   │   │   └── leaveBalanceService.ts    # 잔여 연차 관리
│   │   ├── approval/
│   │   │   ├── approvalEngine.ts         # 결재 처리 엔진
│   │   │   └── approvalLineResolver.ts   # 결재선 자동 매핑
│   │   ├── employee/
│   │   │   └── employeeService.ts        # 직원 관련 비즈니스 로직
│   │   ├── overtime/
│   │   │   └── overtimeService.ts        # 시간외근무 로직
│   │   ├── integration/
│   │   │   └── googleCalendar.ts         # 구글 캘린더 연동
│   │   └── scheduler/
│   │       └── cronJobs.ts               # 크론잡 정의
│   ├── hooks/                      # React 커스텀 훅
│   ├── types/                      # TypeScript 타입 정의
│   └── middleware.ts               # Next.js 미들웨어 (인증 체크)
├── backups/                        # DB 백업 파일 (gitignore)
└── docs/
    └── ARCHITECTURE.md             # 이 문서
```

---

## 12. 개발 단계 (마일스톤)

### Phase 1: 기반 구축 (인프라 + 인증 + 직원관리)
- [x] 프로젝트 초기 설정 (Next.js, TypeScript, Tailwind, Prisma)
- [ ] Docker 환경 구성
- [ ] DB 스키마 생성 및 마이그레이션
- [ ] 시드 데이터 (부서, 직급, 테스트 직원)
- [ ] 로그인/로그아웃 (JWT 인증)
- [ ] 레이아웃 (사이드바, 헤더, Breadcrumb)
- [ ] 직원관리 CRUD
- [ ] 권한 미들웨어 (RBAC)

### Phase 2: 휴가 관리 시스템
- [ ] 연차 자동 생성 로직 (입사일 기반)
- [ ] 나의 휴가 페이지
- [ ] 휴가 신청/수정/취소
- [ ] 휴가사용현황 (부서/전사)
- [ ] 휴가관리대장
- [ ] 휴가부여 (수동)
- [ ] 엑셀 다운로드

### Phase 3: 전자결재 시스템
- [ ] 결재선 설정/관리
- [ ] 휴가 결재 프로세스
- [ ] 결재 승인/반려/전결
- [ ] 결재 알림 (인앱)
- [ ] 결재 이력 조회

### Phase 4: 부가 기능
- [ ] 시간외근무 신청/관리
- [ ] 구글 캘린더 연동
- [ ] 대시보드 (현황 요약)

### Phase 5: 운영 안정화
- [ ] DB 백업 자동화
- [ ] 감사 로그
- [ ] 성능 최적화
- [ ] 사용자 매뉴얼

---

## 13. 시드 데이터 (초기 데이터)

```typescript
// prisma/seed.ts 에서 생성할 데이터

// 직급 (유니포스트 참고)
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
  { name: '병가',     code: 'SICK',   isPaid: true, isAnnualDeduct: false, requiresDoc: true },
  { name: '경조사',   code: 'FAMILY', isPaid: true, isAnnualDeduct: false },
  { name: '출산휴가', code: 'MATERNITY', isPaid: true, isAnnualDeduct: false, maxDays: 90 },
  { name: '배우자출산', code: 'PATERNITY', isPaid: true, isAnnualDeduct: false, maxDays: 10 },
  { name: '공가',     code: 'PUBLIC', isPaid: true, isAnnualDeduct: false },
  { name: '특별휴가', code: 'SPECIAL', isPaid: true, isAnnualDeduct: false },
];

// 테스트 관리자 계정
const adminEmployee = {
  employeeNumber: '1088148326',
  name: '변인수',
  email: 'admin@msa.local',
  position: '이사',
  department: '영업',
  role: 'SYSTEM_ADMIN',
  hireDate: '2020-01-02',
};
```

---

## 14. 환경 변수

```env
# .env.example

# Database
DATABASE_URL="postgresql://msa:your_password_here@localhost:5432/msa_hr"
DB_PASSWORD="your_password_here"

# Authentication
NEXTAUTH_SECRET="your-secret-key-minimum-32-chars"
NEXTAUTH_URL="http://192.168.0.100:3000"
JWT_EXPIRES_IN="1h"
REFRESH_TOKEN_EXPIRES_IN="7d"

# Google Calendar (선택)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_REDIRECT_URI="http://192.168.0.100:3000/api/integration/google/callback"

# Encryption (외부 API 토큰 암호화용)
ENCRYPTION_KEY="your-32-byte-encryption-key-here"

# App
COMPANY_NAME="(주)엠에스에이"
DAILY_WORK_HOURS=8
```

---

## 15. 주요 안전장치 체크리스트

- [ ] 비밀번호 bcrypt 해싱 (평문 저장 절대 금지)
- [ ] SQL Injection 방지 (Prisma 파라미터 바인딩)
- [ ] XSS 방지 (React 자동 이스케이핑 + 사용자 입력 sanitize)
- [ ] CSRF 방지 (SameSite Cookie)
- [ ] 세션 타임아웃 (1시간 자동 로그아웃)
- [ ] 권한 체크 미들웨어 (모든 API 라우트)
- [ ] 감사 로그 (중요 작업 전수 기록)
- [ ] DB 백업 자동화 (매일)
- [ ] 환경 변수 분리 (.env gitignore)
- [ ] Rate Limiting (로그인 시도 제한)
- [ ] 입력값 유효성 검증 (Zod 스키마)
- [ ] 트랜잭션 처리 (휴가 차감 등 원자성 보장)
- [ ] 동시성 제어 (같은 날 중복 휴가 방지 - DB 유니크 제약)
- [ ] 에러 핸들링 (사용자 친화적 메시지, 서버 로그)
