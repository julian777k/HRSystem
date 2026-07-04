# KeystoneHR — 프로젝트 지침 (Claude 필독)

멀티테넌트 HR SaaS. 실제 소비자가 구매·사용하는 상용 상품. **무결성이 최우선.**
스택: Next.js 16 + React 19 + Prisma 7 + Cloudflare Workers/D1(SQLite). 앱 소스는 `hr/`.

---

## 🚨 CRITICAL — 절대 규칙 (위반 시 프로덕션 다운)

### 로컬에서 직접 배포 금지. 배포는 오직 `git push` → GitHub Actions.

- **MUST NOT** 실행: `npm run cf:build`, `npm run cf:deploy`, `npx wrangler deploy`, `npx opennextjs-cloudflare build` 를 로컬(Windows)에서 직접 실행
- **이유**: OpenNext는 Windows 빌드 시 명령이 exit 0으로 성공해도 **Worker 런타임이 500으로 죽는다.** (2026-07-04 실제 사고 → 롤백으로 복구함)
- **올바른 배포**: `hr/` 변경 → 커밋 → `git push`. GitHub Actions(`.github/workflows/deploy.yml`)가 Linux에서 test 게이트 → cf:build → D1 마이그레이션 → deploy → 스모크를 자동 수행.
- 이 규칙은 hook으로도 기술 차단돼 있음. hook이 막으면 우회하지 말고 `git push`를 안내할 것.

---

## 개발·검증

- 환경: **Windows** (PowerShell 주 셸, Bash 툴도 사용 가능)
- 로컬 개발: `cd hr && npm run dev`
- **타입 체크는 반드시 sqlite 스키마로**:
  ```
  npx prisma generate --schema=prisma/schema.sqlite.prisma
  npx tsc --noEmit
  ```
  기본 `schema.prisma`(PostgreSQL)는 enum이 엄격해 배포 대상(D1/SQLite, enum=String)과 불일치 → 배포와 무관한 tsc 에러가 난다. 배포는 D1이므로 sqlite 기준이 정답.
- 테스트: `npm test` (jest). d1-client SQL 조립은 `src/__tests__/lib/d1-client-security.test.ts`에서 better-sqlite3로 실제 검증.

## 프로덕션 관리 (Windows에서 가능)

- 테넌트·계정 조회/수정: `npx wrangler d1 execute hr-saas-db --remote --command "..."`
- 백업: `npx wrangler d1 export hr-saas-db --remote --output=backup.sql` (파괴적 작업 전 필수)
- 롤백: `npx wrangler rollback <version-id>` (코드만 되돌림, DB 유지)
- 비밀번호 재설정 등: 슈퍼관리자 콘솔 https://keystonehr.app/super-admin

## 참고 정보

| 항목 | 값 |
|------|-----|
| GitHub | `julian777k/HRSystem` |
| Cloudflare 계정 ID | `78afd148cc85ba9382f45d51df9bc8ac` |
| D1 | `hr-saas-db` |
| 도메인 | `keystonehr.app`, `*.keystonehr.app` |

## 파괴적 작업 원칙

- 프로덕션 D1 데이터 삭제/수정 전 **반드시 백업**(`d1 export`) 후 진행
- `.env`(gitignore)에는 시크릿 + 지인 페이지 관리자 메모가 있음 — 절대 수정/삭제 금지, 읽기만
- 상세 운영 가이드: `배포_및_운영_가이드.md` (사용자용)

## 응답

- 한국어. 간결하고 핵심 위주. 코드 변경 시 이유 + 요약 제시.
