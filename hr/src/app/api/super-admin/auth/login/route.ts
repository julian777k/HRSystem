import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword, hashPassword } from '@/lib/password';
import { basePrismaClient } from '@/lib/prisma';
import { signSuperAdminToken, SUPER_ADMIN_COOKIE } from '@/lib/super-admin-auth';
import { checkRateLimit } from '@/lib/rate-limit';

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
    data: { email, passwordHash, name, role: 'SUPER_ADMIN' },
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
    const rateLimitResult = checkRateLimit(`super-admin-login:${email}`, 5, 900 * 1000);
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

    if (!admin || !(await verifyPassword(password, admin.passwordHash))) {
      return NextResponse.json(
        { message: '이메일 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    const token = await signSuperAdminToken({
      id: admin.id,
      email: admin.email,
      name: admin.name,
    });

    const response = NextResponse.json({
      message: '로그인 성공',
      user: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
    });

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
