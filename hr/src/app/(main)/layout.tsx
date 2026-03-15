"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Toaster } from "sonner";

function TrialBanner() {
  const [daysLeft, setDaysLeft] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.tenantTrial?.trialExpiresAt) {
          const expires = new Date(data.tenantTrial.trialExpiresAt);
          const now = new Date();
          const diff = Math.ceil((expires.getTime() - now.getTime()) / 86400000);
          setDaysLeft(Math.max(0, diff));
        }
      })
      .catch(() => {});
  }, []);

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
    <div className="min-h-screen min-h-[100dvh] bg-gray-50 flex flex-col">
      <Header onMenuToggle={() => setSidebarOpen((v) => !v)} />
      <TrialBanner />
      <div className="flex flex-1">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 px-3 py-4 sm:p-6 pt-16 sm:pt-20 lg:ml-60 pb-20 sm:pb-6">
          {children}
        </main>
      </div>
      <footer className="lg:ml-60 border-t border-gray-200 bg-white px-4 py-3 flex justify-center gap-4 text-xs text-gray-400">
        <Link href="/privacy" className="hover:text-gray-600 transition-colors">개인정보처리방침</Link>
        <span className="text-gray-300">·</span>
        <Link href="/terms" className="hover:text-gray-600 transition-colors">이용약관</Link>
      </footer>
      <Toaster position="top-center" richColors closeButton />
    </div>
  );
}
