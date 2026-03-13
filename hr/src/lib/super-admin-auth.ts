import { NextRequest, NextResponse } from 'next/server';
import { SignJWT, jwtVerify } from 'jose';
import { basePrismaClient } from '@/lib/prisma';
import { isSaaSMode } from '@/lib/deploy-config';

export const SUPER_ADMIN_COOKIE = 'super_admin_token';

function getSuperAdminJwtSecret(): Uint8Array {
  if (isSaaSMode()) {
    // In SaaS mode, super admin MUST have a separate JWT secret
    const secret = process.env.SUPER_ADMIN_JWT_SECRET;
    if (!secret) {
      throw new Error('SUPER_ADMIN_JWT_SECRET 환경변수가 SaaS 모드에서는 필수입니다.');
    }
    return new TextEncoder().encode(secret);
  }
  // Self-hosted: use separate secret if available, derive from base secret otherwise
  const superAdminSecret = process.env.SUPER_ADMIN_JWT_SECRET;
  if (superAdminSecret) {
    return new TextEncoder().encode(superAdminSecret);
  }
  const baseSecret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
  if (!baseSecret) {
    throw new Error('JWT_SECRET 또는 NEXTAUTH_SECRET 환경변수가 설정되지 않았습니다.');
  }
  return new TextEncoder().encode(baseSecret + '_super_admin');
}

export interface SuperAdminUser {
  id: string;
  email: string;
  name: string;
  mustChangePassword?: boolean;
}

export async function verifySuperAdmin(request: NextRequest): Promise<SuperAdminUser | null> {
  const token = request.cookies.get(SUPER_ADMIN_COOKIE)?.value;
  if (!token) return null;
  try {
    const secret = getSuperAdminJwtSecret();
    const { payload } = await jwtVerify(token, secret);
    if (payload.role !== 'SUPER_ADMIN') return null;

    // Verify the super admin still exists in the database
    const admin = await basePrismaClient.superAdmin.findUnique({
      where: { id: payload.sub! },
    });
    if (!admin) return null;

    return {
      id: payload.sub!,
      email: payload.email as string,
      name: payload.name as string,
      mustChangePassword: !!(admin as Record<string, unknown>).mustChangePassword,
    };
  } catch {
    return null;
  }
}

/**
 * Helper: returns a 403 response if the super admin must change their password.
 * Use this in all super admin API routes except login and change-password.
 */
export function requirePasswordChanged(admin: SuperAdminUser): NextResponse | null {
  if (admin.mustChangePassword) {
    return NextResponse.json(
      { message: '비밀번호를 먼저 변경해야 합니다.', mustChangePassword: true },
      { status: 403 }
    );
  }
  return null;
}

export async function signSuperAdminToken(admin: { id: string; email: string; name: string }): Promise<string> {
  const secret = getSuperAdminJwtSecret();
  return new SignJWT({
    email: admin.email,
    name: admin.name,
    role: 'SUPER_ADMIN',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(admin.id)
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(secret);
}
