'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface PaymentResult {
  success: boolean;
  loginUrl?: string;
  subdomain?: string;
  payment: {
    orderId: string;
    amount: number;
    plan: string;
    planName: string;
    method?: string;
    receiptUrl?: string;
    approvedAt: string;
    expiresAt: string;
  };
}

export default function PurchaseSuccessPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-[80vh] flex items-center justify-center p-4">
          <div className="text-center space-y-4">
            <svg className="animate-spin h-12 w-12 text-blue-600 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-gray-600 font-medium">로딩 중...</p>
          </div>
        </main>
      }
    >
      <PurchaseSuccessContent />
    </Suspense>
  );
}

function PurchaseSuccessContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const confirmedRef = useRef(false);

  useEffect(() => {
    if (confirmedRef.current) return;
    confirmedRef.current = true;

    const paymentKey = searchParams.get('paymentKey');
    const orderId = searchParams.get('orderId');
    const amount = searchParams.get('amount');

    if (!paymentKey || !orderId || !amount) {
      setStatus('error');
      setErrorMessage('결제 정보가 올바르지 않습니다.');
      return;
    }

    const confirmPayment = async () => {
      try {
        const res = await fetch('/api/payments/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentKey,
            orderId,
            amount: Number(amount),
          }),
        });

        const data = await res.json();

        if (res.ok && data.success) {
          setResult(data);
          setStatus('success');
        } else {
          setErrorMessage(data.message || '결제 승인에 실패했습니다.');
          setStatus('error');
        }
      } catch {
        setErrorMessage('서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.');
        setStatus('error');
      }
    };

    confirmPayment();
  }, [searchParams]);

  if (status === 'loading') {
    return (
      <main className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <svg className="animate-spin h-12 w-12 text-blue-600 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-gray-600 font-medium">결제를 확인하고 있습니다...</p>
          <p className="text-gray-400 text-sm">잠시만 기다려 주세요.</p>
        </div>
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-lg p-8 text-center space-y-5">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900">결제 승인에 실패했습니다</h2>
          <p className="text-gray-500 text-sm">{errorMessage}</p>
          <div className="flex flex-col gap-3 pt-2">
            <Link
              href="/purchase"
              className="block w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition text-center"
            >
              다시 시도
            </Link>
            <a
              href="https://docs.google.com/forms/d/e/1FAIpQLSfegtqPf6yW27R_nyK_lCxTC46cwT5lznY_QuHvMWiZuIwK9A/viewform"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-500 hover:text-blue-600 transition"
            >
              문제가 지속되면 문의하기
            </a>
          </div>
        </div>
      </main>
    );
  }

  const isNewAccount = !!result?.loginUrl;
  const payment = result?.payment;

  return (
    <main className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-lg p-8 text-center space-y-5">
        <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        {isNewAccount ? (
          <>
            <h2 className="text-xl font-bold text-gray-900">계정이 생성되었습니다</h2>
            <p className="text-gray-500 text-sm">
              결제가 완료되고 KeystoneHR 계정이 생성되었습니다.<br />
              아래 주소에서 로그인하여 바로 사용하실 수 있습니다.
            </p>
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold text-gray-900">결제가 완료되었습니다</h2>
            <p className="text-gray-500 text-sm">
              KeystoneHR을 구매해주셔서 감사합니다.
            </p>
          </>
        )}

        {payment && (
          <>
            <div className="bg-gray-50 rounded-xl p-4 text-sm text-left space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">상품명</span>
                <span className="font-medium text-gray-900">KeystoneHR {payment.planName} 플랜</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">결제 금액</span>
                <span className="font-bold text-blue-600">{payment.amount.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">주문번호</span>
                <span className="font-mono text-xs text-gray-700">{payment.orderId}</span>
              </div>
              {payment.approvedAt && (
                <div className="flex justify-between">
                  <span className="text-gray-500">승인 일시</span>
                  <span className="text-gray-700">
                    {new Date(payment.approvedAt).toLocaleString('ko-KR')}
                  </span>
                </div>
              )}
            </div>

            {isNewAccount && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-left space-y-1.5">
                <p className="font-medium text-blue-900">로그인 정보</p>
                <p className="text-blue-700">
                  가입 시 입력하신 이메일과 비밀번호로 로그인하세요.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-3 pt-2">
              {result?.loginUrl ? (
                <a
                  href={result.loginUrl}
                  className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition text-center flex items-center justify-center gap-2"
                >
                  로그인하러 가기
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </a>
              ) : result?.subdomain ? (
                <a
                  href={`https://${result.subdomain}.keystonehr.app/login`}
                  className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition text-center flex items-center justify-center gap-2"
                >
                  대시보드로 이동
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </a>
              ) : (
                <Link
                  href="/login"
                  className="block w-full py-3.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition text-center"
                >
                  로그인하러 가기
                </Link>
              )}
              <Link
                href="/"
                className="text-sm text-gray-500 hover:text-blue-600 transition"
              >
                홈으로 돌아가기
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
