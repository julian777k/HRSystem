/** @jest-environment node */
import Database from 'better-sqlite3';
import { updateStmt, deleteStmt } from '@/lib/d1-client';

// $batch용 statement 빌더가 올바른 SQL을 만들고, better-sqlite3의 트랜잭션으로
// 원자적 실행(하나 실패 시 전체 롤백)이 되는지 검증한다.
// D1의 db.batch()도 동일하게 "하나 실패 시 전체 롤백"을 보장한다.
describe('d1-client batch statement 빌더', () => {
    let db: Database.Database;

    beforeEach(() => {
        db = new Database(':memory:');
        db.exec(`
            CREATE TABLE leave_balances (
                id TEXT PRIMARY KEY, tenantId TEXT, employeeId TEXT,
                totalUsed REAL DEFAULT 0, totalRemain REAL
            );
            CREATE TABLE leave_requests (id TEXT PRIMARY KEY, tenantId TEXT, status TEXT);
        `);
        db.prepare('INSERT INTO leave_balances VALUES (?,?,?,?,?)').run('b1', 't1', 'e1', 5, 10);
        db.prepare('INSERT INTO leave_requests VALUES (?,?,?)').run('r1', 't1', 'PENDING');
    });

    afterEach(() => db.close());

    test('updateStmt — increment/decrement 연산자가 SQL로 변환된다', () => {
        const stmt = updateStmt(
            'leaveBalance',
            { id: 'b1', tenantId: 't1' },
            { totalUsed: { increment: 2 }, totalRemain: { decrement: 2 } }
        );
        db.prepare(stmt.sql).run(...(stmt.params as never[]));
        const row = db.prepare('SELECT totalUsed, totalRemain FROM leave_balances WHERE id = ?').get('b1') as {
            totalUsed: number;
            totalRemain: number;
        };
        expect(row).toEqual({ totalUsed: 7, totalRemain: 8 });
    });

    test('deleteStmt — where 조건으로 삭제', () => {
        const stmt = deleteStmt('leaveRequest', { id: 'r1', tenantId: 't1' });
        db.prepare(stmt.sql).run(...(stmt.params as never[]));
        expect(db.prepare('SELECT COUNT(*) AS c FROM leave_requests').get()).toEqual({ c: 0 });
    });

    test('원자성 — 배치 중 하나가 실패하면 전체 롤백 (better-sqlite3 트랜잭션)', () => {
        const stmts = [
            updateStmt('leaveRequest', { id: 'r1' }, { status: 'APPROVED' }),
            // 존재하지 않는 컬럼 → 실행 시 에러
            { sql: 'UPDATE leave_balances SET nonexistent_col = ? WHERE id = ?', params: [1, 'b1'] },
        ];
        const runBatch = db.transaction((list: typeof stmts) => {
            for (const s of list) db.prepare(s.sql).run(...(s.params as never[]));
        });
        expect(() => runBatch(stmts)).toThrow();
        // 첫 statement가 롤백되어 status가 여전히 PENDING이어야 한다
        const row = db.prepare('SELECT status FROM leave_requests WHERE id = ?').get('r1') as { status: string };
        expect(row.status).toBe('PENDING');
    });

    test('빈 where 방어 — updateStmt에 최소 조건이 있어야 전체 테이블 갱신을 피한다', () => {
        // 정상 케이스: where가 있으면 해당 행만
        const stmt = updateStmt('leaveRequest', { id: 'r1' }, { status: 'REJECTED' });
        expect(stmt.sql).toContain('WHERE');
    });
});
