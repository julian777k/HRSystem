const isSQLite = process.env.DB_PROVIDER === 'sqlite';

/**
 * Returns a Prisma `contains` filter compatible with both PostgreSQL and SQLite.
 * PostgreSQL supports `mode: 'insensitive'`, SQLite does not (LIKE is case-insensitive by default for ASCII).
 */
export function containsFilter(value: string) {
  if (isSQLite) {
    return { contains: value };
  }
  return { contains: value, mode: 'insensitive' as const };
}

/**
 * Check if we're running in SQLite mode
 */
export function isSQLiteMode() {
  return process.env.DB_PROVIDER === 'sqlite';
}

/**
 * D1은 쿼리당 바인딩 파라미터가 100개로 제한된다.
 * `IN (...)`에 넣는 ID 목록이 이 한도를 넘으면 쿼리 자체가 실패하므로,
 * 다른 조건까지 감안해 여유를 둔 크기로 나눈다.
 */
export const ID_CHUNK_SIZE = 50;

/** 배열을 지정 크기로 나눈다. */
export function chunk<T>(items: T[], size: number = ID_CHUNK_SIZE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/**
 * ID 목록을 나눠 조회하고 결과를 합친다.
 * 100명 규모 테넌트에서 `IN (전 직원)` 조회가 D1 파라미터 한도로 실패하는 것을 막는다.
 */
export async function findInChunks<T>(
  ids: string[],
  run: (chunkIds: string[]) => Promise<T[]>,
  size: number = ID_CHUNK_SIZE
): Promise<T[]> {
  if (ids.length === 0) return [];
  const out: T[] = [];
  for (const part of chunk(ids, size)) {
    out.push(...(await run(part)));
  }
  return out;
}
