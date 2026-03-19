'use client';
import { useState, useEffect } from 'react';
import Script from 'next/script';
type P = 'standard' | 'business';
const D = {standard:{n:'Standard',p:490000,l:'49만원',m:'50명'},business:{n:'Business',p:700000,l:'70만원',m:'100명'}};
export default function B() {
  const [p, sP] = useState<P>('standard');
  const [l, sL] = useState(false);
  const [e, sE] = useState('');
  const [r, sR] = useState(false);
  const [s, sS] = useState<any>(null);
  useEffect(() => { fetch('/api/payments/status').then(r=>r.json()).then(sS).catch(()=>{}); }, []);
  if (s?.status==='active'&&s?.paidAt) return (
    <div className="max-w-md mx-auto py-20 text-center">
      <h1 className="text-2xl font-bold mb-2">결제 완료</h1>
      <p className="text-gray-500">플랜: {s.plan==='business'?'Business':'Standard'} · {new Date(s.paidAt).toLocaleDateString('ko-KR')}</p>
      <a href="/dashboard" className="mt-6 inline-block px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold">대시보드</a>
    </div>
  );
  const pay = async () => {
    if (!r) { sE('결제 모듈 로딩 중'); return; }
    sL(true); sE('');
    try {
      const res = await fetch('/api/payments/request', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({plan:p}) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      const d = await res.json();
      await window.TossPayments(d.clientKey).payment({customerKey:'ANONYMOUS'}).requestPayment({
        method:'CARD', amount:{currency:'KRW',value:d.amount}, orderId:d.orderId, orderName:d.orderName,
        successUrl:location.origin+'/billing/success', failUrl:location.origin+'/billing/fail',
        customerEmail:d.customerEmail, customerName:d.customerName,
      });
    } catch(err:any) {
      if (err?.message?.includes('USER_CANCEL')) { sL(false); return; }
      sE(err?.message||'오류 발생');
    } finally { sL(false); }
  };
  return (<>
    <Script src="https://js.tosspayments.com/v2/standard" strategy="afterInteractive" onLoad={()=>sR(true)} />
    <div className="max-w-2xl mx-auto py-10">
      <h1 className="text-2xl font-bold mb-1">플랜 결제</h1>
      {s?.daysRemaining!=null&&<p className="text-amber-600 text-sm font-semibold mb-4">무료 체험 {s.daysRemaining}일 남음</p>}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {(['standard','business'] as P[]).map(k=>(
          <button key={k} onClick={()=>sP(k)} className={`p-5 rounded-xl text-left border-2 ${p===k?'border-blue-600 bg-blue-50/30':'border-gray-200'}`}>
            <p className="font-bold text-lg">{D[k].n}</p><p className="text-2xl font-bold mt-1">{D[k].l}</p><p className="text-sm text-gray-500">최대 {D[k].m} · 10년</p>
          </button>))}
      </div>
      {e&&<p className="text-red-600 text-sm mb-4 text-center">{e}</p>}
      <button onClick={pay} disabled={l} className="w-full py-4 bg-blue-600 text-white rounded-xl font-semibold text-lg disabled:opacity-60">
        {l?'결제 진행 중...':D[p].l+' 결제하기'}
      </button>
    </div>
  </>);
}
