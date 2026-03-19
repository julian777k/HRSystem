/**
 * Cloudflare-only Prisma replacement.
 *
 * This file is swapped in place of prisma.ts during `build-cloudflare.sh`.
 * It contains ONLY D1-backed code — no @prisma/client, no adapters, no WASM.
 * All 89+ files that `import { prisma } from '@/lib/prisma'` work unchanged.
 */

import { isSaaSMode } from './deploy-config'

// ─── Type definitions (replaces @prisma/client types for CF builds) ───

/** Model delegate — mirrors Prisma model API (findMany, create, etc.) */
interface D1ModelDelegate {
  findMany(args?: any): Promise<any[]>
  findFirst(args?: any): Promise<any | null>
  findFirstOrThrow(args?: any): Promise<any>
  findUnique(args?: any): Promise<any | null>
  create(args?: any): Promise<any>
  createMany(args?: any): Promise<any>
  update(args?: any): Promise<any>
  updateMany(args?: any): Promise<any>
  delete(args?: any): Promise<any>
  deleteMany(args?: any): Promise<any>
  upsert(args?: any): Promise<any>
  count(args?: any): Promise<number>
  aggregate(args?: any): Promise<any>
  groupBy(args?: any): Promise<any[]>
}

/**
 * Client type — provides enough type info so consumers don't trigger noImplicitAny.
 *
 * Uses an index signature returning D1ModelDelegate so that:
 *   prisma.employee.findMany() → Promise<any[]>
 *   (await prisma.employee.findMany()).map((x) => ...) → x is any (explicit via Array<any>)
 *
 * $transaction is explicitly typed so (tx) => ... gets proper types.
 * D1ModelDelegate is made compatible with the index signature by adding a call signature.
 */
interface D1PrismaClient {
  [model: string]: D1ModelDelegate
  $transaction: D1ModelDelegate & {
    (fn: (tx: D1PrismaClient) => Promise<any>): Promise<any>
    (promises: Promise<any>[]): Promise<any[]>
  }
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
 * the Cloudflare D1-backed client. This allows all API routes
 * to keep using `import { prisma } from '@/lib/prisma'` without changes.
 */
function createCloudflareProxy(useTenantScope: boolean): D1PrismaClient {
  return new Proxy({} as D1PrismaClient, {
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
      return new Proxy({} as D1ModelDelegate, {
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

/** Base client (no tenant filtering) — used by super-admin */
export const basePrismaClient: D1PrismaClient = createCloudflareProxy(false)

/**
 * Default client export.
 * Cloudflare: Proxy -> D1 adapter + lazy tenant extension
 *
 * All API routes use this via `import { prisma } from '@/lib/prisma'`
 */
export const prisma: D1PrismaClient = createCloudflareProxy(true)
