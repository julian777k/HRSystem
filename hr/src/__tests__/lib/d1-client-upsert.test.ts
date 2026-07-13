/** @jest-environment node */
import Database from 'better-sqlite3';
import { buildUpsertSql } from '@/lib/d1-client';

// upsert가 조립하는 SQL을 실제 SQLite에서 실행해, 증감 연산자가 숫자 연산으로
// 변환되는지 검증한다.
//
// 회귀 배경: upsert가 update 절을 buildSetClause에 통과시키지 않고 toSqlValue를
// 직접 호출해, { increment: 4.5 } 객체가 '{"increment":4.5}' 문자열로 DB에 박혔다.
// 연장근무를 승인하면 보상시간 지갑(time_wallets)의 잔액이 손상됐다.
//
// 이 테스트는 buildUpsertSql이 조립한 SQL을 그대로 실행하므로,
// upsert가 buildSetClause를 건너뛰면 반드시 실패한다.
describe('d1-client buildUpsertSql — 증감 연산자', () => {
    let db: Database.Database;

    beforeEach(() => {
        db = new Database(':memory:');
        db.exec(`CREATE TABLE time_wallets (
            id TEXT PRIMARY KEY,
            employeeId TEXT,
            totalEarned REAL,
            totalRemain REAL,
            UNIQUE (employeeId)
        )`);
    });

    afterEach(() => db.close());

    const upsert = (create: Record<string, unknown>, update: Record<string, unknown>) => {
        const { sql, params } = buildUpsertSql('time_wallets', create, update, ['employeeId']);
        db.prepare(sql).run(...(params as never[]));
    };

    const read = () =>
        db.prepare('SELECT totalEarned, totalRemain FROM time_wallets WHERE employeeId = ?').get('e1') as {
            totalEarned: number;
            totalRemain: number;
        };

    test('increment — 기존 값에 숫자로 누적된다', () => {
        upsert({ id: 'w1', employeeId: 'e1', totalEarned: 4.5, totalRemain: 4.5 }, {});
        expect(read()).toEqual({ totalEarned: 4.5, totalRemain: 4.5 });

        // 같은 employeeId → ON CONFLICT DO UPDATE 경로
        upsert(
            { id: 'w2', employeeId: 'e1', totalEarned: 3, totalRemain: 3 },
            { totalEarned: { increment: 3 }, totalRemain: { increment: 3 } }
        );

        const row = read();
        expect(row.totalEarned).toBe(7.5); // 4.5 + 3
        expect(row.totalRemain).toBe(7.5);
        // 연산자 객체가 문자열로 박히면 여기서 걸린다
        expect(typeof row.totalRemain).toBe('number');
    });

    test('decrement — 기존 값에서 차감된다', () => {
        upsert({ id: 'w1', employeeId: 'e1', totalEarned: 10, totalRemain: 10 }, {});
        upsert(
            { id: 'w2', employeeId: 'e1', totalEarned: 0, totalRemain: 0 },
            { totalRemain: { decrement: 2.5 } }
        );
        expect(read().totalRemain).toBe(7.5);
    });

    test('set — 값을 덮어쓴다', () => {
        upsert({ id: 'w1', employeeId: 'e1', totalEarned: 10, totalRemain: 10 }, {});
        upsert(
            { id: 'w2', employeeId: 'e1', totalEarned: 0, totalRemain: 0 },
            { totalRemain: { set: 99 } }
        );
        expect(read().totalRemain).toBe(99);
    });

    test('연산자가 아닌 값은 그대로 대입된다 (회귀 없음)', () => {
        upsert({ id: 'w1', employeeId: 'e1', totalEarned: 10, totalRemain: 10 }, {});
        upsert(
            { id: 'w2', employeeId: 'e1', totalEarned: 0, totalRemain: 0 },
            { totalRemain: 12.5 }
        );
        expect(read().totalRemain).toBe(12.5);
    });

    test('update가 비면 INSERT OR IGNORE로 폴백한다', () => {
        const { sql } = buildUpsertSql('time_wallets', { id: 'w1', employeeId: 'e1' }, {}, ['employeeId']);
        expect(sql).toContain('INSERT OR IGNORE');
        expect(sql).not.toContain('ON CONFLICT');
    });
});
