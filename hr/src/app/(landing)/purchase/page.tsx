'use client';

import { useState, useEffect, useCallback } from 'react';
import Script from 'next/script';
import Link from 'next/link';

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

/** Convert company name to a subdomain suggestion (romanize Korean, lowercase, strip special chars) */
function suggestSubdomain(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[가-힣]+/g, '') // remove Korean chars (can't be in subdomain)
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30);
}

export default function PurchasePage() {
  const [selectedPlan, setSelectedPlan] = useState<Plan>('standard');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sdkReady, setSdkReady] = useState(false);

  // Guest registration fields
  const [companyName, setCompanyName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [subdomainTouched, setSubdomainTouched] = useState(false);
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Auto-suggest subdomain from company name
  useEffect(() => {
    if (!subdomainTouched && companyName) {
      setSubdomain(suggestSubdomain(companyName));
    }
  }, [companyName, subdomainTouched]);

  const plans = {
    standard: { name: 'Standard', price: 490000, priceLabel: '49만원', desc: '50명 이하 중소기업', maxEmployees: '50명' },
    business: { name: 'Business', price: 700000, priceLabel: '70만원', desc: '100명 이하 중견기업', maxEmployees: '100명', badge: 'BEST' },
  } as const;

  const validateForm = useCallback((): boolean => {
    const errors: Record<string, string> = {};

    if (!companyName.trim()) errors.companyName = '회사명을 입력해주세요.';
    if (!subdomain.trim()) {
      errors.subdomain = '서브도메인을 입력해주세요.';
    } else if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(subdomain) || subdomain.length < 2 || subdomain.length > 30) {
      errors.subdomain = '2~30자, 영문 소문자/숫자/하이픈만 사용 가능합니다.';
    }
    if (!adminName.trim()) errors.adminName = '관리자 이름을 입력해주세요.';
    if (!adminEmail.trim()) {
      errors.adminEmail = '이메일을 입력해주세요.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
      errors.adminEmail = '올바른 이메일 형식을 입력해주세요.';
    }
    if (!adminPassword) {
      errors.adminPassword = '비밀번호를 입력해주세요.';
    } else if (adminPassword.length < 8) {
      errors.adminPassword = '비밀번호는 8자 이상이어야 합니다.';
    } else if (!/\d/.test(adminPassword)) {
      errors.adminPassword = '비밀번호에 숫자가 1개 이상 포함되어야 합니다.';
    } else if (!/[!@#$%^&*(),.?":{}|<>]/.test(adminPassword)) {
      errors.adminPassword = '비밀번호에 특수문자가 1개 이상 포함되어야 합니다.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [companyName, subdomain, adminName, adminEmail, adminPassword]);

  const handlePayment = async () => {
    if (!sdkReady) {
      setError('결제 모듈을 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    // Validate guest form
    if (!validateForm()) return;

    setLoading(true);
    setError('');

    try {
      // 1. Request payment info from backend
      const res = await fetch('/api/payments/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: selectedPlan,
          companyName: companyName.trim(),
          subdomain: subdomain.trim(),
          adminName: adminName.trim(),
          adminEmail: adminEmail.trim(),
          adminPassword,
        }),
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

          {/* Company & Admin Info Form */}
          <div className="max-w-2xl mx-auto mb-10">
            <div className="bg-white border border-gray-200 rounded-2xl shadow-lg p-6 sm:p-8">
              <h2 className="text-lg font-bold text-gray-900 mb-1">회사 및 관리자 정보</h2>
              <p className="text-sm text-gray-500 mb-6">
                결제 완료 후 바로 사용할 수 있는 계정이 생성됩니다.
              </p>

              <div className="space-y-4">
                {/* Company Name */}
                <div>
                  <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-1">
                    회사명 <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="companyName"
                    type="text"
                    value={companyName}
                    onChange={(e) => {
                      setCompanyName(e.target.value);
                      setFieldErrors((prev) => ({ ...prev, companyName: '' }));
                    }}
                    placeholder="예: 주식회사 키스톤"
                    className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
                      fieldErrors.companyName ? 'border-red-400 bg-red-50' : 'border-gray-300'
                    }`}
                  />
                  {fieldErrors.companyName && (
                    <p className="mt-1 text-xs text-red-500">{fieldErrors.companyName}</p>
                  )}
                </div>

                {/* Subdomain */}
                <div>
                  <label htmlFor="subdomain" className="block text-sm font-medium text-gray-700 mb-1">
                    서브도메인 <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-0">
                    <input
                      id="subdomain"
                      type="text"
                      value={subdomain}
                      onChange={(e) => {
                        setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                        setSubdomainTouched(true);
                        setFieldErrors((prev) => ({ ...prev, subdomain: '' }));
                      }}
                      placeholder="my-company"
                      className={`flex-1 px-4 py-2.5 border rounded-l-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
                        fieldErrors.subdomain ? 'border-red-400 bg-red-50' : 'border-gray-300'
                      }`}
                    />
                    <span className="px-3 py-2.5 bg-gray-100 border border-l-0 border-gray-300 rounded-r-xl text-sm text-gray-500 whitespace-nowrap">
                      .keystonehr.app
                    </span>
                  </div>
                  {fieldErrors.subdomain ? (
                    <p className="mt-1 text-xs text-red-500">{fieldErrors.subdomain}</p>
                  ) : (
                    <p className="mt-1 text-xs text-gray-400">
                      영문 소문자, 숫자, 하이픈만 사용 가능 (2~30자)
                    </p>
                  )}
                </div>

                <div className="border-t border-gray-100 pt-4" />

                {/* Admin Name */}
                <div>
                  <label htmlFor="adminName" className="block text-sm font-medium text-gray-700 mb-1">
                    관리자 이름 <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="adminName"
                    type="text"
                    value={adminName}
                    onChange={(e) => {
                      setAdminName(e.target.value);
                      setFieldErrors((prev) => ({ ...prev, adminName: '' }));
                    }}
                    placeholder="홍길동"
                    className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
                      fieldErrors.adminName ? 'border-red-400 bg-red-50' : 'border-gray-300'
                    }`}
                  />
                  {fieldErrors.adminName && (
                    <p className="mt-1 text-xs text-red-500">{fieldErrors.adminName}</p>
                  )}
                </div>

                {/* Admin Email */}
                <div>
                  <label htmlFor="adminEmail" className="block text-sm font-medium text-gray-700 mb-1">
                    관리자 이메일 <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="adminEmail"
                    type="email"
                    value={adminEmail}
                    onChange={(e) => {
                      setAdminEmail(e.target.value);
                      setFieldErrors((prev) => ({ ...prev, adminEmail: '' }));
                    }}
                    placeholder="admin@company.com"
                    className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
                      fieldErrors.adminEmail ? 'border-red-400 bg-red-50' : 'border-gray-300'
                    }`}
                  />
                  {fieldErrors.adminEmail && (
                    <p className="mt-1 text-xs text-red-500">{fieldErrors.adminEmail}</p>
                  )}
                </div>

                {/* Admin Password */}
                <div>
                  <label htmlFor="adminPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    관리자 비밀번호 <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="adminPassword"
                      type={showPassword ? 'text' : 'password'}
                      value={adminPassword}
                      onChange={(e) => {
                        setAdminPassword(e.target.value);
                        setFieldErrors((prev) => ({ ...prev, adminPassword: '' }));
                      }}
                      placeholder="8자 이상, 숫자+특수문자 포함"
                      className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition pr-12 ${
                        fieldErrors.adminPassword ? 'border-red-400 bg-red-50' : 'border-gray-300'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {fieldErrors.adminPassword ? (
                    <p className="mt-1 text-xs text-red-500">{fieldErrors.adminPassword}</p>
                  ) : (
                    <p className="mt-1 text-xs text-gray-400">
                      8자 이상, 숫자 1개 이상, 특수문자 1개 이상
                    </p>
                  )}
                </div>
              </div>

              {/* Login link */}
              <div className="mt-5 pt-4 border-t border-gray-100 text-center">
                <p className="text-sm text-gray-500">
                  이미 계정이 있으신가요?{' '}
                  <Link href="/login" className="text-blue-600 hover:underline font-medium">
                    로그인 후 결제하기
                  </Link>
                </p>
              </div>
            </div>
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
