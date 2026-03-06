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
} from "lucide-react";

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
  status: "ACTIVE" | "ON_LEAVE" | "RESIGNED";
  role: string;
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
}

const STATUS_MAP: Record<string, { label: string; className: string }> = {
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

  // Filters
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterPosition, setFilterPosition] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

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
      // ignore
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
      // ignore
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
    setPage(1);
    fetchEmployees();
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
      }
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
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
      setImportResult(data.message || "가져오기 완료");
      if (data.errors?.length > 0) {
        setImportResult(
          (prev) => prev + "\n" + data.errors.slice(0, 5).join("\n")
        );
      }
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
      a.download = `employees_${new Date().toISOString().split("T")[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      // ignore
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
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
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
            <DialogTitle>엑셀 가져오기</DialogTitle>
            <DialogDescription>
              엑셀 파일(.xlsx)을 업로드하여 직원을 일괄 등록합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <div className="rounded-md border bg-slate-50 p-3 text-xs text-slate-600 space-y-1">
              <p className="font-medium text-slate-700">업로드 안내</p>
              <p>• 필수 컬럼: 사번, 이름, 이메일, 부서, 직급, 입사일</p>
              <p>• 선택 컬럼: 비밀번호, 전화번호 (비밀번호 미입력 시 default1234)</p>
              <p>• 파일 형식: .xlsx 또는 .xls</p>
              <p>• 최대 파일 크기: <strong>5MB</strong> / 최대 <strong>1,000건</strong></p>
            </div>
            <Input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImport}
              disabled={submitting}
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
