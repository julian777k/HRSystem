"use client";

import { useState } from "react";
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
    <div className="min-h-screen min-h-[100dvh] bg-gray-50">
      <Header onMenuToggle={() => setSidebarOpen((v) => !v)} />
      <div className="flex">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 px-3 py-4 sm:p-6 pt-16 sm:pt-20 lg:ml-60 pb-20 sm:pb-6">
          {children}
        </main>
      </div>
      <Toaster position="top-center" richColors closeButton />
    </div>
  );
}
