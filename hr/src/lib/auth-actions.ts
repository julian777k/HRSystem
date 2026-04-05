import { cookies, headers } from 'next/headers';
import { COOKIE_NAME, verifyToken, type AuthUser } from './auth';
import { basePrismaClient } from './prisma';
import { getTenantIdSafe } from './tenant-context';
import { isSaaSMode } from './deploy-config';

export async function setAuthCookie(token: string) {
  const cookieStore = await cookies();
  // No domain set → host-only cookie (safe: company-a.keystonehr.app cookie NOT sent to company-b)
  // sameSite: 'strict' prevents cross-site request forgery in SaaS mode
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
  });
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const result = await verifyToken(token);
  if (!result) return null;

  // JWT tenantId cross-validation in SaaS mode
  if (isSaaSMode()) {
    const subdomainTenantId = await getTenantIdSafe();
    if (!subdomainTenantId || result.user.tenantId !== subdomainTenantId) {
      // Clear stale cookie so user can log in fresh on correct tenant
      await clearAuthCookie();
      console.warn(
        `[Auth] Cross-tenant mismatch — jwt.tenantId=${result.user.tenantId}, subdomain.tenantId=${subdomainTenantId}, userId=${result.user.id}`
      );
      return null;
    }
  }

  // Verify the employee still exists and is active (or on leave) in the database
  const employee = await basePrismaClient.employee.findFirst({
    where: { id: result.user.id, status: { in: ['ACTIVE', 'ON_LEAVE'] } },
    select: { id: true },
  });
  if (!employee) return null;

  return result.user;
}

/** getCurrentUser + 토큰 갱신 필요 여부 */
export async function getCurrentUserWithRefresh(): Promise<{ user: AuthUser; shouldRefresh: boolean } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const result = await verifyToken(token);
  if (!result) return null;

  // JWT tenantId cross-validation in SaaS mode
  if (isSaaSMode()) {
    const subdomainTenantId = await getTenantIdSafe();
    if (!subdomainTenantId || result.user.tenantId !== subdomainTenantId) {
      await clearAuthCookie();
      console.warn(
        `[Auth] Cross-tenant mismatch — jwt.tenantId=${result.user.tenantId}, subdomain.tenantId=${subdomainTenantId}, userId=${result.user.id}`
      );
      return null;
    }
  }

  const employee = await basePrismaClient.employee.findFirst({
    where: { id: result.user.id, status: { in: ['ACTIVE', 'ON_LEAVE'] } },
    select: { id: true },
  });
  if (!employee) return null;

  return result;
}
