'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function FailContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get('code') || '';
  const message = searchParams.get('message') || '결제가 완료되지 않았습니다.';

  return (
    <div className="max-w-md mx-auto py-20 text-center">
      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">결제 실패</h1>
      <p className="text-gray-500 mb-2">{message}</p>
      {code && <p className="text-xs text-gray-400 mb-8">에러 코드: {code}</p>}
      <a href="/billing" className="px-8 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition">
        다시 시도하기
      </a>
    </div>
  );
}

export default function SubdomainPurchaseFailPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>}>
      <FailContent />
    </Suspense>
  );
}
