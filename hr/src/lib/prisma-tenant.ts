/**
 * Prisma Client Extension for automatic tenant filtering
 *
 * Two variants:
 * 1. withLazyTenantScope(baseClient) — resolves tenantId LAZILY at query time
 *    via getTenantIdSafe(). Used by the default `prisma` export in SaaS mode.
 * 2. withTenantScope(baseClient, tenantId) — uses a static tenantId provided
 *    at creation time. Kept for backward compatibility (getTenantPrisma).
 *
 * Key design decisions:
 * - findUnique: POST-VERIFY tenantId on result (can't modify unique where).
 * - update / delete: PRE-VERIFY via findUnique before executing the mutation.
 *   This prevents cross-tenant writes from ever executing.
 * - upsert: Only set tenantId in `create` data. Don't modify `where`.
 * - create / createMany: Inject tenantId into data.
 * - All other queries (findMany, findFirst, etc.): Add tenantId to where clause.
 */

import { PrismaClient } from '@prisma/client';
import { getTenantIdSafe } from './tenant-context';

/** Models that do NOT have tenantId (global/SaaS-management models) */
const GLOBAL_MODELS = new Set([
  'Tenant',
  'SuperAdmin',
  'TenantUsageLog',  // Intentionally global: super-admin usage tracking
]);

/**
 * Creates a tenant-scoped Prisma client extension with LAZY tenantId resolution.
 * The tenantId is resolved at query time by calling getTenantIdSafe(),
 * which reads from Next.js request headers.
 *
 * When tenantId is '' (self-hosted mode or no tenant context), all operations
 * pass through without any filtering.
 */
export function withLazyTenantScope(baseClient: PrismaClient) {
  return baseClient.$extends({
    query: {
      $allModels: {
        // --- Queries that accept arbitrary where clauses: add tenantId to where ---

        async findMany({ model, args, query }) {
          if (GLOBAL_MODELS.has(model)) return query(args);
          const tenantId = await getTenantIdSafe();
          if (!tenantId) return query(args);
          args.where = { ...args.where, tenantId };
          return query(args);
        },

        async findFirst({ model, args, query }) {
          if (GLOBAL_MODELS.has(model)) return query(args);
          const tenantId = await getTenantIdSafe();
          if (!tenantId) return query(args);
          args.where = { ...args.where, tenantId };
          return query(args);
        },

        async findFirstOrThrow({ model, args, query }) {
          if (GLOBAL_MODELS.has(model)) return query(args);
          const tenantId = await getTenantIdSafe();
          if (!tenantId) return query(args);
          args.where = { ...args.where, tenantId };
          return query(args);
        },

        async updateMany({ model, args, query }) {
          if (GLOBAL_MODELS.has(model)) return query(args);
          const tenantId = await getTenantIdSafe();
          if (!tenantId) return query(args);
          args.where = { ...args.where, tenantId };
          return query(args);
        },

        async deleteMany({ model, args, query }) {
          if (GLOBAL_MODELS.has(model)) return query(args);
          const tenantId = await getTenantIdSafe();
          if (!tenantId) return query(args);
          args.where = { ...args.where, tenantId };
          return query(args);
        },

        async count({ model, args, query }) {
          if (GLOBAL_MODELS.has(model)) return query(args);
          const tenantId = await getTenantIdSafe();
          if (!tenantId) return query(args);
          args.where = { ...args.where, tenantId };
          return query(args);
        },

        async aggregate({ model, args, query }) {
          if (GLOBAL_MODELS.has(model)) return query(args);
          const tenantId = await getTenantIdSafe();
          if (!tenantId) return query(args);
          args.where = { ...args.where, tenantId };
          return query(args);
        },

        async groupBy({ model, args, query }) {
          if (GLOBAL_MODELS.has(model)) return query(args);
          const tenantId = await getTenantIdSafe();
          if (!tenantId) return query(args);
          args.where = { ...args.where, tenantId };
          return query(args);
        },

        // --- findUnique: POST-VERIFY tenantId on result (can't modify unique where) ---

        async findUnique({ model, args, query }) {
          if (GLOBAL_MODELS.has(model)) return query(args);
          const result = await query(args);
          if (!result) return null;
          const tenantId = await getTenantIdSafe();
          if (!tenantId) return result;
          if ('tenantId' in result && (result as any).tenantId !== tenantId) {
            return null; // Cross-tenant access denied
          }
          return result;
        },

        // --- create / createMany: inject tenantId into data ---

        async create({ model, args, query }) {
          if (GLOBAL_MODELS.has(model)) return query(args);
          const tenantId = await getTenantIdSafe();
          if (!tenantId) return query(args);
          (args.data as Record<string, unknown>).tenantId = tenantId;
          return query(args);
        },

        async createMany({ model, args, query }) {
          if (GLOBAL_MODELS.has(model)) return query(args);
          const tenantId = await getTenantIdSafe();
          if (!tenantId) return query(args);
          if (Array.isArray(args.data)) {
            args.data = args.data.map((d: Record<string, unknown>) => ({
              ...d,
              tenantId,
            }));
          } else {
            (args.data as Record<string, unknown>).tenantId = tenantId;
          }
          return query(args);
        },

        // --- update: PRE-VERIFY tenant ownership before executing ---

        async update({ model, args, query }) {
          if (GLOBAL_MODELS.has(model)) return query(args);
          const tenantId = await getTenantIdSafe();
          if (!tenantId) return query(args);
          // Pre-verify: find the record first and check tenant ownership
          const modelKey = model.charAt(0).toLowerCase() + model.slice(1);
          const modelDelegate = (baseClient as any)[modelKey];
          if (modelDelegate) {
            const record = await modelDelegate.findUnique({ where: args.where, select: { tenantId: true } });
            if (!record) {
              throw new Error('Record not found');
            }
            if (record.tenantId !== tenantId) {
              console.error(`[SECURITY] Cross-tenant update blocked: model=${model}, expected=${tenantId}, got=${record.tenantId}`);
              throw new Error('Access denied: tenant mismatch');
            }
          }
          return query(args);
        },

        // --- delete: PRE-VERIFY tenant ownership before executing ---

        async delete({ model, args, query }) {
          if (GLOBAL_MODELS.has(model)) return query(args);
          const tenantId = await getTenantIdSafe();
          if (!tenantId) return query(args);
          // Pre-verify: find the record first and check tenant ownership
          const modelKey = model.charAt(0).toLowerCase() + model.slice(1);
          const modelDelegate = (baseClient as any)[modelKey];
          if (modelDelegate) {
            const record = await modelDelegate.findUnique({ where: args.where, select: { tenantId: true } });
            if (!record) {
              throw new Error('Record not found');
            }
            if (record.tenantId !== tenantId) {
              console.error(`[SECURITY] Cross-tenant delete blocked: model=${model}, expected=${tenantId}, got=${record.tenantId}`);
              throw new Error('Access denied: tenant mismatch');
            }
          }
          return query(args);
        },

        // --- upsert: set tenantId in create data ONLY, DON'T modify where ---

        async upsert({ model, args, query }) {
          if (GLOBAL_MODELS.has(model)) return query(args);
          const tenantId = await getTenantIdSafe();
          if (!tenantId) return query(args);
          (args.create as Record<string, unknown>).tenantId = tenantId;
          return query(args);
        },
      },
    },
  });
}

