// 데모 테넌트의 현재 데이터를 SQL 스냅샷으로 추출한다.
// 결과: scripts/demo-reset.sql (DELETE + INSERT). GitHub Actions cron이 이 파일을 D1에 실행해 데모를 초기화한다.
//
// 사용법: node scripts/generate-demo-snapshot.mjs
// 데모 데이터를 의도적으로 바꾼 뒤 "새 기준"으로 다시 뜨고 싶을 때만 재실행하면 된다.

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const DEMO_SUBDOMAIN = 'demo';

// 스냅샷으로 복원할 테이블.
// 순서 중요 — FK 의존성 순으로 INSERT 된다. 특히 approvals는 leave_requests·overtime_requests를
// 참조하므로 반드시 그 뒤에 와야 한다.
const SNAPSHOT_TABLES = [
    'tenant_settings',
    'departments', // 자기참조(parentId) → sortParentsFirst로 부모 우선 정렬
    'positions',
    'employees', // → departments, positions
    'view_permissions',
    'leave_types',
    'leave_policies', // → leave_types
    'leave_grants',
    'leave_balances',
    'leave_requests', // → employees, leave_types
    'overtime_policies',
    'overtime_requests', // → employees
    'approval_lines',
    'approval_steps', // → approval_lines, employees
    'approvals', // → employees, leave_requests, overtime_requests
    'compensation_policies',
    'time_wallets',
    'time_deductions',
    'comp_time_accruals',
    'welfare_categories',
    'welfare_items', // → welfare_categories
    'welfare_requests', // → employees, welfare_items
    'attendances',
    'leave_of_absences',
    'external_integrations',
    'holidays',
];

// 복원하지 않고 삭제만 하는 테이블 (세션·로그·알림은 초기 상태가 '비어있음')
const PURGE_ONLY_TABLES = ['sessions', 'audit_logs', 'notifications'];

// 자기참조 테이블 — 부모 row가 먼저 INSERT 되어야 FK가 통과한다 (테이블명 → 부모 참조 컬럼)
const SELF_REF_COLUMNS = { departments: 'parentId' };

// 부모가 먼저 오도록 위상 정렬
function sortParentsFirst(rows, parentCol) {
    const inserted = new Set();
    const sorted = [];
    let remaining = [...rows];
    while (remaining.length) {
        const ready = remaining.filter((r) => !r[parentCol] || inserted.has(r[parentCol]));
        if (!ready.length) {
            // 순환 참조 — 남은 것을 그대로 붙인다 (FK가 깨지면 즉시 드러나야 하므로 조용히 넘기지 않음)
            console.warn(`  ⚠️ ${parentCol} 순환 참조 감지 — ${remaining.length} rows를 정렬 없이 추가`);
            return [...sorted, ...remaining];
        }
        for (const r of ready) {
            inserted.add(r.id);
            sorted.push(r);
        }
        remaining = remaining.filter((r) => !inserted.has(r.id));
    }
    return sorted;
}

// wrangler의 JS 진입점을 직접 실행한다 (셸·.cmd 미개입 → 인자가 그대로 전달되고 메타문자 해석 없음)
const WRANGLER = new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url).pathname.replace(/^\//, '');

function d1(sql) {
    const out = execFileSync(
        process.execPath,
        [WRANGLER, 'd1', 'execute', 'hr-saas-db', '--remote', '--json', '--command', sql],
        { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }
    );
    const start = out.indexOf('[');
    return JSON.parse(out.slice(start))[0].results;
}

// 이 SQL은 PUBLIC 리포에 커밋된다. 비밀값이 실린 채 나가면 안 된다.
// 데모 자동 로그인(/api/demo/login)은 비밀번호를 검증하지 않으므로 해시를 무효화해도 데모는 정상 동작한다.
const SENSITIVE_COLUMN_RE = /password|passwordhash|token|secret|webhook|apikey|api_key/i;
const INVALID_BCRYPT = '$2b$10$DDDDDDDDDDDDDDDDDDDDDDxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'; // 어떤 비밀번호와도 매치되지 않음

function maskIfSensitive(col, v) {
    if (v === null || v === undefined) return v;
    if (!SENSITIVE_COLUMN_RE.test(col)) return v;
    return /^\$2[aby]\$/.test(String(v)) ? INVALID_BCRYPT : 'REDACTED';
}

function sqlValue(v) {
    if (v === null || v === undefined) return 'NULL';
    if (typeof v === 'number') return String(v);
    if (typeof v === 'boolean') return v ? '1' : '0';
    return `'${String(v).replace(/'/g, "''")}'`;
}

const tenant = d1(`SELECT id FROM tenants WHERE subdomain='${DEMO_SUBDOMAIN}'`)[0];
if (!tenant) throw new Error('demo 테넌트를 찾을 수 없습니다');
const tenantId = tenant.id;
console.log(`demo tenantId = ${tenantId}`);

const lines = [
    '-- 데모 테넌트 초기화 SQL (자동 생성 — scripts/generate-demo-snapshot.mjs)',
    '-- GitHub Actions cron이 매일 실행해 공개 데모를 원상 복구한다.',
    `-- tenantId: ${tenantId}`,
    '',
];

// 1) 삭제 — FK 역순
const allTables = [...SNAPSHOT_TABLES, ...PURGE_ONLY_TABLES];
lines.push('-- 기존 데모 데이터 삭제 (FK 역순)');
for (const t of [...allTables].reverse()) {
    lines.push(`DELETE FROM ${t} WHERE tenantId = '${tenantId}';`);
}
lines.push('');

// 2) 복원 — FK 순서
let totalRows = 0;
for (const table of SNAPSHOT_TABLES) {
    let rows = d1(`SELECT * FROM ${table} WHERE tenantId = '${tenantId}'`);
    if (!rows.length) {
        console.log(`  ${table}: 0 (건너뜀)`);
        continue;
    }
    const parentCol = SELF_REF_COLUMNS[table];
    if (parentCol) {
        rows = sortParentsFirst(rows, parentCol);
    }
    const cols = Object.keys(rows[0]);
    lines.push(`-- ${table} (${rows.length} rows)`);
    const masked = cols.filter((c) => SENSITIVE_COLUMN_RE.test(c));
    if (masked.length) {
        console.log(`     ↳ 마스킹: ${masked.join(', ')}`);
    }
    for (const row of rows) {
        const vals = cols.map((c) => sqlValue(maskIfSensitive(c, row[c]))).join(', ');
        lines.push(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${vals});`);
    }
    lines.push('');
    totalRows += rows.length;
    console.log(`  ${table}: ${rows.length}`);
}

writeFileSync('scripts/demo-reset.sql', lines.join('\n'), 'utf8');
console.log(`\n✅ scripts/demo-reset.sql 생성 완료 — 총 ${totalRows} rows`);
