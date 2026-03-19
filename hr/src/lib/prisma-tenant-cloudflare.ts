/**
 * Cloudflare-only prisma-tenant replacement.
 *
 * On Cloudflare, tenant scoping is already handled by withD1TenantScope
 * in d1-client.ts. This file provides a no-op pass-through so that
 * prisma.ts (swapped to prisma-cloudflare.ts) can import without errors.
 *
 * No @prisma/client imports — zero bundle impact.
 */

/**
 * Pass-through: D1 client already handles tenant scoping via withD1TenantScope.
 */
export function withLazyTenantScope(baseClient: any) {
  return baseClient
}
