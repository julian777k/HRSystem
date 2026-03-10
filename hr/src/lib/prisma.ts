import { PrismaClient } from '@prisma/client'
import { isSaaSMode } from './deploy-config'
import { withLazyTenantScope } from './prisma-tenant'

const isCloudflare = process.env.DEPLOY_TARGET === 'cloudflare'
const isSQLite = process.env.DB_PROVIDER === 'sqlite'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// ─── Local Development Client (module-level singleton) ───

// Dynamic require helper — created lazily to avoid 'new Function()' at module
// level, which triggers EvalError in Cloudflare Workers (no unsafe-eval).
function getDynamicRequire(): NodeRequire {
  return new Function('m', 'return require(m)') as NodeRequire
}

function createLocalPrismaClient() {
  const _require = getDynamicRequire()
  if (isSQLite) {
    const { PrismaBetterSqlite3 } = _require('@prisma/adapter-better-sqlite3')
    const adapter = new PrismaBetterSqlite3({
      url: process.env.DATABASE_URL || 'file:./keystonehr.db',
    })
    return new PrismaClient({ adapter })
  }
  const { PrismaPg } = _require('@prisma/adapter-pg')
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
  return new PrismaClient({ adapter })
}

// ─── Cloudflare D1 Client (lightweight SQL, no WASM) ───

let _cfD1Client: any = null
let _cfD1TenantClient: any = null

async function getCloudflareClient(): Promise<any> {
  if (_cfD1Client) return _cfD1Client
  const { getCloudflareContext } = await import('@opennextjs/cloudflare')
  const { env } = await getCloudflareContext()
  const { createD1Client } = await import('./d1-client')
  _cfD1Client = createD1Client((env as any).DB)
  return _cfD1Client
}

async function getCloudflareTenantClient(): Promise<any> {
  if (_cfD1TenantClient) return _cfD1TenantClient
  const base = await getCloudflareClient()
  if (isSaaSMode()) {
    const { withD1TenantScope } = await import('./d1-client')
    const { getTenantIdSafe } = await import('./tenant-context')
    _cfD1TenantClient = withD1TenantScope(base, getTenantIdSafe)
  } else {
    _cfD1TenantClient = base
  }
  return _cfD1TenantClient
}

/**
 * Creates a Proxy that intercepts model access and lazily initializes
 * the Cloudflare D1-backed Prisma client. This allows all 74 API routes
 * to keep using `import { prisma } from '@/lib/prisma'` without changes.
 *
 * How it works:
 * - `prisma.employee` (sync) → returns a model proxy
 * - `prisma.employee.findMany(...)` (async) → creates D1 client, then calls real method
 */
function createCloudflareProxy(useTenantScope: boolean): PrismaClient {
  return new Proxy({} as PrismaClient, {
    get(_target, prop: string | symbol) {
      if (typeof prop === 'symbol') return undefined

      // Handle Prisma client methods ($transaction, $executeRaw, etc.)
      if (prop.startsWith('$')) {
        return async (...args: any[]) => {
          const client = useTenantScope
            ? await getCloudflareTenantClient()
            : await getCloudflareClient()
          return (client as any)[prop](...args)
        }
      }

      // Handle 'then' to prevent treating proxy as a thenable
      if (prop === 'then') return undefined

      // Return a model delegate proxy (e.g., prisma.employee)
      return new Proxy({}, {
        get(_modelTarget, methodName: string | symbol) {
          if (typeof methodName === 'symbol') return undefined
          return async (...args: any[]) => {
            const client = useTenantScope
              ? await getCloudflareTenantClient()
              : await getCloudflareClient()
            return (client as any)[prop][methodName](...args)
          }
        },
      })
    },
  })
}

// ─── Exports ───

/** Base Prisma client (no tenant filtering) — used by super-admin */
export const basePrismaClient: PrismaClient = isCloudflare
  ? createCloudflareProxy(false)
  : (globalForPrisma.prisma ?? createLocalPrismaClient())

if (!isCloudflare && process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = basePrismaClient
}

/**
 * Default Prisma client export.
 * - Local self-hosted: plain PrismaClient
 * - Local SaaS: PrismaClient + lazy tenant extension
 * - Cloudflare: Proxy → D1 adapter + lazy tenant extension
 *
 * All 74 API routes use this via `import { prisma } from '@/lib/prisma'`
 */
export const prisma: PrismaClient = isCloudflare
  ? createCloudflareProxy(true)
  : (isSaaSMode()
      ? withLazyTenantScope(basePrismaClient) as unknown as PrismaClient
      : basePrismaClient)

