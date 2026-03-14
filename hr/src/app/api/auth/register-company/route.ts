import { NextRequest, NextResponse } from 'next/server';
import { basePrismaClient } from '@/lib/prisma';
import { seedTenantData } from '@/lib/tenant-seed';
import { validatePasswordPolicy } from '@/lib/password';
import { checkRateLimit } from '@/lib/rate-limit';
import { SAAS_BASE_DOMAIN } from '@/lib/deploy-config';

const RESERVED_SUBDOMAINS = [
  'www', 'api', 'admin', 'super-admin', 'app', 'mail', 'ftp',
  'blog', 'help', 'support', 'status', 'demo', 'test', 'staging',
  'dev', 'cdn', 'static', 'assets', 'docs', 'kb',
];

const TRIAL_DAYS = 7;

/**
 * POST /api/auth/register-company — Self-service company registration (public)
 * Creates a new tenant with 7-day trial + admin account.
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limit: 3 company registrations per IP per hour
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const rateLimitResult = await checkRateLimit(`register-company:${ip}`, 3, 60 * 60 * 1000);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { message: '등록 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { companyName, subdomain, adminName, email, password, phone } = body;

    // Validate required fields
    if (!companyName || !subdomain || !adminName || !email || !password || !phone) {
      return NextResponse.json(
        { message: '모든 필수 항목을 입력해주세요.' },
        { status: 400 }
      );
    }

    // Validate password policy
    const pwError = validatePasswordPolicy(password);
    if (pwError) {
      return NextResponse.json({ message: pwError }, { status: 400 });
    }

    // Validate subdomain format
    const subdomainRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
    if (!subdomainRegex.test(subdomain) || subdomain.length < 2 || subdomain.length > 30) {
      return NextResponse.json(
        { message: '서브도메인은 2~30자, 영문 소문자/숫자/하이픈만 사용 가능합니다.' },
        { status: 400 }
      );
    }

    if (RESERVED_SUBDOMAINS.includes(subdomain)) {
      return NextResponse.json(
        { message: '사용할 수 없는 서브도메인입니다.' },
        { status: 400 }
      );
    }

    // Check subdomain uniqueness
    const existing = await basePrismaClient.tenant.findUnique({
      where: { subdomain },
    });
    if (existing) {
      return NextResponse.json(
        { message: '이미 사용 중인 서브도메인입니다. 다른 이름을 선택해주세요.' },
        { status: 409 }
      );
    }

    // Check email uniqueness across all tenants (owner email)
    const existingOwner = await basePrismaClient.tenant.findFirst({
      where: { ownerEmail: email },
    });
    if (existingOwner) {
      return NextResponse.json(
        { message: '이미 등록된 이메일입니다. 로그인해주세요.' },
        { status: 409 }
      );
    }

    // Create tenant with trial status
    const trialExpiresAt = new Date(Date.now() + TRIAL_DAYS * 86400000).toISOString();

    const tenant = await (basePrismaClient.tenant as any).create({
      data: {
        name: companyName,
        subdomain,
        plan: 'standard',
        ownerEmail: email,
        maxEmployees: 50,
        status: 'trial',
        trialExpiresAt,
      },
    });

    // Seed default data (positions, departments, leave types, admin account)
    await seedTenantData({
      tenantId: tenant.id,
      companyName,
      adminEmail: email,
      adminPassword: password,
      adminName,
    });

    const loginUrl = `${subdomain}.${SAAS_BASE_DOMAIN}`;

    return NextResponse.json(
      {
        message: '회사 등록이 완료되었습니다.',
        tenant: {
          name: companyName,
          subdomain,
          trialExpiresAt,
        },
        loginUrl,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Register company error:', error);
    return NextResponse.json(
      { message: '회사 등록 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
