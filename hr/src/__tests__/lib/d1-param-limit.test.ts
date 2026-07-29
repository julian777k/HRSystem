/** @jest-environment node */
import Database from 'better-sqlite3';
import { createD1Client } from '@/lib/d1-client';

// D1은 쿼리당 바인딩 파라미터를 100개로 제한한다(SQLITE_MAX_VARIABLE_NUMBER).
// include(relation) 해석이 IN 절을 통째로 만들면 100건 이상 조회에서
// "too many SQL variables"로 실패한다. 실제로 100명 테넌트의 연차 이월이 이 때문에 죽었다.
//
// better-sqlite3의 기본 한도는 D1보다 크므로, bind()에 넘어가는 파라미터 수를
// 직접 감시해 D1과 동일한 한도를 강제한다.

function makeD1(db: Database.Database, maxVars = 100) {
    const seen: number[] = [];
    const d1 = {
        prepare(sql: string) {
            let bound: unknown[] = [];
            const stmt = {
                bind(...params: unknown[]) {
                    bound = params;
                    seen.push(params.length);
                    if (params.length > maxVars) {
                        throw new Error(`D1_ERROR: too many SQL variables: ${params.length}`);
                    }
                    return stmt;
                },
                async all() {
                    const s = db.prepare(sql);
                    const results = s.reader ? s.all(...(bound as never[])) : (s.run(...(bound as never[])), []);
                    return { results, meta: { changes: 0 } };
                },
                async run() {
                    const info = db.prepare(sql).run(...(bound as never[]));
                    return { meta: { changes: info.changes } };
                },
                async first() {
                    return db.prepare(sql).get(...(bound as never[])) ?? null;
                },
            };
            return stmt;
        },
        async batch(statements: unknown[]) {
            const out = [];
            for (const s of statements as { run: () => Promise<unknown> }[]) out.push(await s.run());
            return out;
        },
    };
    return { d1, seen };
}

const N = 150; // D1 한도(100)를 확실히 넘기는 규모

describe('D1 바인딩 파라미터 한도 — include 해석', () => {
    let db: Database.Database;

    beforeEach(() => {
        db = new Database(':memory:');
        db.exec(`
            CREATE TABLE departments (
                id TEXT PRIMARY KEY, tenantId TEXT, name TEXT
            );
            CREATE TABLE employees (
                id TEXT PRIMARY KEY, tenantId TEXT, name TEXT,
                departmentId TEXT, status TEXT
            );
            CREATE TABLE leave_balances (
                id TEXT PRIMARY KEY, tenantId TEXT, employeeId TEXT,
                year INTEGER, leaveTypeCode TEXT, totalRemain REAL
            );
        `);
        const insDept = db.prepare('INSERT INTO departments (id, tenantId, name) VALUES (?,?,?)');
        const insEmp = db.prepare('INSERT INTO employees (id, tenantId, name, departmentId, status) VALUES (?,?,?,?,?)');
        const insBal = db.prepare(
            'INSERT INTO leave_balances (id, tenantId, employeeId, year, leaveTypeCode, totalRemain) VALUES (?,?,?,?,?,?)'
        );
        for (let i = 0; i < N; i++) {
            // 부서도 직원마다 달라야 belongsTo의 FK 집합이 실제로 커진다
            insDept.run(`d${i}`, 't1', `부서${i}`);
            insEmp.run(`e${i}`, 't1', `직원${i}`, `d${i}`, 'ACTIVE');
            insBal.run(`b${i}`, 't1', `e${i}`, 2026, 'ANNUAL', 5);
        }
    });

    afterEach(() => db.close());

    // 연차 이월이 실패했던 실제 경로: leaveBalance 150건 + include employee
    it('belongsTo — 부모 150건의 서로 다른 FK를 나눠 조회한다', async () => {
        const { d1, seen } = makeD1(db);
        const client = createD1Client(d1 as never) as never as {
            leaveBalance: { findMany: (a: unknown) => Promise<Record<string, unknown>[]> };
        };

        const rows = await client.leaveBalance.findMany({
            where: { year: 2026, leaveTypeCode: 'ANNUAL' },
            include: { employee: true },
        });

        expect(rows).toHaveLength(N);
        // 모든 행에 직원이 붙어야 한다 (청크로 나눠도 누락 없음)
        const withEmp = rows.filter((r) => (r.employee as { name?: string } | null)?.name);
        expect(withEmp).toHaveLength(N);
        expect(Math.max(...seen)).toBeLessThanOrEqual(100);
    });

    it('hasMany — 부모 150건의 자식을 나눠 조회한다', async () => {
        const { d1, seen } = makeD1(db);
        const client = createD1Client(d1 as never) as never as {
            department: { findMany: (a: unknown) => Promise<Record<string, unknown>[]> };
        };

        const rows = await client.department.findMany({
            include: { employees: true },
        });

        expect(rows).toHaveLength(N);
        const totalChildren = rows.reduce(
            (sum, r) => sum + ((r.employees as unknown[] | undefined)?.length || 0),
            0
        );
        expect(totalChildren).toBe(N);
        expect(Math.max(...seen)).toBeLessThanOrEqual(100);
    });
});
