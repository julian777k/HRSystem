'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FileText, Check, X, Users, ChevronDown, ChevronRight, ClipboardCheck, Loader2, MoreVertical, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const ADMIN_ROLES = ["SYSTEM_ADMIN", "COMPANY_ADMIN"];

interface RegisterRecord {
  id: string;
  employeeName: string;
  departmentName: string;
  positionName: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  useUnit: string;
  requestDays: number;
  reason: string | null;
  status: string;
  appliedAt: string;
}

interface GroupedRequest {
  key: string;
  employeeName: string;
  departmentName: string;
  positionName: string;
  records: RegisterRecord[];
  totalDays: number;
  rangeStart: string;
  rangeEnd: string;
  leaveTypes: string[];
  isGroup: boolean;
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

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '-';
  return dateStr.split('T')[0];
}

function formatDateWithDay(dateStr: string | null | undefined) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const dayOfWeek = dayNames[d.getDay()];
  return `${m}/${day}(${dayOfWeek})`;
}

function isConsecutiveOrOverlapping(endA: string, startB: string): boolean {
  const a = new Date(endA);
  const b = new Date(startB);
  const diffMs = b.getTime() - a.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= -1 && diffDays <= 3;
}

function groupConsecutiveRecords(records: RegisterRecord[]): GroupedRequest[] {
  if (!records || records.length === 0) return [];

  // Filter out any null/undefined entries defensively
  const validRecords = records.filter((r): r is RegisterRecord => r != null);
  if (validRecords.length === 0) return [];

  const sorted = [...validRecords].sort((a, b) => {
    if (a.employeeName !== b.employeeName) return a.employeeName.localeCompare(b.employeeName);
    return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
  });

  const groups: GroupedRequest[] = [];
  let current: RegisterRecord[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = current[current.length - 1];
    const curr = sorted[i];

    if (
      curr.employeeName === prev.employeeName &&
      isConsecutiveOrOverlapping(prev.endDate, curr.startDate)
    ) {
      current.push(curr);
    } else {
      groups.push(buildGroup(current));
      current = [curr];
    }
  }
  groups.push(buildGroup(current));

  return groups;
}

function buildGroup(records: RegisterRecord[]): GroupedRequest {
  const first = records[0];
  const totalDays = records.reduce((sum, r) => sum + r.requestDays, 0);
  const starts = records.map(r => new Date(r.startDate).getTime());
  const ends = records.map(r => new Date(r.endDate).getTime());
  const rangeStart = new Date(Math.min(...starts)).toISOString();
  const rangeEnd = new Date(Math.max(...ends)).toISOString();
  const leaveTypes = [...new Set(records.map(r => r.leaveTypeName))];

  return {
    key: records.map(r => r.id).join('-'),
    employeeName: first.employeeName,
    departmentName: first.departmentName,
    positionName: first.positionName,
    records,
    totalDays,
    rangeStart,
    rangeEnd,
    leaveTypes,
    isGroup: records.length > 1,
  };
}

export default function LeaveRequestsPage() {
  const router = useRouter();
  const [userRole, setUserRole] = useState('');
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [tab, setTab] = useState('pending');
  const [records, setRecords] = useState<RegisterRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Batch selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchProcessing, setBatchProcessing] = useState(false);

  // Expanded groups
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState('');

  // Approval dialog
  const [approvalDialog, setApprovalDialog] = useState(false);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject'>('approve');
  const [approvalTargetIds, setApprovalTargetIds] = useState<string[]>([]);
  const [approvalLabel, setApprovalLabel] = useState('');
  const [approvalComment, setApprovalComment] = useState('');
  const [processing, setProcessing] = useState(false);

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

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (tab === 'pending') {
        params.set('status', 'PENDING');
      } else if (statusFilter && statusFilter !== 'all') {
        params.set('status', statusFilter);
      }
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const res = await fetch(`/api/leave/register?${params}`);
      if (res.ok) {
        const json = await res.json();
        setRecords(json.data ?? []);
      } else {
        setError('데이터를 불러오는데 실패했습니다.');
      }
    } catch {
      setError('서버에 연결할 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [tab, statusFilter, startDate, endDate]);

  useEffect(() => {
    if (roleLoaded && ADMIN_ROLES.includes(userRole)) {
      fetchRecords();
    }
  }, [fetchRecords, roleLoaded, userRole]);

  const groupedRecords = useMemo(() => {
    if (tab !== 'pending') return [];
    return groupConsecutiveRecords(records);
  }, [records, tab]);

  const openApprovalDialog = (ids: string[], label: string, action: 'approve' | 'reject') => {
    setApprovalTargetIds(ids);
    setApprovalLabel(label);
    setApprovalAction(action);
    setApprovalComment('');
    setApprovalDialog(true);
  };

  const handleApproval = async () => {
    if (approvalTargetIds.length === 0) return;
    setProcessing(true);
    setBatchProcessing(true);
    const newStatus = approvalAction === 'approve' ? 'APPROVED' : 'REJECTED';
    let success = 0;
    let fail = 0;

    try {
      for (const id of approvalTargetIds) {
        try {
          const res = await fetch(`/api/leave/request/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus, comment: approvalComment }),
          });
          if (res.ok) success++;
          else fail++;
        } catch {
          fail++;
        }
      }

      setApprovalDialog(false);

      if (fail === 0) {
        toast.success(
          approvalAction === 'approve'
            ? `${success}건이 승인되었습니다.`
            : `${success}건이 반려되었습니다.`
        );
      } else {
        toast.error(`${success}건 처리, ${fail}건 실패`);
      }
      fetchRecords();
    } finally {
      setProcessing(false);
      setBatchProcessing(false);
    }
  };

  const toggleGroupSelect = (group: GroupedRequest) => {
    const groupIds = group.records.map(r => r.id);
    const allSelected = groupIds.every(id => selectedIds.has(id));

    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        groupIds.forEach(id => next.delete(id));
      } else {
        groupIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === records.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(records.map(r => r.id)));
    }
  };

  const handleBatchApprove = async () => {
    if (selectedIds.size === 0) return;
    openApprovalDialog(
      Array.from(selectedIds),
      `선택한 ${selectedIds.size}건`,
      'approve'
    );
  };

  const openDeleteDialog = (id: string) => {
    setDeleteTargetId(id);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    try {
      const res = await fetch(`/api/leave/request/${deleteTargetId}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('삭제되었습니다.');
        setDeleteDialogOpen(false);
        fetchRecords();
      } else {
        const err = await res.json();
        toast.error(err.message || '삭제에 실패했습니다.');
      }
    } catch {
      toast.error('서버에 연결할 수 없습니다.');
    }
  };

  const toggleGroupExpand = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  useEffect(() => {
    setSelectedIds(new Set());
    setExpandedGroups(new Set());
  }, [tab, records]);

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
      <div className="flex items-center gap-3 mb-6">
        <ClipboardCheck className="w-7 h-7 text-emerald-600" />
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">결재 관리</h1>
          <p className="text-sm text-gray-500 mt-0.5">휴가 신청을 승인하거나 반려합니다.</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pending">결재대기</TabsTrigger>
          <TabsTrigger value="all">전체</TabsTrigger>
        </TabsList>

        {/* Filters for "all" tab */}
        {tab === 'all' && (
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 mt-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="상태" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 상태</SelectItem>
                <SelectItem value="PENDING">대기</SelectItem>
                <SelectItem value="APPROVED">승인</SelectItem>
                <SelectItem value="REJECTED">반려</SelectItem>
                <SelectItem value="CANCELLED">취소</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full sm:w-[150px]"
              />
              <span className="text-muted-foreground">~</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full sm:w-[150px]"
              />
            </div>
          </div>
        )}

        <TabsContent value="pending">
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>결재 대기 목록</CardTitle>
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
                  <Button variant="outline" onClick={fetchRecords}>다시 시도</Button>
                </div>
              ) : groupedRecords.length === 0 ? (
                <div className="text-center py-12">
                  <ClipboardCheck className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-400 mb-4">결재 대기 중인 신청이 없습니다.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Batch controls */}
                  <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={selectedIds.size === records.length && records.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                      <span className="text-sm text-gray-600">
                        {selectedIds.size > 0 ? `${selectedIds.size}건 선택됨` : '전체 선택'}
                      </span>
                    </div>
                    {selectedIds.size > 0 && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleBatchApprove}
                          disabled={batchProcessing}
                        >
                          <Check className="w-4 h-4 mr-1" />
                          일괄 승인 ({selectedIds.size}건)
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => openApprovalDialog(
                            Array.from(selectedIds),
                            `선택한 ${selectedIds.size}건`,
                            'reject'
                          )}
                          disabled={batchProcessing}
                        >
                          <X className="w-4 h-4 mr-1" />
                          일괄 반려
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Grouped records */}
                  {groupedRecords.map((group) => {
                    const groupIds = group.records.map(r => r.id);
                    const allSelected = groupIds.every(id => selectedIds.has(id));
                    const someSelected = groupIds.some(id => selectedIds.has(id));
                    const isExpanded = expandedGroups.has(group.key);

                    if (!group.isGroup) {
                      const record = group.records[0];
                      return (
                        <div key={record.id} className="border rounded-lg p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3 hover:shadow-sm transition-shadow">
                          <div className="flex gap-3 min-w-0">
                            <Checkbox
                              checked={selectedIds.has(record.id)}
                              onCheckedChange={() => toggleSelect(record.id)}
                              className="mt-1"
                            />
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium">{record.employeeName}</span>
                                <span className="text-muted-foreground text-sm">{record.departmentName} / {record.positionName}</span>
                              </div>
                              <div className="text-sm">
                                <span className="font-medium">{record.leaveTypeName}</span>
                                {' | '}
                                {formatDateWithDay(record.startDate)} ~ {formatDateWithDay(record.endDate)}
                                {' | '}
                                {UNIT_LABELS[record.useUnit] || record.useUnit}
                                {' | '}
                                {record.requestDays}일
                              </div>
                              {record.reason && (
                                <div className="text-sm text-muted-foreground truncate">사유: {record.reason}</div>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <Button
                              size="sm"
                              className="w-full sm:w-auto"
                              onClick={() => openApprovalDialog([record.id], `${record.employeeName}님의 ${record.leaveTypeName}`, 'approve')}
                            >
                              <Check className="w-4 h-4 mr-1" />
                              승인
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="w-full sm:w-auto"
                              onClick={() => openApprovalDialog([record.id], `${record.employeeName}님의 ${record.leaveTypeName}`, 'reject')}
                            >
                              <X className="w-4 h-4 mr-1" />
                              반려
                            </Button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={group.key} className="border-2 border-emerald-200 rounded-lg overflow-hidden">
                        {/* Group Header */}
                        <div className="bg-emerald-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex gap-3 min-w-0 items-start">
                            <Checkbox
                              checked={allSelected}
                              className={`mt-1 ${someSelected && !allSelected ? 'opacity-60' : ''}`}
                              onCheckedChange={() => toggleGroupSelect(group)}
                            />
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Users className="w-4 h-4 text-emerald-600" />
                                <span className="font-semibold text-emerald-800">{group.employeeName}</span>
                                <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200">
                                  연속 {group.records.length}건
                                </Badge>
                                <span className="text-muted-foreground text-sm">{group.departmentName} / {group.positionName}</span>
                              </div>
                              <div className="text-sm text-emerald-700">
                                <span className="font-medium">{group.leaveTypes.join(', ')}</span>
                                {' | '}
                                {formatDateWithDay(group.rangeStart)} ~ {formatDateWithDay(group.rangeEnd)}
                                {' | '}
                                총 {group.totalDays}일
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2 shrink-0 items-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleGroupExpand(group.key)}
                            >
                              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              <span className="ml-1 text-xs">상세</span>
                            </Button>
                            <Button
                              size="sm"
                              className="w-full sm:w-auto"
                              onClick={() => openApprovalDialog(
                                groupIds,
                                `${group.employeeName}님의 연속 ${group.records.length}건 (${group.totalDays}일)`,
                                'approve'
                              )}
                            >
                              <Check className="w-4 h-4 mr-1" />
                              일괄 승인
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="w-full sm:w-auto"
                              onClick={() => openApprovalDialog(
                                groupIds,
                                `${group.employeeName}님의 연속 ${group.records.length}건 (${group.totalDays}일)`,
                                'reject'
                              )}
                            >
                              <X className="w-4 h-4 mr-1" />
                              일괄 반려
                            </Button>
                          </div>
                        </div>

                        {/* Expanded details */}
                        {isExpanded && (
                          <div className="divide-y bg-white">
                            {group.records.map((record) => (
                              <div key={record.id} className="p-3 pl-12 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-gray-50 transition-colors">
                                <div className="flex gap-3 items-start min-w-0">
                                  <Checkbox
                                    checked={selectedIds.has(record.id)}
                                    onCheckedChange={() => toggleSelect(record.id)}
                                    className="mt-0.5"
                                  />
                                  <div className="text-sm space-y-0.5 min-w-0">
                                    <div>
                                      <span className="font-medium">{record.leaveTypeName}</span>
                                      {' | '}
                                      {formatDateWithDay(record.startDate)} ~ {formatDateWithDay(record.endDate)}
                                      {' | '}
                                      {UNIT_LABELS[record.useUnit] || record.useUnit}
                                      {' | '}
                                      {record.requestDays}일
                                    </div>
                                    {record.reason && (
                                      <div className="text-muted-foreground truncate">사유: {record.reason}</div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex gap-2 shrink-0">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openApprovalDialog([record.id], `${record.employeeName}님의 ${record.leaveTypeName}`, 'approve')}
                                  >
                                    승인
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openApprovalDialog([record.id], `${record.employeeName}님의 ${record.leaveTypeName}`, 'reject')}
                                  >
                                    반려
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all">
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>전체 신청 목록</CardTitle>
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
                  <Button variant="outline" onClick={fetchRecords}>다시 시도</Button>
                </div>
              ) : records.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-400 mb-4">신청 내역이 없습니다.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead>
                      <tr className="border-b text-left bg-gray-50">
                        <th className="py-3 px-2 font-medium">신청일</th>
                        <th className="py-3 px-2 font-medium">신청자</th>
                        <th className="py-3 px-2 font-medium hidden sm:table-cell">부서</th>
                        <th className="py-3 px-2 font-medium">휴가유형</th>
                        <th className="py-3 px-2 font-medium">기간</th>
                        <th className="py-3 px-2 font-medium">일수</th>
                        <th className="py-3 px-2 font-medium">상태</th>
                        <th className="py-3 px-2 font-medium hidden sm:table-cell">사유</th>
                        <th className="py-3 px-2 font-medium w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((record) => (
                        <tr key={record.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-2">{formatDate(record.appliedAt)}</td>
                          <td className="py-3 px-2 font-medium">{record.employeeName}</td>
                          <td className="py-3 px-2 hidden sm:table-cell">{record.departmentName}</td>
                          <td className="py-3 px-2">{record.leaveTypeName}</td>
                          <td className="py-3 px-2">
                            {formatDate(record.startDate)}
                            {formatDate(record.startDate) !== formatDate(record.endDate) && ` ~ ${formatDate(record.endDate)}`}
                          </td>
                          <td className="py-3 px-2">{record.requestDays}일</td>
                          <td className="py-3 px-2">
                            <Badge variant="outline" className={getStatusStyle(record.status)}>
                              {STATUS_LABELS[record.status] || record.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-2 max-w-[200px] truncate hidden sm:table-cell">{record.reason || '-'}</td>
                          <td className="py-3 px-2 text-right">
                            {record.status === 'PENDING' ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => openApprovalDialog([record.id], `${record.employeeName}님의 ${record.leaveTypeName}`, 'approve')}>
                                    <Check className="w-4 h-4 mr-2 text-green-600" />
                                    승인
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => openApprovalDialog([record.id], `${record.employeeName}님의 ${record.leaveTypeName}`, 'reject')}>
                                    <X className="w-4 h-4 mr-2 text-red-600" />
                                    반려
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => openDeleteDialog(record.id)} className="text-red-600">
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    삭제
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : (
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-400 hover:text-red-500" onClick={() => openDeleteDialog(record.id)}>
                                <Trash2 className="w-4 h-4" />
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
        </TabsContent>
      </Tabs>

      {/* Approval Dialog */}
      <Dialog open={approvalDialog} onOpenChange={setApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {approvalAction === 'approve' ? '휴가 승인' : '휴가 반려'}
            </DialogTitle>
            <DialogDescription>
              {approvalLabel}을(를) {approvalAction === 'approve' ? '승인' : '반려'}합니다.
              {approvalTargetIds.length > 1 && (
                <span className="block mt-1 text-emerald-600 font-medium">
                  총 {approvalTargetIds.length}건이 일괄 처리됩니다.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>코멘트</Label>
            <Textarea
              value={approvalComment}
              onChange={(e) => setApprovalComment(e.target.value)}
              placeholder={approvalAction === 'approve' ? '승인 코멘트 (선택)' : '반려 사유를 입력하세요'}
              className="mt-1"
            />
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setApprovalDialog(false)}>
              취소
            </Button>
            <Button
              variant={approvalAction === 'approve' ? 'default' : 'destructive'}
              className="w-full sm:w-auto"
              onClick={handleApproval}
              disabled={processing}
            >
              {processing ? '처리 중...' : approvalAction === 'approve' ? '승인' : '반려'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>기록 삭제</DialogTitle>
            <DialogDescription>이 휴가 신청 기록을 삭제하시겠습니까? 삭제된 데이터는 복구할 수 없습니다.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setDeleteDialogOpen(false)}>
              취소
            </Button>
            <Button
              variant="destructive"
              className="w-full sm:w-auto"
              onClick={handleDelete}
            >
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
