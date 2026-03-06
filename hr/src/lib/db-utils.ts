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
