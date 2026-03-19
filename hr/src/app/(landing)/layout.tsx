import Image from 'next/image';

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur-sm z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <a href="/" className="flex items-center gap-2">
              <Image src="/logo.png" alt="KeystoneHR" width={32} height={32} className="w-8 h-8" />
              <span className="text-xl font-bold text-gray-900">KeystoneHR</span>
            </a>
            <nav className="hidden sm:flex items-center gap-6">
              <a href="/#features" className="text-gray-600 hover:text-gray-900 text-sm font-medium">
                기능소개
              </a>
              <a href="/#pricing" className="text-gray-600 hover:text-gray-900 text-sm font-medium">
                요금제
              </a>
              <a href="/login" className="text-gray-600 hover:text-gray-900 text-sm font-medium">
                로그인
              </a>
              <a
                href="/start"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition"
              >
                7일 무료 체험
              </a>
            </nav>
            <div className="sm:hidden flex items-center gap-3">
              <a href="/login" className="text-gray-600 hover:text-gray-900 text-sm font-medium">
                로그인
              </a>
              <a
                href="/start"
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition"
              >
                무료 체험
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
              <p>상호: KeystoneHR | 대표: 김영홍 | 사업자등록번호: 614-30-01348</p>
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
