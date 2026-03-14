'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
import { BarChart3, Plus, Pencil, Trash2, Loader2, ChevronDown, ChevronRight, Users, ArrowRightLeft } from 'lucide-react';
import { toast } from 'sonner';

const ADMIN_ROLES = ['SYSTEM_ADMIN', 'COMPANY_ADMIN'];

interface Position {
  id: string;
  name: string;
  level: number;
  isActive: boolean;
  _count?: { employees: number };
}

interface PositionEmployee {
  id: string;
  employeeNumber: string;
  name: string;
  email: string;
  department?: { name: string };
  status: string;
}

export default function PositionsPage() {
  const router = useRouter();
  const [userRole, setUserRole] = useState('');
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);

  // Form
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [formName, setFormName] = useState('');
  const [formLevel, setFormLevel] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{open: boolean; title: string; description: string; action: () => void}>({open: false, title: '', description: '', action: () => {}});

  // Expanded position employees
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [positionEmployees, setPositionEmployees] = useState<PositionEmployee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [changingPositionFor, setChangingPositionFor] = useState<string | null>(null);

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

  const fetchPositions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/positions?all=true');
      if (res.ok) {
        const data = await res.json();
        setPositions(data.positions);
      }
    } catch {
      toast.error('직급 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (roleLoaded && ADMIN_ROLES.includes(userRole)) {
      fetchPositions();
    }
  }, [fetchPositions, roleLoaded, userRole]);

  const toggleExpand = async (positionId: string) => {
    if (expandedId === positionId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(positionId);
    setLoadingEmployees(true);
    try {
      const res = await fetch(`/api/employees?position=${positionId}&limit=100`);
      if (res.ok) {
        const data = await res.json();
        setPositionEmployees(data.employees || []);
      }
    } catch {
      toast.error('직원 목록을 불러오지 못했습니다.');
    } finally {
      setLoadingEmployees(false);
    }
  };

  const handleChangePosition = async (employeeId: string, newPositionId: string) => {
    setChangingPositionFor(employeeId);
    try {
      const res = await fetch(`/api/employees/${employeeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionId: newPositionId }),
      });
      if (res.ok) {
        toast.success('직급이 변경되었습니다.');
        fetchPositions();
        if (expandedId) toggleExpand(expandedId);
      } else {
        const data = await res.json();
        toast.error(data.message || '직급 변경에 실패했습니다.');
      }
    } catch {
      toast.error('직급 변경 중 오류가 발생했습니다.');
    } finally {
      setChangingPositionFor(null);
    }
  };

  const openCreateDialog = () => {
    setEditingPosition(null);
    setFormName('');
    setFormLevel('');
    setDialogOpen(true);
  };

  const openEditDialog = (position: Position) => {
    setEditingPosition(position);
    setFormName(position.name);
    setFormLevel(String(position.level));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formLevel.trim()) {
      toast.error('직급명과 레벨을 입력해주세요.');
      return;
    }

    setSaving(true);
    try {
      if (editingPosition) {
        const res = await fetch(`/api/positions/${editingPosition.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: formName, level: Number(formLevel) }),
        });
        if (res.ok) {
          toast.success('직급이 수정되었습니다.');
          setDialogOpen(false);
          fetchPositions();
        } else {
          const data = await res.json();
          toast.error(data.message || '수정에 실패했습니다.');
        }
      } else {
        const res = await fetch('/api/positions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: formName, level: Number(formLevel) }),
        });
        if (res.ok) {
          toast.success('직급이 추가되었습니다.');
          setDialogOpen(false);
          fetchPositions();
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

  const handleToggleActive = async (position: Position) => {
    try {
      const res = await fetch(`/api/positions/${position.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !position.isActive }),
      });
      if (res.ok) {
        toast.success(position.isActive ? '비활성화되었습니다.' : '활성화되었습니다.');
        fetchPositions();
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
      title: '직급 삭제',
      description: '이 직급을 삭제하시겠습니까? 삭제된 데이터는 복구할 수 없습니다.',
      action: async () => {
        try {
          const res = await fetch(`/api/positions/${id}`, { method: 'DELETE' });
          if (res.ok) {
            toast.success('삭제되었습니다.');
            fetchPositions();
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
          <BarChart3 className="w-7 h-7 text-purple-600" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">직급 관리</h1>
            <p className="text-sm text-gray-500 mt-0.5">직급을 추가, 수정, 삭제할 수 있습니다.</p>
          </div>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="w-4 h-4 mr-2" />
          직급 추가
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>직급 목록</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              불러오는 중...
            </div>
          ) : positions.length === 0 ? (
            <div className="text-center py-12">
              <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 mb-4">등록된 직급이 없습니다.</p>
              <Button variant="outline" onClick={openCreateDialog}>
                직급 추가
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[500px]">
                <thead>
                  <tr className="border-b bg-gray-50 text-left">
                    <th className="py-3 px-3 font-medium text-gray-600">레벨</th>
                    <th className="py-3 px-3 font-medium text-gray-600">직급명</th>
                    <th className="py-3 px-3 font-medium text-gray-600 text-center">직원수</th>
                    <th className="py-3 px-3 font-medium text-gray-600">상태</th>
                    <th className="py-3 px-3 font-medium text-gray-600 text-right">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((p) => {
                    const isExpanded = expandedId === p.id;
                    const empCount = p._count?.employees ?? 0;
                    return (
                      <React.Fragment key={p.id}>
                        <tr className={`border-b hover:bg-gray-50 cursor-pointer ${isExpanded ? 'bg-purple-50/50' : ''}`} onClick={() => empCount > 0 && toggleExpand(p.id)}>
                          <td className="py-3 px-3 text-gray-500">
                            <div className="flex items-center gap-1">
                              {empCount > 0 && (isExpanded ? <ChevronDown className="w-4 h-4 text-purple-500" /> : <ChevronRight className="w-4 h-4 text-gray-400" />)}
                              {p.level}
                            </div>
                          </td>
                          <td className="py-3 px-3 font-medium">{p.name}</td>
                          <td className="py-3 px-3 text-center">
                            <span className={empCount > 0 ? 'text-purple-600 font-medium' : 'text-gray-400'}>{empCount}명</span>
                          </td>
                          <td className="py-3 px-3">
                            <Badge
                              className={
                                p.isActive
                                  ? 'bg-green-100 text-green-800 hover:bg-green-100 cursor-pointer'
                                  : 'bg-gray-100 text-gray-500 hover:bg-gray-100 cursor-pointer'
                              }
                              onClick={(e) => { e.stopPropagation(); handleToggleActive(p); }}
                            >
                              {p.isActive ? '활성' : '비활성'}
                            </Badge>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openEditDialog(p); }}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}>
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={5} className="bg-purple-50/30 px-3 py-0">
                              {loadingEmployees ? (
                                <div className="flex items-center gap-2 py-4 text-gray-400 text-sm">
                                  <Loader2 className="w-4 h-4 animate-spin" /> 불러오는 중...
                                </div>
                              ) : positionEmployees.length === 0 ? (
                                <div className="py-4 text-sm text-gray-400">소속 직원이 없습니다.</div>
                              ) : (
                                <div className="py-3">
                                  <div className="flex items-center gap-2 mb-2 text-xs text-gray-500">
                                    <Users className="w-3.5 h-3.5" />
                                    <span>{p.name} 소속 직원 ({positionEmployees.length}명)</span>
                                  </div>
                                  <div className="grid gap-1.5">
                                    {positionEmployees.map((emp) => (
                                      <div key={emp.id} className="flex items-center justify-between bg-white rounded-lg border border-gray-100 px-3 py-2 text-sm">
                                        <div className="flex items-center gap-3">
                                          <span className="text-gray-400 text-xs w-16 shrink-0">{emp.employeeNumber}</span>
                                          <span className="font-medium">{emp.name}</span>
                                          <span className="text-gray-400 text-xs">{emp.department?.name}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <Select
                                            value={p.id}
                                            onValueChange={(val) => handleChangePosition(emp.id, val)}
                                            disabled={changingPositionFor === emp.id}
                                          >
                                            <SelectTrigger className="w-[120px] h-8 text-xs">
                                              <div className="flex items-center gap-1">
                                                <ArrowRightLeft className="w-3 h-3 text-gray-400" />
                                                <SelectValue />
                                              </div>
                                            </SelectTrigger>
                                            <SelectContent>
                                              {positions.filter(pp => pp.isActive).map((pp) => (
                                                <SelectItem key={pp.id} value={pp.id}>
                                                  {pp.name}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
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

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{editingPosition ? '직급 수정' : '직급 추가'}</DialogTitle>
            <DialogDescription>직급 정보를 입력하세요.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>직급명</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="예: 과장"
                className="mt-1"
              />
            </div>
            <div>
              <Label>레벨</Label>
              <Input
                type="number"
                value={formLevel}
                onChange={(e) => setFormLevel(e.target.value)}
                placeholder="숫자 (낮을수록 높은 직급)"
                className="mt-1"
              />
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
