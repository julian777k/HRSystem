import { NextRequest, NextResponse } from 'next/server';
import { basePrismaClient } from '@/lib/prisma';
import { confirmPayment, PLANS, type PlanKey } from '@/lib/toss';

/**
 * POST /api/payments/confirm — Confirm (approve) a Toss payment
 * Called after the client-side payment widget succeeds.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { paymentKey, orderId, amount } = body as {
      paymentKey: string;
      orderId: string;
      amount: number;
    };

    if (!paymentKey || !orderId || !amount) {
      return NextResponse.json(
        { message: '필수 파라미터가 누락되었습니다. (paymentKey, orderId, amount)' },
        { status: 400 }
      );
    }

    // Look up existing payment record
    const payments = await (basePrismaClient as any).$queryRaw(
      `SELECT id, tenantId, plan, amount, status FROM payments WHERE orderId = ?`,
      orderId
    ) as any[];

    if (!payments || payments.length === 0) {
      return NextResponse.json(
        { message: '결제 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const payment = payments[0];

    // Verify amount matches
    if (payment.amount !== amount) {
      return NextResponse.json(
        { message: '결제 금액이 일치하지 않습니다.' },
        { status: 400 }
      );
    }

    // Verify payment is still PENDING
    if (payment.status !== 'PENDING') {
      return NextResponse.json(
        { message: `이미 처리된 결제입니다. (상태: ${payment.status})` },
        { status: 409 }
      );
    }

    // Call Toss Payments confirm API
    const result = await confirmPayment(paymentKey, orderId, amount);
    const now = new Date().toISOString();

    if (!result.success) {
      // Update payment record as FAILED
      await (basePrismaClient as any).$executeRaw(
        `UPDATE payments SET status = 'FAILED', failureReason = ?, updatedAt = ? WHERE id = ?`,
        result.error?.message || '결제 승인 실패', now, payment.id
      );

      return NextResponse.json(
        {
          success: false,
          message: result.error?.message || '결제 승인에 실패했습니다.',
          code: result.error?.code,
        },
        { status: 400 }
      );
    }

    // Payment succeeded — extract useful data from Toss response
    const tossData = result.data;
    const method = tossData?.method || null;
    const receiptUrl = tossData?.receipt?.url || null;

    // Update payment record as SUCCESS
    await (basePrismaClient as any).$executeRaw(
      `UPDATE payments
       SET status = 'SUCCESS', paymentKey = ?, method = ?, receiptUrl = ?,
           approvedAt = ?, updatedAt = ?
       WHERE id = ?`,
      paymentKey, method, receiptUrl, now, now, payment.id
    );

    // Activate tenant — update plan, status, paidAt, maxEmployees
    const planKey = payment.plan as PlanKey;
    const planInfo = PLANS[planKey];
    // 10 years from now
    const expiresAt = new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString();

    await (basePrismaClient as any).$executeRaw(
      `UPDATE tenants
       SET status = 'active', plan = ?, maxEmployees = ?, paidAt = ?, updatedAt = ?
       WHERE id = ?`,
      planKey, planInfo.maxEmployees, now, now, payment.tenantId
    );

    return NextResponse.json({
      success: true,
      payment: {
        orderId,
        amount,
        plan: planKey,
        planName: planInfo.name,
        method,
        receiptUrl,
        approvedAt: now,
        expiresAt,
      },
    });
  } catch (error) {
    console.error('Payment confirm error:', error);
    return NextResponse.json(
      { message: '결제 승인 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
