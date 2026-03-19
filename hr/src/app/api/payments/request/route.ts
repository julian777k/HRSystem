import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-actions';
import { basePrismaClient } from '@/lib/prisma';
import { getTenantId } from '@/lib/tenant-context';
import { generateOrderId, getTossClientKey, PLANS, type PlanKey } from '@/lib/toss';
import { hashPassword, validatePasswordPolicy } from '@/lib/password';

const RESERVED_SUBDOMAINS = [
  'www', 'api', 'admin', 'super-admin', 'app', 'mail', 'ftp',
  'blog', 'help', 'support', 'status', 'demo', 'test', 'staging',
  'dev', 'cdn', 'static', 'assets', 'docs', 'kb',
];

/**
 * POST /api/payments/request — Create a payment request
 * Supports TWO modes:
 *   1. Authenticated mode — logged-in admin upgrading their tenant
 *   2. Guest mode — new customer purchasing from landing page (no auth)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { plan } = body as { plan: string };

    // Validate plan
    if (!plan || !(plan in PLANS)) {
      return NextResponse.json(
        { message: '유효하지 않은 플랜입니다. (standard 또는 business)' },
        { status: 400 }
      );
    }

    const planKey = plan as PlanKey;
    const planInfo = PLANS[planKey];

    // ---------- Try authenticated mode first ----------
    let user: Awaited<ReturnType<typeof getCurrentUser>> = null;
    try {
      user = await getCurrentUser();
    } catch {
      // Not logged in — that's fine, use guest mode
    }

    if (user) {
      // ===== Authenticated mode =====
      if (!['SYSTEM_ADMIN', 'COMPANY_ADMIN'].includes(user.role)) {
        return NextResponse.json({ message: '결제 권한이 없습니다.' }, { status: 403 });
      }

      const tenantId = await getTenantId();
      const tenant = await basePrismaClient.tenant.findUnique({
        where: { id: tenantId },
      });
      if (!tenant) {
        return NextResponse.json({ message: '테넌트 정보를 찾을 수 없습니다.' }, { status: 404 });
      }

      const orderId = generateOrderId();
      const now = new Date().toISOString();
      const paymentId = crypto.randomUUID();

      await (basePrismaClient as any).$executeRaw(
        `INSERT INTO payments (id, tenantId, orderId, plan, amount, status, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?)`,
        paymentId, tenantId, orderId, planKey, planInfo.amount, now, now
      );

      return NextResponse.json({
        orderId,
        amount: planInfo.amount,
        orderName: `KeystoneHR ${planInfo.name} 플랜`,
        clientKey: getTossClientKey(),
        customerEmail: user.email,
        customerName: user.name,
      });
    }

    // ===== Guest mode — no auth required =====
    const { companyName, subdomain, adminName, adminEmail, adminPassword } = body as {
      companyName?: string;
      subdomain?: string;
      adminName?: string;
      adminEmail?: string;
      adminPassword?: string;
    };

    // Validate required fields
    if (!companyName?.trim()) {
      return NextResponse.json({ message: '회사명을 입력해주세요.' }, { status: 400 });
    }
    if (!subdomain?.trim()) {
      return NextResponse.json({ message: '서브도메인을 입력해주세요.' }, { status: 400 });
    }
    if (!adminName?.trim()) {
      return NextResponse.json({ message: '관리자 이름을 입력해주세요.' }, { status: 400 });
    }
    if (!adminEmail?.trim()) {
      return NextResponse.json({ message: '이메일을 입력해주세요.' }, { status: 400 });
    }
    if (!adminPassword) {
      return NextResponse.json({ message: '비밀번호를 입력해주세요.' }, { status: 400 });
    }

    // Validate subdomain format
    const subdomainClean = subdomain.trim().toLowerCase();
    const subdomainRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
    if (!subdomainRegex.test(subdomainClean) || subdomainClean.length < 2 || subdomainClean.length > 30) {
      return NextResponse.json(
        { message: '서브도메인은 2~30자, 영문 소문자/숫자/하이픈만 사용 가능합니다.' },
        { status: 400 }
      );
    }
    if (RESERVED_SUBDOMAINS.includes(subdomainClean)) {
      return NextResponse.json({ message: '사용할 수 없는 서브도메인입니다.' }, { status: 400 });
    }

    // Validate email format
    const emailClean = adminEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailClean)) {
      return NextResponse.json({ message: '올바른 이메일 형식을 입력해주세요.' }, { status: 400 });
    }

    // Validate password policy
    const pwError = validatePasswordPolicy(adminPassword);
    if (pwError) {
      return NextResponse.json({ message: pwError }, { status: 400 });
    }

    // Check subdomain uniqueness
    const existingTenant = await basePrismaClient.tenant.findUnique({
      where: { subdomain: subdomainClean },
    });
    if (existingTenant) {
      return NextResponse.json(
        { message: '이미 사용 중인 서브도메인입니다. 다른 이름을 선택해주세요.' },
        { status: 409 }
      );
    }

    // Check email uniqueness (ownerEmail in tenants table)
    const existingOwner = await basePrismaClient.tenant.findFirst({
      where: { ownerEmail: emailClean },
    });
    if (existingOwner) {
      return NextResponse.json(
        { message: '이미 등록된 이메일입니다. 로그인 후 결제해주세요.' },
        { status: 409 }
      );
    }

    // Hash password BEFORE storing (never store plaintext)
    const adminPasswordHash = await hashPassword(adminPassword);

    // Build guestData JSON
    const guestData = JSON.stringify({
      companyName: companyName.trim(),
      subdomain: subdomainClean,
      adminName: adminName.trim(),
      adminEmail: emailClean,
      adminPasswordHash,
    });

    const orderId = generateOrderId();
    const now = new Date().toISOString();
    const paymentId = crypto.randomUUID();

    // Create payment record with guestData (no tenantId)
    await (basePrismaClient as any).$executeRaw(
      `INSERT INTO payments (id, tenantId, orderId, plan, amount, status, guestData, createdAt, updatedAt)
       VALUES (?, NULL, ?, ?, ?, 'PENDING', ?, ?, ?)`,
      paymentId, orderId, planKey, planInfo.amount, guestData, now, now
    );

    return NextResponse.json({
      orderId,
      amount: planInfo.amount,
      orderName: `KeystoneHR ${planInfo.name} 플랜`,
      clientKey: getTossClientKey(),
      customerEmail: emailClean,
      customerName: adminName.trim(),
    });
  } catch (error) {
    console.error('Payment request error:', error);
    return NextResponse.json(
      { message: '결제 요청 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
