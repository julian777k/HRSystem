'use client';

import { useState, useEffect } from 'react';
import Script from 'next/script';

declare global {
  interface Window {
    TossPayments: (clientKey: string) => {
      payment: (opts: { customerKey: string }) => {
        requestPayment: (params: {
          method: string;
          amount: { currency: string; value: number };
          orderId: string;
          orderName: string;
          successUrl: string;
          failUrl: string;
          customerEmail?: string;
          customerName?: string;
        }) => Promise<void>;
      };
    };
  }
}

type Plan = 'standard' | 'business';

export default function SubdomainPurchasePage() {
  const [selectedPlan, setSelectedPlan] = useState<Plan>('standard');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sdkReady, setSdkReady] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [checking, setChecking] = useState(true);

  const plans = {
    standard: { name: 'Standard', price: 490000, priceLabel: '49만원', desc: '50명 이하', maxEmployees: '50명' },
    business: { name: 'Business', price: 700000, priceLabel: '70만원', desc: '100명 이하', maxEmployees: '100명' },
  } as const;

  // Check current payment status
  useEffect(() => {
    fetch('/api/payments/status')
      .then((r) => r.json())
      .then((data) => setStatus(data))
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  const handlePayment = async () => {
    if (!sdkReady) {
      setError('결제 모듈을 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/payments/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: selectedPlan }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || '결제 요청에 실패했습니다.');
      }

      const { orderId, amount, orderName, clientKey, customerEmail, customerName } = await res.json();

      const tossPayments = window.TossPayments(clientKey);
      const payment = tossPayments.payment({ customerKey: 'ANONYMOUS' });

      await payment.requestPayment({
        method: 'CARD',
        amount: { currency: 'KRW', value: amount },
        orderId,
        orderName,
        successUrl: window.location.origin + '/billing/success',
        failUrl: window.location.origin + '/billing/fail',
        customerEmail,
        customerName,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : '결제 처리 중 오류가 발생했습니다.';
      if (message.includes('USER_CANCEL') || message.includes('사용자가 결제를 취소')) {
        setLoading(false);
        return;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Already paid
  if (status?.status === 'active' && status?.paidAt) {
    return (
      <div className="max-w-lg mx-auto py-20 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">이미 결제가 완료되었습니다</h1>
        <p className="text-gray-500 mb-2">플랜: {status.plan === 'business' ? 'Business' : 'Standard'}</p>
        <p className="text-gray-500 mb-8">결제일: {new Date(status.paidAt).toLocaleDateString('ko-KR')}</p>
        <a href="/dashboard" className="px-8 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition">
          대시보드로 이동
        </a>
      </div>
    );
  }

  return (
    <>
      <Script
        src="https://js.tosspayments.com/v2/standard"
        strategy="afterInteractive"
        onLoad={() => setSdkReady(true)}
      />

      <div className="max-w-3xl mx-auto py-10">
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">플랜 결제</h1>
          {status?.status === 'trial' && status?.daysRemaining != null && (
            <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-4 py-1.5 text-sm">
              <span className="text-amber-600 font-semibold">무료 체험 {status.daysRemaining}일 남음</span>
            </div>
          )}
        </div>

        {/* Plan Cards */}
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          {(Object.entries(plans) as [Plan, typeof plans[Plan]][]).map(([key, plan]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedPlan(key)}
              className={`p-6 rounded-xl text-left transition-all ${
                selectedPlan === key
                  ? 'border-2 border-blue-600 shadow-lg bg-blue-50/30'
                  : 'border-2 border-gray-200 hover:border-blue-300'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                {selectedPlan === key && (
                  <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>
              <p className="text-3xl font-bold text-gray-900 mb-1">
                {plan.price === 490000 ? '49' : '70'}<span className="text-lg">만원</span>
              </p>
              <p className="text-sm text-gray-500">{plan.desc} · 최대 {plan.maxEmployees} · 10년 사용</p>
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 text-center">{error}</div>
        )}

        <button
          onClick={handlePayment}
          disabled={loading}
          className="w-full py-4 bg-blue-600 text-white rounded-xl font-semibold text-lg hover:bg-blue-700 transition shadow-lg shadow-blue-600/25 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              결제 진행 중...
            </>
          ) : (
            <>{plans[selectedPlan].priceLabel} 결제하기</>
          )}
        </button>
        <p className="mt-4 text-xs text-gray-400 text-center">결제는 토스페이먼츠를 통해 안전하게 처리됩니다</p>
      </div>
    </>
  );
}
