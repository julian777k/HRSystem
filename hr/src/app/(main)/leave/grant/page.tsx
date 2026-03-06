'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Gift, Plus, Search, Loader2, Zap, Users } from 'lucide-react';
import { toast } from 'sonner';

const ADMIN_ROLES = ["SYSTEM_ADMIN", "COMPANY_ADMIN"];

interface Employee {
  id: string;
  name: string;
  employeeNumber: string;
  departmentName: string;
  positionName: string;
  hireDate: string;
}

interface LeaveType {
  id: string;
  name: string;
  code: string;
}

interface GrantRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  departmentName: string;
  positionName: string;
  leaveTypeCode: string;
  grantDays: number;
  usedDays: number;
  remainDays: number;
  grantReason: string;
  periodStart: string;
  periodEnd: string;
  isExpired: boolean;
  createdAt: string;
}

interface UsageData {
  employeeId: string;
  name: string;
  departmentName: string;
  positionName: string;
  hireDate: string;
  totalGranted: number;
  totalUsed: number;
  totalRemain: number;
  usageRate: number;
  balancesByType?: Record<string, { granted: number; used: number; remain: number }>;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toISOString().split('T')[0];
}

function getYearsWorked(hireDate: string): string {
  const hire = new Date(hireDate);
  const now = new Date();
  const years = now.getFullYear() - hire.getFullYear();
  const months = now.getMonth() - hire.getMonth();
  const totalMonths = years * 12 + months;
  const y = Math.floor(totalMonths / 12);
  const m = totalMonths % 12;
  return `${y}년 ${m}개월`;
}

export default function LeaveGrantPage() {
  const router = useRouter();
  const [userRole, setUserRole] = useState('');
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [usageData, setUsageData] = useState<UsageData[]>([]);
  const [grants, setGrants] = useState<GrantRecord[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [autoGrantDialogOpen, setAutoGrantDialogOpen] = useState(false);
  const [autoGranting, setAutoGranting] = useState(false);
  const [autoGrantResult, setAutoGrantResult] = useState<{ granted: number; skipped: number; errors: string[]; grantedByType?: Record<string, number> } | null>(null);
  const [selectedGrantTypes, setSelectedGrantTypes] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'status' | 'history'>('status');

  // Employee search
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [showEmployeeList, setShowEmployeeList] = useState(false);

  // Form
  const [formEmployeeId, setFormEmployeeId] = useState('');
  const [formEmployeeName, setFormEmployeeName] = useState('');
  const [formLeaveTypeCode, setFormLeaveTypeCode] = useState('');
  const [formGrantDays, setFormGrantDays] = useState('');
  const [formPeriodStart, setFormPeriodStart] = useState('');
  const [formPeriodEnd, setFormPeriodEnd] = useState('');
  const [formReason, setFormReason] = useState('');

  useEffect(() => {
    fetch("/api/auth/me").then(r => { if (r.status === 401) { window.location.href = '/login'; return null; } return r.ok ? r.json() : null; }).then(d => {
      if (d?.user?.role) {
        setUserRole(d.user.role);
        if (!ADMIN_ROLES.includes(d.user.role)) {
          router.replace('/dashboard');
          return;
        }
      }
      setRoleLoaded(true);
    }).catch(() => setRoleLoaded(true));
  }, [router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [usageRes, grantsRes, typesRes] = await Promise.all([
        fetch(`/api/leave/usage?year=${new Date().getFullYear()}`),
        fetch('/api/leave/grants'),
        fetch('/api/leave/types'),
      ]);
      if (usageRes.ok) {
        const json = await usageRes.json();
        setUsageData(json.data);
      }
      if (grantsRes.ok) setGrants(await grantsRes.json());
      if (typesRes.ok) setLeaveTypes(await typesRes.json());
    } catch {
      setError('데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  const searchEmployees = useCallback(async (query: string) => {
    if (!query || query.length < 1) {
      setEmployees([]);
      return;
    }
    try {
      const res = await fetch(`/api/employees?search=${encodeURIComponent(query)}&limit=10`);
      if (res.ok) {
        const json = await res.json();
        const list = Array.isArray(json) ? json : json.data || [];
        setEmployees(list.map((e: Record<string, unknown>) => ({
          id: e.id as string,
          name: e.name as string,
          employeeNumber: e.employeeNumber as string,
          departmentName: (e.department as Record<string, string>)?.name || (e.departmentName as string) || '',
          positionName: (e.position as Record<string, string>)?.name || (e.positionName as string) || '',
          hireDate: e.hireDate as string,
        })));
      }
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    if (roleLoaded && ADMIN_ROLES.includes(userRole)) {
      fetchData();
    }
  }, [fetchData, roleLoaded, userRole]);

  const selectEmployee = (emp: Employee) => {
    setFormEmployeeId(emp.id);
    setFormEmployeeName(`${emp.name} (${emp.departmentName})`);
    setEmployeeSearch('');
    setShowEmployeeList(false);
  };

  const handleSubmit = async () => {
    if (!formEmployeeId || !formLeaveTypeCode || !formGrantDays || !formPeriodStart || !formPeriodEnd || !formReason) {
      toast.error('모든 항목을 입력해주세요.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/leave/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: formEmployeeId,
          leaveTypeCode: formLeaveTypeCode,
          grantDays: parseFloat(formGrantDays),
          grantReason: formReason,
          periodStart: formPeriodStart,
          periodEnd: formPeriodEnd,
        }),
      });
      if (res.ok) {
        setDialogOpen(false);
        resetForm();
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.message || '부여에 실패했습니다.');
      }
    } catch {
      toast.error('서버에 연결할 수 없습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormEmployeeId('');
    setFormEmployeeName('');
    setFormLeaveTypeCode('');
    setFormGrantDays('');
    setFormPeriodStart('');
    setFormPeriodEnd('');
    setFormReason('');
    setEmployeeSearch('');
    setEmployees([]);
  };

  const handleAutoGrant = async () => {
    const year = new Date().getFullYear();
    setAutoGranting(true);
    setAutoGrantResult(null);
    try {
      const res = await fetch('/api/leave/auto-grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year,
          leaveTypeCodes: selectedGrantTypes.length > 0 ? selectedGrantTypes : undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAutoGrantResult({ granted: data.granted, skipped: data.skipped, errors: data.errors, grantedByType: data.grantedByType });
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.message || '자동부여에 실패했습니다.');
      }
    } catch {
      toast.error('서버에 연결할 수 없습니다.');
    } finally {
      setAutoGranting(false);
    }
  };

  const toggleGrantType = (code: string) => {
    setSelectedGrantTypes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  if (!roleLoaded) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        불러오는 중...
      </div>
    );
  }

  return (
    <div>
      {/* Unified Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Gift className="w-7 h-7 text-emerald-600" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">휴가부여</h1>
            <p className="text-sm text-gray-500 mt-0.5">직원에게 휴가를 부여하고 이력을 관리합니다.</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => setAutoGrantDialogOpen(true)}>
            <Zap className="w-4 h-4 mr-2" />
            전직원 자동부여
          </Button>
          <Button className="w-full sm:w-auto" onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            휴가 부여
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-0">
        <button
          onClick={() => setActiveTab('status')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'status'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          직원 휴가 현황
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'history'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          부여 이력
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'status' && (
        <Card className="rounded-t-none border-t-0">
          <CardContent className="pt-6">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                불러오는 중...
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-red-500 mb-4">{error}</p>
                <Button variant="outline" onClick={fetchData}>다시 시도</Button>
              </div>
            ) : usageData.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-400 mb-4">데이터가 없습니다.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[700px]">
                  <thead>
                    <tr className="border-b text-left bg-gray-50">
                      <th className="py-3 px-2 font-medium">이름</th>
                      <th className="py-3 px-2 font-medium">부서</th>
                      <th className="py-3 px-2 font-medium hidden sm:table-cell">직급</th>
                      <th className="py-3 px-2 font-medium hidden sm:table-cell">입사일</th>
                      <th className="py-3 px-2 font-medium hidden md:table-cell">근속연수</th>
                      <th className="py-3 px-2 font-medium">총부여</th>
                      <th className="py-3 px-2 font-medium">사용</th>
                      <th className="py-3 px-2 font-medium">잔여</th>
                      <th className="py-3 px-2 font-medium hidden lg:table-cell">유형별 잔여</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usageData.map((row) => (
                      <tr key={row.employeeId} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-2 font-medium">{row.name}</td>
                        <td className="py-3 px-2">{row.departmentName}</td>
                        <td className="py-3 px-2 hidden sm:table-cell">{row.positionName}</td>
                        <td className="py-3 px-2 hidden sm:table-cell">{formatDate(row.hireDate)}</td>
                        <td className="py-3 px-2 hidden md:table-cell">{getYearsWorked(row.hireDate)}</td>
                        <td className="py-3 px-2">{row.totalGranted}일</td>
                        <td className="py-3 px-2">{row.totalUsed}일</td>
                        <td className="py-3 px-2 font-medium text-emerald-600">{row.totalRemain}일</td>
                        <td className="py-3 px-2 hidden lg:table-cell text-xs text-muted-foreground">
                          {row.balancesByType && Object.entries(row.balancesByType).map(([code, bal]) => {
                            const typeName = leaveTypes.find((lt) => lt.code === code)?.name || code;
                            return (
                              <span key={code} className="inline-block mr-2">
                                {typeName} {bal.remain}/{bal.granted}
                              </span>
                            );
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'history' && (
        <Card className="rounded-t-none border-t-0">
          <CardContent className="pt-6">
            {grants.length === 0 ? (
              <div className="text-center py-12">
                <Gift className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-400 mb-4">부여 이력이 없습니다.</p>
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  휴가 부여하기
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[700px]">
                  <thead>
                    <tr className="border-b text-left bg-gray-50">
                      <th className="py-3 px-2 font-medium">부여일</th>
                      <th className="py-3 px-2 font-medium">이름</th>
                      <th className="py-3 px-2 font-medium hidden sm:table-cell">부서</th>
                      <th className="py-3 px-2 font-medium">휴가유형</th>
                      <th className="py-3 px-2 font-medium">부여일수</th>
                      <th className="py-3 px-2 font-medium hidden sm:table-cell">사용</th>
                      <th className="py-3 px-2 font-medium">잔여</th>
                      <th className="py-3 px-2 font-medium hidden md:table-cell">유효기간</th>
                      <th className="py-3 px-2 font-medium hidden sm:table-cell">사유</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grants.map((g) => (
                      <tr key={g.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-2">{formatDate(g.createdAt)}</td>
                        <td className="py-3 px-2 font-medium">{g.employeeName}</td>
                        <td className="py-3 px-2 hidden sm:table-cell">{g.departmentName}</td>
                        <td className="py-3 px-2">{g.leaveTypeCode}</td>
                        <td className="py-3 px-2">{g.grantDays}일</td>
                        <td className="py-3 px-2 hidden sm:table-cell">{g.usedDays}일</td>
                        <td className="py-3 px-2">{g.remainDays}일</td>
                        <td className="py-3 px-2 hidden md:table-cell">{formatDate(g.periodStart)} ~ {formatDate(g.periodEnd)}</td>
                        <td className="py-3 px-2 max-w-[200px] truncate hidden sm:table-cell">{g.grantReason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Grant Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>휴가 부여</DialogTitle>
            <DialogDescription>직원에게 휴가를 부여합니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>직원 검색</Label>
              {formEmployeeId ? (
                <div className="flex items-center gap-2 mt-1">
                  <Input value={formEmployeeName} readOnly className="bg-muted" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setFormEmployeeId(''); setFormEmployeeName(''); }}
                  >
                    변경
                  </Button>
                </div>
              ) : (
                <div className="relative mt-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={employeeSearch}
                      onChange={(e) => {
                        setEmployeeSearch(e.target.value);
                        searchEmployees(e.target.value);
                        setShowEmployeeList(true);
                      }}
                      onFocus={() => setShowEmployeeList(true)}
                      placeholder="이름 또는 사번으로 검색"
                      className="pl-10"
                    />
                  </div>
                  {showEmployeeList && employees.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-[200px] overflow-y-auto">
                      {employees.map((emp) => (
                        <button
                          key={emp.id}
                          className="w-full text-left px-3 py-2 hover:bg-muted text-sm"
                          onClick={() => selectEmployee(emp)}
                        >
                          <span className="font-medium">{emp.name}</span>
                          <span className="text-muted-foreground ml-2">{emp.employeeNumber} | {emp.departmentName}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div>
              <Label>휴가 유형</Label>
              <Select value={formLeaveTypeCode} onValueChange={setFormLeaveTypeCode}>
                <SelectTrigger className="w-full mt-1">
                  <SelectValue placeholder="휴가 유형 선택" />
                </SelectTrigger>
                <SelectContent>
                  {leaveTypes.map((lt) => (
                    <SelectItem key={lt.code} value={lt.code}>{lt.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>부여 일수</Label>
              <Input
                type="number"
                value={formGrantDays}
                onChange={(e) => setFormGrantDays(e.target.value)}
                min="0.5"
                step="0.5"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>유효기간 시작</Label>
                <Input
                  type="date"
                  value={formPeriodStart}
                  onChange={(e) => setFormPeriodStart(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>유효기간 종료</Label>
                <Input
                  type="date"
                  value={formPeriodEnd}
                  onChange={(e) => setFormPeriodEnd(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label>부여 사유</Label>
              <Textarea
                value={formReason}
                onChange={(e) => setFormReason(e.target.value)}
                placeholder="부여 사유를 입력하세요"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setDialogOpen(false)}>
              취소
            </Button>
            <Button
              className="w-full sm:w-auto"
              onClick={handleSubmit}
              disabled={submitting || !formEmployeeId || !formLeaveTypeCode || !formGrantDays || !formPeriodStart || !formPeriodEnd || !formReason}
            >
              {submitting ? '처리 중...' : '부여'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Auto Grant Dialog */}
      <Dialog open={autoGrantDialogOpen} onOpenChange={(open) => {
        setAutoGrantDialogOpen(open);
        if (!open) { setAutoGrantResult(null); setSelectedGrantTypes([]); }
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>전직원 자동부여</DialogTitle>
            <DialogDescription>
              {new Date().getFullYear()}년도 휴가를 자동 부여합니다.
              휴가규정 설정에 따라 연차, 병가, 경조사 등을 자동 부여합니다.
            </DialogDescription>
          </DialogHeader>
          {!autoGrantResult && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">부여 대상 휴가유형</Label>
              <p className="text-xs text-muted-foreground">선택하지 않으면 정책이 등록된 모든 유형이 부여됩니다.</p>
              <div className="grid grid-cols-2 gap-2">
                {leaveTypes
                  .filter((lt) => lt.code !== 'AM_HALF' && lt.code !== 'PM_HALF')
                  .map((lt) => (
                    <label key={lt.code} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={selectedGrantTypes.includes(lt.code)}
                        onCheckedChange={() => toggleGrantType(lt.code)}
                      />
                      {lt.name}
                    </label>
                  ))}
              </div>
            </div>
          )}
          {autoGrantResult && (
            <div className="bg-muted p-4 rounded-lg text-sm space-y-2">
              <p className="font-medium">처리 결과</p>
              <p>{autoGrantResult.granted}건 부여 완료, {autoGrantResult.skipped}건 스킵</p>
              {autoGrantResult.grantedByType && Object.keys(autoGrantResult.grantedByType).length > 0 && (
                <div className="space-y-1 pt-1 border-t">
                  <p className="text-xs font-medium text-muted-foreground">유형별 부여 현황</p>
                  {Object.entries(autoGrantResult.grantedByType).map(([code, count]) => {
                    const typeName = leaveTypes.find((lt) => lt.code === code)?.name || code;
                    return <p key={code} className="text-xs">{typeName}: {count}건</p>;
                  })}
                </div>
              )}
              {autoGrantResult.errors.length > 0 && (
                <div className="text-red-500 mt-2">
                  <p>{autoGrantResult.errors.length}건 오류:</p>
                  {autoGrantResult.errors.map((e, i) => (
                    <p key={i} className="text-xs">{e}</p>
                  ))}
                </div>
              )}
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => { setAutoGrantDialogOpen(false); setAutoGrantResult(null); setSelectedGrantTypes([]); }}
            >
              {autoGrantResult ? '닫기' : '취소'}
            </Button>
            {!autoGrantResult && (
              <Button
                className="w-full sm:w-auto"
                onClick={handleAutoGrant}
                disabled={autoGranting}
              >
                {autoGranting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    처리 중...
                  </>
                ) : (
                  '자동부여 실행'
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
