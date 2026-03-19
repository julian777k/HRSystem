import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-actions';
import { basePrismaClient } from '@/lib/prisma';
import { getTenantId } from '@/lib/tenant-context';
import { generateOrderId, getTossClientKey, PLANS, type PlanKey } from '@/lib/toss';

/**
 * POST /api/payments/request — Create a payment request
 * Returns data needed by the Toss Payments SDK on the client side.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 });
    }

    // Only admins can initiate payments
    if (!['SYSTEM_ADMIN', 'COMPANY_ADMIN'].includes(user.role)) {
      return NextResponse.json({ message: '결제 권한이 없습니다.' }, { status: 403 });
    }

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
    const tenantId = await getTenantId();

    // Verify tenant exists
    const tenant = await basePrismaClient.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      return NextResponse.json({ message: '테넌트 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const orderId = generateOrderId();
    const now = new Date().toISOString();
    const paymentId = crypto.randomUUID();

    // Create payment record in DB
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
  } catch (error) {
    console.error('Payment request error:', error);
    return NextResponse.json(
      { message: '결제 요청 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
