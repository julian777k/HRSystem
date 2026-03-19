import { cookies, headers } from 'next/headers';
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
    if (!subdomainTenantId || result.user.tenantId !== subdomainTenantId) {
      return null; // No tenant (suspended/invalid) or tenant mismatch
    }
  }

  // Verify the employee still exists and is active (or on leave) in the database
  const employee = await basePrismaClient.employee.findFirst({
    where: { id: result.user.id, status: { in: ['ACTIVE', 'ON_LEAVE'] } },
    select: { id: true },
  });
  if (!employee) return null;

  // Session IP consistency check (monitoring only — not blocking, as mobile users change IPs)
  try {
    const hdrs = await headers();
    const currentIp = hdrs.get('cf-connecting-ip') || hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const session = await basePrismaClient.session.findFirst({
      where: { employeeId: result.user.id, token },
      select: { ipAddress: true },
    });
    if (session?.ipAddress && session.ipAddress !== 'unknown' && currentIp !== 'unknown' && session.ipAddress !== currentIp) {
      console.warn(`[Auth] Session IP mismatch — userId=${result.user.id}, session=${session.ipAddress}, current=${currentIp}`);
    }
  } catch {
    // Non-critical: don't block auth if IP check fails
  }

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
      return null; // No tenant (suspended/invalid) or tenant mismatch
    }
  }

  const employee = await basePrismaClient.employee.findFirst({
    where: { id: result.user.id, status: { in: ['ACTIVE', 'ON_LEAVE'] } },
    select: { id: true },
  });
  if (!employee) return null;

  // Session IP consistency check (monitoring only — not blocking, as mobile users change IPs)
  try {
    const hdrs = await headers();
    const currentIp = hdrs.get('cf-connecting-ip') || hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const session = await basePrismaClient.session.findFirst({
      where: { employeeId: result.user.id, token },
      select: { ipAddress: true },
    });
    if (session?.ipAddress && session.ipAddress !== 'unknown' && currentIp !== 'unknown' && session.ipAddress !== currentIp) {
      console.warn(`[Auth] Session IP mismatch — userId=${result.user.id}, session=${session.ipAddress}, current=${currentIp}`);
    }
  } catch {
    // Non-critical: don't block auth if IP check fails
  }

  return result;
}
