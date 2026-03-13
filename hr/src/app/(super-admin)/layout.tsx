'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [checking, setChecking] = useState(true);
  const [adminName, setAdminName] = useState('');

  // Password change modal
  const [showPwModal, setShowPwModal] = useState(false);
  const [forcePwChange, setForcePwChange] = useState(false); // Can't dismiss
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  // Login page should not use the sidebar layout
  const isLoginPage = pathname === '/super-admin/login';

  useEffect(() => {
    if (isLoginPage) {
      setChecking(false);
      return;
    }

    // Check authentication by looking for the cookie via a lightweight API call
    fetch('/api/super-admin/stats', { method: 'GET', credentials: 'include' })
      .then((res) => {
        if (res.status === 401) {
          router.replace('/super-admin/login');
          return null;
        }
        if (res.ok) return res.json();
        setChecking(false);
        return null;
      })
      .then((data) => {
        if (!data) return;
        setChecking(false);
        if (data.mustChangePassword) {
          setForcePwChange(true);
          setShowPwModal(true);
        }
      })
      .catch(() => {
        router.replace('/super-admin/login');
      });
  }, [isLoginPage, router]);

  useEffect(() => {
    // Try to get admin name from cookie-stored info
    const stored = typeof window !== 'undefined' ? localStorage.getItem('super_admin_name') : null;
    if (stored) setAdminName(stored);
  }, []);

  const handleLogout = async () => {
    // Clear the cookie by setting it expired
    document.cookie = 'super_admin_token=; path=/; max-age=0';
    localStorage.removeItem('super_admin_name');
    router.replace('/super-admin/login');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');

    if (pwNew !== pwConfirm) {
      setPwError('새 비밀번호가 일치하지 않습니다.');
      return;
    }
    if (pwNew.length < 8) {
      setPwError('비밀번호는 8자 이상이어야 합니다.');
      return;
    }

    setPwLoading(true);
    try {
      const res = await fetch('/api/super-admin/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: pwCurrent, newPassword: pwNew }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        setPwError(data.message || '비밀번호 변경에 실패했습니다.');
        return;
      }
      setPwSuccess('비밀번호가 변경되었습니다. 다시 로그인해주세요.');
      setTimeout(() => {
        document.cookie = 'super_admin_token=; path=/; max-age=0';
        router.replace('/super-admin/login');
      }, 2000);
    } catch {
      setPwError('서버에 연결할 수 없습니다.');
    } finally {
      setPwLoading(false);
    }
  };

  const closePwModal = () => {
    setShowPwModal(false);
    setPwCurrent('');
    setPwNew('');
    setPwConfirm('');
    setPwError('');
    setPwSuccess('');
  };

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
          <div className="text-gray-500 text-sm">인증 확인 중...</div>
        </div>
      </div>
    );
  }

  const navItems = [
    { href: '/super-admin/dashboard', label: '대시보드', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { href: '/super-admin/tenants', label: '테넌트 관리', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-slate-900 text-white transform transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-slate-700">
          <h1 className="text-lg font-bold tracking-tight">Super Admin</h1>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="mt-6 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                </svg>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-700">
          {adminName && (
            <div className="text-xs text-slate-400 mb-2 truncate">{adminName}</div>
          )}
          <button
            onClick={() => setShowPwModal(true)}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
            </svg>
            비밀번호 변경
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            로그아웃
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:ml-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200 h-16 flex items-center px-4 lg:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden mr-4 text-gray-600 hover:text-gray-900"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="text-sm text-gray-500">KeystoneHR Management Console</div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6">{children}</main>
      </div>

      {/* Password Change Modal */}
      {showPwModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">비밀번호 변경</h3>

            {forcePwChange && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm font-medium text-amber-800">초기 비밀번호를 변경해주세요.</p>
                <p className="text-xs text-amber-600 mt-1">보안을 위해 비밀번호를 변경한 후 서비스를 이용할 수 있습니다.</p>
              </div>
            )}

            {pwError && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {pwError}
              </div>
            )}
            {pwSuccess && (
              <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                {pwSuccess}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">현재 비밀번호</label>
                <input
                  type="password"
                  value={pwCurrent}
                  onChange={(e) => setPwCurrent(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">새 비밀번호</label>
                <input
                  type="password"
                  value={pwNew}
                  onChange={(e) => setPwNew(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none"
                  placeholder="8자 이상, 숫자+특수문자 포함"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">새 비밀번호 확인</label>
                <input
                  type="password"
                  value={pwConfirm}
                  onChange={(e) => setPwConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                {!forcePwChange && (
                  <button
                    type="button"
                    onClick={closePwModal}
                    className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    취소
                  </button>
                )}
                <button
                  type="submit"
                  disabled={pwLoading}
                  className="flex-1 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
                >
                  {pwLoading ? '변경 중...' : '변경'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
