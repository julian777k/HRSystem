'use client';
import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
function C() {
  const sp = useSearchParams();
  const [s, sS] = useState<'loading'|'ok'|'err'>('loading');
  const [m, sM] = useState('');
  const d = useRef(false);
  useEffect(() => {
    if (d.current) return; d.current = true;
    const pk=sp.get('paymentKey'), oi=sp.get('orderId'), am=sp.get('amount');
    if (!pk||!oi||!am) { sS('err'); sM('결제 정보 없음'); return; }
    fetch('/api/payments/confirm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({paymentKey:pk,orderId:oi,amount:Number(am)})})
      .then(async r=>{const d=await r.json();if(r.ok&&d.success)sS('ok');else throw new Error(d.message||'확인 실패');})
      .catch(e=>{sS('err');sM(e.message||'오류');});
  }, [sp]);
  if (s==='loading') return <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full"/></div>;
  if (s==='err') return <div className="max-w-md mx-auto py-20 text-center"><h1 className="text-xl font-bold mb-2">결제 확인 실패</h1><p className="text-gray-500 mb-6">{m}</p><a href="/billing" className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold">다시 시도</a></div>;
  return <div className="max-w-md mx-auto py-20 text-center"><h1 className="text-xl font-bold mb-2">결제 완료</h1><p className="text-gray-500 mb-6">플랜이 활성화되었습니다.</p><a href="/dashboard" className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold">대시보드</a></div>;
}
export default function P() { return <Suspense fallback={<div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full"/></div>}><C/></Suspense>; }
