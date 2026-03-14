import { NextRequest, NextResponse } from 'next/server';
import { basePrismaClient } from '@/lib/prisma';
import { verifySuperAdmin, requirePasswordChanged } from '@/lib/super-admin-auth';
import { seedTenantData } from '@/lib/tenant-seed';
import { containsFilter } from '@/lib/db-utils';

export async function GET(request: NextRequest) {
  try {
    const admin = await verifySuperAdmin(request);
    if (!admin) {
      return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 });
    }
    const pwBlock = requirePasswordChanged(admin);
    if (pwBlock) return pwBlock;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const plan = searchParams.get('plan') || '';

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { name: containsFilter(search) },
        { subdomain: containsFilter(search) },
        { ownerEmail: containsFilter(search) },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (plan) {
      where.plan = plan;
    }

    const [tenants, total] = await Promise.all([
      basePrismaClient.tenant.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      basePrismaClient.tenant.count({ where }),
    ]);

    // Get employee counts for each tenant
    const tenantIds = tenants.map((t: { id: string }) => t.id);
    const employeeCounts = await basePrismaClient.employee.groupBy({
      by: ['tenantId'],
      where: {
        tenantId: { in: tenantIds },
        status: 'ACTIVE',
      },
      _count: { id: true },
    });

    const countMap = new Map(
      employeeCounts.map((ec: { tenantId: string; _count: { id: number } }) => [ec.tenantId, ec._count.id])
    );

    const tenantsWithCounts = tenants.map((t: { id: string }) => ({
      ...t,
      employeeCount: countMap.get(t.id) || 0,
    }));

    return NextResponse.json({
      tenants: tenantsWithCounts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('List tenants error:', error);
    return NextResponse.json(
      { message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await verifySuperAdmin(request);
    if (!admin) {
      return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 });
    }
    const pwBlock2 = requirePasswordChanged(admin);
    if (pwBlock2) return pwBlock2;

    const { name, subdomain, plan, ownerEmail, bizNumber, maxEmployees, adminPassword, adminName, status: initialStatus, trialExpiresAt } = await request.json();

    if (!name || !subdomain || !ownerEmail || !adminPassword) {
      return NextResponse.json(
        { message: '회사명, 서브도메인, 관리자 이메일, 관리자 비밀번호는 필수입니다.' },
        { status: 400 }
      );
    }

    if (adminPassword.length < 8) {
      return NextResponse.json(
        { message: '비밀번호는 8자 이상이어야 합니다.' },
        { status: 400 }
      );
    }

    // Validate subdomain format
    const subdomainRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
    if (!subdomainRegex.test(subdomain)) {
      return NextResponse.json(
        { message: '서브도메인은 영문 소문자, 숫자, 하이픈만 사용 가능합니다.' },
        { status: 400 }
      );
    }

    // Reserved subdomains
    const reserved = ['www', 'api', 'admin', 'super-admin', 'app', 'mail', 'ftp', 'blog', 'help', 'support', 'status'];
    if (reserved.includes(subdomain)) {
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
        { message: '이미 사용 중인 서브도메인입니다.' },
        { status: 409 }
      );
    }

    const tenantData: Record<string, unknown> = {
      name,
      subdomain,
      plan: plan || 'standard',
      ownerEmail,
      bizNumber: bizNumber || null,
      maxEmployees: maxEmployees || 50,
      status: initialStatus || 'active',
    };

    // Set trial expiry
    if (initialStatus === 'trial') {
      tenantData.trialExpiresAt = trialExpiresAt
        ? new Date(trialExpiresAt).toISOString()
        : new Date(Date.now() + 7 * 86400000).toISOString(); // default 7 days
    }

    const tenant = await (basePrismaClient.tenant as any).create({
      data: tenantData,
    });

    // Seed default data (positions, departments, leave types, admin account, etc.)
    await seedTenantData({
      tenantId: tenant.id,
      companyName: name,
      adminEmail: ownerEmail,
      adminPassword,
      adminName: adminName || '관리자',
    });

    return NextResponse.json({ tenant }, { status: 201 });
  } catch (error) {
    console.error('Create tenant error:', error);
    return NextResponse.json(
      { message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
