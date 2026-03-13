import { cookies } from 'next/headers';
import { COOKIE_NAME, verifyToken, type AuthUser } from './auth';
import { basePrismaClient } from './prisma';
import { getTenantIdSafe } from './tenant-context';
import { isSaaSMode } from './deploy-config';

export async function setAuthCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
  });
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
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
    if (subdomainTenantId && result.user.tenantId !== subdomainTenantId) {
      return null; // JWT tenant doesn't match subdomain tenant
    }
  }

  // Verify the employee still exists and is active in the database
  const employee = await basePrismaClient.employee.findFirst({
    where: { id: result.user.id, status: 'ACTIVE' },
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
    if (subdomainTenantId && result.user.tenantId !== subdomainTenantId) {
      return null; // JWT tenant doesn't match subdomain tenant
    }
  }

  const employee = await basePrismaClient.employee.findFirst({
    where: { id: result.user.id, status: 'ACTIVE' },
    select: { id: true },
  });
  if (!employee) return null;

  return result;
}
