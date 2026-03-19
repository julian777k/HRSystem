'use client';

import { useState, useEffect } from 'react';
import Script from 'next/script';

/* global TossPayments SDK — loaded via CDN script tag */
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

const ALL_FEATURES = [
  '직원 관리 (부서/직급/입퇴사)',
  '출퇴근 기록 및 근태 대시보드',
  '휴가 관리 (연차/반차/병가/경조사)',
  '연차 자동부여 (근로기준법 준수)',
  '다단계 결재 시스템',
  '연장근무 관리 및 보상시간 적립',
  '복지 관리 (항목 등록/신청/승인)',
  '웹훅 자동전송 (Slack/Teams/Kakao)',
  '공휴일 관리',
  '데이터 내보내기 (Excel/CSV)',
  '모바일 반응형 UI',
  '데이터 암호화 및 감사로그',
];

type Plan = 'standard' | 'business';

export default function PurchasePage() {
  const [selectedPlan, setSelectedPlan] = useState<Plan>('standard');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sdkReady, setSdkReady] = useState(false);

  const plans = {
    standard: { name: 'Standard', price: 490000, priceLabel: '49만원', desc: '50명 이하 중소기업', maxEmployees: '50명' },
    business: { name: 'Business', price: 700000, priceLabel: '70만원', desc: '100명 이하 중견기업', maxEmployees: '100명', badge: 'BEST' },
  } as const;

  const handlePayment = async () => {
    if (!sdkReady) {
      setError('결제 모듈을 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 1. Request payment info from backend
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

      // 2. Initialize Toss SDK and request payment
      const tossPayments = window.TossPayments(clientKey);
      const payment = tossPayments.payment({ customerKey: 'ANONYMOUS' });

      await payment.requestPayment({
        method: '카드',
        amount: { currency: 'KRW', value: amount },
        orderId,
        orderName,
        successUrl: window.location.origin + '/purchase/success',
        failUrl: window.location.origin + '/purchase/fail',
        customerEmail,
        customerName,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : '결제 처리 중 오류가 발생했습니다.';
      // Toss SDK cancellation or user close — don't show as error
      if (message.includes('USER_CANCEL') || message.includes('사용자가 결제를 취소')) {
        setLoading(false);
        return;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Script
        src="https://js.tosspayments.com/v2/standard"
        strategy="afterInteractive"
        onLoad={() => setSdkReady(true)}
      />

      <main className="py-12 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              KeystoneHR 구매하기
            </h1>
            <p className="text-gray-600 max-w-2xl mx-auto">
              추가 비용 없이, 모든 기능을 하나의 플랜으로. 1회 결제, 10년 사용.
            </p>
          </div>

          {/* Plan Cards */}
          <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-6 mb-10">
            {(Object.entries(plans) as [Plan, typeof plans[Plan]][]).map(([key, plan]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedPlan(key)}
                className={`p-8 rounded-2xl bg-white text-left relative overflow-hidden transition-all ${
                  selectedPlan === key
                    ? 'border-2 border-blue-600 shadow-xl ring-2 ring-blue-100'
                    : 'border-2 border-gray-200 shadow-lg hover:border-blue-400'
                }`}
              >
                {/* Selected indicator */}
                {selectedPlan === key && (
                  <div className="absolute top-4 right-4">
                    <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                )}

                {/* BEST badge */}
                {'badge' in plan && plan.badge && (
                  <div className="absolute top-0 left-0 bg-blue-600 text-white text-xs font-bold px-4 py-1.5 rounded-br-lg">
                    {plan.badge}
                  </div>
                )}

                <h3 className="text-2xl font-bold text-gray-900 mb-1">{plan.name}</h3>
                <p className="text-gray-500 text-sm mb-6">
                  {key === 'business' ? (
                    <><span className="text-red-500 font-bold">{plan.maxEmployees}</span> 이하 중견기업</>
                  ) : (
                    plan.desc
                  )}
                </p>

                <div className="mb-2">
                  <span className="text-4xl font-bold text-gray-900">
                    {plan.price === 490000 ? '49' : '70'}
                  </span>
                  <span className="text-xl font-bold text-gray-900">만원</span>
                </div>
                <p className="text-sm text-gray-400 mb-6">
                  1회 구매 · 10년 사용 · 최대{' '}
                  {key === 'business' ? (
                    <span className="text-red-500 font-semibold">{plan.maxEmployees}</span>
                  ) : (
                    plan.maxEmployees
                  )}
                </p>

                <div className="space-y-2.5">
                  {ALL_FEATURES.map((feature) => (
                    <div key={feature} className="flex items-start gap-2 text-sm text-gray-600">
                      <svg className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {feature}
                    </div>
                  ))}
                </div>
              </button>
            ))}
          </div>

          {/* Error message */}
          {error && (
            <div className="max-w-md mx-auto mb-6">
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 text-center">
                {error}
              </div>
            </div>
          )}

          {/* Payment button */}
          <div className="max-w-md mx-auto text-center">
            <button
              onClick={handlePayment}
              disabled={loading}
              className="w-full py-4 bg-blue-600 text-white rounded-xl font-semibold text-lg hover:bg-blue-700 transition shadow-lg shadow-blue-600/25 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  결제 진행 중...
                </>
              ) : (
                <>
                  {plans[selectedPlan].priceLabel} 결제하기
                </>
              )}
            </button>
            <p className="mt-4 text-xs text-gray-400">
              결제는 토스페이먼츠를 통해 안전하게 처리됩니다
            </p>
            <p className="mt-2 text-xs text-gray-400">
              구매 전{' '}
              <a href="/start" className="text-blue-600 hover:underline font-medium">7일 무료 체험</a>
              을 먼저 해보세요
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
