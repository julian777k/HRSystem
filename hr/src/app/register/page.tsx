'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, UserPlus, CheckCircle } from 'lucide-react';
import Image from 'next/image';
import { Toaster, toast } from 'sonner';

interface Department {
  id: string;
  name: string;
}

interface Position {
  id: string;
  name: string;
  level: number;
}

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [positionId, setPositionId] = useState('');
  const [departmentInput, setDepartmentInput] = useState('');
  const [positionInput, setPositionInput] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [resultInfo, setResultInfo] = useState<{ employeeNumber: string } | null>(null);

  useEffect(() => {
    fetch('/api/auth/register/options')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.departments) setDepartments(data.departments);
        if (data?.positions) setPositions(data.positions);
      })
      .catch(() => {});
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
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

    if (!agreePrivacy) {
      setError('개인정보 수집 및 이용에 동의해주세요.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password,
          phone: phone || undefined,
          employeeNumber: employeeNumber || undefined,
          departmentId: departmentId || undefined,
          positionId: positionId || undefined,
          departmentName: !departmentId && departmentInput ? departmentInput : undefined,
          positionName: !positionId && positionInput ? positionInput : undefined,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        setResultInfo({ employeeNumber: data.employee.employeeNumber });
        toast.success('회원가입이 완료되었습니다!');
      } else {
        const msg = data.message || '회원가입에 실패했습니다.';
        setError(msg);
        toast.error(msg);
      }
    } catch {
      const msg = '서버에 연결할 수 없습니다.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Toaster position="top-center" richColors closeButton />
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 text-center space-y-4 px-4 sm:px-6">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold">회원가입 완료</h2>
            <p className="text-gray-500">
              가입이 완료되었습니다. 바로 로그인할 수 있습니다.
            </p>
            {resultInfo && (
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <span className="text-gray-500">사원번호: </span>
                <span className="font-mono font-bold">{resultInfo.employeeNumber}</span>
              </div>
            )}
            <Button className="w-full" onClick={() => router.push('/login')}>
              로그인하기
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasDepartments = departments.length > 0;
  const hasPositions = positions.length > 0;

  return (
    <div className="min-h-screen min-h-[100dvh] bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <Toaster position="top-center" richColors closeButton />
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2 px-4 sm:px-6">
          <Image src="/logo.png" alt="KeystoneHR" width={48} height={48} className="mx-auto w-12 h-12 mb-2" />
          <CardTitle className="text-xl sm:text-2xl font-bold">회원가입</CardTitle>
          <CardDescription>KeystoneHR에 직원으로 등록합니다</CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <form onSubmit={handleRegister} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">
                이름 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                placeholder="홍길동"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
                className="h-11 text-base"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">
                이메일 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="hong@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
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
                  autoComplete="new-password"
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
                  autoComplete="new-password"
                  className="h-11 text-base"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="employeeNumber">사원번호 (선택)</Label>
              <Input
                id="employeeNumber"
                placeholder="미입력 시 자동 생성"
                value={employeeNumber}
                onChange={(e) => setEmployeeNumber(e.target.value)}
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
                autoComplete="tel"
                className="h-11 text-base"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>부서 (선택)</Label>
                {hasDepartments ? (
                  <Select value={departmentId} onValueChange={(v) => { setDepartmentId(v); setDepartmentInput(''); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="부서 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    placeholder="부서명 입력"
                    value={departmentInput}
                    onChange={(e) => setDepartmentInput(e.target.value)}
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label>직급 (선택)</Label>
                {hasPositions ? (
                  <Select value={positionId} onValueChange={(v) => { setPositionId(v); setPositionInput(''); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="직급 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {positions.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    placeholder="직급명 입력"
                    value={positionInput}
                    onChange={(e) => setPositionInput(e.target.value)}
                  />
                )}
              </div>
            </div>

            <div className="flex items-start gap-2 pt-1">
              <Checkbox
                id="agreePrivacy"
                checked={agreePrivacy}
                onCheckedChange={(v) => setAgreePrivacy(v === true)}
                className="mt-[3px] size-3.5"
              />
              <label htmlFor="agreePrivacy" className="text-sm text-gray-600 leading-snug cursor-pointer">
                <Link href="/privacy" target="_blank" className="text-blue-600 hover:underline font-medium">개인정보 수집 및 이용</Link>에 동의합니다.
                <span className="text-red-500"> *</span>
              </label>
            </div>

            <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  가입 중...
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  회원가입
                </>
              )}
            </Button>

            <div className="text-center">
              <span className="text-sm text-gray-500">이미 계정이 있으신가요?</span>{' '}
              <Link
                href="/login"
                className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
              >
                로그인
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
