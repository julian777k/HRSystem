"use client";

import { useState } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Toaster } from "sonner";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen min-h-[100dvh] bg-gray-50 flex flex-col">
      <Header onMenuToggle={() => setSidebarOpen((v) => !v)} />
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
