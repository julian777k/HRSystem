import Image from 'next/image';

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <a href="/" className="flex items-center gap-2">
              <Image src="/logo.png" alt="KeystoneHR" width={32} height={32} className="w-8 h-8" />
              <span className="text-xl font-bold text-gray-900">KeystoneHR</span>
            </a>
            <nav className="flex items-center gap-6">
              <a href="/privacy" className="text-gray-600 hover:text-gray-900 text-sm">
                개인정보처리방침
              </a>
              <a href="/terms" className="text-gray-600 hover:text-gray-900 text-sm">
                이용약관
              </a>
            </nav>
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
            </div>
            <div className="text-gray-500 text-sm">
              &copy; {new Date().getFullYear()} KeystoneHR. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
