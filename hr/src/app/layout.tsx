import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"] });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "HR SYSTEM - 인사관리 시스템",
  description: "사내 인사관리 시스템",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "HR SYSTEM",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={`${geist.className} antialiased`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
