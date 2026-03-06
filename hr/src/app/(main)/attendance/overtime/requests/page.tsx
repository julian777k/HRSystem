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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ClipboardList, Check, X, Filter, Loader2, FileX, MoreVertical, Trash2 } from 'lucide-react';
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
  employee: {
    id: string;
    name: string;
    employeeNumber: string;
    department?: { id: string; name: string };
  };
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

export default function OvertimeRequestsPage() {
  const [requests, setRequests] = useState<OvertimeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);

  // Filter state
  const [filterStatus, setFilterStatus] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // Reject dialog
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectTargetId, setRejectTargetId] = useState('');
  const [rejectComment, setRejectComment] = useState('');

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{open: boolean; title: string; description: string; action: () => void}>({open: false, title: '', description: '', action: () => {}});

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filterStatus && filterStatus !== 'ALL') params.set('status', filterStatus);
      if (filterStartDate) params.set('startDate', filterStartDate);
      if (filterEndDate) params.set('endDate', filterEndDate);

      const qs = params.toString();
      const res = await fetch(`/api/overtime/requests${qs ? `?${qs}` : ''}`);
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests);
      } else if (res.status === 403) {
        setError('접근 권한이 없습니다.');
      } else {
        setError('데이터를 불러오는데 실패했습니다.');
      }
    } catch {
      setError('서버에 연결할 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterStartDate, filterEndDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApprove = (id: string) => {
    setConfirmDialog({
      open: true,
      title: '신청 승인',
      description: '이 연장근무 신청을 승인하시겠습니까?',
      action: async () => {
        setProcessing(id);
        try {
          const res = await fetch(`/api/overtime/request/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'APPROVED' }),
          });
          if (res.ok) {
            const data = await res.json();
            toast.success(data.message || '승인되었습니다.');
            fetchData();
          } else {
            const err = await res.json();
            toast.error(err.message || '승인에 실패했습니다.');
          }
        } catch {
          toast.error('서버에 연결할 수 없습니다.');
        } finally {
          setProcessing(null);
        }
      },
    });
  };

  const openRejectDialog = (id: string) => {
    setRejectTargetId(id);
    setRejectComment('');
    setRejectDialogOpen(true);
  };

  const handleReject = async () => {
    if (!rejectTargetId) return;
    setProcessing(rejectTargetId);
    try {
      const res = await fetch(`/api/overtime/request/${rejectTargetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'REJECTED', comment: rejectComment }),
      });
      if (res.ok) {
        toast.success('반려되었습니다.');
        setRejectDialogOpen(false);
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.message || '반려에 실패했습니다.');
      }
    } catch {
      toast.error('서버에 연결할 수 없습니다.');
    } finally {
      setProcessing(null);
    }
  };

  const openDeleteDialog = (id: string) => {
    setDeleteTargetId(id);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    setProcessing(deleteTargetId);
    try {
      const res = await fetch(`/api/overtime/request/${deleteTargetId}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('삭제되었습니다.');
        setDeleteDialogOpen(false);
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.message || '삭제에 실패했습니다.');
      }
    } catch {
      toast.error('서버에 연결할 수 없습니다.');
    } finally {
      setProcessing(null);
    }
  };

  const pendingCount = requests.filter((r) => r.status === 'PENDING' || r.status === 'IN_PROGRESS').length;

  return (
    <div>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <ClipboardList className="w-7 h-7 text-indigo-600" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">연장근무 현황 관리</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              부서원의 연장근무 신청을 조회하고 승인/반려합니다.
              {pendingCount > 0 && (
                <span className="text-yellow-600 font-medium ml-2">
                  (대기 {pendingCount}건)
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-end gap-4">
            <div className="w-full sm:w-auto">
              <Label className="text-xs text-gray-600">상태</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full sm:w-[140px] mt-1">
                  <SelectValue placeholder="전체" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">전체</SelectItem>
                  <SelectItem value="PENDING">대기</SelectItem>
                  <SelectItem value="APPROVED">승인</SelectItem>
                  <SelectItem value="REJECTED">반려</SelectItem>
                  <SelectItem value="CANCELLED">취소</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-auto">
              <Label className="text-xs text-gray-600">시작일</Label>
              <Input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className="mt-1 w-full sm:w-[160px]"
              />
            </div>
            <div className="w-full sm:w-auto">
              <Label className="text-xs text-gray-600">종료일</Label>
              <Input
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className="mt-1 w-full sm:w-[160px]"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFilterStatus('');
                setFilterStartDate('');
                setFilterEndDate('');
              }}
              className="w-full sm:w-auto"
            >
              <Filter className="w-4 h-4 mr-1" />
              초기화
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Requests Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-indigo-600" />
            연장근무 신청 목록
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
              <p className="text-gray-400">연장근무 신청 내역이 없습니다.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[800px]">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-2.5 px-3 font-medium text-gray-600">신청자</th>
                    <th className="text-left py-2.5 px-3 font-medium text-gray-600 hidden lg:table-cell">부서</th>
                    <th className="text-left py-2.5 px-3 font-medium text-gray-600">날짜</th>
                    <th className="text-left py-2.5 px-3 font-medium text-gray-600">유형</th>
                    <th className="text-left py-2.5 px-3 font-medium text-gray-600">시간</th>
                    <th className="text-left py-2.5 px-3 font-medium text-gray-600 hidden sm:table-cell">사유</th>
                    <th className="text-left py-2.5 px-3 font-medium text-gray-600">상태</th>
                    <th className="text-right py-2.5 px-3 font-medium text-gray-600 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req) => (
                    <tr key={req.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="font-medium">{req.employee.name}</div>
                        <div className="text-xs text-gray-500">{req.employee.employeeNumber}</div>
                      </td>
                      <td className="py-2.5 px-3 hidden lg:table-cell text-gray-600">
                        {req.employee.department?.name || '-'}
                      </td>
                      <td className="py-2.5 px-3">{formatDate(req.date)}</td>
                      <td className="py-2.5 px-3">{OVERTIME_TYPE_LABELS[req.overtimeType] || req.overtimeType}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium">{req.hours}h</div>
                        <div className="text-xs text-gray-500">{req.startTime} ~ {req.endTime}</div>
                      </td>
                      <td className="py-2.5 px-3 max-w-[200px] truncate hidden sm:table-cell text-gray-600">{req.reason || '-'}</td>
                      <td className="py-2.5 px-3">
                        <Badge className={STATUS_COLORS[req.status] || 'bg-gray-100 text-gray-800'}>
                          {STATUS_LABELS[req.status] || req.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {(req.status === 'PENDING' || req.status === 'IN_PROGRESS') && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-green-600 border-green-300 hover:bg-green-50"
                                onClick={() => handleApprove(req.id)}
                                disabled={processing === req.id}
                              >
                                <Check className="w-3.5 h-3.5 mr-1" />
                                승인
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-red-600 border-red-300 hover:bg-red-50"
                                onClick={() => openRejectDialog(req.id)}
                                disabled={processing === req.id}
                              >
                                <X className="w-3.5 h-3.5 mr-1" />
                                반려
                              </Button>
                            </>
                          )}
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-red-500" onClick={() => openDeleteDialog(req.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
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
            <Button onClick={() => { confirmDialog.action(); setConfirmDialog(prev => ({...prev, open: false})); }}>확인</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>연장근무 반려</DialogTitle>
            <DialogDescription>반려 사유를 입력해주세요.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>반려 사유</Label>
              <Textarea
                value={rejectComment}
                onChange={(e) => setRejectComment(e.target.value)}
                placeholder="반려 사유를 입력하세요"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setRejectDialogOpen(false)}>
              취소
            </Button>
            <Button
              variant="destructive"
              className="w-full sm:w-auto"
              onClick={handleReject}
              disabled={processing === rejectTargetId}
            >
              {processing === rejectTargetId ? '처리 중...' : '반려'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>기록 삭제</DialogTitle>
            <DialogDescription>이 연장근무 기록을 삭제하시겠습니까? 삭제된 데이터는 복구할 수 없습니다.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setDeleteDialogOpen(false)}>
              취소
            </Button>
            <Button
              variant="destructive"
              className="w-full sm:w-auto"
              onClick={handleDelete}
              disabled={processing === deleteTargetId}
            >
              {processing === deleteTargetId ? '삭제 중...' : '삭제'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
