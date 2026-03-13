'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { Clock, Plus, X, Loader2, FileX } from 'lucide-react';
import { toast } from 'sonner';

interface OvertimeRequest {
  id: string;
  date: string;
  overtimeType: string;
  startTime: string;
  endTime: string;
  hours: number;
  reason: string;
  status: string;
  createdAt: string;
  approvals?: {
    approver: { id: string; name: string };
    action: string;
    comment: string | null;
  }[];
}

const OVERTIME_TYPE_LABELS: Record<string, string> = {
  WEEKDAY_OVERTIME: '평일 연장',
  WEEKEND: '휴일 근무',
  HOLIDAY: '공휴일 근무',
  NIGHT: '야간 근무',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: '대기',
  IN_PROGRESS: '진행중',
  APPROVED: '승인',
  REJECTED: '반려',
  CANCELLED: '취소',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toISOString().split('T')[0];
}

function calculateHours(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 0;
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  let diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff < 0) diff += 24 * 60;
  return Math.round((diff / 60) * 10) / 10;
}

function addTime(time: string, hours: number): string {
  const [h, m] = time.split(':').map(Number);
  const totalMin = h * 60 + m + Math.round(hours * 60);
  const nh = Math.floor(totalMin / 60) % 24;
  const nm = totalMin % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}

interface WorkSettings {
  workEndTime: string;
  workStartTime: string;
  nightStartTime: string;
}

export default function OvertimePage() {
  const [requests, setRequests] = useState<OvertimeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{open: boolean; title: string; description: string; action: () => void}>({open: false, title: '', description: '', action: () => {}});

  // Work settings
  const [ws, setWs] = useState<WorkSettings>({
    workEndTime: '18:00',
    workStartTime: '09:00',
    nightStartTime: '22:00',
  });

  // Form state
  const [formDate, setFormDate] = useState('');
  const [formOvertimeType, setFormOvertimeType] = useState('');
  const [formStartTime, setFormStartTime] = useState('');
  const [formEndTime, setFormEndTime] = useState('');
  const [formHours, setFormHours] = useState<number>(0);
  const [formReason, setFormReason] = useState('');

  // 유형별 기본 시작시간
  const getDefaultStartTime = (type: string): string => {
    switch (type) {
      case 'WEEKDAY_OVERTIME': return ws.workEndTime;
      case 'NIGHT': return ws.nightStartTime;
      case 'WEEKEND':
      case 'HOLIDAY': return ws.workStartTime;
      default: return '';
    }
  };

  const handleOvertimeTypeChange = (type: string) => {
    setFormOvertimeType(type);
    const start = getDefaultStartTime(type);
    setFormStartTime(start);
    if (formHours > 0 && start) {
      setFormEndTime(addTime(start, formHours));
    } else {
      setFormEndTime('');
    }
  };

  const handleHoursChange = (hours: number) => {
    setFormHours(hours);
    if (formStartTime && hours > 0) {
      setFormEndTime(addTime(formStartTime, hours));
    }
  };

  const handleStartTimeChange = (value: string) => {
    setFormStartTime(value);
    if (value && formEndTime) {
      setFormHours(calculateHours(value, formEndTime));
    } else if (value && formHours > 0) {
      setFormEndTime(addTime(value, formHours));
    }
  };

  const handleEndTimeChange = (value: string) => {
    setFormEndTime(value);
    if (formStartTime && value) {
      setFormHours(calculateHours(formStartTime, value));
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/overtime/my');
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests);
      } else {
        setError('데이터를 불러오는데 실패했습니다.');
      }
    } catch {
      setError('서버에 연결할 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // 근무설정 + 시간외근무 정책 가져오기
    Promise.all([
      fetch('/api/company/settings').then(r => r.ok ? r.json() : null),
      fetch('/api/settings/overtime').then(r => r.ok ? r.json() : null),
    ]).then(([company, overtime]) => {
      setWs(prev => ({
        ...prev,
        ...(company?.work_end_time && { workEndTime: company.work_end_time }),
        ...(company?.work_start_time && { workStartTime: company.work_start_time }),
        ...(overtime?.nightStartTime && { nightStartTime: overtime.nightStartTime }),
      }));
    }).catch(() => {});
  }, [fetchData]);

  const resetForm = () => {
    setFormDate('');
    setFormOvertimeType('');
    setFormStartTime('');
    setFormEndTime('');
    setFormHours(0);
    setFormReason('');
  };

  const handleSubmit = async () => {
    if (!formDate || !formOvertimeType || !formReason) {
      toast.error('날짜, 근무 유형, 사유를 입력해주세요.');
      return;
    }
    if (formHours <= 0) {
      toast.error('시간이 올바르지 않습니다.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/overtime/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: formDate,
          overtimeType: formOvertimeType,
          startTime: formStartTime || null,
          endTime: formEndTime || null,
          hours: formHours,
          reason: formReason,
        }),
      });
      if (res.ok) {
        toast.success('연장근무 신청이 완료되었습니다.');
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
      title: '신청 취소',
      description: '연장근무 신청을 취소하시겠습니까?',
      action: async () => {
        try {
          const res = await fetch(`/api/overtime/request/${id}`, { method: 'DELETE' });
          if (res.ok) {
            toast.success('신청이 취소되었습니다.');
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

  return (
    <div>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Clock className="w-7 h-7 text-indigo-600" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">연장근무 신청</h1>
            <p className="text-sm text-gray-500 mt-0.5">연장근무(시간외근무) 신청 및 내역을 확인합니다.</p>
          </div>
        </div>
        <Button className="w-full sm:w-auto" onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          연장근무 신청
        </Button>
      </div>

      {/* Requests Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-600" />
            연장근무 신청 내역
          </CardTitle>
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
              <FileX className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 mb-4">연장근무 신청 내역이 없습니다.</p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                연장근무 신청하기
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-2.5 px-3 font-medium text-gray-600">날짜</th>
                    <th className="text-left py-2.5 px-3 font-medium text-gray-600">유형</th>
                    <th className="text-left py-2.5 px-3 font-medium text-gray-600">시작</th>
                    <th className="text-left py-2.5 px-3 font-medium text-gray-600">종료</th>
                    <th className="text-left py-2.5 px-3 font-medium text-gray-600">시간</th>
                    <th className="text-left py-2.5 px-3 font-medium text-gray-600 hidden sm:table-cell">사유</th>
                    <th className="text-left py-2.5 px-3 font-medium text-gray-600">상태</th>
                    <th className="text-left py-2.5 px-3 font-medium text-gray-600"></th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req) => (
                    <tr key={req.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                      <td className="py-2.5 px-3">{formatDate(req.date)}</td>
                      <td className="py-2.5 px-3">{OVERTIME_TYPE_LABELS[req.overtimeType] || req.overtimeType}</td>
                      <td className="py-2.5 px-3">{req.startTime}</td>
                      <td className="py-2.5 px-3">{req.endTime}</td>
                      <td className="py-2.5 px-3">{req.hours}h</td>
                      <td className="py-2.5 px-3 max-w-[200px] truncate hidden sm:table-cell">{req.reason || '-'}</td>
                      <td className="py-2.5 px-3">
                        <Badge className={STATUS_COLORS[req.status] || 'bg-gray-100 text-gray-800'}>
                          {STATUS_LABELS[req.status] || req.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3">
                        {(req.status === 'PENDING' || req.status === 'IN_PROGRESS') && (
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

      {/* Request Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>연장근무 신청</DialogTitle>
            <DialogDescription>연장근무(시간외근무) 정보를 입력하세요.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>날짜</Label>
              <Input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>근무 유형</Label>
              <Select value={formOvertimeType} onValueChange={handleOvertimeTypeChange}>
                <SelectTrigger className="w-full mt-1">
                  <SelectValue placeholder="근무 유형 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WEEKDAY_OVERTIME">평일 연장</SelectItem>
                  <SelectItem value="WEEKEND">휴일 근무</SelectItem>
                  <SelectItem value="HOLIDAY">공휴일 근무</SelectItem>
                  <SelectItem value="NIGHT">야간 근무</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>연장근무 시간 <span className="text-red-500">*</span></Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={formHours || ''}
                  onChange={(e) => handleHoursChange(parseFloat(e.target.value) || 0)}
                  placeholder="예: 2"
                />
                <span className="text-sm text-gray-500 whitespace-nowrap">시간</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>시작 시간</Label>
                <Input
                  type="time"
                  value={formStartTime}
                  onChange={(e) => handleStartTimeChange(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>종료 시간</Label>
                <Input
                  type="time"
                  value={formEndTime}
                  onChange={(e) => handleEndTimeChange(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">
              근무 유형 선택 시 시작시간이 자동 설정됩니다. 수동 변경 가능합니다.
            </p>
            <div>
              <Label>사유</Label>
              <Textarea
                value={formReason}
                onChange={(e) => setFormReason(e.target.value)}
                placeholder="연장근무 사유를 입력하세요"
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
              disabled={submitting || !formDate || !formOvertimeType || formHours <= 0 || !formReason}
            >
              {submitting ? '신청 중...' : '신청'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
