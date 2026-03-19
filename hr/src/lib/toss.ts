/**
 * Toss Payments integration utility
 * Uses plain fetch() — no npm packages (critical for CF Workers bundle size)
 */

const TOSS_API_URL = 'https://api.tosspayments.com/v1';

export function getTossSecretKey(): string {
  const key = process.env.TOSS_SECRET_KEY || process.env.test_secret_key;
  if (!key) throw new Error('TOSS_SECRET_KEY is not configured');
  return key.trim();
}

export function getTossClientKey(): string {
  const key = process.env.TOSS_CLIENT_KEY || process.env.test_client_key;
  if (!key) throw new Error('TOSS_CLIENT_KEY is not configured');
  return key.trim();
}

/** Toss Payments confirm API — Basic auth with base64(secretKey + ':') */
export async function confirmPayment(
  paymentKey: string,
  orderId: string,
  amount: number
): Promise<{ success: boolean; data?: any; error?: { code: string; message: string } }> {
  const secretKey = getTossSecretKey();
  // btoa is available in CF Workers & modern Node
  const authHeader = 'Basic ' + btoa(secretKey + ':');

  try {
    const res = await fetch(`${TOSS_API_URL}/payments/confirm`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });

    const data = await res.json();

    if (!res.ok) {
      return {
        success: false,
        error: {
          code: data.code || 'UNKNOWN_ERROR',
          message: data.message || '결제 승인에 실패했습니다.',
        },
      };
    }

    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : '네트워크 오류가 발생했습니다.',
      },
    };
  }
}

/** Generate unique order ID: KHR-{timestamp}-{random} */
export function generateOrderId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `KHR-${timestamp}-${random}`;
}

/** Plan definitions */
export const PLANS = {
  standard: {
    name: 'Standard',
    amount: 490000,
    maxEmployees: 50,
  },
  business: {
    name: 'Business',
    amount: 700000,
    maxEmployees: 100,
  },
} as const;

export type PlanKey = keyof typeof PLANS;
