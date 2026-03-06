import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const isSQLite = process.env.DB_PROVIDER === 'sqlite'

function createPrismaClient() {
  if (isSQLite) {
    // SQLite mode: use better-sqlite3 driver adapter (Prisma 7 requires adapter)
    const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3')
    const adapter = new PrismaBetterSqlite3({
      url: process.env.DATABASE_URL || 'file:./msa-hr.db',
    })
    return new PrismaClient({ adapter })
  }
  // PostgreSQL mode: use PrismaPg adapter
  const { PrismaPg } = require('@prisma/adapter-pg')
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export function createPrismaClientWithUrl(url: string) {
  if (isSQLite) {
    const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3')
    const adapter = new PrismaBetterSqlite3({ url })
    return new PrismaClient({ adapter })
  }
  const { PrismaPg } = require('@prisma/adapter-pg')
  const adapter = new PrismaPg({ connectionString: url })
  return new PrismaClient({ adapter })
}
