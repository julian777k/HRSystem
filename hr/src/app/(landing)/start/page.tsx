'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Building2, CheckCircle, ArrowRight } from 'lucide-react';

export default function StartPage() {
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [companyName, setCompanyName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [adminName, setAdminName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultUrl, setResultUrl] = useState('');

  const generateSubdomain = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[가-힣]/g, '') // remove Korean chars
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 30);
  };

  const handleCompanyNameChange = (value: string) => {
    setCompanyName(value);
    // Auto-suggest subdomain if user hasn't manually edited it
    if (!subdomain || subdomain === generateSubdomain(companyName)) {
      setSubdomain(generateSubdomain(value));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    if (password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.');
      return;
    }

    if (!subdomain || subdomain.length < 2) {
      setError('서브도메인은 2자 이상이어야 합니다.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/register-company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName,
          subdomain,
          adminName,
          email,
          password,
          phone,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setResultUrl(data.loginUrl);
        setStep('success');
      } else {
        setError(data.message || '등록에 실패했습니다.');
      }
    } catch {
      setError('서버에 연결할 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'success') {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 text-center space-y-5 px-4 sm:px-6">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">회사 등록 완료!</h2>
            <p className="text-gray-500 text-sm">
              7일 무료 체험이 시작되었습니다.<br />
              아래 주소에서 로그인하세요.
            </p>
            <div className="bg-blue-50 rounded-lg p-4 text-sm">
              <p className="text-gray-500 mb-1">회사 전용 주소</p>
              <p className="font-mono font-bold text-blue-700 text-base break-all">{resultUrl}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-sm text-left space-y-1">
              <p><span className="text-gray-500">관리자 이메일:</span> <span className="font-medium">{email}</span></p>
              <p><span className="text-gray-500">체험 기간:</span> <span className="font-medium">7일</span></p>
            </div>
            <a
              href={`https://${resultUrl}/login`}
              className="flex items-center justify-center gap-2 w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition"
            >
              로그인하러 가기
              <ArrowRight className="w-4 h-4" />
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4 py-12">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center space-y-2 px-4 sm:px-6">
          <Image src="/logo.png" alt="KeystoneHR" width={48} height={48} className="mx-auto w-12 h-12 mb-2" />
          <CardTitle className="text-xl sm:text-2xl font-bold">7일 무료 체험 시작</CardTitle>
          <CardDescription>
            회사 정보를 입력하면 바로 사용할 수 있습니다. 카드 등록 불필요.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Company Info */}
            <div className="space-y-2">
              <Label htmlFor="companyName">
                회사명 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="companyName"
                placeholder="예: 우리회사"
                value={companyName}
                onChange={(e) => handleCompanyNameChange(e.target.value)}
                required
                autoFocus
                className="h-11 text-base"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subdomain">
                서브도메인 <span className="text-red-500">*</span>
              </Label>
              <div className="flex items-center gap-1">
                <Input
                  id="subdomain"
                  placeholder="mycompany"
                  value={subdomain}
                  onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  required
                  className="h-11 text-base font-mono"
                />
                <span className="text-sm text-gray-500 whitespace-nowrap">.keystonehr.app</span>
              </div>
              <p className="text-xs text-gray-400">영문 소문자, 숫자, 하이픈만 사용 가능</p>
            </div>

            <div className="border-t border-gray-100 pt-4 mt-4">
              <p className="text-sm font-medium text-gray-700 mb-3">관리자 계정 정보</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="adminName">
                  관리자 이름 <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="adminName"
                  placeholder="홍길동"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  required
                  className="h-11 text-base"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">
                  연락처 <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="010-1234-5678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="h-11 text-base"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">
                관리자 이메일 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 text-base"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="password">
                  비밀번호 <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="8자 이상"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11 text-base"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">
                  비밀번호 확인 <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="비밀번호 확인"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="h-11 text-base"
                />
              </div>
            </div>

            <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  등록 중...
                </>
              ) : (
                <>
                  <Building2 className="mr-2 h-4 w-4" />
                  7일 무료 체험 시작하기
                </>
              )}
            </Button>

            <p className="text-xs text-gray-400 text-center">
              가입 시{' '}
              <Link href="/terms" className="text-blue-500 hover:underline">이용약관</Link> 및{' '}
              <Link href="/privacy" className="text-blue-500 hover:underline">개인정보처리방침</Link>에 동의합니다.
            </p>

            <div className="text-center">
              <span className="text-sm text-gray-500">이미 계정이 있으신가요?</span>{' '}
              <Link href="/login" className="text-sm text-blue-600 hover:text-blue-800 hover:underline">
                로그인
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
