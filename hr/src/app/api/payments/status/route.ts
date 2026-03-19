import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-actions';
import { basePrismaClient } from '@/lib/prisma';
import { getTenantId } from '@/lib/tenant-context';

/**
 * GET /api/payments/status — Get current payment/subscription status
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 });
    }

    const tenantId = await getTenantId();

    // Get tenant info
    const tenant = await basePrismaClient.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      return NextResponse.json({ message: '테넌트 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    // If tenant has paid, return paid status
    if (tenant.paidAt) {
      // Get the latest successful payment
      const payments = await (basePrismaClient as any).$queryRaw(
        `SELECT orderId, plan, amount, method, receiptUrl, approvedAt
         FROM payments
         WHERE tenantId = ? AND status = 'SUCCESS'
         ORDER BY approvedAt DESC
         LIMIT 1`,
        tenantId
      ) as any[];

      const latestPayment = payments?.[0] || null;
      const paidAt = tenant.paidAt;
      const expiresAt = new Date(
        new Date(paidAt).getTime() + 10 * 365 * 24 * 60 * 60 * 1000
      ).toISOString();

      return NextResponse.json({
        status: 'active',
        plan: (tenant as any).plan,
        paidAt,
        expiresAt,
        payment: latestPayment,
      });
    }

    // Trial status
    const trialExpiresAt = (tenant as any).trialExpiresAt;
    if (trialExpiresAt) {
      const expiresDate = new Date(trialExpiresAt);
      const now = new Date();
      const daysRemaining = Math.max(
        0,
        Math.ceil((expiresDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      );

      return NextResponse.json({
        status: 'trial',
        plan: (tenant as any).plan,
        trialExpiresAt,
        daysRemaining,
      });
    }

    // No payment, no trial — suspended or unknown state
    return NextResponse.json({
      status: (tenant as any).status || 'unknown',
      plan: (tenant as any).plan,
    });
  } catch (error) {
    console.error('Payment status error:', error);
    return NextResponse.json(
      { message: '결제 상태 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
