'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Building2, Plus, Pencil, Trash2, ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const ADMIN_ROLES = ['SYSTEM_ADMIN', 'COMPANY_ADMIN'];

interface Department {
  id: string;
  name: string;
  code: string;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  workStartTime: string | null;
  workEndTime: string | null;
  lunchStartTime: string | null;
  lunchEndTime: string | null;
  _count?: { employees: number };
  children?: Department[];
}

export default function DepartmentsPage() {
  const router = useRouter();
  const [userRole, setUserRole] = useState('');
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [allDepartments, setAllDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // Form
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formParentId, setFormParentId] = useState('');
  const [formSortOrder, setFormSortOrder] = useState('0');
  const [formWorkStartTime, setFormWorkStartTime] = useState('');
  const [formWorkEndTime, setFormWorkEndTime] = useState('');
  const [formLunchStartTime, setFormLunchStartTime] = useState('');
  const [formLunchEndTime, setFormLunchEndTime] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{open: boolean; title: string; description: string; action: () => void}>({open: false, title: '', description: '', action: () => {}});

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => {
        if (r.status === 401) { window.location.href = '/login'; return null; }
        return r.ok ? r.json() : null;
      })
      .then((d) => {
        if (d?.user?.role) {
          setUserRole(d.user.role);
          if (!ADMIN_ROLES.includes(d.user.role)) {
            router.replace('/dashboard');
            return;
          }
        }
        setRoleLoaded(true);
      })
      .catch(() => setRoleLoaded(true));
  }, [router]);

  const fetchDepartments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/departments?all=true');
      if (res.ok) {
        const data = await res.json();
        setDepartments(data.departments);
        setAllDepartments(data.allDepartments);
      }
    } catch {
      toast.error('부서 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (roleLoaded && ADMIN_ROLES.includes(userRole)) {
      fetchDepartments();
    }
  }, [fetchDepartments, roleLoaded, userRole]);

  const openCreateDialog = () => {
    setEditingDept(null);
    setFormName('');
    setFormCode('');
    setFormParentId('');
    setFormSortOrder('0');
    setFormWorkStartTime('');
    setFormWorkEndTime('');
    setFormLunchStartTime('');
    setFormLunchEndTime('');
    setDialogOpen(true);
  };

  const openEditDialog = (dept: Department) => {
    setEditingDept(dept);
    setFormName(dept.name);
    setFormCode(dept.code);
    setFormParentId(dept.parentId || '');
    setFormSortOrder(String(dept.sortOrder));
    setFormWorkStartTime(dept.workStartTime || '');
    setFormWorkEndTime(dept.workEndTime || '');
    setFormLunchStartTime(dept.lunchStartTime || '');
    setFormLunchEndTime(dept.lunchEndTime || '');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formCode.trim()) {
      toast.error('부서명과 부서코드를 입력해주세요.');
      return;
    }

    setSaving(true);
    try {
      if (editingDept) {
        const res = await fetch(`/api/departments/${editingDept.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formName,
            code: formCode,
            parentId: formParentId && formParentId !== 'none' ? formParentId : null,
            sortOrder: Number(formSortOrder),
            workStartTime: formWorkStartTime,
            workEndTime: formWorkEndTime,
            lunchStartTime: formLunchStartTime,
            lunchEndTime: formLunchEndTime,
          }),
        });
        if (res.ok) {
          toast.success('부서가 수정되었습니다.');
          setDialogOpen(false);
          fetchDepartments();
        } else {
          const data = await res.json();
          toast.error(data.message || '수정에 실패했습니다.');
        }
      } else {
        const res = await fetch('/api/departments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formName,
            code: formCode,
            parentId: formParentId && formParentId !== 'none' ? formParentId : null,
            sortOrder: Number(formSortOrder),
            workStartTime: formWorkStartTime,
            workEndTime: formWorkEndTime,
            lunchStartTime: formLunchStartTime,
            lunchEndTime: formLunchEndTime,
          }),
        });
        if (res.ok) {
          toast.success('부서가 추가되었습니다.');
          setDialogOpen(false);
          fetchDepartments();
        } else {
          const data = await res.json();
          toast.error(data.message || '추가에 실패했습니다.');
        }
      }
    } catch {
      toast.error('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (dept: Department) => {
    try {
      const res = await fetch(`/api/departments/${dept.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !dept.isActive }),
      });
      if (res.ok) {
        toast.success(dept.isActive ? '비활성화되었습니다.' : '활성화되었습니다.');
        fetchDepartments();
      } else {
        const data = await res.json();
        toast.error(data.message || '상태 변경에 실패했습니다.');
      }
    } catch {
      toast.error('상태 변경 중 오류가 발생했습니다.');
    }
  };

  const handleDelete = (id: string) => {
    setConfirmDialog({
      open: true,
      title: '부서 삭제',
      description: '이 부서를 삭제하시겠습니까? 삭제된 데이터는 복구할 수 없습니다.',
      action: async () => {
        try {
          const res = await fetch(`/api/departments/${id}`, { method: 'DELETE' });
          if (res.ok) {
            toast.success('삭제되었습니다.');
            fetchDepartments();
          } else {
            const data = await res.json();
            toast.error(data.message || '삭제에 실패했습니다.');
          }
        } catch {
          toast.error('삭제 중 오류가 발생했습니다.');
        }
      },
    });
  };

  const getParentName = (parentId: string | null) => {
    if (!parentId) return '-';
    const parent = allDepartments.find((d) => d.id === parentId);
    return parent?.name || '-';
  };

  const renderDepartmentRows = (depts: Department[], depth = 0): React.ReactNode => {
    return depts.map((dept) => (
      <Fragment key={dept.id}>
        <tr className="border-b last:border-0 hover:bg-gray-50">
          <td className="py-3 px-3">
            <div className="flex items-center" style={{ paddingLeft: `${depth * 24}px` }}>
              {depth > 0 && <ChevronRight className="w-3 h-3 text-gray-400 mr-1" />}
              <span className="font-medium">{dept.name}</span>
            </div>
          </td>
          <td className="py-3 px-3 text-gray-500">{dept.code}</td>
          <td className="py-3 px-3 text-gray-500 hidden sm:table-cell">{getParentName(dept.parentId)}</td>
          <td className="py-3 px-3 text-center">{dept._count?.employees ?? 0}명</td>
          <td className="py-3 px-3">
            <Badge
              className={
                dept.isActive
                  ? 'bg-green-100 text-green-800 hover:bg-green-100 cursor-pointer'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-100 cursor-pointer'
              }
              onClick={() => handleToggleActive(dept)}
            >
              {dept.isActive ? '활성' : '비활성'}
            </Badge>
          </td>
          <td className="py-3 px-3 text-right">
            <div className="flex items-center justify-end gap-1">
              <Button variant="ghost" size="sm" onClick={() => openEditDialog(dept)}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(dept.id)}>
                <Trash2 className="w-4 h-4 text-red-500" />
              </Button>
            </div>
          </td>
        </tr>
        {dept.children && dept.children.length > 0 && renderDepartmentRows(dept.children, depth + 1)}
      </Fragment>
    ));
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Building2 className="w-7 h-7 text-purple-600" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">부서 관리</h1>
            <p className="text-sm text-gray-500 mt-0.5">부서를 추가, 수정, 삭제할 수 있습니다.</p>
          </div>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="w-4 h-4 mr-2" />
          부서 추가
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>부서 목록</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              불러오는 중...
            </div>
          ) : departments.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 mb-4">등록된 부서가 없습니다.</p>
              <Button variant="outline" onClick={openCreateDialog}>
                부서 추가
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="border-b bg-gray-50 text-left">
                    <th className="py-3 px-3 font-medium text-gray-600">부서명</th>
                    <th className="py-3 px-3 font-medium text-gray-600">부서코드</th>
                    <th className="py-3 px-3 font-medium text-gray-600 hidden sm:table-cell">상위부서</th>
                    <th className="py-3 px-3 font-medium text-gray-600 text-center">직원수</th>
                    <th className="py-3 px-3 font-medium text-gray-600">상태</th>
                    <th className="py-3 px-3 font-medium text-gray-600 text-right">관리</th>
                  </tr>
                </thead>
                <tbody>{renderDepartmentRows(departments)}</tbody>
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
            <Button variant="destructive" onClick={() => { confirmDialog.action(); setConfirmDialog(prev => ({...prev, open: false})); }}>확인</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{editingDept ? '부서 수정' : '부서 추가'}</DialogTitle>
            <DialogDescription>부서 정보를 입력하세요.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>부서명</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="예: 개발팀"
                className="mt-1"
              />
            </div>
            <div>
              <Label>부서코드</Label>
              <Input
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                placeholder="예: DEV"
                className="mt-1"
              />
            </div>
            <div>
              <Label>상위부서</Label>
              <Select value={formParentId} onValueChange={setFormParentId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="없음 (최상위)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">없음 (최상위)</SelectItem>
                  {allDepartments
                    .filter((d) => d.id !== editingDept?.id)
                    .map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>정렬순서</Label>
              <Input
                type="number"
                value={formSortOrder}
                onChange={(e) => setFormSortOrder(e.target.value)}
                placeholder="0"
                className="mt-1"
              />
            </div>
            <div className="border-t pt-4 mt-2">
              <p className="text-sm font-medium text-gray-700 mb-3">근무시간 설정 (미입력시 회사 설정 사용)</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>출근시간</Label>
                  <Input type="time" value={formWorkStartTime} onChange={(e) => setFormWorkStartTime(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>퇴근시간</Label>
                  <Input type="time" value={formWorkEndTime} onChange={(e) => setFormWorkEndTime(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>점심 시작</Label>
                  <Input type="time" value={formLunchStartTime} onChange={(e) => setFormLunchStartTime(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>점심 종료</Label>
                  <Input type="time" value={formLunchEndTime} onChange={(e) => setFormLunchEndTime(e.target.value)} className="mt-1" />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setDialogOpen(false)}
            >
              취소
            </Button>
            <Button className="w-full sm:w-auto" onClick={handleSave} disabled={saving}>
              {saving ? '저장 중...' : '저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
