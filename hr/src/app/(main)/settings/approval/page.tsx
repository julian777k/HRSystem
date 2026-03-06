'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Plus, Pencil, Trash2, Search, Users, GitBranch, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { PERMISSION_MODULES, CAPABILITIES, parsePermissions, type CustomPermissions, type PermissionModule, type Capability } from '@/lib/permissions';

const ADMIN_ROLES = ["SYSTEM_ADMIN", "COMPANY_ADMIN"];

interface ApprovalStep {
  id?: string;
  stepOrder: number;
  approverId?: string | null;
  approverRole: string;
  actionType: string;
  positionLevel?: number | null;
  approver?: { id: string; name: string; employeeNumber: string } | null;
}

interface PositionOption {
  id: string;
  name: string;
  level: number;
}

interface ApprovalLine {
  id: string;
  name: string;
  type: string;
  isDefault: boolean;
  isActive: boolean;
  steps: ApprovalStep[];
}

interface EmployeePermission {
  id: string;
  employeeNumber: string;
  name: string;
  email: string;
  role: string;
  customPermissions?: string | null;
  department: { id: string; name: string };
  position: { id: string; name: string };
}

interface EmployeeOption {
  id: string;
  name: string;
  employeeNumber: string;
}

const TYPE_LABELS: Record<string, string> = {
  LEAVE: '휴가',
  OVERTIME: '시간외근무',
  GENERAL: '일반',
};

const ROLE_LABELS: Record<string, string> = {
  FIXED: '고정결재자',
  POSITION: '직급지정',
  DEPT_HEAD: '부서장',
  UPPER_POSITION: '차상위직급',
  SKIP_TO_HEAD: '전결',
};

const ACTION_TYPE_LABELS: Record<string, string> = {
  APPROVE: '결재',
  AGREE: '합의',
  NOTIFY: '통보',
};


export default function ApprovalSettingsPage() {
  const router = useRouter();
  const [userRole, setUserRole] = useState('');
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [lines, setLines] = useState<ApprovalLine[]>([]);
  const [employees, setEmployees] = useState<EmployeePermission[]>([]);
  const [employeeOptions, setEmployeeOptions] = useState<EmployeeOption[]>([]);
  const [positionOptions, setPositionOptions] = useState<PositionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [permSearch, setPermSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLine, setEditingLine] = useState<ApprovalLine | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('LEAVE');
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [formSteps, setFormSteps] = useState<ApprovalStep[]>([
    { stepOrder: 1, approverRole: 'DEPT_HEAD', actionType: 'APPROVE' },
  ]);
  const [saving, setSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{open: boolean; title: string; description: string; action: () => void}>({open: false, title: '', description: '', action: () => {}});

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

  const fetchLines = useCallback(async () => {
    try {
      const res = await fetch('/api/approval/lines');
      if (res.ok) {
        const data = await res.json();
        setLines(data.lines);
      }
    } catch {
      toast.error('결재선 목록을 불러오지 못했습니다.');
    }
  }, []);

  const fetchEmployees = useCallback(async (search?: string) => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const res = await fetch(`/api/settings/permissions?${params}`);
      if (res.ok) {
        const data = await res.json();
        setEmployees(data.employees);
      }
    } catch {
      toast.error('직원 목록을 불러오지 못했습니다.');
    }
  }, []);

  const fetchEmployeeOptions = useCallback(async () => {
    try {
      const res = await fetch('/api/employees?limit=200');
      if (res.ok) {
        const data = await res.json();
        setEmployeeOptions(
          data.employees.map((e: { id: string; name: string; employeeNumber: string }) => ({
            id: e.id,
            name: e.name,
            employeeNumber: e.employeeNumber,
          }))
        );
      }
    } catch {
      // silently fail
    }
  }, []);

  const fetchPositions = useCallback(async () => {
    try {
      const res = await fetch('/api/positions');
      if (res.ok) {
        const data = await res.json();
        setPositionOptions(
          data.positions.map((p: { id: string; name: string; level: number }) => ({
            id: p.id,
            name: p.name,
            level: p.level,
          }))
        );
      }
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    if (roleLoaded && ADMIN_ROLES.includes(userRole)) {
      Promise.all([fetchLines(), fetchEmployees(), fetchEmployeeOptions(), fetchPositions()]).finally(() =>
        setLoading(false)
      );
    }
  }, [fetchLines, fetchEmployees, fetchEmployeeOptions, fetchPositions, roleLoaded, userRole]);

  const openCreateDialog = () => {
    setEditingLine(null);
    setFormName('');
    setFormType('LEAVE');
    setFormIsDefault(false);
    setFormSteps([{ stepOrder: 1, approverRole: 'DEPT_HEAD', actionType: 'APPROVE' }]);
    setDialogOpen(true);
  };

  const openEditDialog = (line: ApprovalLine) => {
    setEditingLine(line);
    setFormName(line.name);
    setFormType(line.type);
    setFormIsDefault(line.isDefault);
    setFormSteps(
      line.steps.map((s) => ({
        stepOrder: s.stepOrder,
        approverId: s.approverId,
        approverRole: s.approverRole,
        actionType: s.actionType,
        positionLevel: s.positionLevel,
      }))
    );
    setDialogOpen(true);
  };

  const addStep = () => {
    setFormSteps((prev) => [
      ...prev,
      {
        stepOrder: prev.length + 1,
        approverRole: 'DEPT_HEAD',
        actionType: 'APPROVE',
      },
    ]);
  };

  const removeStep = (index: number) => {
    setFormSteps((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((s, i) => ({ ...s, stepOrder: i + 1 }))
    );
  };

  const updateStep = (index: number, field: string, value: string) => {
    setFormSteps((prev) =>
      prev.map((s, i) => {
        if (i !== index) return s;
        if (field === 'positionLevel') {
          return { ...s, positionLevel: value ? parseInt(value) : null };
        }
        return { ...s, [field]: value };
      })
    );
  };

  const handleSaveLine = async () => {
    if (!formName.trim()) {
      toast.error('결재선 이름을 입력해주세요.');
      return;
    }

    const invalidStep = formSteps.find(
      (s) => (s.approverRole === 'FIXED' && !s.approverId) ||
             (s.approverRole === 'POSITION' && s.positionLevel == null)
    );
    if (invalidStep) {
      toast.error(
        invalidStep.approverRole === 'FIXED'
          ? `${invalidStep.stepOrder}단계: 고정결재자를 선택해주세요.`
          : `${invalidStep.stepOrder}단계: 직급을 선택해주세요.`
      );
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formName,
        type: formType,
        isDefault: formIsDefault,
        steps: formSteps.map((s) => ({
          stepOrder: s.stepOrder,
          approverId: s.approverRole === 'FIXED' ? s.approverId : null,
          approverRole: s.approverRole,
          actionType: s.actionType,
          positionLevel: s.approverRole === 'POSITION' ? s.positionLevel : null,
        })),
      };

      const res = editingLine
        ? await fetch(`/api/approval/lines/${editingLine.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/approval/lines', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

      if (res.ok) {
        toast.success(editingLine ? '결재선이 수정되었습니다.' : '결재선이 생성되었습니다.');
        setDialogOpen(false);
        fetchLines();
      } else {
        const data = await res.json();
        toast.error(data.message || '저장에 실패했습니다.');
      }
    } catch {
      toast.error('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLine = (id: string) => {
    setConfirmDialog({
      open: true,
      title: '결재선 삭제',
      description: '이 결재선을 삭제하시겠습니까? 삭제된 데이터는 복구할 수 없습니다.',
      action: async () => {
        try {
          const res = await fetch(`/api/approval/lines/${id}`, { method: 'DELETE' });
          if (res.ok) {
            toast.success('결재선이 삭제되었습니다.');
            fetchLines();
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

  const handleRoleChange = async (employeeId: string, role: string) => {
    try {
      const res = await fetch('/api/settings/permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, role }),
      });

      if (res.ok) {
        toast.success('권한이 변경되었습니다.');
        fetchEmployees(permSearch);
      } else {
        const data = await res.json();
        toast.error(data.message || '권한 변경에 실패했습니다.');
      }
    } catch {
      toast.error('권한 변경 중 오류가 발생했습니다.');
    }
  };

  // Custom permissions dialog
  const [permDialogOpen, setPermDialogOpen] = useState(false);
  const [permTarget, setPermTarget] = useState<EmployeePermission | null>(null);
  const [permEditing, setPermEditing] = useState<CustomPermissions>({});
  const [savingPerm, setSavingPerm] = useState(false);

  const openPermDialog = (emp: EmployeePermission) => {
    setPermTarget(emp);
    setPermEditing(parsePermissions(emp.customPermissions));
    setPermDialogOpen(true);
  };

  const togglePermission = (module: PermissionModule, cap: Capability) => {
    setPermEditing(prev => {
      const current = prev[module] || [];
      const next = current.includes(cap)
        ? current.filter(c => c !== cap)
        : [...current, cap];
      if (next.length === 0) {
        const { [module]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [module]: next };
    });
  };

  const handleSavePermissions = async () => {
    if (!permTarget) return;
    setSavingPerm(true);
    try {
      const res = await fetch('/api/settings/permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: permTarget.id,
          role: permTarget.role,
          customPermissions: Object.keys(permEditing).length > 0 ? permEditing : null,
        }),
      });
      if (res.ok) {
        toast.success('커스텀 권한이 저장되었습니다.');
        setPermDialogOpen(false);
        fetchEmployees(permSearch);
      } else {
        const data = await res.json();
        toast.error(data.message || '저장에 실패했습니다.');
      }
    } catch {
      toast.error('저장 중 오류가 발생했습니다.');
    } finally {
      setSavingPerm(false);
    }
  };

  const linesByType = (type: string) => lines.filter((l) => l.type === type);

  const getPositionName = (level: number | null | undefined) => {
    if (level == null) return '';
    const pos = positionOptions.find((p) => p.level === level);
    return pos ? pos.name : `Level ${level}`;
  };

  const getStepLabel = (s: ApprovalStep) => {
    if (s.approverRole === 'POSITION' && s.positionLevel != null) {
      return `${getPositionName(s.positionLevel)} 결재`;
    }
    if (s.approverRole === 'FIXED' && s.approver) {
      return `${ROLE_LABELS[s.approverRole]} [${s.approver.name}]`;
    }
    return ROLE_LABELS[s.approverRole] || s.approverRole;
  };

  if (!roleLoaded || loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        불러오는 중...
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-7 h-7 text-slate-600" />
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">권한/결재선 설정</h1>
          <p className="text-sm text-gray-500 mt-0.5">결재선과 직원 권한을 관리합니다.</p>
        </div>
      </div>

      <Tabs defaultValue="approval-lines">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="approval-lines">
            <GitBranch className="w-4 h-4 mr-1" />
            결재선 관리
          </TabsTrigger>
          <TabsTrigger value="permissions">
            <Users className="w-4 h-4 mr-1" />
            권한 설정
          </TabsTrigger>
        </TabsList>

        <TabsContent value="approval-lines" className="mt-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
            <p className="text-sm text-muted-foreground">
              결재선을 관리하고 기본 결재선을 설정합니다.
            </p>
            <Button className="w-full sm:w-auto" onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-1" />
              결재선 추가
            </Button>
          </div>

          {['LEAVE', 'OVERTIME', 'GENERAL'].map((type) => (
            <div key={type} className="mb-6">
              <h3 className="text-lg font-semibold mb-3">
                {TYPE_LABELS[type]}
              </h3>
              {linesByType(type).length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-gray-400">
                    등록된 결재선이 없습니다.
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {linesByType(type).map((line) => (
                    <Card key={line.id}>
                      <CardContent className="py-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium">{line.name}</span>
                              {line.isDefault && (
                                <Badge variant="default">기본</Badge>
                              )}
                              {!line.isActive && (
                                <Badge variant="secondary">비활성</Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                              {line.steps.length}단계:{' '}
                              {line.steps.map((s) => (
                                <span key={s.stepOrder}>
                                  {s.stepOrder > 1 && ' → '}
                                  {getStepLabel(s)}
                                  ({ACTION_TYPE_LABELS[s.actionType]})
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditDialog(line)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteLine(line.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          ))}
        </TabsContent>

        <TabsContent value="permissions" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>직원 권한 관리</CardTitle>
              <CardDescription>
                직원별 시스템 역할을 설정합니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="이름, 사번, 이메일로 검색"
                    className="pl-9"
                    value={permSearch}
                    onChange={(e) => setPermSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') fetchEmployees(permSearch);
                    }}
                  />
                </div>
                <Button variant="outline" className="w-full sm:w-auto" onClick={() => fetchEmployees(permSearch)}>
                  검색
                </Button>
              </div>

              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm min-w-[600px]">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium">사번</th>
                      <th className="text-left px-4 py-3 font-medium">이름</th>
                      <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">부서</th>
                      <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">직급</th>
                      <th className="text-left px-4 py-3 font-medium">역할</th>
                      <th className="text-left px-4 py-3 font-medium">커스텀 권한</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {employees.map((emp) => (
                      <tr key={emp.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">{emp.employeeNumber}</td>
                        <td className="px-4 py-3 font-medium">{emp.name}</td>
                        <td className="px-4 py-3 hidden sm:table-cell">{emp.department.name}</td>
                        <td className="px-4 py-3 hidden sm:table-cell">{emp.position.name}</td>
                        <td className="px-4 py-3">
                          <Select
                            value={emp.role}
                            onValueChange={(value) => handleRoleChange(emp.id, value)}
                          >
                            <SelectTrigger className="w-[140px] sm:w-[160px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="SYSTEM_ADMIN">시스템 관리자</SelectItem>
                              <SelectItem value="COMPANY_ADMIN">회사 관리자</SelectItem>
                              <SelectItem value="DEPT_ADMIN">부서 관리자</SelectItem>
                              <SelectItem value="BASIC">일반 사용자</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-3">
                          {!ADMIN_ROLES.includes(emp.role) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openPermDialog(emp)}
                            >
                              {emp.customPermissions ? '편집' : '설정'}
                              {emp.customPermissions && (
                                <Badge variant="secondary" className="ml-1 text-xs">
                                  {Object.keys(parsePermissions(emp.customPermissions)).length}
                                </Badge>
                              )}
                            </Button>
                          )}
                          {ADMIN_ROLES.includes(emp.role) && (
                            <span className="text-xs text-muted-foreground">전체 권한</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {employees.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                          직원이 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Approval Line Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingLine ? '결재선 수정' : '결재선 추가'}
            </DialogTitle>
            <DialogDescription>결재선 정보를 입력하세요.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>결재선 이름</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="예: 기본 휴가 결재"
                />
              </div>
              <div className="space-y-2">
                <Label>유형</Label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LEAVE">휴가</SelectItem>
                    <SelectItem value="OVERTIME">시간외근무</SelectItem>
                    <SelectItem value="GENERAL">일반</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="isDefault"
                checked={formIsDefault}
                onCheckedChange={(checked) => setFormIsDefault(checked === true)}
              />
              <Label htmlFor="isDefault">기본 결재선으로 설정</Label>
            </div>

            <Separator />

            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-base">결재 단계</Label>
                <Button variant="outline" size="sm" onClick={addStep}>
                  <Plus className="w-4 h-4 mr-1" />
                  단계 추가
                </Button>
              </div>

              <div className="space-y-3">
                {formSteps.map((step, index) => (
                  <Card key={index}>
                    <CardContent className="py-3">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        <Badge variant="outline" className="shrink-0">
                          {step.stepOrder}단계
                        </Badge>

                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                          <Select
                            value={
                              step.approverRole === 'POSITION' && step.positionLevel != null
                                ? `POS_${step.positionLevel}`
                                : step.approverRole
                            }
                            onValueChange={(v) => {
                              if (v.startsWith('POS_')) {
                                const level = parseInt(v.replace('POS_', ''));
                                updateStep(index, 'approverRole', 'POSITION');
                                updateStep(index, 'positionLevel', String(level));
                                updateStep(index, 'approverId', '');
                              } else {
                                updateStep(index, 'approverRole', v);
                                updateStep(index, 'positionLevel', '');
                                if (v !== 'FIXED') updateStep(index, 'approverId', '');
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="결재자 유형" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="FIXED">고정결재자 (직접 지정)</SelectItem>
                              {positionOptions.map((pos) => (
                                <SelectItem key={pos.id} value={`POS_${pos.level}`}>
                                  {pos.name} 결재
                                </SelectItem>
                              ))}
                              <SelectItem value="SKIP_TO_HEAD">전결 (최종결재자)</SelectItem>
                            </SelectContent>
                          </Select>

                          <Select
                            value={step.actionType}
                            onValueChange={(v) => updateStep(index, 'actionType', v)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="결재 유형" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="APPROVE">결재</SelectItem>
                              <SelectItem value="AGREE">합의</SelectItem>
                              <SelectItem value="NOTIFY">통보</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {step.approverRole === 'FIXED' && (
                          <Select
                            value={step.approverId || ''}
                            onValueChange={(v) => updateStep(index, 'approverId', v)}
                          >
                            <SelectTrigger className="w-full sm:w-[200px]">
                              <SelectValue placeholder="결재자 선택" />
                            </SelectTrigger>
                            <SelectContent>
                              {employeeOptions.map((emp) => (
                                <SelectItem key={emp.id} value={emp.id}>
                                  {emp.name} ({emp.employeeNumber})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}

                        {formSteps.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeStep(index)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setDialogOpen(false)}>
              취소
            </Button>
            <Button className="w-full sm:w-auto" onClick={handleSaveLine} disabled={saving}>
              {saving ? '저장 중...' : '저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* Custom Permissions Dialog */}
      <Dialog open={permDialogOpen} onOpenChange={setPermDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>커스텀 권한 설정</DialogTitle>
            <DialogDescription>
              {permTarget?.name} ({permTarget?.department.name}) - 모듈별 접근 권한을 설정합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">모듈</th>
                    {CAPABILITIES.map(cap => (
                      <th key={cap.key} className="text-center px-4 py-3 font-medium">{cap.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(Object.entries(PERMISSION_MODULES) as [PermissionModule, string][]).map(([mod, label]) => (
                    <tr key={mod}>
                      <td className="px-4 py-3 font-medium">{label}</td>
                      {CAPABILITIES.map(cap => (
                        <td key={cap.key} className="text-center px-4 py-3">
                          <Switch
                            checked={permEditing[mod]?.includes(cap.key) || false}
                            onCheckedChange={() => togglePermission(mod, cap.key)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              시스템 관리자와 회사 관리자는 모든 권한을 가집니다. 커스텀 권한은 일반 사용자와 부서 관리자에게만 적용됩니다.
            </p>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setPermDialogOpen(false)}>
              취소
            </Button>
            <Button className="w-full sm:w-auto" onClick={handleSavePermissions} disabled={savingPerm}>
              {savingPerm ? '저장 중...' : '저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
