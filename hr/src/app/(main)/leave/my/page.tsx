'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
import { Calendar, Plus, X, Palmtree, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

interface LeaveType {
  id: string;
  name: string;
  code: string;
}

interface LeaveRequest {
  id: string;
  leaveTypeName: string;
  leaveTypeCode: string;
  startDate: string;
  endDate: string;
  useUnit: string;
  requestDays: number;
  reason: string | null;
  status: string;
  appliedAt: string;
}

interface Summary {
  totalGranted: number;
  totalUsed: number;
  totalRemain: number;
  usageRate: number;
}

interface BalanceByType {
  leaveTypeCode: string;
  totalGranted: number;
  totalUsed: number;
  totalRemain: number;
}

interface TimeWalletData {
  compTime: { earned: number; used: number; remain: number };
  annual: { earned: number; used: number; remain: number };
  totalRemainHours: number;
  totalRemainDays: number;
  dailyWorkHours: number;
  halfDayHours: number;
}

interface HolidayData {
  id: string;
  name: string;
  date: string;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: '대기',
  IN_PROGRESS: '진행중',
  APPROVED: '승인',
  REJECTED: '반려',
  CANCELLED: '취소',
};

const UNIT_LABELS: Record<string, string> = {
  FULL_DAY: '종일',
  AM_HALF: '오전반차',
  PM_HALF: '오후반차',
  HOURS: '시간',
};

function getStatusStyle(status: string) {
  switch (status) {
    case 'PENDING': return 'bg-yellow-100 text-yellow-800';
    case 'IN_PROGRESS': return 'bg-blue-100 text-blue-800';
    case 'APPROVED': return 'bg-green-100 text-green-800';
    case 'REJECTED': return 'bg-red-100 text-red-800';
    case 'CANCELLED': return 'bg-gray-100 text-gray-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

function formatDate(dateStr: string) {
  return dateStr.split('T')[0];
}

function calculateWorkingDaysClient(
  startDate: string,
  endDate: string,
  holidays: string[]
): { workingDays: number; totalDays: number; weekendDays: number; holidayDays: number } {
  if (!startDate || !endDate) return { workingDays: 0, totalDays: 0, weekendDays: 0, holidayDays: 0 };

  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  if (start > end) return { workingDays: 0, totalDays: 0, weekendDays: 0, holidayDays: 0 };

  const holidaySet = new Set(holidays);

  let workingDays = 0;
  let weekendDays = 0;
  let holidayDays = 0;
  let totalDays = 0;
  const current = new Date(start);

  while (current <= end) {
    totalDays++;
    const dayOfWeek = current.getDay();
    const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;

    if (dayOfWeek === 0 || dayOfWeek === 6) {
      weekendDays++;
    } else if (holidaySet.has(dateStr)) {
      holidayDays++;
    } else {
      workingDays++;
    }

    current.setDate(current.getDate() + 1);
  }

  return { workingDays, totalDays, weekendDays, holidayDays };
}

export default function MyLeavePage() {
  const [summary, setSummary] = useState<Summary>({ totalGranted: 0, totalUsed: 0, totalRemain: 0, usageRate: 0 });
  const [balancesByType, setBalancesByType] = useState<BalanceByType[]>([]);
  const [timeWallet, setTimeWallet] = useState<TimeWalletData | null>(null);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{open: boolean; title: string; description: string; action: () => void}>({open: false, title: '', description: '', action: () => {}});

  // Holidays for working day calculation
  const [holidayDates, setHolidayDates] = useState<string[]>([]);

  // Form state
  const [formLeaveTypeId, setFormLeaveTypeId] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formUseUnit, setFormUseUnit] = useState('FULL_DAY');
  const [formReason, setFormReason] = useState('');

  // Collapsible toggles
  const [showBalanceByType, setShowBalanceByType] = useState(false);
  const [showTimeWallet, setShowTimeWallet] = useState(false);

  // Calculate working days (excluding weekends and holidays)
  const dayCalc = calculateWorkingDaysClient(formStartDate, formEndDate, holidayDates);
  const requestDays = (formUseUnit === 'AM_HALF' || formUseUnit === 'PM_HALF')
    ? 0.5
    : dayCalc.workingDays;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/leave/my');
      if (res.status === 401) { window.location.href = '/login'; return; }
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary);
        setRequests(data.requests);
        if (data.balancesByType) setBalancesByType(data.balancesByType);
        if (data.timeWallet) setTimeWallet(data.timeWallet);
      } else {
        setError('데이터를 불러오는데 실패했습니다.');
      }
    } catch {
      setError('서버에 연결할 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLeaveTypes = useCallback(async () => {
    try {
      const res = await fetch('/api/leave/types');
      if (res.ok) {
        const data = await res.json();
        setLeaveTypes(data);
      }
    } catch {
      // silently fail
    }
  }, []);

  const fetchHolidays = useCallback(async (year: number) => {
    try {
      const res = await fetch(`/api/holidays?year=${year}`);
      if (res.ok) {
        const data = await res.json();
        setHolidayDates(
          (data.holidays || []).map((h: HolidayData) => {
            const d = new Date(h.date);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          })
        );
      }
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchLeaveTypes();
    fetchHolidays(new Date().getFullYear());
  }, [fetchData, fetchLeaveTypes, fetchHolidays]);

  // Fetch holidays for additional year if dates span multiple years
  useEffect(() => {
    if (formStartDate) {
      const startYear = new Date(formStartDate).getFullYear();
      const currentYear = new Date().getFullYear();
      if (startYear !== currentYear) {
        fetchHolidays(startYear);
      }
    }
  }, [formStartDate, fetchHolidays]);

  const handleSubmit = async () => {
    if (!formLeaveTypeId || !formStartDate || !formEndDate) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/leave/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leaveTypeId: formLeaveTypeId,
          startDate: formStartDate,
          endDate: formEndDate,
          useUnit: formUseUnit,
          requestDays,
          reason: formReason,
        }),
      });
      if (res.ok) {
        toast.success('휴가 신청이 완료되었습니다.');
        setDialogOpen(false);
        resetForm();
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.message || '신청에 실패했습니다.');
      }
    } catch {
      toast.error('서버에 연결할 수 없습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = (id: string) => {
    setConfirmDialog({
      open: true,
      title: '휴가 취소',
      description: '휴가 신청을 취소하시겠습니까?',
      action: async () => {
        try {
          const res = await fetch(`/api/leave/request/${id}`, { method: 'DELETE' });
          if (res.ok) {
            toast.success('휴가 신청이 취소되었습니다.');
            fetchData();
          } else {
            const err = await res.json();
            toast.error(err.message || '취소에 실패했습니다.');
          }
        } catch {
          toast.error('서버에 연결할 수 없습니다.');
        }
      },
    });
  };

  const resetForm = () => {
    setFormLeaveTypeId('');
    setFormStartDate('');
    setFormEndDate('');
    setFormUseUnit('FULL_DAY');
    setFormReason('');
  };

  return (
    <div>
      {/* Unified Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Palmtree className="w-7 h-7 text-emerald-600" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">나의 휴가</h1>
            <p className="text-sm text-gray-500 mt-0.5">나의 휴가 현황과 신청 내역을 확인합니다.</p>
          </div>
        </div>
        <Button className="w-full sm:w-auto" onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          휴가 신청
        </Button>
      </div>

      {/* Summary Cards */}
      <Card className="mb-6">
        <CardContent className="p-0">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-100">
            <div className="p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">총 부여</p>
              <p className="text-2xl font-bold">{summary.totalGranted}일</p>
            </div>
            <div className="p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">총 사용</p>
              <p className="text-2xl font-bold">{summary.totalUsed}일</p>
            </div>
            <div className="p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">총 잔여</p>
              <p className="text-2xl font-bold text-emerald-600">{summary.totalRemain}일</p>
            </div>
            <div className="p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">사용률</p>
              <p className="text-2xl font-bold mb-2">{summary.usageRate}%</p>
              <Progress value={summary.usageRate} className="h-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Per-type Balance Breakdown (collapsible, default closed) */}
      {balancesByType.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => setShowBalanceByType(!showBalanceByType)}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            {showBalanceByType ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            유형별 휴가 잔여
          </button>
          {showBalanceByType && (
            <div className="mt-2 p-4 bg-muted/50 border rounded-lg">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 text-sm">
                {balancesByType.map((b) => {
                  const typeName = leaveTypes.find((lt) => lt.code === b.leaveTypeCode)?.name || b.leaveTypeCode;
                  return (
                    <div key={b.leaveTypeCode} className="flex flex-col">
                      <span className="text-muted-foreground">{typeName}</span>
                      <p className="font-bold">{b.totalRemain}일 <span className="font-normal text-xs text-muted-foreground">/ {b.totalGranted}일</span></p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Time Wallet (collapsible, default closed) */}
      {timeWallet && (timeWallet.compTime.earned > 0 || timeWallet.annual.earned > 0) && (
        <div className="mb-6">
          <button
            onClick={() => setShowTimeWallet(!showTimeWallet)}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            {showTimeWallet ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            시간 지갑
            <span className="text-xs text-indigo-600 font-medium">{timeWallet.totalRemainHours}h</span>
          </button>
          {showTimeWallet && (
            <div className="mt-2 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">보상시간</span>
                  <p className="font-bold text-indigo-600">{timeWallet.compTime.remain}h</p>
                </div>
                <div>
                  <span className="text-gray-500">연차시간</span>
                  <p className="font-bold text-blue-600">{timeWallet.annual.remain}h</p>
                </div>
                <div>
                  <span className="text-gray-500">합계</span>
                  <p className="font-bold">{timeWallet.totalRemainHours}h ({timeWallet.totalRemainDays}일)</p>
                </div>
                <div>
                  <span className="text-gray-500">차감 순서</span>
                  <p className="font-bold text-xs">보상시간 → 연차</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Requests Table */}
      <Card>
        <CardHeader>
          <CardTitle>휴가 신청 내역</CardTitle>
        </CardHeader>
        <CardContent>
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
          ) : requests.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 mb-4">휴가 신청 내역이 없습니다.</p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                휴가 신청하기
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="border-b text-left bg-gray-50">
                    <th className="py-3 px-2 font-medium">신청일</th>
                    <th className="py-3 px-2 font-medium">휴가유형</th>
                    <th className="py-3 px-2 font-medium">기간</th>
                    <th className="py-3 px-2 font-medium hidden sm:table-cell">구분</th>
                    <th className="py-3 px-2 font-medium">일수</th>
                    <th className="py-3 px-2 font-medium">상태</th>
                    <th className="py-3 px-2 font-medium hidden sm:table-cell">사유</th>
                    <th className="py-3 px-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req) => (
                    <tr key={req.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-2">{formatDate(req.appliedAt)}</td>
                      <td className="py-3 px-2">{req.leaveTypeName}</td>
                      <td className="py-3 px-2">
                        {formatDate(req.startDate)}
                        {formatDate(req.startDate) !== formatDate(req.endDate) && ` ~ ${formatDate(req.endDate)}`}
                      </td>
                      <td className="py-3 px-2 hidden sm:table-cell">{UNIT_LABELS[req.useUnit] || req.useUnit}</td>
                      <td className="py-3 px-2">{req.requestDays}일</td>
                      <td className="py-3 px-2">
                        <Badge variant="outline" className={getStatusStyle(req.status)}>
                          {STATUS_LABELS[req.status] || req.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-2 max-w-[200px] truncate hidden sm:table-cell">{req.reason || '-'}</td>
                      <td className="py-3 px-2">
                        {req.status === 'PENDING' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancel(req.id)}
                          >
                            <X className="w-4 h-4" />
                            <span className="hidden sm:inline ml-1">취소</span>
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Request Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>휴가 신청</DialogTitle>
            <DialogDescription>신청할 휴가 정보를 입력하세요.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>휴가 유형</Label>
              <Select value={formLeaveTypeId} onValueChange={(val) => {
                setFormLeaveTypeId(val);
                const selected = leaveTypes.find(lt => lt.id === val);
                if (selected?.code === 'AM_HALF') setFormUseUnit('AM_HALF');
                else if (selected?.code === 'PM_HALF') setFormUseUnit('PM_HALF');
              }}>
                <SelectTrigger className="w-full mt-1">
                  <SelectValue placeholder="휴가 유형 선택" />
                </SelectTrigger>
                <SelectContent>
                  {leaveTypes.map((lt) => (
                    <SelectItem key={lt.id} value={lt.id}>{lt.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>시작일</Label>
                <Input
                  type="date"
                  value={formStartDate}
                  onChange={(e) => {
                    setFormStartDate(e.target.value);
                    if (!formEndDate || e.target.value > formEndDate) {
                      setFormEndDate(e.target.value);
                    }
                  }}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>종료일</Label>
                <Input
                  type="date"
                  value={formEndDate}
                  onChange={(e) => setFormEndDate(e.target.value)}
                  min={formStartDate}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label>휴가 구분</Label>
              <RadioGroup
                value={formUseUnit}
                onValueChange={(val) => {
                  setFormUseUnit(val);
                  if ((val === 'AM_HALF' || val === 'PM_HALF') && formStartDate) {
                    setFormEndDate(formStartDate);
                  }
                }}
                className="flex flex-wrap gap-4 mt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="FULL_DAY" id="full" />
                  <Label htmlFor="full">종일</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="AM_HALF" id="am" />
                  <Label htmlFor="am">오전반차</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="PM_HALF" id="pm" />
                  <Label htmlFor="pm">오후반차</Label>
                </div>
              </RadioGroup>
            </div>
            <div>
              <Label>신청 일수</Label>
              <Input type="number" value={requestDays} readOnly className="mt-1 bg-muted" />
              {formStartDate && formEndDate && formUseUnit === 'FULL_DAY' && dayCalc.totalDays > 0 && (
                requestDays === 0 ? (
                  <p className="text-xs text-red-500 mt-1">
                    선택 기간에 근무일이 없습니다
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">
                    총 {dayCalc.totalDays}일 중 주말 {dayCalc.weekendDays}일
                    {dayCalc.holidayDays > 0 && `, 공휴일 ${dayCalc.holidayDays}일`} 제외
                  </p>
                )
              )}
            </div>
            <div>
              <Label>사유</Label>
              <Textarea
                value={formReason}
                onChange={(e) => setFormReason(e.target.value)}
                placeholder="휴가 사유를 입력하세요"
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
              disabled={submitting || !formLeaveTypeId || !formStartDate || !formEndDate || requestDays <= 0}
            >
              {submitting ? '신청 중...' : '신청'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog */}
      <Dialog open={confirmDialog.open} onOpenChange={(v) => setConfirmDialog(prev => ({...prev, open: v}))}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{confirmDialog.title}</DialogTitle>
            <DialogDescription>{confirmDialog.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setConfirmDialog(prev => ({...prev, open: false}))}>취소</Button>
            <Button variant="destructive" onClick={async () => { await confirmDialog.action(); setConfirmDialog(prev => ({...prev, open: false})); }}>확인</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
