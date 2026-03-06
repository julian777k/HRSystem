'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Save, AlertCircle, Loader2, DollarSign } from 'lucide-react';

const ADMIN_ROLES = ['SYSTEM_ADMIN', 'COMPANY_ADMIN'];

interface Policy {
  id: string;
  compensationType: string;
  weekdayMultiplier: number;
  nightMultiplier: number;
  holidayMultiplier: number;
  dailyWorkHours: number;
  halfDayHours: number;
  minUseUnit: number;
  deductionOrder: string;
  autoSplitDeduct: boolean;
}

export default function CompensationSettingsPage() {
  const router = useRouter();
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [userRole, setUserRole] = useState('');
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => {
        if (r.status === 401) { window.location.href = '/login'; return null; }
        return r.ok ? r.json() : null;
      })
      .then((d) => {
        if (d?.user?.role) {
          setUserRole(d.user.role);
          if (!ADMIN_ROLES.includes(d.user.role)) {
            router.replace('/dashboard');
            return;
          }
        }
        setRoleLoaded(true);
      })
      .catch(() => setRoleLoaded(true));
  }, [router]);

  useEffect(() => {
    if (!roleLoaded || !ADMIN_ROLES.includes(userRole)) return;
    fetch('/api/compensation-policy')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setPolicy(data);
      })
      .catch(() => setError('정책을 불러오는데 실패했습니다.'))
      .finally(() => setLoading(false));
  }, [roleLoaded, userRole]);

  const handleSave = async () => {
    if (!policy) return;
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const res = await fetch('/api/compensation-policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policy),
      });
      if (res.ok) {
        const updated = await res.json();
        setPolicy(updated);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        const err = await res.json();
        setError(err.message || '저장에 실패했습니다.');
      }
    } catch {
      setError('서버에 연결할 수 없습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (!roleLoaded || loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        불러오는 중...
      </div>
    );
  }

  if (!policy) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500 mb-4">정책을 불러올 수 없습니다.</p>
        <Button variant="outline" onClick={() => {
          setLoading(true);
          setError('');
          fetch('/api/compensation-policy')
            .then((r) => r.ok ? r.json() : null)
            .then((data) => { if (data) setPolicy(data); })
            .catch(() => setError('정책을 불러오는데 실패했습니다.'))
            .finally(() => setLoading(false));
        }}>
          다시 시도
        </Button>
      </div>
    );
  }

  // 예시 계산
  const exampleOT = 3; // 3시간 연장근무
  const exampleEarned = Math.round(exampleOT * policy.weekdayMultiplier * 10) / 10;

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <DollarSign className="w-7 h-7 text-amber-600" />
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">보상정책 설정</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            시간외근무 보상 방식과 휴가 차감 순서를 설정합니다.
          </p>
        </div>
      </div>

      {error && (
        <Alert className="mb-4 border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      {saved && (
        <Alert className="mb-4 border-green-200 bg-green-50">
          <AlertDescription className="text-green-800">설정이 저장되었습니다.</AlertDescription>
        </Alert>
      )}

      <div className="space-y-6">
        {/* 보상 방식 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              시간외근무 보상 방식
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>보상 방식</Label>
              <Select
                value={policy.compensationType}
                onValueChange={(v) => setPolicy({ ...policy, compensationType: v })}
              >
                <SelectTrigger className="w-full sm:w-[300px] mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="COMP_TIME">보상시간 적립 (대체휴무)</SelectItem>
                  <SelectItem value="ALLOWANCE">수당 지급</SelectItem>
                  <SelectItem value="CHOICE">직원 선택 가능</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                {policy.compensationType === 'COMP_TIME' &&
                  '연장근무 시간에 배율을 적용하여 보상시간으로 적립합니다.'}
                {policy.compensationType === 'ALLOWANCE' &&
                  '연장근무에 대해 수당을 지급합니다. (보상시간 미적립)'}
                {policy.compensationType === 'CHOICE' &&
                  '직원이 보상시간 또는 수당 중 선택할 수 있습니다.'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label>평일 연장 배율</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="1"
                  max="5"
                  value={policy.weekdayMultiplier}
                  onChange={(e) =>
                    setPolicy({ ...policy, weekdayMultiplier: parseFloat(e.target.value) || 1.5 })
                  }
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">예: 1.5배</p>
              </div>
              <div>
                <Label>야간근무 배율</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="1"
                  max="5"
                  value={policy.nightMultiplier}
                  onChange={(e) =>
                    setPolicy({ ...policy, nightMultiplier: parseFloat(e.target.value) || 2.0 })
                  }
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">예: 2.0배</p>
              </div>
              <div>
                <Label>휴일근무 배율</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="1"
                  max="5"
                  value={policy.holidayMultiplier}
                  onChange={(e) =>
                    setPolicy({ ...policy, holidayMultiplier: parseFloat(e.target.value) || 2.0 })
                  }
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">예: 2.0배</p>
              </div>
            </div>

            {policy.compensationType !== 'ALLOWANCE' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                <strong>예시:</strong> 직원이 평일 {exampleOT}시간 연장근무 →{' '}
                <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                  {exampleEarned}시간 보상시간 적립
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 시간 단위 설정 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              시간 단위 설정
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label>1일 근무시간</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    type="number"
                    min="1"
                    max="24"
                    value={policy.dailyWorkHours}
                    onChange={(e) =>
                      setPolicy({ ...policy, dailyWorkHours: parseFloat(e.target.value) || 8 })
                    }
                  />
                  <span className="text-sm text-gray-500 shrink-0">시간</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">1일 휴가 = {policy.dailyWorkHours}시간 차감</p>
              </div>
              <div>
                <Label>반차 시간</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    type="number"
                    min="1"
                    max="12"
                    value={policy.halfDayHours}
                    onChange={(e) =>
                      setPolicy({ ...policy, halfDayHours: parseFloat(e.target.value) || 4 })
                    }
                  />
                  <span className="text-sm text-gray-500 shrink-0">시간</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">반차 = {policy.halfDayHours}시간 차감</p>
              </div>
              <div>
                <Label>최소 사용 단위</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    type="number"
                    min="0.5"
                    max="8"
                    step="0.5"
                    value={policy.minUseUnit}
                    onChange={(e) =>
                      setPolicy({ ...policy, minUseUnit: parseFloat(e.target.value) || 1 })
                    }
                  />
                  <span className="text-sm text-gray-500 shrink-0">시간</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 차감 순서 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              휴가 차감 순서
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>차감 우선순위</Label>
              <Select
                value={policy.deductionOrder}
                onValueChange={(v) => setPolicy({ ...policy, deductionOrder: v })}
              >
                <SelectTrigger className="w-full sm:w-[350px] mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="COMP_TIME,ANNUAL">보상시간 우선 → 연차</SelectItem>
                  <SelectItem value="ANNUAL,COMP_TIME">연차 우선 → 보상시간</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                {policy.deductionOrder === 'COMP_TIME,ANNUAL'
                  ? '보상시간부터 먼저 차감한 후, 소진되면 연차에서 차감합니다.'
                  : '연차부터 먼저 차감한 후, 소진되면 보상시간에서 차감합니다.'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={policy.autoSplitDeduct}
                onCheckedChange={(v) => setPolicy({ ...policy, autoSplitDeduct: v })}
              />
              <div>
                <Label>자동 분할 차감</Label>
                <p className="text-xs text-gray-500">
                  한 종류의 시간이 부족하면 자동으로 다음 순위에서 나머지를 차감합니다.
                </p>
              </div>
            </div>

            <div className="bg-gray-50 border rounded-lg p-3 text-sm space-y-2">
              <strong>차감 예시:</strong>
              <div className="text-gray-600">
                직원 잔액: 보상시간 5h, 연차 120h
                <br />
                1일 휴가 신청 ({policy.dailyWorkHours}시간):
              </div>
              {policy.deductionOrder === 'COMP_TIME,ANNUAL' ? (
                <div className="text-gray-800 space-y-1">
                  <div>
                    1순위: 보상시간 -{Math.min(5, policy.dailyWorkHours)}h →{' '}
                    잔액 {Math.max(0, 5 - policy.dailyWorkHours)}h
                  </div>
                  {policy.dailyWorkHours > 5 && (
                    <div>
                      2순위: 연차 -{policy.dailyWorkHours - 5}h → 잔액 {120 - (policy.dailyWorkHours - 5)}h
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-gray-800">
                  1순위: 연차 -{policy.dailyWorkHours}h → 잔액 {120 - policy.dailyWorkHours}h
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 저장 버튼 */}
      <div className="mt-6 flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
          <Save className="w-4 h-4 mr-2" />
          {saving ? '저장 중...' : '설정 저장'}
        </Button>
      </div>
    </div>
  );
}
