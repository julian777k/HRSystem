"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, LogIn, AlertCircle, Building2 } from "lucide-react";
import Image from "next/image";
import { Toaster, toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRootDomain, setIsRootDomain] = useState(false);
  const [domainChecked, setDomainChecked] = useState(false);
  const [subdomainInput, setSubdomainInput] = useState("");

  // Check if we're on the SaaS root domain (no subdomain, no tenant context)
  useEffect(() => {
    const hostname = window.location.hostname;
    const isSaasRoot =
      hostname === 'keystonehr.app' ||
      hostname === 'www.keystonehr.app';
    setIsRootDomain(isSaasRoot);
    setDomainChecked(true);
  }, []);

  // 시스템 초기 설정이 완료되지 않았으면 설정 페이지로 이동 (서브도메인 전용)
  useEffect(() => {
    if (!domainChecked || isRootDomain) return;
    fetch("/api/setup/status")
      .then((res) => res.json())
      .then((data) => {
        if (!data.isComplete) {
          router.replace("/setup");
        }
      })
      .catch(() => {});
  }, [router, domainChecked, isRootDomain]);

  // 이미 로그인된 사용자는 대시보드로 리다이렉트 (서브도메인 전용)
  useEffect(() => {
    if (!domainChecked || isRootDomain) return;
    fetch("/api/auth/me")
      .then((res) => {
        if (res.ok) {
          router.replace("/dashboard");
        }
      })
      .catch(() => {});
  }, [router, domainChecked, isRootDomain]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("로그인 성공! 이동 중...");
        const isAdmin = ['SYSTEM_ADMIN', 'COMPANY_ADMIN'].includes(data.user?.role);
        router.replace(isAdmin ? '/admin' : '/dashboard');
      } else {
        const msg = data.message || "로그인에 실패했습니다.";
        setError(msg);
        toast.error(msg);
      }
    } catch {
      const msg = "서버에 연결할 수 없습니다.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Hydration 전에는 로딩 표시 (SSR에서 isRootDomain을 알 수 없으므로)
  if (!domainChecked) {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-2 px-4 sm:px-6">
            <Image src="/logo.png" alt="KeystoneHR" width={48} height={48} className="mx-auto w-12 h-12 mb-2" />
            <CardTitle className="text-xl sm:text-2xl font-bold">KeystoneHR</CardTitle>
            <CardDescription>로딩 중...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <Toaster position="top-center" richColors closeButton />
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2 px-4 sm:px-6">
          <Image src="/logo.png" alt="KeystoneHR" width={48} height={48} className="mx-auto w-12 h-12 mb-2" />
          <CardTitle className="text-xl sm:text-2xl font-bold">KeystoneHR</CardTitle>
          <CardDescription>인사관리 시스템에 로그인하세요</CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          {isRootDomain ? (
            /* SaaS 루트 도메인: 로그인 폼 숨기고 서브도메인 안내만 표시 */
            <div className="space-y-5">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2.5 mb-3">
                  <Building2 className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">회사 전용 주소에서 로그인하세요</p>
                    <p className="text-xs text-blue-700 mt-1">
                      각 회사는 고유한 서브도메인을 통해 접속합니다.
                      <br />
                      예: <span className="font-mono font-medium">회사명.keystonehr.app</span>
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 flex items-center">
                    <input
                      type="text"
                      value={subdomainInput}
                      onChange={(e) => setSubdomainInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      placeholder="회사 서브도메인"
                      className="w-full px-3 py-2 border border-blue-300 rounded-l-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                    <span className="px-2 py-2 bg-blue-100 border border-l-0 border-blue-300 rounded-r-lg text-xs text-blue-600 whitespace-nowrap">
                      .keystonehr.app
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (subdomainInput.trim()) {
                        window.location.href = `https://${subdomainInput.trim()}.keystonehr.app/login`;
                      }
                    }}
                    className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition whitespace-nowrap"
                  >
                    이동
                  </button>
                </div>
              </div>
              <div className="text-center space-y-3">
                <p className="text-sm text-gray-500">
                  아직 회사가 등록되지 않았다면?
                </p>
                <Link
                  href="/start"
                  className="block w-full py-3 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition"
                >
                  7일 무료 체험 시작하기
                </Link>
                <p className="text-xs text-gray-400">
                  <a href="/privacy" className="hover:text-gray-500 underline">개인정보처리방침</a>
                  {' · '}
                  <a href="/terms" className="hover:text-gray-500 underline">이용약관</a>
                </p>
              </div>
            </div>
          ) : (
            /* 서브도메인 또는 localhost: 일반 로그인 폼 표시 */
            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <Alert variant="destructive" className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <AlertDescription className="text-sm">{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">이메일</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="이메일을 입력하세요"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="h-11 text-base"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">비밀번호</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="비밀번호를 입력하세요"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-11 text-base"
                />
              </div>
              <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    로그인 중...
                  </>
                ) : (
                  <>
                    <LogIn className="mr-2 h-5 w-5" />
                    로그인
                  </>
                )}
              </Button>
              <div className="text-center space-y-3 pt-2">
                <div>
                  <span className="text-sm text-gray-500">계정이 없으신가요?</span>{' '}
                  <Link
                    href="/register"
                    className="text-sm text-blue-600 hover:text-blue-800 hover:underline active:text-blue-900 font-medium"
                  >
                    회원가입
                  </Link>
                </div>
                <p className="text-xs text-gray-400">
                  비밀번호 분실 시 관리자에게 문의해주세요.
                </p>
                <p className="text-xs text-gray-400">
                  <a href="/privacy" className="hover:text-gray-500 underline">개인정보처리방침</a>
                  {' · '}
                  <a href="/terms" className="hover:text-gray-500 underline">이용약관</a>
                </p>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
