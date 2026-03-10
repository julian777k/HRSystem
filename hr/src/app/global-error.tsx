'use client';
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="ko">
      <body>
        <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f9fafb' }}>
          <div style={{ textAlign:'center' }}>
            <h1 style={{ fontSize:'3rem', fontWeight:'bold', color:'#d1d5db', marginBottom:'8px' }}>500</h1>
            <p style={{ color:'#6b7280', marginBottom:'24px' }}>서버 오류가 발생했습니다</p>
            <button onClick={reset} style={{ padding:'8px 16px', background:'#2563eb', color:'white', borderRadius:'8px', border:'none', cursor:'pointer', fontSize:'14px' }}>
              다시 시도
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
