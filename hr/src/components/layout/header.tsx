"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogOut, User, Menu, KeyRound } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";

interface HeaderProps {
  onMenuToggle?: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [companyName, setCompanyName] = useState("");
  const [hasLogo, setHasLogo] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // User menu state
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Password change modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    fetch("/api/setup/status").then((res) => res.ok ? res.json() : null)
      .then((statusData) => {
        if (statusData?.companyName) setCompanyName(statusData.companyName);
        if (statusData?.hasLogo) setHasLogo(true);
      }).catch(() => {});
  }, []);

  // Cleanup redirect timeout on unmount
  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) clearTimeout(redirectTimeoutRef.current);
    };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    router.replace("/login");
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (newPassword !== confirmPassword) {
      setPasswordError("새 비밀번호가 일치하지 않습니다.");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("비밀번호는 8자 이상이어야 합니다.");
      return;
    }

    setChangingPassword(true);

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();

      if (res.ok) {
        setPasswordSuccess("비밀번호가 변경되었습니다. 다시 로그인합니다.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        redirectTimeoutRef.current = setTimeout(() => {
          window.location.href = "/login";
        }, 2000);
      } else {
        setPasswordError(data.message || "비밀번호 변경에 실패했습니다.");
      }
    } catch {
      setPasswordError("서버에 연결할 수 없습니다.");
    } finally {
      setChangingPassword(false);
    }
  };

  const displayName = companyName || "KeystoneHR";

  return (
    <>
      <header className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-200 z-50 flex items-center justify-between px-3 sm:px-6">
        <div className="flex items-center gap-2 min-w-0">
          {/* 모바일 햄버거 메뉴 */}
          <button
            onClick={onMenuToggle}
            className="p-1.5 rounded-md hover:bg-gray-100 lg:hidden shrink-0"
            aria-label="메뉴 열기"
          >
            <Menu className="w-5 h-5 text-gray-600" aria-hidden="true" />
          </button>

          <Link
            href="/dashboard"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity min-w-0"
          >
            <Image
              src={hasLogo ? "/api/company/logo" : "/logo.png"}
              alt="KeystoneHR"
              width={32}
              height={32}
              unoptimized={hasLogo}
              className="w-7 h-7 sm:w-8 sm:h-8 shrink-0"
            />
            <span className="font-bold text-base sm:text-lg truncate max-w-[140px] sm:max-w-none">
              {displayName}
            </span>
            <span className="text-xs text-gray-400 hidden md:inline">
              KeystoneHR
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* User Menu */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-md px-2 py-1.5"
              aria-expanded={showUserMenu}
              aria-haspopup="true"
            >
              <User className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">
                {user ? `${user.name} (${user.positionName})` : "..."}
              </span>
              <span className="sm:hidden text-xs">
                {user ? user.name : "..."}
              </span>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1" role="menu">
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    setShowPasswordModal(true);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  role="menuitem"
                >
                  <KeyRound className="w-4 h-4" aria-hidden="true" />
                  비밀번호 변경
                </button>
                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  role="menuitem"
                >
                  <LogOut className="w-4 h-4" aria-hidden="true" />
                  로그아웃
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-label="비밀번호 변경"
        >
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              setShowPasswordModal(false);
              setPasswordError("");
              setPasswordSuccess("");
            }}
            onKeyDown={(e) => { if (e.key === 'Escape') setShowPasswordModal(false); }}
          />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-semibold mb-4">비밀번호 변경</h2>
            <form onSubmit={handleChangePassword} className="space-y-4">
              {passwordError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600" aria-live="polite">
                  {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-600" aria-live="polite">
                  {passwordSuccess}
                </div>
              )}
              <div className="space-y-2">
                <label htmlFor="current-password" className="text-sm font-medium text-gray-700">
                  현재 비밀번호
                </label>
                <input
                  id="current-password"
                  name="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  required
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="new-password" className="text-sm font-medium text-gray-700">
                  새 비밀번호
                </label>
                <input
                  id="new-password"
                  name="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="8자 이상"
                  autoComplete="new-password"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  required
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="confirm-password" className="text-sm font-medium text-gray-700">
                  새 비밀번호 확인
                </label>
                <input
                  id="confirm-password"
                  name="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  required
                />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setPasswordError("");
                    setPasswordSuccess("");
                    setCurrentPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                  }}
                >
                  취소
                </Button>
                <Button type="submit" disabled={changingPassword}>
                  {changingPassword ? "변경 중..." : "변경하기"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
