'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
function C() {
  const sp = useSearchParams();
  const m = sp.get('message')||'결제가 완료되지 않았습니다.';
  return <div className="max-w-md mx-auto py-20 text-center"><h1 className="text-xl font-bold mb-2">결제 실패</h1><p className="text-gray-500 mb-6">{m}</p><a href="/billing" className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold">다시 시도</a></div>;
}
export default function P() { return <Suspense fallback={<div/>}><C/></Suspense>; }
