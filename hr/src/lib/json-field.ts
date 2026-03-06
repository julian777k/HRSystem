/**
 * JSON field helpers for SQLite compatibility.
 * PostgreSQL uses native Json type, SQLite stores JSON as TEXT (String).
 */

const isSQLite = process.env.DB_PROVIDER === 'sqlite';

/**
 * Serialize a value for storage in a JSON field.
 * - PostgreSQL: pass through as-is (Prisma handles Json natively)
 * - SQLite: JSON.stringify to store as TEXT
 */
export function serializeJson<T>(value: T): T | string {
  if (!isSQLite || value === null || value === undefined) {
    return value;
  }
  return JSON.stringify(value);
}

/**
 * Parse a value read from a JSON field.
 * - PostgreSQL: already parsed by Prisma
 * - SQLite: parse from TEXT string
 */
export function parseJson<T = unknown>(value: unknown): T | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
  return value as T;
}
