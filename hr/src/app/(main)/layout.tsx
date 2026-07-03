"use client";

import { useState } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/contexts/auth-context";

function TrialBanner() {
  const { tenantTrial } = useAuth();

  const daysLeft = (() => {
    if (!tenantTrial?.trialExpiresAt) return null;
    const expires = new Date(tenantTrial.trialExpiresAt);
    const now = new Date();
    const diff = Math.ceil((expires.getTime() - now.getTime()) / 86400000);
    return Math.max(0, diff);
  })();

  if (daysLeft === null) return null;

  const urgent = daysLeft <= 2;

  return (
    <div className={`lg:ml-60 px-4 py-2 text-center text-sm font-medium ${urgent ? 'bg-red-50 text-red-700 border-b border-red-200' : 'bg-amber-50 text-amber-700 border-b border-amber-200'}`}>
      {daysLeft === 0
        ? '체험 기간이 오늘 만료됩니다. 계속 사용하시려면 구매해주세요.'
        : `체험 기간이 ${daysLeft}일 남았습니다.`}
    </div>
  );
}

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <AuthProvider>
      <div className="min-h-[100dvh] bg-gray-50 flex flex-col">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-white focus:text-blue-600 focus:underline">
          본문으로 건너뛰기
        </a>
        <Header onMenuToggle={() => setSidebarOpen((v) => !v)} />
        <TrialBanner />
        <div className="flex flex-1">
          <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <main id="main-content" className="flex-1 px-3 py-4 sm:p-6 pt-16 sm:pt-20 lg:ml-60 pb-20 sm:pb-6">
            {children}
          </main>
        </div>
        <footer className="lg:ml-60 border-t border-gray-200 bg-white px-4 py-3 flex justify-center gap-4 text-xs text-gray-400">
          <Link href="/privacy" className="hover:text-gray-600 transition-colors">개인정보처리방침</Link>
          <span className="text-gray-300">·</span>
          <Link href="/terms" className="hover:text-gray-600 transition-colors">이용약관</Link>
          <span className="text-gray-300">·</span>
          <a href="https://docs.google.com/forms/d/e/1FAIpQLSfegtqPf6yW27R_nyK_lCxTC46cwT5lznY_QuHvMWiZuIwK9A/viewform" target="_blank" rel="noopener noreferrer" className="hover:text-gray-600 transition-colors">문의하기</a>
          <span className="text-gray-300">·</span>
          <Link href="/billing" className="text-blue-600 font-semibold hover:text-blue-700 transition-colors">결제하기</Link>
        </footer>
        <Toaster position="top-center" richColors closeButton />
      </div>
    </AuthProvider>
  );
}
