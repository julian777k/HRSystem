"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Upload,
  Download,
  ChevronLeft,
  ChevronRight,
  Users,
  Loader2,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";

const ADMIN_ROLES = ["SYSTEM_ADMIN", "COMPANY_ADMIN"];

interface Department {
  id: string;
  name: string;
}

interface Position {
  id: string;
  name: string;
  level: number;
}

interface Employee {
  id: string;
  employeeNumber: string;
  name: string;
  email: string;
  phone: string | null;
  departmentId: string;
  positionId: string;
  department: Department;
  position: Position;
  hireDate: string;
  resignDate: string | null;
  status: "PENDING" | "ACTIVE" | "ON_LEAVE" | "RESIGNED";
  role: string;
  workType: string | null;
  workStartTime: string | null;
  workEndTime: string | null;
  lunchStartTime: string | null;
  lunchEndTime: string | null;
}

interface EmployeeForm {
  employeeNumber: string;
  name: string;
  email: string;
  password: string;
  phone: string;
  departmentId: string;
  positionId: string;
  hireDate: string;
  role: string;
  status: string;
  workType: string;
  workStartTime: string;
  workEndTime: string;
  lunchStartTime: string;
  lunchEndTime: string;
}

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  PENDING: {
    label: "승인대기",
    className: "bg-orange-100 text-orange-800 hover:bg-orange-100",
  },
  ACTIVE: {
    label: "재직",
    className: "bg-green-100 text-green-800 hover:bg-green-100",
  },
  ON_LEAVE: {
    label: "휴직",
    className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
  },
  RESIGNED: {
    label: "퇴직",
    className: "bg-red-100 text-red-800 hover:bg-red-100",
  },
};

const ROLE_OPTIONS = [
  { value: "BASIC", label: "일반" },
  { value: "DEPT_ADMIN", label: "부서관리자" },
  { value: "COMPANY_ADMIN", label: "회사관리자" },
  { value: "SYSTEM_ADMIN", label: "시스템관리자" },
];

const emptyForm: EmployeeForm = {
  employeeNumber: "",
  name: "",
  email: "",
  password: "",
  phone: "",
  departmentId: "",
  positionId: "",
  hireDate: "",
  role: "BASIC",
  status: "ACTIVE",
  workType: "",
  workStartTime: "",
  workEndTime: "",
  lunchStartTime: "",
  lunchEndTime: "",
};

export default function EmployeesPage() {
  const router = useRouter();
  const [userRole, setUserRole] = useState("");
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [loading, setLoading] = useState(false);

  // Filters (search는 debounce 적용)
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterPosition, setFilterPosition] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // 검색어 debounce (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== search) {
        setSearch(searchInput);
        setPage(1);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null
  );
  const [form, setForm] = useState<EmployeeForm>(emptyForm);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Import
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importResult, setImportResult] = useState<string>("");

  const totalPages = Math.ceil(total / limit);

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

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (search) params.set("search", search);
      if (filterDept) params.set("department", filterDept);
      if (filterPosition) params.set("position", filterPosition);
      if (filterStatus) params.set("status", filterStatus);

      const res = await fetch(`/api/employees?${params}`);
      if (res.ok) {
        const data = await res.json();
        setEmployees(data.employees);
        setTotal(data.total);
      }
    } catch {
      toast.error('데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, filterDept, filterPosition, filterStatus]);

  const fetchMeta = useCallback(async () => {
    try {
      const [deptRes] = await Promise.all([
        fetch("/api/departments"),
      ]);

      if (deptRes.ok) {
        const data = await deptRes.json();
        setDepartments(data.allDepartments || []);
      }

      const positionsRes = await fetch("/api/positions");
      if (positionsRes.ok) {
        const data = await positionsRes.json();
        setPositions(data.positions || []);
      }
    } catch {
      toast.error('데이터를 불러오는 중 오류가 발생했습니다.');
    }
  }, []);

  useEffect(() => {
    if (roleLoaded && ADMIN_ROLES.includes(userRole)) {
      fetchMeta();
    }
  }, [fetchMeta, roleLoaded, userRole]);

  useEffect(() => {
    if (roleLoaded && ADMIN_ROLES.includes(userRole)) {
      fetchEmployees();
    }
  }, [fetchEmployees, roleLoaded, userRole]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const handleCreate = async () => {
    setFormError("");
    if (
      !form.name ||
      !form.email ||
      !form.password ||
      !form.departmentId ||
      !form.positionId ||
      !form.hireDate
    ) {
      setFormError("필수 항목을 모두 입력해주세요.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        setCreateOpen(false);
        setForm(emptyForm);
        toast.success('직원이 등록되었습니다.');
        fetchEmployees();
      } else {
        const data = await res.json();
        setFormError(data.message || "등록 실패");
      }
    } catch {
      setFormError("서버 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (emp: Employee) => {
    setSelectedEmployee(emp);
    setForm({
      employeeNumber: emp.employeeNumber,
      name: emp.name,
      email: emp.email,
      password: "",
      phone: emp.phone || "",
      departmentId: emp.departmentId,
      positionId: emp.positionId,
      hireDate: emp.hireDate.split("T")[0],
      role: emp.role,
      status: emp.status,
      workType: emp.workType || "",
      workStartTime: emp.workStartTime || "",
      workEndTime: emp.workEndTime || "",
      lunchStartTime: emp.lunchStartTime || "",
      lunchEndTime: emp.lunchEndTime || "",
    });
    setFormError("");
    setEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!selectedEmployee) return;
    setFormError("");

    setSubmitting(true);
    try {
      const body: Record<string, string> = {
        name: form.name,
        email: form.email,
        phone: form.phone,
        departmentId: form.departmentId,
        positionId: form.positionId,
        hireDate: form.hireDate,
        role: form.role,
        status: form.status,
        workType: form.workType,
        workStartTime: form.workStartTime,
        workEndTime: form.workEndTime,
        lunchStartTime: form.lunchStartTime,
        lunchEndTime: form.lunchEndTime,
      };
      if (form.password) body.password = form.password;

      const res = await fetch(`/api/employees/${selectedEmployee.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setEditOpen(false);
        setSelectedEmployee(null);
        setForm(emptyForm);
        fetchEmployees();
      } else {
        const data = await res.json();
        setFormError(data.message || "수정 실패");
      }
    } catch {
      setFormError("서버 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedEmployee) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/employees/${selectedEmployee.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setDeleteOpen(false);
        setSelectedEmployee(null);
        fetchEmployees();
      } else {
        const data = await res.json();
        toast.error(data.message || '직원 처리 중 오류가 발생했습니다.');
      }
    } catch {
      toast.error('직원 처리 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (emp: Employee) => {
    try {
      const res = await fetch(`/api/employees/${emp.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACTIVE" }),
      });
      if (res.ok) {
        toast.success(`${emp.name}님이 승인되었습니다.`);
        fetchEmployees();
      } else {
        const data = await res.json();
        toast.error(data.message || "승인 처리 중 오류가 발생했습니다.");
      }
    } catch {
      toast.error("승인 처리 중 오류가 발생했습니다.");
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportResult("");
    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/employees/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      let result = data.message || '가져오기 완료';
      if (data.errors?.length > 0) {
        result += '\n' + data.errors.slice(0, 5).join('\n');
      }
      setImportResult(result);
      fetchEmployees();
    } catch {
      setImportResult("가져오기 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleExport = async () => {
    try {
      const res = await fetch("/api/employees/export");
      if (!res.ok) return;

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `employees_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('데이터를 불러오는 중 오류가 발생했습니다.');
    }
  };

  const formatDate = (dateStr: string) => {
    return dateStr ? dateStr.split("T")[0] : "-";
  };

  const renderFormFields = () => (
    <div className="grid gap-4 py-4">
      {formError && (
        <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
          {formError}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="employeeNumber">사번 {editOpen ? '' : '(미입력시 자동생성)'}</Label>
          <Input
            id="employeeNumber"
            value={form.employeeNumber}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, employeeNumber: e.target.value }))
            }
            placeholder={editOpen ? '' : 'EMP-20260213-001'}
            disabled={editOpen}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">이름 *</Label>
          <Input
            id="name"
            value={form.name}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, name: e.target.value }))
            }
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="email">이메일 *</Label>
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, email: e.target.value }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">
            비밀번호 {editOpen ? "(변경시에만 입력)" : "*"}
          </Label>
          <Input
            id="password"
            type="password"
            value={form.password}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, password: e.target.value }))
            }
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="phone">전화번호</Label>
          <Input
            id="phone"
            value={form.phone}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, phone: e.target.value }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="hireDate">입사일 *</Label>
          <Input
            id="hireDate"
            type="date"
            value={form.hireDate}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, hireDate: e.target.value }))
            }
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>부서 *</Label>
          <Select
            value={form.departmentId}
            onValueChange={(v) =>
              setForm((prev) => ({ ...prev, departmentId: v }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="부서 선택" />
            </SelectTrigger>
            <SelectContent>
              {departments.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>직급 *</Label>
          <Select
            value={form.positionId}
            onValueChange={(v) =>
              setForm((prev) => ({ ...prev, positionId: v }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="직급 선택" />
            </SelectTrigger>
            <SelectContent>
              {positions.map((pos) => (
                <SelectItem key={pos.id} value={pos.id}>
                  {pos.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>권한</Label>
          <Select
            value={form.role}
            onValueChange={(v) => setForm((prev) => ({ ...prev, role: v }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {editOpen && (
          <div className="space-y-2">
            <Label>상태</Label>
            <Select
              value={form.status}
              onValueChange={(v) => setForm((prev) => ({ ...prev, status: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">재직</SelectItem>
                <SelectItem value="ON_LEAVE">휴직</SelectItem>
                <SelectItem value="RESIGNED">퇴직</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      {/* 근무시간 설정 */}
      <div className="border-t pt-4 mt-2">
        <p className="text-sm font-medium text-gray-700 mb-3">근무시간 설정 (미입력시 부서/회사 설정 사용)</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>근무유형</Label>
            <Select value={form.workType || 'default'} onValueChange={(v) => setForm(prev => ({...prev, workType: v === 'default' ? '' : v}))}>
              <SelectTrigger><SelectValue placeholder="회사 기본" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="default">회사 기본</SelectItem>
                <SelectItem value="FIXED">고정근무</SelectItem>
                <SelectItem value="FLEXIBLE">자율근무</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-3">
          <div className="space-y-2">
            <Label>출근시간</Label>
            <Input type="time" value={form.workStartTime} onChange={(e) => setForm(prev => ({...prev, workStartTime: e.target.value}))} />
          </div>
          <div className="space-y-2">
            <Label>퇴근시간</Label>
            <Input type="time" value={form.workEndTime} onChange={(e) => setForm(prev => ({...prev, workEndTime: e.target.value}))} />
          </div>
          <div className="space-y-2">
            <Label>점심 시작</Label>
            <Input type="time" value={form.lunchStartTime} onChange={(e) => setForm(prev => ({...prev, lunchStartTime: e.target.value}))} />
          </div>
          <div className="space-y-2">
            <Label>점심 종료</Label>
            <Input type="time" value={form.lunchEndTime} onChange={(e) => setForm(prev => ({...prev, lunchEndTime: e.target.value}))} />
          </div>
        </div>
      </div>
    </div>
  );

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Users className="w-7 h-7 text-purple-600" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">직원관리</h1>
            <p className="text-sm text-gray-500 mt-0.5">직원 정보를 등록하고 관리합니다.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => setImportOpen(true)}
          >
            <Upload className="w-4 h-4 mr-1" />
            엑셀 가져오기
          </Button>
          <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={handleExport}>
            <Download className="w-4 h-4 mr-1" />
            엑셀 내보내기
          </Button>
          <Button
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => {
              setForm(emptyForm);
              setFormError("");
              setCreateOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-1" />
            직원 등록
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card className="mb-4">
        <CardContent className="pt-4">
          <form
            onSubmit={handleSearchSubmit}
            className="flex flex-wrap gap-3 items-end"
          >
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs text-gray-500 mb-1 block">검색</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="이름, 사번, 이메일 검색"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="w-full sm:w-[160px]">
              <Label className="text-xs text-gray-500 mb-1 block">부서</Label>
              <Select
                value={filterDept}
                onValueChange={(v) => {
                  setFilterDept(v === "all" ? "" : v);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="전체 부서" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 부서</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-[140px]">
              <Label className="text-xs text-gray-500 mb-1 block">직급</Label>
              <Select
                value={filterPosition}
                onValueChange={(v) => {
                  setFilterPosition(v === "all" ? "" : v);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="전체 직급" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 직급</SelectItem>
                  {positions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-[120px]">
              <Label className="text-xs text-gray-500 mb-1 block">상태</Label>
              <Select
                value={filterStatus}
                onValueChange={(v) => {
                  setFilterStatus(v === "all" ? "" : v);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="전체" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="PENDING">승인대기</SelectItem>
                  <SelectItem value="ACTIVE">재직</SelectItem>
                  <SelectItem value="ON_LEAVE">휴직</SelectItem>
                  <SelectItem value="RESIGNED">퇴직</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" variant="outline" size="sm" className="w-full sm:w-auto">
              검색
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Employee Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            직원 목록 ({total}명)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              불러오는 중...
            </div>
          ) : employees.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 mb-4">등록된 직원이 없습니다.</p>
              <Button onClick={() => { setForm(emptyForm); setFormError(""); setCreateOpen(true); }}>
                <Plus className="w-4 h-4 mr-1" />
                직원 등록하기
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-3 px-3 font-medium text-gray-600">사번</th>
                    <th className="text-left py-3 px-3 font-medium text-gray-600">이름</th>
                    <th className="text-left py-3 px-3 font-medium text-gray-600">부서</th>
                    <th className="text-left py-3 px-3 font-medium text-gray-600 hidden sm:table-cell">직급</th>
                    <th className="text-left py-3 px-3 font-medium text-gray-600 hidden sm:table-cell">입사일</th>
                    <th className="text-left py-3 px-3 font-medium text-gray-600">상태</th>
                    <th className="text-left py-3 px-3 font-medium text-gray-600 hidden md:table-cell">이메일</th>
                    <th className="text-right py-3 px-3 font-medium text-gray-600">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => (
                    <tr key={emp.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-3">{emp.employeeNumber}</td>
                      <td className="py-3 px-3 font-medium">{emp.name}</td>
                      <td className="py-3 px-3">{emp.department.name}</td>
                      <td className="py-3 px-3 hidden sm:table-cell">{emp.position.name}</td>
                      <td className="py-3 px-3 hidden sm:table-cell">{formatDate(emp.hireDate)}</td>
                      <td className="py-3 px-3">
                        <Badge
                          variant="secondary"
                          className={STATUS_MAP[emp.status]?.className}
                        >
                          {STATUS_MAP[emp.status]?.label || emp.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-gray-500 hidden md:table-cell truncate max-w-[200px]">{emp.email}</td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex justify-end gap-1">
                          {emp.status === "PENDING" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleApprove(emp)}
                              title="승인"
                            >
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(emp)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedEmployee(emp);
                              setDeleteOpen(true);
                            }}
                            disabled={emp.status === "RESIGNED"}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-4 border-t">
              <div className="text-sm text-gray-500">
                전체 {total}명 중 {(page - 1) * limit + 1}-
                {Math.min(page * limit, total)}명
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>직원 등록</DialogTitle>
            <DialogDescription>
              새로운 직원 정보를 입력해주세요.
            </DialogDescription>
          </DialogHeader>
          {renderFormFields()}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setCreateOpen(false)}>
              취소
            </Button>
            <Button className="w-full sm:w-auto" onClick={handleCreate} disabled={submitting}>
              {submitting ? "등록 중..." : "등록"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>직원 수정</DialogTitle>
            <DialogDescription>
              직원 정보를 수정합니다.
            </DialogDescription>
          </DialogHeader>
          {renderFormFields()}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setEditOpen(false)}>
              취소
            </Button>
            <Button className="w-full sm:w-auto" onClick={handleUpdate} disabled={submitting}>
              {submitting ? "저장 중..." : "저장"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>퇴직 처리</DialogTitle>
            <DialogDescription>
              {selectedEmployee?.name}님을 퇴직 처리하시겠습니까? 이 작업은 해당
              직원의 상태를 &apos;퇴직&apos;으로 변경합니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setDeleteOpen(false)}>
              취소
            </Button>
            <Button
              variant="destructive"
              className="w-full sm:w-auto"
              onClick={handleDelete}
              disabled={submitting}
            >
              {submitting ? "처리 중..." : "퇴직 처리"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>CSV 가져오기</DialogTitle>
            <DialogDescription>
              CSV 파일(.csv)을 업로드하여 직원을 일괄 등록합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <div className="rounded-md border bg-slate-50 p-3 text-xs text-slate-600 space-y-1.5">
              <p className="font-medium text-slate-700">자동 컬럼 매핑</p>
              <p>CSV 파일을 그대로 업로드하세요. 다양한 헤더명을 자동으로 인식합니다.</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-1 text-slate-500">
                <p><strong className="text-slate-700">사번</strong> — 사원번호, 직원번호, No, ID</p>
                <p><strong className="text-slate-700">이름</strong> — 성명, 성함, 직원명</p>
                <p><strong className="text-slate-700">이메일</strong> — 메일, E-mail</p>
                <p><strong className="text-slate-700">부서</strong> — 부서명, 소속, 팀</p>
                <p><strong className="text-slate-700">직급</strong> — 직위, 직책, 등급</p>
                <p><strong className="text-slate-700">입사일</strong> — 입사일자, 시작일</p>
              </div>
              <p className="text-slate-400 mt-1">선택: 전화번호, 비밀번호 (미입력 시 랜덤 생성)</p>
              <p className="text-slate-400">최대 <strong>5MB</strong> / <strong>1,000건</strong></p>
            </div>
            <div
              onClick={() => !submitting && fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-blue-400', 'bg-blue-50'); }}
              onDragLeave={(e) => { e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50'); }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50');
                const f = e.dataTransfer.files[0];
                if (f && fileInputRef.current) {
                  const dt = new DataTransfer();
                  dt.items.add(f);
                  fileInputRef.current.files = dt.files;
                  fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }));
                }
              }}
              className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 p-6 cursor-pointer transition hover:border-blue-400 hover:bg-blue-50/50 ${submitting ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <p className="text-sm text-gray-600 font-medium">CSV 파일을 드래그하거나 클릭하여 선택</p>
              <p className="text-xs text-gray-400">.csv 파일만 가능</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleImport}
              disabled={submitting}
              className="hidden"
            />
            {importResult && (
              <pre className="mt-3 text-sm bg-gray-50 p-3 rounded whitespace-pre-wrap">
                {importResult}
              </pre>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => {
                setImportOpen(false);
                setImportResult("");
              }}
            >
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
