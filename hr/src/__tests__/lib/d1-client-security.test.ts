/** @jest-environment node */
import Database from 'better-sqlite3';
import { buildWhere, buildOrderBy, buildSelectColumns } from '@/lib/d1-client';

// d1-client의 SQL 조립 순수 함수를 실제 SQLite에서 실행해
// 식별자 인젝션 차단(M-6)과 LIKE 이스케이프를 검증한다.
describe('d1-client SQL 조립 보안', () => {
  let db: Database.Database;

  beforeAll(() => {
    db = new Database(':memory:');
    db.exec('CREATE TABLE employees (id TEXT, name TEXT, email TEXT, tenantId TEXT)');
    const ins = db.prepare('INSERT INTO employees (id, name, email, tenantId) VALUES (?,?,?,?)');
    ins.run('1', '50% off sale', 'a@b.com', 't1');
    ins.run('2', 'normal name', 'c@d.com', 't1');
    ins.run('3', 'other tenant', 'e@f.com', 't2');
  });

  afterAll(() => db.close());

  const run = (sql: string, params: unknown[]) =>
    db.prepare(`SELECT * FROM employees WHERE ${sql}`).all(...(params as never[]));

  test('정상 where → 유효 SQL 실행 (회귀 없음)', () => {
    const { sql, params } = buildWhere({ tenantId: 't1', name: 'normal name' });
    const rows = run(sql, params) as Array<{ id: string }>;
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('2');
  });

  test('IN / OR 정상 동작', () => {
    const or = buildWhere({ OR: [{ email: 'a@b.com' }, { email: 'c@d.com' }] });
    expect(run(or.sql, or.params)).toHaveLength(2);
    const inq = buildWhere({ id: { in: ['1', '3'] } });
    expect(run(inq.sql, inq.params)).toHaveLength(2);
  });

  test('식별자 인젝션 키 → throw (M-6)', () => {
    expect(() => buildWhere({ 'email" OR "1"="1': 'x' })).toThrow(/Invalid column identifier/);
    expect(() => buildWhere({ 'name"); DROP TABLE employees;--': 'x' })).toThrow(/Invalid column identifier/);
  });

  test('LIKE contains의 %는 리터럴로 처리 (와일드카드 아님)', () => {
    const { sql, params } = buildWhere({ name: { contains: '50%' } });
    const rows = run(sql, params) as Array<{ name: string }>;
    // '50%'를 리터럴로 찾으므로 '50% off sale'만 매칭. 이스케이프 없으면 '%'가 전체 매칭.
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('50% off sale');
  });

  test('LIKE contains 언더스코어(_)도 리터럴 처리', () => {
    // '_'는 단일 문자 와일드카드 — 이스케이프 안 하면 'normal name'의 임의 문자와 매칭
    const { sql, params } = buildWhere({ name: { contains: 'a_b' } });
    expect(run(sql, params)).toHaveLength(0);
  });

  test('LIKE insensitive: COLLATE NOCASE + ESCAPE 문법이 SQLite에서 유효', () => {
    const { sql, params } = buildWhere({ name: { contains: 'NORMAL', mode: 'insensitive' } });
    const rows = run(sql, params) as Array<{ id: string }>;
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('2');
  });

  test('startsWith / endsWith 정상', () => {
    const sw = buildWhere({ name: { startsWith: 'normal' } });
    expect(run(sw.sql, sw.params)).toHaveLength(1);
    const ew = buildWhere({ name: { endsWith: 'sale' } });
    expect(run(ew.sql, ew.params)).toHaveLength(1);
  });

  test('buildOrderBy 정상 + 필드/방향 인젝션 차단', () => {
    expect(buildOrderBy({ name: 'asc' })).toBe(' ORDER BY "name" ASC');
    expect(() => buildOrderBy({ 'name"; DROP TABLE x': 'asc' })).toThrow(/Invalid column identifier/);
    expect(() => buildOrderBy({ name: 'asc; DROP' })).toThrow(/Invalid ORDER BY direction/);
  });

  test('buildSelectColumns 정상 + 인젝션 차단', () => {
    expect(buildSelectColumns({ id: true, name: true })).toBe('"id", "name"');
    expect(() => buildSelectColumns({ 'id" FROM employees --': true })).toThrow(/Invalid column identifier/);
  });
});
