'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, Save, Search, Check, X, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

const ADMIN_ROLES = ["SYSTEM_ADMIN", "COMPANY_ADMIN"];

interface OvertimePolicy {
  id: string;
  maxWeeklyHours: number;
  maxMonthlyHours: number;
  nightStartTime: string;
  nightEndTime: string;
  weekdayRate: number;
  weekendRate: number;
  nightRate: number;
}

interface OvertimeRequest {
  id: string;
  date: string;
  overtimeType: string;
  startTime: string;
  endTime: string;
  hours: number;
  reason: string;
  status: string;
  employee: {
    id: string;
    name: string;
    employeeNumber: string;
    department: { id: string; name: string };
  };
}

const OVERTIME_TYPE_LABELS: Record<string, string> = {
  WEEKDAY_OVERTIME: '평일연장',
  NIGHT: '야간',
  WEEKEND: '휴일근무',
  HOLIDAY: '공휴일근무',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: '대기',
  IN_PROGRESS: '진행중',
  APPROVED: '승인',
  REJECTED: '반려',
  CANCELLED: '취소',
};

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PENDING: 'outline',
  IN_PROGRESS: 'secondary',
  APPROVED: 'default',
  REJECTED: 'destructive',
  CANCELLED: 'secondary',
};

export default function OvertimeSettingsPage() {
  const router = useRouter();
  const [userRole, setUserRole] = useState('');
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [policy, setPolicy] = useState<OvertimePolicy | null>(null);
  const [requests, setRequests] = useState<OvertimeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Policy form
  const [formPolicy, setFormPolicy] = useState({
    maxWeeklyHours: 12,
    maxMonthlyHours: 52,
    nightStartTime: '22:00',
    nightEndTime: '06:00',
    weekdayRate: 1.5,
    weekendRate: 1.5,
    nightRate: 2.0,
  });

  const [processing, setProcessing] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'policy' | 'requests'>('policy');
  const [confirmDialog, setConfirmDialog] = useState<{open: boolean; title: string; description: string; action: () => void}>({open: false, title: '', description: '', action: () => {}});

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

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

  const fetchPolicy = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/overtime');
      if (res.ok) {
        const data = await res.json();
        setPolicy(data.policy);
        setFormPolicy({
          maxWeeklyHours: data.policy.maxWeeklyHours,
          maxMonthlyHours: data.policy.maxMonthlyHours,
          nightStartTime: data.policy.nightStartTime,
          nightEndTime: data.policy.nightEndTime,
          weekdayRate: data.policy.weekdayRate,
          weekendRate: data.policy.weekendRate,
          nightRate: data.policy.nightRate,
        });
      }
    } catch {
      toast.error('정책을 불러오지 못했습니다.');
    }
  }, []);

  const fetchRequests = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterStartDate) params.set('startDate', filterStartDate);
      if (filterEndDate) params.set('endDate', filterEndDate);
      if (filterStatus) params.set('status', filterStatus);
      const res = await fetch(`/api/overtime/requests?${params}`);
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests);
      }
    } catch {
      toast.error('신청 목록을 불러오지 못했습니다.');
    }
  }, [filterStartDate, filterEndDate, filterStatus]);

  useEffect(() => {
    if (roleLoaded && ADMIN_ROLES.includes(userRole)) {
      Promise.all([fetchPolicy(), fetchRequests()]).finally(() => setLoading(false));
    }
  }, [fetchPolicy, fetchRequests, roleLoaded, userRole]);

  const handleSavePolicy = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings/overtime', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxWeeklyHours: Number(formPolicy.maxWeeklyHours),
          maxMonthlyHours: Number(formPolicy.maxMonthlyHours),
          nightStartTime: formPolicy.nightStartTime,
          nightEndTime: formPolicy.nightEndTime,
          weekdayRate: Number(formPolicy.weekdayRate),
          weekendRate: Number(formPolicy.weekendRate),
          nightRate: Number(formPolicy.nightRate),
        }),
      });

      if (res.ok) {
        toast.success('정책이 저장되었습니다.');
        fetchPolicy();
      } else {
        const data = await res.json();
        toast.error(data.message || '저장에 실패했습니다.');
      }
    } catch {
      toast.error('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleApproval = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    if (status === 'REJECTED') {
      setConfirmDialog({
        open: true,
        title: '신청 반려',
        description: '시간외근무 신청을 반려하시겠습니까?',
        action: async () => {
          setProcessing(id);
          try {
            const res = await fetch(`/api/overtime/request/${id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status }),
            });
            if (res.ok) {
              const data = await res.json();
              toast.success(data.message || '반려되었습니다.');
              fetchRequests();
            } else {
              const err = await res.json();
              toast.error(err.message || '처리에 실패했습니다.');
            }
          } catch {
            toast.error('서버에 연결할 수 없습니다.');
          } finally {
            setProcessing(null);
          }
        },
      });
      return;
    }
    setProcessing(id);
    try {
      const res = await fetch(`/api/overtime/request/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(data.message || (status === 'APPROVED' ? '승인되었습니다.' : '반려되었습니다.'));
        fetchRequests();
      } else {
        const err = await res.json();
        toast.error(err.message || '처리에 실패했습니다.');
      }
    } catch {
      toast.error('서버에 연결할 수 없습니다.');
    } finally {
      setProcessing(null);
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

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Clock className="w-7 h-7 text-amber-600" />
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">시간외근무 설정</h1>
          <p className="text-sm text-gray-500 mt-0.5">시간외근무 정책을 설정하고 신청 현황을 확인합니다.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-0">
        <button
          onClick={() => setActiveTab('policy')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'policy'
              ? 'border-amber-600 text-amber-700'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          정책 설정
        </button>
        <button
          onClick={() => setActiveTab('requests')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'requests'
              ? 'border-amber-600 text-amber-700'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          신청 관리
        </button>
      </div>

      {/* Policy Settings Tab */}
      {activeTab === 'policy' && (
        <Card className="rounded-t-none border-t-0">
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500 mb-4">시간외근무 관련 정책을 설정합니다.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label>주 최대 시간외근무 (시간)</Label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={formPolicy.maxWeeklyHours}
                  onChange={(e) =>
                    setFormPolicy({ ...formPolicy, maxWeeklyHours: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>월 최대 시간외근무 (시간)</Label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={formPolicy.maxMonthlyHours}
                  onChange={(e) =>
                    setFormPolicy({ ...formPolicy, maxMonthlyHours: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>야간근무 시작시간</Label>
                <Input
                  type="time"
                  value={formPolicy.nightStartTime}
                  onChange={(e) =>
                    setFormPolicy({ ...formPolicy, nightStartTime: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>야간근무 종료시간</Label>
                <Input
                  type="time"
                  value={formPolicy.nightEndTime}
                  onChange={(e) =>
                    setFormPolicy({ ...formPolicy, nightEndTime: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>평일 시간외 수당 배율</Label>
                <Input
                  type="number"
                  min={1}
                  step={0.1}
                  value={formPolicy.weekdayRate}
                  onChange={(e) =>
                    setFormPolicy({ ...formPolicy, weekdayRate: parseFloat(e.target.value) || 1 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>휴일 수당 배율</Label>
                <Input
                  type="number"
                  min={1}
                  step={0.1}
                  value={formPolicy.weekendRate}
                  onChange={(e) =>
                    setFormPolicy({ ...formPolicy, weekendRate: parseFloat(e.target.value) || 1 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>야간 수당 배율</Label>
                <Input
                  type="number"
                  min={1}
                  step={0.1}
                  value={formPolicy.nightRate}
                  onChange={(e) =>
                    setFormPolicy({ ...formPolicy, nightRate: parseFloat(e.target.value) || 1 })
                  }
                />
              </div>
            </div>

            <div className="mt-6">
              <Button className="w-full sm:w-auto" onClick={handleSavePolicy} disabled={saving}>
                <Save className="w-4 h-4 mr-1" />
                {saving ? '저장 중...' : '저장'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overtime Requests Tab */}
      {activeTab === 'requests' && (
        <Card className="rounded-t-none border-t-0">
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-end gap-3 mb-4">
              <div className="space-y-1">
                <Label className="text-xs">시작일</Label>
                <Input
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                  className="w-[150px]"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">종료일</Label>
                <Input
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                  className="w-[150px]"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">상태</Label>
                <Select value={filterStatus || 'all'} onValueChange={(v) => setFilterStatus(v === 'all' ? '' : v)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="전체" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    <SelectItem value="PENDING">대기</SelectItem>
                    <SelectItem value="APPROVED">승인</SelectItem>
                    <SelectItem value="REJECTED">반려</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => {
                  fetchRequests();
                }}
              >
                <Search className="w-4 h-4 mr-1" />
                조회
              </Button>
            </div>

            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm min-w-[600px]">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">신청자</th>
                    <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">부서</th>
                    <th className="text-left px-4 py-3 font-medium">근무일</th>
                    <th className="text-left px-4 py-3 font-medium">유형</th>
                    <th className="text-left px-4 py-3 font-medium">시간</th>
                    <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">사유</th>
                    <th className="text-left px-4 py-3 font-medium">상태</th>
                    <th className="text-left px-4 py-3 font-medium">처리</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {requests.map((req) => (
                    <tr key={req.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{req.employee.name}</td>
                      <td className="px-4 py-3 hidden sm:table-cell">{req.employee.department.name}</td>
                      <td className="px-4 py-3">
                        {new Date(req.date).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="px-4 py-3">{OVERTIME_TYPE_LABELS[req.overtimeType]}</td>
                      <td className="px-4 py-3">
                        {req.startTime} ~ {req.endTime} ({req.hours}h)
                      </td>
                      <td className="px-4 py-3 max-w-[200px] truncate hidden sm:table-cell">{req.reason}</td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_VARIANTS[req.status]}>
                          {STATUS_LABELS[req.status]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {req.status === 'PENDING' && (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="default"
                              className="h-7 px-2"
                              disabled={processing === req.id}
                              onClick={() => handleApproval(req.id, 'APPROVED')}
                            >
                              <Check className="w-3 h-3 mr-1" />
                              승인
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-7 px-2"
                              disabled={processing === req.id}
                              onClick={() => handleApproval(req.id, 'REJECTED')}
                            >
                              <X className="w-3 h-3 mr-1" />
                              반려
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {requests.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                        신청 내역이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirm Dialog */}
      <Dialog open={confirmDialog.open} onOpenChange={(v) => setConfirmDialog(prev => ({...prev, open: v}))}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{confirmDialog.title}</DialogTitle>
            <DialogDescription>{confirmDialog.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setConfirmDialog(prev => ({...prev, open: false}))}>취소</Button>
            <Button variant="destructive" onClick={() => { confirmDialog.action(); setConfirmDialog(prev => ({...prev, open: false})); }}>확인</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
