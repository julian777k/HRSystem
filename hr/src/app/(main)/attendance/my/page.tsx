'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ClipboardList,
} from 'lucide-react';

interface AttendanceRecord {
  id: string;
  date: string;
  clockIn: string;
  clockOut: string | null;
  workHours: number | null;
  overtimeHours: number | null;
  status: string;
  note: string | null;
}

interface Summary {
  totalWorkDays: number;
  totalWorkHours: number;
  totalOvertimeHours: number;
  lateCount: number;
  earlyLeaveCount: number;
  absentCount: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  NORMAL: { label: '정상', className: 'bg-green-100 text-green-800' },
  LATE: { label: '지각', className: 'bg-orange-100 text-orange-800' },
  EARLY_LEAVE: { label: '조퇴', className: 'bg-yellow-100 text-yellow-800' },
  ABSENT: { label: '결근', className: 'bg-red-100 text-red-800' },
};

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit', weekday: 'short' });
}

export default function MyAttendancePage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const [listRes, summaryRes] = await Promise.all([
        fetch(`/api/attendance/my?startDate=${startDate}&endDate=${endDate}&page=${page}&limit=31`),
        fetch(`/api/attendance/summary?year=${year}&month=${month}`),
      ]);

      if (listRes.status === 401) { window.location.href = '/login'; return; }

      if (listRes.ok) {
        const listData = await listRes.json();
        setAttendances(listData.attendances);
        setPagination(listData.pagination);
      }

      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        setSummary(summaryData.summary);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [year, month, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const goMonth = (dir: -1 | 1) => {
    let newMonth = month + dir;
    let newYear = year;
    if (newMonth < 1) { newMonth = 12; newYear--; }
    if (newMonth > 12) { newMonth = 1; newYear++; }
    setYear(newYear);
    setMonth(newMonth);
    setPage(1);
  };

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  return (
    <div>
      {/* Page Header */}
      <div className="flex items-center gap-3 mb-6">
        <CalendarDays className="w-7 h-7 text-indigo-600" />
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">내 근태현황</h1>
          <p className="text-sm text-gray-500 mt-0.5">월별 출퇴근 기록과 근무시간을 확인합니다.</p>
        </div>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-6">
        <Button variant="outline" size="sm" onClick={() => goMonth(-1)}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="text-center">
          <h2 className="text-lg font-bold">{year}년 {month}월</h2>
          {isCurrentMonth && (
            <p className="text-xs text-blue-600">이번 달</p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => goMonth(1)}
          disabled={isCurrentMonth}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Summary - unified card */}
      {summary && (
        <Card className="mb-6">
          <CardContent className="p-0">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 divide-x divide-gray-100">
              <div className="p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">출근일수</p>
                <p className="text-2xl font-bold">{summary.totalWorkDays}일</p>
              </div>
              <div className="p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">총 근무시간</p>
                <p className="text-2xl font-bold">{summary.totalWorkHours.toFixed(1)}h</p>
              </div>
              <div className="p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">연장근무</p>
                <p className="text-2xl font-bold">{summary.totalOvertimeHours.toFixed(1)}h</p>
              </div>
              <div className="p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">지각</p>
                <p className="text-2xl font-bold">{summary.lateCount}회</p>
              </div>
              <div className="p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">조퇴</p>
                <p className="text-2xl font-bold">{summary.earlyLeaveCount}회</p>
              </div>
              <div className="p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">결근</p>
                <p className="text-2xl font-bold">{summary.absentCount}회</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Attendance list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-indigo-600" />
            근태 기록
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              불러오는 중...
            </div>
          ) : attendances.length === 0 ? (
            <div className="text-center py-12">
              <CalendarDays className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400">{year}년 {month}월 근태 기록이 없습니다.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[600px]">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left py-2.5 px-3 font-medium text-gray-600">날짜</th>
                      <th className="text-left py-2.5 px-3 font-medium text-gray-600">출근</th>
                      <th className="text-left py-2.5 px-3 font-medium text-gray-600">퇴근</th>
                      <th className="text-left py-2.5 px-3 font-medium text-gray-600">근무시간</th>
                      <th className="text-left py-2.5 px-3 font-medium text-gray-600 hidden sm:table-cell">연장</th>
                      <th className="text-left py-2.5 px-3 font-medium text-gray-600">상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendances.map((att) => {
                      const cfg = STATUS_CONFIG[att.status] || STATUS_CONFIG.NORMAL;
                      return (
                        <tr key={att.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                          <td className="py-2.5 px-3 font-medium">{formatDateShort(att.date)}</td>
                          <td className="py-2.5 px-3">{formatTime(att.clockIn)}</td>
                          <td className="py-2.5 px-3">{att.clockOut ? formatTime(att.clockOut) : '-'}</td>
                          <td className="py-2.5 px-3">
                            {att.workHours != null ? `${att.workHours.toFixed(1)}h` : '-'}
                          </td>
                          <td className="py-2.5 px-3 hidden sm:table-cell">
                            {att.overtimeHours != null && att.overtimeHours > 0
                              ? <span className="text-purple-600 font-medium">{att.overtimeHours.toFixed(1)}h</span>
                              : '-'}
                          </td>
                          <td className="py-2.5 px-3">
                            <Badge className={cfg.className}>{cfg.label}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-gray-600">
                    {pagination.page} / {pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= pagination.totalPages}
                    onClick={() => setPage(p => p + 1)}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
