'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { BarChart3, Users, ChevronLeft, ChevronRight, ChevronDown, Search, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const ADMIN_ROLES = ["SYSTEM_ADMIN", "COMPANY_ADMIN"];

interface LeaveTypeOption {
  id: string;
  name: string;
  code: string;
}

interface HolidayData {
  id: string;
  name: string;
  date: string;
}

function calculateWorkingDaysForRequest(
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
  let workingDays = 0, weekendDays = 0, holidayDays = 0, totalDays = 0;
  const current = new Date(start);

  while (current <= end) {
    totalDays++;
    const dayOfWeek = current.getDay();
    const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
    if (dayOfWeek === 0 || dayOfWeek === 6) weekendDays++;
    else if (holidaySet.has(dateStr)) holidayDays++;
    else workingDays++;
    current.setDate(current.getDate() + 1);
  }
  return { workingDays, totalDays, weekendDays, holidayDays };
}

// ── List tab types ──

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
}

interface SummaryData {
  totalEmployees: number;
  avgUsageRate: number;
  totalGrantedAll: number;
  totalUsedAll: number;
}

interface Department {
  id: string;
  name: string;
  parentId: string | null;
}

// ── Calendar tab types ──

interface DepartmentTree {
  id: string;
  name: string;
  parentId: string | null;
  children: DepartmentTree[];
  employees: { id: string; name: string }[];
}

interface CalendarLeaveRequest {
  id: string;
  employeeName: string;
  employeeId: string;
  departmentName: string;
  departmentId: string;
  leaveTypeName: string;
  leaveTypeCode: string;
  startDate: string;
  endDate: string;
  useUnit: string;
  requestDays: number;
  reason: string | null;
}

interface CalendarHoliday {
  date: string;
  name: string;
}

interface CalendarEvent {
  id: string;
  employeeName: string;
  leaveTypeName: string;
  leaveTypeCode: string;
  useUnit: string;
  requestDays: number;
  reason: string | null;
}

type SortKey = 'name' | 'departmentName' | 'totalGranted' | 'totalUsed' | 'totalRemain' | 'usageRate';

// Leave type color mapping
function getLeaveColor(code: string, useUnit: string) {
  if (useUnit === 'AM_HALF' || useUnit === 'PM_HALF') {
    return 'bg-sky-100 text-sky-800';
  }
  switch (code) {
    case 'ANNUAL': return 'bg-emerald-100 text-emerald-800';
    case 'REWARD': return 'bg-amber-100 text-amber-800';
    case 'FAMILY_EVENT': return 'bg-purple-100 text-purple-800';
    case 'SICK': return 'bg-rose-100 text-rose-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

function getLeaveDotColor(code: string) {
  switch (code) {
    case 'ANNUAL': return 'bg-emerald-500';
    case 'REWARD': return 'bg-amber-500';
    case 'FAMILY_EVENT': return 'bg-purple-500';
    case 'SICK': return 'bg-rose-500';
    default: return 'bg-gray-500';
  }
}

function formatBadgeLabel(event: CalendarEvent) {
  const detail = event.reason?.trim() || event.leaveTypeName;
  if (event.useUnit === 'AM_HALF') return `${event.employeeName}(오전반차)`;
  if (event.useUnit === 'PM_HALF') return `${event.employeeName}(오후반차)`;
  if (detail) return `${event.employeeName}(${detail})`;
  return event.employeeName;
}

export default function LeaveUsagePage() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  // Shared state
  const [userRole, setUserRole] = useState('');
  const isAdmin = ADMIN_ROLES.includes(userRole);

  // ── List tab state ──
  const [year, setYear] = useState(String(currentYear));
  const [departmentId, setDepartmentId] = useState('all');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [data, setData] = useState<UsageData[]>([]);
  const [summary, setSummary] = useState<SummaryData>({ totalEmployees: 0, avgUsageRate: 0, totalGrantedAll: 0, totalUsedAll: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortAsc, setSortAsc] = useState(true);

  // ── Calendar tab state ──
  const [calYear, setCalYear] = useState(currentYear);
  const [calMonth, setCalMonth] = useState(currentMonth);
  const [calLeaves, setCalLeaves] = useState<CalendarLeaveRequest[]>([]);
  const [calHolidays, setCalHolidays] = useState<CalendarHoliday[]>([]);
  const [calLoading, setCalLoading] = useState(false);
  const [deptTree, setDeptTree] = useState<DepartmentTree[]>([]);
  const [deptEmployees, setDeptEmployees] = useState<Record<string, { id: string; name: string }[]>>({});
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [deptSearch, setDeptSearch] = useState('');
  const [expandedCells, setExpandedCells] = useState<Set<string>>(new Set());

  // ── Leave Request from Calendar ──
  const [reqDialogOpen, setReqDialogOpen] = useState(false);
  const [reqLeaveTypes, setReqLeaveTypes] = useState<LeaveTypeOption[]>([]);
  const [reqHolidayDates, setReqHolidayDates] = useState<string[]>([]);
  const [reqLeaveTypeId, setReqLeaveTypeId] = useState('');
  const [reqStartDate, setReqStartDate] = useState('');
  const [reqEndDate, setReqEndDate] = useState('');
  const [reqUseUnit, setReqUseUnit] = useState('FULL_DAY');
  const [reqReason, setReqReason] = useState('');
  const [reqSubmitting, setReqSubmitting] = useState(false);

  const reqDayCalc = calculateWorkingDaysForRequest(reqStartDate, reqEndDate, reqHolidayDates);
  const reqRequestDays = (reqUseUnit === 'AM_HALF' || reqUseUnit === 'PM_HALF')
    ? 0.5
    : reqDayCalc.workingDays;

  const openReqDialog = (presetDate?: string) => {
    const dateStr = presetDate || '';
    setReqLeaveTypeId('');
    setReqStartDate(dateStr);
    setReqEndDate(dateStr);
    setReqUseUnit('FULL_DAY');
    setReqReason('');
    setReqDialogOpen(true);
  };

  const handleReqSubmit = async () => {
    if (!reqLeaveTypeId || !reqStartDate || !reqEndDate) return;
    setReqSubmitting(true);
    try {
      const res = await fetch('/api/leave/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leaveTypeId: reqLeaveTypeId,
          startDate: reqStartDate,
          endDate: reqEndDate,
          useUnit: reqUseUnit,
          requestDays: reqRequestDays,
          reason: reqReason,
        }),
      });
      if (res.ok) {
        toast.success('휴가가 신청되었습니다.');
        setReqDialogOpen(false);
        fetchCalendar();
      } else {
        const err = await res.json();
        toast.error(err.message || '신청에 실패했습니다.');
      }
    } catch {
      toast.error('서버에 연결할 수 없습니다.');
    } finally {
      setReqSubmitting(false);
    }
  };

  // Auth
  useEffect(() => {
    fetch("/api/auth/me").then(r => { if (r.status === 401) { window.location.href = '/login'; return null; } return r.ok ? r.json() : null; }).then(d => {
      if (d?.user?.role) setUserRole(d.user.role);
    }).catch(() => {});
  }, []);

  // ── List tab logic ──
  const fetchDepartments = useCallback(async () => {
    try {
      const res = await fetch('/api/departments');
      if (res.ok) {
        const json = await res.json();
        const allDepts: Department[] = json.allDepartments || json.data || [];
        setDepartments(allDepts);
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchUsage = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ year });
      if (departmentId && departmentId !== 'all') params.set('departmentId', departmentId);
      const res = await fetch(`/api/leave/usage?${params}`);
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
        setSummary(json.summary);
      } else {
        setError('데이터를 불러오는데 실패했습니다.');
      }
    } catch {
      setError('서버에 연결할 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [year, departmentId]);

  useEffect(() => { fetchDepartments(); }, [fetchDepartments]);
  useEffect(() => { fetchUsage(); }, [fetchUsage]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) { setSortAsc(!sortAsc); }
    else { setSortKey(key); setSortAsc(true); }
  };

  const sortedData = [...data].sort((a, b) => {
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return sortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
  });

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <th
      className="py-3 px-2 font-medium cursor-pointer hover:text-foreground select-none bg-gray-50"
      onClick={() => handleSort(field)}
    >
      {label} {sortKey === field ? (sortAsc ? '\u2191' : '\u2193') : ''}
    </th>
  );

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  // ── Calendar tab logic ──
  const fetchDeptTree = useCallback(async () => {
    try {
      const res = await fetch('/api/departments');
      if (!res.ok) return;
      const json = await res.json();
      const treeDepts: DepartmentTree[] = json.departments || [];

      const empRes = await fetch('/api/employees?limit=9999');
      if (!empRes.ok) return;
      const empJson = await empRes.json();
      const employees: { id: string; name: string; departmentId: string }[] =
        (empJson.data || empJson.employees || []).map((e: { id: string; name: string; departmentId: string }) => ({
          id: e.id,
          name: e.name,
          departmentId: e.departmentId,
        }));

      const byDept: Record<string, { id: string; name: string }[]> = {};
      for (const emp of employees) {
        if (!byDept[emp.departmentId]) byDept[emp.departmentId] = [];
        byDept[emp.departmentId].push({ id: emp.id, name: emp.name });
      }
      setDeptEmployees(byDept);

      function mapTree(node: { id: string; name: string; parentId?: string | null; children?: DepartmentTree[] }): DepartmentTree {
        return {
          id: node.id,
          name: node.name,
          parentId: node.parentId || null,
          children: (node.children || []).map(mapTree),
          employees: byDept[node.id] || [],
        };
      }
      setDeptTree(treeDepts.map(mapTree));

      const allIds = new Set<string>();
      function collectIds(nodes: DepartmentTree[]) {
        for (const n of nodes) {
          allIds.add(n.id);
          if (n.children) collectIds(n.children as DepartmentTree[]);
        }
      }
      collectIds(treeDepts as DepartmentTree[]);
      setExpandedDepts(allIds);
    } catch {
      // ignore
    }
  }, []);

  const fetchCalendar = useCallback(async () => {
    setCalLoading(true);
    try {
      const params = new URLSearchParams({
        year: String(calYear),
        month: String(calMonth),
      });
      if (selectedDeptId) params.set('departmentId', selectedDeptId);
      const res = await fetch(`/api/leave/calendar?${params}`);
      if (res.ok) {
        const json = await res.json();
        setCalLeaves(json.leaveRequests || []);
        setCalHolidays(json.holidays || []);
      }
    } catch {
      // ignore
    } finally {
      setCalLoading(false);
    }
  }, [calYear, calMonth, selectedDeptId]);

  const fetchReqOptions = useCallback(async () => {
    try {
      const [typesRes, holRes] = await Promise.all([
        fetch('/api/leave/types'),
        fetch(`/api/holidays?year=${calYear}`),
      ]);
      if (typesRes.ok) {
        const data = await typesRes.json();
        setReqLeaveTypes(data);
      }
      if (holRes.ok) {
        const data = await holRes.json();
        setReqHolidayDates(
          (data.holidays || []).map((h: HolidayData) => {
            const d = new Date(h.date);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          })
        );
      }
    } catch { /* ignore */ }
  }, [calYear]);

  useEffect(() => { fetchDeptTree(); }, [fetchDeptTree]);
  useEffect(() => { fetchCalendar(); }, [fetchCalendar]);
  useEffect(() => { fetchReqOptions(); }, [fetchReqOptions]);

  // Calendar grid computation
  const calendarGrid = useMemo(() => {
    const firstDay = new Date(calYear, calMonth - 1, 1);
    const lastDay = new Date(calYear, calMonth, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    const weeks: (number | null)[][] = [];
    let week: (number | null)[] = [];
    for (let i = 0; i < startDayOfWeek; i++) week.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      week.push(d);
      if (week.length === 7) {
        weeks.push(week);
        week = [];
      }
    }
    if (week.length > 0) {
      while (week.length < 7) week.push(null);
      weeks.push(week);
    }
    return weeks;
  }, [calYear, calMonth]);

  const holidayMap = useMemo(() => {
    const map: Record<number, string> = {};
    for (const h of calHolidays) {
      const d = new Date(h.date).getDate();
      map[d] = h.name;
    }
    return map;
  }, [calHolidays]);

  const eventsByDay = useMemo(() => {
    const map: Record<number, CalendarEvent[]> = {};
    const monthStart = new Date(calYear, calMonth - 1, 1);
    const monthEnd = new Date(calYear, calMonth, 0);

    for (const lr of calLeaves) {
      const start = new Date(lr.startDate);
      const end = new Date(lr.endDate);
      const rangeStart = start < monthStart ? 1 : start.getDate();
      const rangeEnd = end > monthEnd ? monthEnd.getDate() : end.getDate();

      for (let d = rangeStart; d <= rangeEnd; d++) {
        if (!map[d]) map[d] = [];
        map[d].push({
          id: lr.id,
          employeeName: lr.employeeName,
          leaveTypeName: lr.leaveTypeName,
          leaveTypeCode: lr.leaveTypeCode,
          useUnit: lr.useUnit,
          requestDays: lr.requestDays,
          reason: lr.reason,
        });
      }
    }
    return map;
  }, [calLeaves, calYear, calMonth]);

  const leaveTypesForLegend = useMemo(() => {
    const seen = new Map<string, string>();
    for (const lr of calLeaves) {
      if (!seen.has(lr.leaveTypeCode)) {
        seen.set(lr.leaveTypeCode, lr.leaveTypeName);
      }
    }
    if (seen.size === 0) {
      seen.set('ANNUAL', '연차');
      seen.set('REWARD', '포상');
      seen.set('FAMILY_EVENT', '경조');
      seen.set('SICK', '병가');
    }
    return Array.from(seen.entries());
  }, [calLeaves]);

  const prevMonth = () => {
    if (calMonth === 1) { setCalYear(calYear - 1); setCalMonth(12); }
    else setCalMonth(calMonth - 1);
    setExpandedCells(new Set());
  };
  const nextMonth = () => {
    if (calMonth === 12) { setCalYear(calYear + 1); setCalMonth(1); }
    else setCalMonth(calMonth + 1);
    setExpandedCells(new Set());
  };

  const toggleDept = (id: string) => {
    setExpandedDepts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleCell = (key: string) => {
    setExpandedCells(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  function filterTree(nodes: DepartmentTree[], search: string): DepartmentTree[] {
    if (!search) return nodes;
    const lower = search.toLowerCase();
    return nodes.reduce<DepartmentTree[]>((acc, node) => {
      const matchesName = node.name.toLowerCase().includes(lower);
      const matchingEmployees = node.employees.filter(e => e.name.toLowerCase().includes(lower));
      const filteredChildren = filterTree(node.children, search);
      if (matchesName || matchingEmployees.length > 0 || filteredChildren.length > 0) {
        acc.push({
          ...node,
          children: filteredChildren,
          employees: search ? matchingEmployees : node.employees,
        });
      }
      return acc;
    }, []);
  }

  const filteredDeptTree = useMemo(() => filterTree(deptTree, deptSearch), [deptTree, deptSearch]);

  function renderDeptTree(nodes: DepartmentTree[], depth: number = 0) {
    return nodes.map(node => {
      const isExpanded = expandedDepts.has(node.id);
      const isSelected = selectedDeptId === node.id;
      const hasChildren = node.children.length > 0;
      const employees = deptEmployees[node.id] || node.employees;

      return (
        <div key={node.id}>
          <div
            className={`flex items-center gap-1 py-1.5 px-2 rounded cursor-pointer text-sm hover:bg-muted/80 ${isSelected ? 'bg-muted font-semibold' : ''}`}
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
          >
            <button
              className="w-4 h-4 flex items-center justify-center shrink-0"
              onClick={(e) => { e.stopPropagation(); toggleDept(node.id); }}
            >
              {(hasChildren || employees.length > 0) ? (
                isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />
              ) : <span className="w-3" />}
            </button>
            <span
              className="truncate flex-1"
              onClick={() => setSelectedDeptId(isSelected ? null : node.id)}
            >
              {node.name}
            </span>
          </div>
          {isExpanded && (
            <>
              {renderDeptTree(node.children, depth + 1)}
              {employees.map(emp => (
                <div
                  key={emp.id}
                  className="text-xs text-muted-foreground py-1 truncate"
                  style={{ paddingLeft: `${(depth + 1) * 16 + 24}px` }}
                >
                  {emp.name}
                </div>
              ))}
            </>
          )}
        </div>
      );
    });
  }

  const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <div>
      {/* Unified Header */}
      <div className="flex items-center gap-3 mb-6">
        <BarChart3 className="w-7 h-7 text-emerald-600" />
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">휴가사용현황</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isAdmin ? '전체 직원의 휴가 사용 현황을 확인합니다.' : '부서 내 휴가 사용 현황을 확인합니다.'}
          </p>
        </div>
      </div>

      <Tabs defaultValue="calendar">
        <TabsList className="mb-4">
          <TabsTrigger value="list">목록</TabsTrigger>
          <TabsTrigger value="calendar">캘린더</TabsTrigger>
        </TabsList>

        {/* ── LIST TAB ── */}
        <TabsContent value="list">
          {/* Summary Cards */}
          <Card className="mb-6">
            <CardContent className="p-0">
              <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-100">
                <div className="p-4 text-center">
                  <p className="text-xs text-gray-500 mb-1">총 인원</p>
                  <p className="text-2xl font-bold">{summary.totalEmployees}명</p>
                </div>
                <div className="p-4 text-center">
                  <p className="text-xs text-gray-500 mb-1">총 부여</p>
                  <p className="text-2xl font-bold">{summary.totalGrantedAll}일</p>
                </div>
                <div className="p-4 text-center">
                  <p className="text-xs text-gray-500 mb-1">총 사용</p>
                  <p className="text-2xl font-bold">{summary.totalUsedAll}일</p>
                </div>
                <div className="p-4 text-center">
                  <p className="text-xs text-gray-500 mb-1">평균 사용률</p>
                  <p className="text-2xl font-bold mb-2">{summary.avgUsageRate}%</p>
                  <Progress value={summary.avgUsageRate} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-4">
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="w-full sm:w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}년</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isAdmin && (
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="전체 부서" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 부서</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Usage Table */}
          <Card>
            <CardHeader>
              <CardTitle>직원별 휴가 사용현황</CardTitle>
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
                  <Button variant="outline" onClick={fetchUsage}>다시 시도</Button>
                </div>
              ) : data.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-400 mb-4">데이터가 없습니다.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead>
                      <tr className="border-b text-left">
                        <SortHeader label="이름" field="name" />
                        <SortHeader label="부서" field="departmentName" />
                        <th className="py-3 px-2 font-medium hidden sm:table-cell bg-gray-50">직급</th>
                        <SortHeader label="총부여" field="totalGranted" />
                        <SortHeader label="사용" field="totalUsed" />
                        <SortHeader label="잔여" field="totalRemain" />
                        <SortHeader label="사용률" field="usageRate" />
                      </tr>
                    </thead>
                    <tbody>
                      {sortedData.map((row) => (
                        <tr key={row.employeeId} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-2 font-medium">{row.name}</td>
                          <td className="py-3 px-2">{row.departmentName}</td>
                          <td className="py-3 px-2 hidden sm:table-cell">{row.positionName}</td>
                          <td className="py-3 px-2">{row.totalGranted}일</td>
                          <td className="py-3 px-2">{row.totalUsed}일</td>
                          <td className="py-3 px-2 font-medium text-emerald-600">{row.totalRemain}일</td>
                          <td className="py-3 px-2 w-[160px]">
                            <div className="flex items-center gap-2">
                              <Progress value={row.usageRate} className="h-2 flex-1" />
                              <span className="text-xs w-[36px] text-right">{row.usageRate}%</span>
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
        </TabsContent>

        {/* ── CALENDAR TAB ── */}
        <TabsContent value="calendar">
          <div className="flex gap-4">
            {/* Department Tree - hidden on mobile */}
            <div className="hidden md:block w-56 shrink-0">
              <Card className="sticky top-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">부서 목록</CardTitle>
                </CardHeader>
                <CardContent className="p-2">
                  <div className="relative mb-2">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      placeholder="검색"
                      value={deptSearch}
                      onChange={e => setDeptSearch(e.target.value)}
                      className="pl-7 h-8 text-xs"
                    />
                  </div>
                  <div
                    className="cursor-pointer text-sm py-1.5 px-2 rounded hover:bg-muted/80 font-medium mb-1"
                    style={{ backgroundColor: selectedDeptId === null ? 'var(--muted)' : undefined }}
                    onClick={() => setSelectedDeptId(null)}
                  >
                    전체
                  </div>
                  <div className="max-h-[60vh] overflow-y-auto">
                    {renderDeptTree(filteredDeptTree)}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Calendar Grid */}
            <div className="flex-1 min-w-0">
              {/* Legend */}
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <span className="text-xs text-muted-foreground">범례:</span>
                {leaveTypesForLegend.map(([code, name]) => (
                  <span key={code} className="flex items-center gap-1 text-xs">
                    <span className={`w-2.5 h-2.5 rounded-full ${getLeaveDotColor(code)}`} />
                    {name}
                  </span>
                ))}
                <span className="flex items-center gap-1 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                  반차
                </span>
              </div>

              {/* Month Navigation + Request Button */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4 flex-1 justify-center">
                  <button onClick={prevMonth} className="p-1 rounded hover:bg-muted">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="text-lg font-semibold min-w-[140px] text-center">
                    {calYear}년 {calMonth}월
                  </span>
                  <button onClick={nextMonth} className="p-1 rounded hover:bg-muted">
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
                <Button size="sm" onClick={() => openReqDialog()}>
                  <Plus className="w-4 h-4 mr-1" />
                  휴가 신청
                </Button>
              </div>

              {/* Calendar */}
              <Card>
                <CardContent className="p-0 overflow-x-auto">
                  {calLoading ? (
                    <div className="flex items-center justify-center py-12 text-gray-400">
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      불러오는 중...
                    </div>
                  ) : (
                    <table className="w-full border-collapse min-w-[640px]">
                      <thead>
                        <tr>
                          {DAY_LABELS.map((label, i) => (
                            <th
                              key={label}
                              className={`text-center text-xs font-medium py-2 border-b bg-gray-50 ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-muted-foreground'}`}
                            >
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {calendarGrid.map((week, wi) => (
                          <tr key={wi}>
                            {week.map((day, di) => {
                              if (day === null) {
                                return <td key={di} className="border p-1 align-top h-24 bg-muted/30" />;
                              }

                              const isWeekend = di === 0 || di === 6;
                              const holidayName = holidayMap[day];
                              const events = eventsByDay[day] || [];
                              const cellKey = `${wi}-${di}`;
                              const isExpanded = expandedCells.has(cellKey);
                              const maxShow = 2;
                              const overflow = events.length - maxShow;

                              const dateStr = `${calYear}-${String(calMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

                              return (
                                <td
                                  key={di}
                                  className={`border p-1 align-top h-24 cursor-pointer hover:bg-muted/40 transition-colors ${isWeekend ? 'bg-yellow-50' : ''}`}
                                  onDoubleClick={() => {
                                    if (!isWeekend && !holidayName) openReqDialog(dateStr);
                                  }}
                                  title="더블클릭하여 휴가 신청"
                                >
                                  <div className="flex items-start justify-between mb-0.5">
                                    <span className={`text-xs font-medium ${holidayName ? 'text-red-500' : di === 0 ? 'text-red-500' : di === 6 ? 'text-blue-500' : ''}`}>
                                      {day}
                                    </span>
                                    {holidayName && (
                                      <span className="text-[10px] text-red-400 truncate ml-1">{holidayName}</span>
                                    )}
                                  </div>
                                  <div className="space-y-0.5">
                                    {(isExpanded ? events : events.slice(0, maxShow)).map((ev) => (
                                      <div
                                        key={ev.id + '-' + day}
                                        className={`text-[10px] px-1 py-0.5 rounded truncate ${getLeaveColor(ev.leaveTypeCode, ev.useUnit)}`}
                                        title={`${ev.employeeName} - ${ev.leaveTypeName}${ev.reason ? ` (${ev.reason})` : ''}`}
                                      >
                                        {formatBadgeLabel(ev)}
                                      </div>
                                    ))}
                                    {!isExpanded && overflow > 0 && (
                                      <button
                                        onClick={() => toggleCell(cellKey)}
                                        className="text-[10px] px-1 py-0.5 rounded bg-muted text-muted-foreground hover:bg-muted/80 w-full text-center"
                                      >
                                        +{overflow}건
                                      </button>
                                    )}
                                    {isExpanded && overflow > 0 && (
                                      <button
                                        onClick={() => toggleCell(cellKey)}
                                        className="text-[10px] px-1 py-0.5 rounded bg-muted text-muted-foreground hover:bg-muted/80 w-full text-center"
                                      >
                                        접기
                                      </button>
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Leave Request Dialog */}
      <Dialog open={reqDialogOpen} onOpenChange={setReqDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>휴가 신청</DialogTitle>
            <DialogDescription>캘린더를 확인하고 바로 휴가를 신청하세요.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>휴가 유형</Label>
              <Select value={reqLeaveTypeId} onValueChange={(val) => {
                setReqLeaveTypeId(val);
                const selected = reqLeaveTypes.find(lt => lt.id === val);
                if (selected?.code === 'AM_HALF') setReqUseUnit('AM_HALF');
                else if (selected?.code === 'PM_HALF') setReqUseUnit('PM_HALF');
              }}>
                <SelectTrigger className="w-full mt-1">
                  <SelectValue placeholder="휴가 유형 선택" />
                </SelectTrigger>
                <SelectContent>
                  {reqLeaveTypes.map((lt) => (
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
                  value={reqStartDate}
                  onChange={(e) => {
                    setReqStartDate(e.target.value);
                    if (!reqEndDate || e.target.value > reqEndDate) {
                      setReqEndDate(e.target.value);
                    }
                  }}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>종료일</Label>
                <Input
                  type="date"
                  value={reqEndDate}
                  onChange={(e) => setReqEndDate(e.target.value)}
                  min={reqStartDate}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label>휴가 구분</Label>
              <RadioGroup
                value={reqUseUnit}
                onValueChange={(val) => {
                  setReqUseUnit(val);
                  if ((val === 'AM_HALF' || val === 'PM_HALF') && reqStartDate) {
                    setReqEndDate(reqStartDate);
                  }
                }}
                className="flex flex-wrap gap-4 mt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="FULL_DAY" id="cal-full" />
                  <Label htmlFor="cal-full">종일</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="AM_HALF" id="cal-am" />
                  <Label htmlFor="cal-am">오전반차</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="PM_HALF" id="cal-pm" />
                  <Label htmlFor="cal-pm">오후반차</Label>
                </div>
              </RadioGroup>
            </div>
            <div>
              <Label>신청 일수</Label>
              <Input type="number" value={reqRequestDays} readOnly className="mt-1 bg-muted" />
              {reqStartDate && reqEndDate && reqUseUnit === 'FULL_DAY' && reqDayCalc.totalDays > 0 && (
                reqRequestDays === 0 ? (
                  <p className="text-xs text-red-500 mt-1">선택 기간에 근무일이 없습니다</p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">
                    총 {reqDayCalc.totalDays}일 중 주말 {reqDayCalc.weekendDays}일
                    {reqDayCalc.holidayDays > 0 && `, 공휴일 ${reqDayCalc.holidayDays}일`} 제외
                  </p>
                )
              )}
            </div>
            <div>
              <Label>사유</Label>
              <Textarea
                value={reqReason}
                onChange={(e) => setReqReason(e.target.value)}
                placeholder="휴가 사유를 입력하세요"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setReqDialogOpen(false)}>
              취소
            </Button>
            <Button
              className="w-full sm:w-auto"
              onClick={handleReqSubmit}
              disabled={reqSubmitting || !reqLeaveTypeId || !reqStartDate || !reqEndDate || reqRequestDays <= 0}
            >
              {reqSubmitting ? '신청 중...' : '신청'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
