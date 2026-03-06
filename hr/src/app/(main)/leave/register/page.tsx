'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ClipboardList, Download, ChevronLeft, ChevronRight, Loader2, ChevronDown, ChevronUp, Filter } from 'lucide-react';

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

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface Department {
  id: string;
  name: string;
}

interface LeaveType {
  id: string;
  name: string;
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
  return new Date(dateStr).toISOString().split('T')[0];
}

export default function LeaveRegisterPage() {
  const router = useRouter();
  const [userRole, setUserRole] = useState('');
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [records, setRecords] = useState<RegisterRecord[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [departmentId, setDepartmentId] = useState('all');
  const [leaveTypeId, setLeaveTypeId] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);

  // Reference data
  const [departments, setDepartments] = useState<Department[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [showFilters, setShowFilters] = useState(true);

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

  const fetchRefs = useCallback(async () => {
    try {
      const [deptRes, typeRes] = await Promise.all([
        fetch('/api/departments'),
        fetch('/api/leave/types'),
      ]);
      if (deptRes.ok) {
        const json = await deptRes.json();
        setDepartments(Array.isArray(json) ? json : json.data || []);
      }
      if (typeRes.ok) setLeaveTypes(await typeRes.json());
    } catch {
      // silently fail
    }
  }, []);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (departmentId && departmentId !== 'all') params.set('departmentId', departmentId);
      if (leaveTypeId && leaveTypeId !== 'all') params.set('leaveTypeId', leaveTypeId);
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);

      const res = await fetch(`/api/leave/register?${params}`);
      if (res.ok) {
        const json = await res.json();
        setRecords(json.data);
        setPagination(json.pagination);
      } else {
        setError('데이터를 불러오는데 실패했습니다.');
      }
    } catch {
      setError('서버에 연결할 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [page, startDate, endDate, departmentId, leaveTypeId, statusFilter]);

  useEffect(() => {
    if (roleLoaded && ADMIN_ROLES.includes(userRole)) {
      fetchRefs();
    }
  }, [fetchRefs, roleLoaded, userRole]);

  useEffect(() => {
    if (roleLoaded && ADMIN_ROLES.includes(userRole)) {
      fetchRecords();
    }
  }, [fetchRecords, roleLoaded, userRole]);

  const handleExport = () => {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    if (departmentId && departmentId !== 'all') params.set('departmentId', departmentId);
    window.open(`/api/leave/export?${params}`, '_blank');
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
          <ClipboardList className="w-7 h-7 text-emerald-600" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">휴가관리대장</h1>
            <p className="text-sm text-gray-500 mt-0.5">전체 휴가 기록을 조회하고 관리합니다.</p>
          </div>
        </div>
        <Button variant="outline" className="w-full sm:w-auto" onClick={handleExport}>
          <Download className="w-4 h-4 mr-2" />
          Excel 다운로드
        </Button>
      </div>

      {/* Collapsible Filters */}
      <div className="mb-4">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 transition-colors mb-2"
        >
          {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          <Filter className="w-4 h-4" />
          필터
          {/* Active filter badges when collapsed */}
          {!showFilters && (
            <span className="flex gap-1 ml-1">
              {startDate && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{startDate}~</span>}
              {departmentId !== 'all' && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">부서</span>}
              {leaveTypeId !== 'all' && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">유형</span>}
              {statusFilter !== 'all' && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{STATUS_LABELS[statusFilter] || '상태'}</span>}
            </span>
          )}
        </button>
        {showFilters && (
          <div className="flex flex-col sm:flex-row flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                className="w-full sm:w-[150px]"
              />
              <span className="text-muted-foreground">~</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                className="w-full sm:w-[150px]"
              />
            </div>
            <Select value={departmentId} onValueChange={(v) => { setDepartmentId(v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="부서" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 부서</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={leaveTypeId} onValueChange={(v) => { setLeaveTypeId(v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="휴가유형" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 유형</SelectItem>
                {leaveTypes.map((lt) => (
                  <SelectItem key={lt.id} value={lt.id}>{lt.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
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
          </div>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>휴가 기록</CardTitle>
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
              <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 mb-4">기록이 없습니다.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[700px]">
                  <thead>
                    <tr className="border-b text-left bg-gray-50">
                      <th className="py-3 px-2 font-medium">신청일</th>
                      <th className="py-3 px-2 font-medium">이름</th>
                      <th className="py-3 px-2 font-medium hidden sm:table-cell">부서</th>
                      <th className="py-3 px-2 font-medium hidden sm:table-cell">직급</th>
                      <th className="py-3 px-2 font-medium">휴가유형</th>
                      <th className="py-3 px-2 font-medium">기간</th>
                      <th className="py-3 px-2 font-medium hidden sm:table-cell">구분</th>
                      <th className="py-3 px-2 font-medium">일수</th>
                      <th className="py-3 px-2 font-medium">상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r) => (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-2">{formatDate(r.appliedAt)}</td>
                        <td className="py-3 px-2 font-medium">{r.employeeName}</td>
                        <td className="py-3 px-2 hidden sm:table-cell">{r.departmentName}</td>
                        <td className="py-3 px-2 hidden sm:table-cell">{r.positionName}</td>
                        <td className="py-3 px-2">{r.leaveTypeName}</td>
                        <td className="py-3 px-2">
                          {formatDate(r.startDate)}
                          {formatDate(r.startDate) !== formatDate(r.endDate) && ` ~ ${formatDate(r.endDate)}`}
                        </td>
                        <td className="py-3 px-2 hidden sm:table-cell">{UNIT_LABELS[r.useUnit] || r.useUnit}</td>
                        <td className="py-3 px-2">{r.requestDays}일</td>
                        <td className="py-3 px-2">
                          <Badge variant="outline" className={getStatusStyle(r.status)}>
                            {STATUS_LABELS[r.status] || r.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
                <div className="text-sm text-muted-foreground">
                  총 {pagination.total}건 (페이지 {pagination.page}/{pagination.totalPages})
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    이전
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= pagination.totalPages}
                    onClick={() => setPage(page + 1)}
                  >
                    다음
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
