'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function PurchaseFailPage() {
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
      <PurchaseFailContent />
    </Suspense>
  );
}

function PurchaseFailContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get('code') || 'UNKNOWN_ERROR';
  const message = searchParams.get('message') || '결제 처리 중 문제가 발생했습니다.';

  return (
    <main className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-8 text-center space-y-5">
          {/* Error icon */}
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>

          <h2 className="text-xl font-bold text-gray-900">결제에 실패했습니다</h2>
          <p className="text-gray-500 text-sm">{message}</p>

          {/* Error details */}
          <div className="bg-gray-50 rounded-xl p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">오류 코드</span>
              <span className="font-mono text-xs text-gray-600">{code}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3 pt-2">
            <Link
              href="/purchase"
              className="block w-full py-3.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition text-center"
            >
              다시 시도하기
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
      </div>
    </main>
  );
}
