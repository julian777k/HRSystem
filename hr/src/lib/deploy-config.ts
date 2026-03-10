/**
 * Deployment mode configuration for SaaS / Self-hosted hybrid
 *
 * DEPLOY_MODE=saas    → Multi-tenant SaaS on Cloudflare
 * DEPLOY_MODE=self-hosted (default) → Single-tenant, existing behavior
 */

export type DeployMode = 'saas' | 'self-hosted';

export const DEPLOY_MODE: DeployMode =
  (process.env.DEPLOY_MODE as DeployMode) || 'self-hosted';

export function isSaaSMode(): boolean {
  return DEPLOY_MODE === 'saas';
}

/** SaaS base domain for subdomain extraction */
export const SAAS_BASE_DOMAIN = process.env.SAAS_BASE_DOMAIN || 'keystonehr.app';

