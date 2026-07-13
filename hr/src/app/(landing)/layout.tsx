import Image from 'next/image';

// 공개 데모 — 가입 없이 데모 테넌트로 자동 로그인된다
const DEMO_URL = 'https://demo.keystonehr.app/api/demo/login';

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white">
      {/* Header — 다크 히어로와 이어지도록 네이비로 고정 */}
      <header className="sticky top-0 bg-surface-navy/90 backdrop-blur-md z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <a href="/" className="flex items-center gap-2">
              <Image src="/logo.png" alt="KeystoneHR" width={32} height={32} className="w-8 h-8" />
              <span className="text-xl font-bold text-white">KeystoneHR</span>
            </a>
            <nav className="hidden sm:flex items-center gap-6">
              <a href="/#features" className="text-slate-300 hover:text-white text-sm font-medium transition">
                기능소개
              </a>
              <a href="/#pricing" className="text-slate-300 hover:text-white text-sm font-medium transition">
                요금제
              </a>
              <a href="/login" className="text-slate-300 hover:text-white text-sm font-medium transition">
                로그인
              </a>
              <a
                href={DEMO_URL}
                className="px-4 py-2 bg-white text-surface-navy rounded-full text-sm font-semibold hover:bg-slate-100 transition"
              >
                데모 체험
              </a>
            </nav>
            <div className="sm:hidden flex items-center gap-3">
              <a href="/login" className="text-slate-300 hover:text-white text-sm font-medium">
                로그인
              </a>
              <a
                href={DEMO_URL}
                className="px-3 py-1.5 bg-white text-surface-navy rounded-full text-sm font-semibold hover:bg-slate-100 transition"
              >
                데모
              </a>
            </div>
          </div>
        </div>
      </header>

      {children}

      {/* Footer */}
      <footer className="bg-gray-50 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col items-center gap-4">
            <div className="flex gap-6 text-sm text-gray-500">
              <a href="/privacy" className="hover:text-gray-700">개인정보처리방침</a>
              <a href="/terms" className="hover:text-gray-700">이용약관</a>
              <a href="https://docs.google.com/forms/d/e/1FAIpQLSfegtqPf6yW27R_nyK_lCxTC46cwT5lznY_QuHvMWiZuIwK9A/viewform" target="_blank" rel="noopener noreferrer" className="hover:text-gray-700">문의하기</a>
            </div>
            <div className="text-gray-400 text-xs leading-relaxed text-center">
              <p>상호: 어나니무명스 | 대표: 김영홍 | 사업자등록번호: 614-30-01348</p>
              <p>이메일: anonymoomyungs@gmail.com</p>
            </div>
            <div className="text-gray-400 text-xs">
              &copy; {new Date().getFullYear()} KeystoneHR. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
