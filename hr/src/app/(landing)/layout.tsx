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
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">K</span>
              </div>
              <span className="text-xl font-bold text-gray-900">KeystoneHR</span>
            </div>
            <nav className="flex items-center gap-6">
              <a href="#features" className="text-gray-600 hover:text-gray-900 text-sm">
                기능
              </a>
              <a href="#pricing" className="text-gray-600 hover:text-gray-900 text-sm">
                요금제
              </a>
              <a
                href="/login"
                className="text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                로그인
              </a>
              <a
                href="/register"
                className="text-sm font-medium px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                무료 시작
              </a>
            </nav>
          </div>
        </div>
      </header>

      {children}

      {/* Footer */}
      <footer className="bg-gray-50 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-500 text-sm">
            &copy; {new Date().getFullYear()} KeystoneHR. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
