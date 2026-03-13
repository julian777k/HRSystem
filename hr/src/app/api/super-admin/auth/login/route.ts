import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword, hashPassword } from '@/lib/password';
import { basePrismaClient } from '@/lib/prisma';
import { signSuperAdminToken, SUPER_ADMIN_COOKIE } from '@/lib/super-admin-auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { writeAuditLog } from '@/lib/audit-log';

const DEFAULT_SUPER_ADMIN_EMAIL = 'admin@admin.com';
const DEFAULT_SUPER_ADMIN_PASSWORD = 'admin1234';
const DEFAULT_SUPER_ADMIN_NAME = 'Super Admin';

/**
 * Ensure at least one super admin exists.
 * Uses SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD env vars when set,
 * otherwise falls back to built-in defaults.
 */
async function ensureSuperAdmin() {
  const count = await basePrismaClient.superAdmin.count();
  if (count > 0) return;

  const email = process.env.SUPER_ADMIN_EMAIL || DEFAULT_SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD || DEFAULT_SUPER_ADMIN_PASSWORD;
  const name = process.env.SUPER_ADMIN_NAME || DEFAULT_SUPER_ADMIN_NAME;

  const passwordHash = await hashPassword(password);
  await basePrismaClient.superAdmin.create({
    data: { email, passwordHash, name, role: 'SUPER_ADMIN', mustChangePassword: true },
  });
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { message: '이메일과 비밀번호를 입력해주세요.' },
        { status: 400 }
      );
    }

    // Rate limit: 5 attempts per email per 15 minutes
    const rateLimitResult = await checkRateLimit(`super-admin-login:${email}`, 5, 900 * 1000);
    if (!rateLimitResult.success) {
      const retrySeconds = Math.ceil((rateLimitResult.retryAfterMs || 0) / 1000);
      return NextResponse.json(
        { message: `로그인 시도가 너무 많습니다. ${retrySeconds}초 후 다시 시도해주세요.` },
        { status: 429 }
      );
    }

    // Auto-seed default super admin if none exists
    await ensureSuperAdmin();

    const admin = await basePrismaClient.superAdmin.findUnique({
      where: { email },
    });

    if (!admin) {
      return NextResponse.json(
        { message: '이메일 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    // Account lock check
    if (admin.lockedUntil) {
      const lockedUntil = new Date(admin.lockedUntil as unknown as string);
      if (lockedUntil > new Date()) {
        const remainingMs = lockedUntil.getTime() - Date.now();
        const remainingMin = Math.ceil(remainingMs / 60000);
        return NextResponse.json(
          { message: `계정이 잠겨 있습니다. ${remainingMin}분 후 다시 시도해주세요.` },
          { status: 423 }
        );
      }
    }

    const passwordValid = await verifyPassword(password, admin.passwordHash);
    if (!passwordValid) {
      // Increment failed login count
      const newCount = ((admin.failedLoginCount as number) || 0) + 1;
      const updateData: Record<string, unknown> = { failedLoginCount: newCount };

      // Lock account if too many failures
      if (newCount >= 10) {
        updateData.lockedUntil = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // 2 hours
      } else if (newCount >= 5) {
        updateData.lockedUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 minutes
      }

      await basePrismaClient.superAdmin.update({
        where: { id: admin.id },
        data: updateData,
      });

      return NextResponse.json(
        { message: '이메일 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    // Successful login: reset failed count, update lastLoginAt
    await basePrismaClient.superAdmin.update({
      where: { id: admin.id },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: new Date().toISOString(),
      },
    });

    const token = await signSuperAdminToken({
      id: admin.id,
      email: admin.email,
      name: admin.name,
    });

    const responseBody: Record<string, unknown> = {
      message: '로그인 성공',
      user: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
    };

    // Flag if password change required
    if (admin.mustChangePassword) {
      responseBody.mustChangePassword = true;
    }

    const response = NextResponse.json(responseBody);

    writeAuditLog({ action: 'SUPER_ADMIN_LOGIN', target: 'superAdmin', targetId: admin.id, ipAddress: request.headers.get('x-forwarded-for') || 'unknown' });

    response.cookies.set(SUPER_ADMIN_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return response;
  } catch (error) {
    console.error('Super admin login error:', error);
    return NextResponse.json(
      { message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
