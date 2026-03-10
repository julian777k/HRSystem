/**
 * Tenant context utilities
 *
 * In SaaS mode on Cloudflare, middleware sets x-tenant-subdomain header.
 * This module resolves the subdomain to tenantId via D1 query (cached).
 * In self-hosted mode, tenantId is always "" (empty string).
 */

import { headers } from 'next/headers';
import { isSaaSMode } from './deploy-config';

// Per-isolate cache: subdomain → tenantId (persists across requests in same Worker)
const subdomainCache = new Map<string, { tenantId: string; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes (tenant mapping rarely changes)
const CACHE_MAX_SIZE = 500;

/**
 * Resolve subdomain to tenantId via D1 query, with caching.
 */
async function resolveSubdomainToTenantId(subdomain: string): Promise<string> {
  // Check cache
  const cached = subdomainCache.get(subdomain);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.tenantId;
  }

  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const { env } = await getCloudflareContext();
    const db = (env as any).DB;

    if (!db) return '';

    // Look up tenant (active or trial)
    const result = await db
      .prepare('SELECT "id", "status", "trialExpiresAt" FROM "tenants" WHERE "subdomain" = ? AND "status" IN (?, ?) LIMIT 1')
      .bind(subdomain, 'active', 'trial')
      .first() as { id: string; status: string; trialExpiresAt: string | null } | null;

    if (!result) return '';

    // Auto-expire trial tenants
    if (result.status === 'trial' && result.trialExpiresAt) {
      const expiresAt = new Date(result.trialExpiresAt);
      if (expiresAt <= new Date()) {
        // Trial expired → suspend tenant
        await db
          .prepare('UPDATE "tenants" SET "status" = ?, "updatedAt" = ? WHERE "id" = ?')
          .bind('suspended', new Date().toISOString(), result.id)
          .run();
        return ''; // Deny access
      }
    }

    const tenantId = result.id;

    // Cache the result (with max size enforcement)
    if (tenantId) {
      if (subdomainCache.size >= CACHE_MAX_SIZE) {
        // Evict oldest entries by expiry time
        let oldestKey: string | null = null;
        let oldestExpiry = Infinity;
        for (const [key, entry] of subdomainCache) {
          if (entry.expiresAt < oldestExpiry) {
            oldestExpiry = entry.expiresAt;
            oldestKey = key;
          }
        }
        if (oldestKey) subdomainCache.delete(oldestKey);
      }
      subdomainCache.set(subdomain, {
        tenantId,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
    }

    return tenantId;
  } catch {
    return '';
  }
}

/**
 * Get the current tenant ID from request headers.
 * Returns "" in self-hosted mode (matches @default("") in schema).
 */
export async function getTenantId(): Promise<string> {
  if (!isSaaSMode()) {
    return '';
  }

  const headerStore = await headers();

  // Resolve from subdomain header (set by middleware)
  const subdomain = headerStore.get('x-tenant-subdomain');
  if (!subdomain) {
    throw new Error('Tenant context not found in SaaS mode');
  }

  const tenantId = await resolveSubdomainToTenantId(subdomain);
  if (!tenantId) {
    throw new Error(`Tenant not found for subdomain: ${subdomain}`);
  }

  return tenantId;
}

/**
 * Get tenant ID without throwing (for optional contexts).
 */
export async function getTenantIdSafe(): Promise<string> {
  if (!isSaaSMode()) {
    return '';
  }

  try {
    const headerStore = await headers();

    const subdomain = headerStore.get('x-tenant-subdomain');
    if (!subdomain) return '';

    return resolveSubdomainToTenantId(subdomain);
  } catch {
    return '';
  }
}
