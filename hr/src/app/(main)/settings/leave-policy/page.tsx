'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Plus, Pencil, Info, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

const ADMIN_ROLES = ["SYSTEM_ADMIN", "COMPANY_ADMIN"];

interface LeaveType {
  id: string;
  name: string;
  code: string;
  isPaid: boolean;
  isAnnualDeduct: boolean;
  maxDays: number | null;
  requiresDoc: boolean;
  isActive: boolean;
  sortOrder: number;
}

interface LeavePolicy {
  id: string;
  leaveTypeId: string;
  name: string;
  description: string | null;
  yearFrom: number;
  yearTo: number | null;
  grantDays: number;
  grantType: string;
  isActive: boolean;
  leaveType: { id: string; name: string; code: string };
}

const GRANT_TYPE_LABELS: Record<string, string> = {
  MONTHLY: '월별 부여',
  YEARLY: '연간 부여',
  ONCE: '일시 부여',
};

export default function LeavePolicyPage() {
  const router = useRouter();
  const [userRole, setUserRole] = useState('');
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [policies, setPolicies] = useState<LeavePolicy[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);

  // Policy dialog
  const [policyDialogOpen, setPolicyDialogOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<LeavePolicy | null>(null);
  const [policyForm, setPolicyForm] = useState({
    name: '',
    leaveTypeId: '',
    description: '',
    yearFrom: 1,
    yearTo: '' as string | number,
    grantDays: 15,
    grantType: 'YEARLY',
  });

  // Leave type dialog
  const [typeDialogOpen, setTypeDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<LeaveType | null>(null);
  const [typeForm, setTypeForm] = useState({
    name: '',
    code: '',
    isPaid: true,
    isAnnualDeduct: false,
    maxDays: '' as string | number,
    requiresDoc: false,
    sortOrder: 0,
  });

  const [saving, setSaving] = useState(false);

  // Carry-over settings
  const [carryOverEnabled, setCarryOverEnabled] = useState(false);
  const [carryOverMaxDays, setCarryOverMaxDays] = useState('5');
  const [carryOverExpiryMonths, setCarryOverExpiryMonths] = useState('3');
  const [carryOverSaving, setCarryOverSaving] = useState(false);
  const [carryOverProcessing, setCarryOverProcessing] = useState(false);
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

  const fetchPolicies = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/leave-policy');
      if (res.ok) {
        const data = await res.json();
        setPolicies(data.policies);
      }
    } catch {
      toast.error('휴가규정을 불러오지 못했습니다.');
    }
  }, []);

  const fetchCarryOverSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/leave-policy/carry-over');
      if (res.ok) {
        const data = await res.json();
        setCarryOverEnabled(data.enabled);
        setCarryOverMaxDays(String(data.maxDays));
        setCarryOverExpiryMonths(String(data.expiryMonths));
      }
    } catch {
      // silently fail on initial load
    }
  }, []);

  const fetchLeaveTypes = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/leave-types');
      if (res.ok) {
        const data = await res.json();
        setLeaveTypes(data.leaveTypes);
      }
    } catch {
      toast.error('휴가유형을 불러오지 못했습니다.');
    }
  }, []);

  useEffect(() => {
    if (roleLoaded && ADMIN_ROLES.includes(userRole)) {
      Promise.all([fetchPolicies(), fetchLeaveTypes(), fetchCarryOverSettings()]).finally(() => setLoading(false));
    }
  }, [fetchPolicies, fetchLeaveTypes, fetchCarryOverSettings, roleLoaded, userRole]);

  // Policy handlers
  const openCreatePolicyDialog = () => {
    setEditingPolicy(null);
    setPolicyForm({
      name: '',
      leaveTypeId: leaveTypes[0]?.id || '',
      description: '',
      yearFrom: 1,
      yearTo: '',
      grantDays: 15,
      grantType: 'YEARLY',
    });
    setPolicyDialogOpen(true);
  };

  const openEditPolicyDialog = (policy: LeavePolicy) => {
    setEditingPolicy(policy);
    setPolicyForm({
      name: policy.name,
      leaveTypeId: policy.leaveTypeId,
      description: policy.description || '',
      yearFrom: policy.yearFrom,
      yearTo: policy.yearTo ?? '',
      grantDays: policy.grantDays,
      grantType: policy.grantType,
    });
    setPolicyDialogOpen(true);
  };

  const handleSavePolicy = async () => {
    if (!policyForm.name.trim() || !policyForm.leaveTypeId) {
      toast.error('필수 항목을 모두 입력해주세요.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...(editingPolicy && { id: editingPolicy.id }),
        name: policyForm.name,
        leaveTypeId: policyForm.leaveTypeId,
        description: policyForm.description || null,
        yearFrom: Number(policyForm.yearFrom),
        yearTo: policyForm.yearTo !== '' ? Number(policyForm.yearTo) : null,
        grantDays: Number(policyForm.grantDays),
        grantType: policyForm.grantType,
      };

      const res = await fetch('/api/settings/leave-policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(editingPolicy ? '규정이 수정되었습니다.' : '규정이 추가되었습니다.');
        setPolicyDialogOpen(false);
        fetchPolicies();
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

  const togglePolicyActive = async (policy: LeavePolicy) => {
    try {
      const res = await fetch('/api/settings/leave-policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: policy.id, isActive: !policy.isActive }),
      });
      if (res.ok) {
        toast.success(policy.isActive ? '비활성화되었습니다.' : '활성화되었습니다.');
        fetchPolicies();
      }
    } catch {
      toast.error('상태 변경에 실패했습니다.');
    }
  };

  // Leave type handlers
  const openCreateTypeDialog = () => {
    setEditingType(null);
    setTypeForm({
      name: '',
      code: '',
      isPaid: true,
      isAnnualDeduct: false,
      maxDays: '',
      requiresDoc: false,
      sortOrder: leaveTypes.length,
    });
    setTypeDialogOpen(true);
  };

  const openEditTypeDialog = (lt: LeaveType) => {
    setEditingType(lt);
    setTypeForm({
      name: lt.name,
      code: lt.code,
      isPaid: lt.isPaid,
      isAnnualDeduct: lt.isAnnualDeduct,
      maxDays: lt.maxDays ?? '',
      requiresDoc: lt.requiresDoc,
      sortOrder: lt.sortOrder,
    });
    setTypeDialogOpen(true);
  };

  const handleSaveType = async () => {
    if (!typeForm.name.trim() || !typeForm.code.trim()) {
      toast.error('유형명과 코드를 입력해주세요.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: typeForm.name,
        code: typeForm.code,
        isPaid: typeForm.isPaid,
        isAnnualDeduct: typeForm.isAnnualDeduct,
        maxDays: typeForm.maxDays !== '' ? Number(typeForm.maxDays) : null,
        requiresDoc: typeForm.requiresDoc,
        sortOrder: Number(typeForm.sortOrder),
      };

      const res = editingType
        ? await fetch(`/api/settings/leave-types/${editingType.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/settings/leave-types', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

      if (res.ok) {
        toast.success(editingType ? '휴가유형이 수정되었습니다.' : '휴가유형이 추가되었습니다.');
        setTypeDialogOpen(false);
        fetchLeaveTypes();
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

  const toggleTypeActive = async (lt: LeaveType) => {
    try {
      const res = await fetch(`/api/settings/leave-types/${lt.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !lt.isActive }),
      });
      if (res.ok) {
        toast.success(lt.isActive ? '비활성화되었습니다.' : '활성화되었습니다.');
        fetchLeaveTypes();
      }
    } catch {
      toast.error('상태 변경에 실패했습니다.');
    }
  };

  const handleSaveCarryOver = async () => {
    setCarryOverSaving(true);
    try {
      const res = await fetch('/api/settings/leave-policy/carry-over', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: carryOverEnabled,
          maxDays: parseFloat(carryOverMaxDays) || 0,
          expiryMonths: parseInt(carryOverExpiryMonths) || 3,
        }),
      });
      if (res.ok) {
        toast.success('이월 설정이 저장되었습니다.');
      } else {
        toast.error('저장에 실패했습니다.');
      }
    } catch {
      toast.error('저장 중 오류가 발생했습니다.');
    } finally {
      setCarryOverSaving(false);
    }
  };

  const handleProcessCarryOver = () => {
    const fromYear = new Date().getFullYear() - 1;
    setConfirmDialog({
      open: true,
      title: '연차 이월',
      description: `${fromYear}년 잔여 연차를 ${fromYear + 1}년으로 이월하시겠습니까?`,
      action: async () => {
        setCarryOverProcessing(true);
        try {
          const res = await fetch('/api/leave/carry-over', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fromYear }),
          });
          const data = await res.json();
          if (res.ok) {
            toast.success(`이월 완료: ${data.carryOverCount}명 이월, ${data.skippedCount}명 스킵`);
          } else {
            toast.error(data.message || '이월 처리에 실패했습니다.');
          }
        } catch {
          toast.error('이월 처리 중 오류가 발생했습니다.');
        } finally {
          setCarryOverProcessing(false);
        }
      },
    });
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
        <FileText className="w-7 h-7 text-amber-600" />
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">휴가규정 관리</h1>
          <p className="text-sm text-gray-500 mt-0.5">연차 부여 규정과 휴가 유형을 관리합니다.</p>
        </div>
      </div>

      <Tabs defaultValue="policies">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="policies">연차 부여 규정</TabsTrigger>
          <TabsTrigger value="types">휴가유형 관리</TabsTrigger>
          <TabsTrigger value="carryover">이월 설정</TabsTrigger>
        </TabsList>

        <TabsContent value="policies" className="mt-4">
          <Alert className="mb-4">
            <Info className="w-4 h-4" />
            <AlertDescription>
              근로기준법에 따라 1년 미만 근로자는 매월 1일의 유급휴가가 발생하며,
              1년 이상 근로자는 15일의 연차휴가가 부여됩니다. 3년 이상 근속 시
              매 2년마다 1일이 가산됩니다 (최대 25일).
            </AlertDescription>
          </Alert>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
            <p className="text-sm text-muted-foreground">
              근속연수별 연차 부여 규정을 관리합니다.
            </p>
            <Button className="w-full sm:w-auto" onClick={openCreatePolicyDialog}>
              <Plus className="w-4 h-4 mr-1" />
              규정 추가
            </Button>
          </div>

          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm min-w-[600px]">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">규정명</th>
                  <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">휴가유형</th>
                  <th className="text-left px-4 py-3 font-medium">근속연수</th>
                  <th className="text-left px-4 py-3 font-medium">부여일수</th>
                  <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">부여방식</th>
                  <th className="text-left px-4 py-3 font-medium">상태</th>
                  <th className="text-right px-4 py-3 font-medium">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {policies.map((policy) => (
                  <tr key={policy.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{policy.name}</td>
                    <td className="px-4 py-3 hidden sm:table-cell">{policy.leaveType.name}</td>
                    <td className="px-4 py-3">
                      {policy.yearFrom}년
                      {policy.yearTo ? ` ~ ${policy.yearTo}년` : ' 이상'}
                    </td>
                    <td className="px-4 py-3">{policy.grantDays}일</td>
                    <td className="px-4 py-3 hidden sm:table-cell">{GRANT_TYPE_LABELS[policy.grantType]}</td>
                    <td className="px-4 py-3">
                      <Badge variant={policy.isActive ? 'default' : 'secondary'}>
                        {policy.isActive ? '활성' : '비활성'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditPolicyDialog(policy)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => togglePolicyActive(policy)}
                        >
                          {policy.isActive ? '비활성' : '활성'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {policies.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                      등록된 규정이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="types" className="mt-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
            <p className="text-sm text-muted-foreground">
              휴가유형을 관리합니다. 기본 유형은 초기 설정 시 자동 생성됩니다.
            </p>
            <Button className="w-full sm:w-auto" onClick={openCreateTypeDialog}>
              <Plus className="w-4 h-4 mr-1" />
              유형 추가
            </Button>
          </div>

          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm min-w-[600px]">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">유형명</th>
                  <th className="text-left px-4 py-3 font-medium">코드</th>
                  <th className="text-left px-4 py-3 font-medium">유급여부</th>
                  <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">연차차감</th>
                  <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">최대일수</th>
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell">증빙필요</th>
                  <th className="text-left px-4 py-3 font-medium">상태</th>
                  <th className="text-right px-4 py-3 font-medium">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {leaveTypes.map((lt) => (
                  <tr key={lt.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{lt.name}</td>
                    <td className="px-4 py-3">
                      <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{lt.code}</code>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={lt.isPaid ? 'default' : 'secondary'}>
                        {lt.isPaid ? '유급' : '무급'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">{lt.isAnnualDeduct ? 'O' : 'X'}</td>
                    <td className="px-4 py-3 hidden sm:table-cell">{lt.maxDays ? `${lt.maxDays}일` : '-'}</td>
                    <td className="px-4 py-3 hidden md:table-cell">{lt.requiresDoc ? 'O' : 'X'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={lt.isActive ? 'default' : 'secondary'}>
                        {lt.isActive ? '활성' : '비활성'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditTypeDialog(lt)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleTypeActive(lt)}
                        >
                          {lt.isActive ? '비활성' : '활성'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {leaveTypes.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                      등록된 휴가유형이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
        <TabsContent value="carryover" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>연차 이월 설정</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">이월 허용</Label>
                  <p className="text-sm text-muted-foreground">미사용 연차를 다음 해로 이월할 수 있습니다.</p>
                </div>
                <Switch
                  checked={carryOverEnabled}
                  onCheckedChange={setCarryOverEnabled}
                />
              </div>

              {carryOverEnabled && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>최대 이월 일수</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.5"
                        value={carryOverMaxDays}
                        onChange={(e) => setCarryOverMaxDays(e.target.value)}
                        placeholder="예: 5"
                      />
                      <p className="text-xs text-muted-foreground">
                        잔여 연차 중 이월 가능한 최대 일수
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>이월 연차 소멸 기한 (개월)</Label>
                      <Input
                        type="number"
                        min="1"
                        max="12"
                        value={carryOverExpiryMonths}
                        onChange={(e) => setCarryOverExpiryMonths(e.target.value)}
                        placeholder="예: 3"
                      />
                      <p className="text-xs text-muted-foreground">
                        이월된 연차가 소멸되는 기한 (다음 해 기준)
                      </p>
                    </div>
                  </div>
                </>
              )}

              <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t">
                <Button
                  onClick={handleSaveCarryOver}
                  disabled={carryOverSaving}
                >
                  {carryOverSaving ? '저장 중...' : '설정 저장'}
                </Button>
                {carryOverEnabled && (
                  <Button
                    variant="outline"
                    onClick={handleProcessCarryOver}
                    disabled={carryOverProcessing}
                  >
                    {carryOverProcessing ? '처리 중...' : `${new Date().getFullYear() - 1}년 이월 실행`}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

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

      {/* Policy Dialog */}
      <Dialog open={policyDialogOpen} onOpenChange={setPolicyDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingPolicy ? '규정 수정' : '규정 추가'}
            </DialogTitle>
            <DialogDescription>연차 부여 규정 정보를 입력하세요.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>규정명</Label>
              <Input
                value={policyForm.name}
                onChange={(e) => setPolicyForm({ ...policyForm, name: e.target.value })}
                placeholder="예: 1년 미만 월별 부여"
              />
            </div>

            <div className="space-y-2">
              <Label>휴가유형</Label>
              <Select
                value={policyForm.leaveTypeId}
                onValueChange={(v) => setPolicyForm({ ...policyForm, leaveTypeId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="휴가유형 선택" />
                </SelectTrigger>
                <SelectContent>
                  {leaveTypes.map((lt) => (
                    <SelectItem key={lt.id} value={lt.id}>
                      {lt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>근속연수 (시작)</Label>
                <Input
                  type="number"
                  min={0}
                  value={policyForm.yearFrom}
                  onChange={(e) =>
                    setPolicyForm({ ...policyForm, yearFrom: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>근속연수 (종료, 비워두면 이상)</Label>
                <Input
                  type="number"
                  min={0}
                  value={policyForm.yearTo}
                  onChange={(e) =>
                    setPolicyForm({
                      ...policyForm,
                      yearTo: e.target.value ? parseInt(e.target.value) : '',
                    })
                  }
                  placeholder="미입력 시 제한없음"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>부여일수</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  value={policyForm.grantDays}
                  onChange={(e) =>
                    setPolicyForm({ ...policyForm, grantDays: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>부여방식</Label>
                <Select
                  value={policyForm.grantType}
                  onValueChange={(v) => setPolicyForm({ ...policyForm, grantType: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MONTHLY">월별 부여</SelectItem>
                    <SelectItem value="YEARLY">연간 부여</SelectItem>
                    <SelectItem value="ONCE">일시 부여</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>설명 (선택)</Label>
              <Textarea
                value={policyForm.description}
                onChange={(e) => setPolicyForm({ ...policyForm, description: e.target.value })}
                placeholder="규정에 대한 추가 설명"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setPolicyDialogOpen(false)}>
              취소
            </Button>
            <Button className="w-full sm:w-auto" onClick={handleSavePolicy} disabled={saving}>
              {saving ? '저장 중...' : '저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leave Type Dialog */}
      <Dialog open={typeDialogOpen} onOpenChange={setTypeDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingType ? '휴가유형 수정' : '휴가유형 추가'}
            </DialogTitle>
            <DialogDescription>휴가유형 정보를 입력하세요.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>유형명</Label>
                <Input
                  value={typeForm.name}
                  onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
                  placeholder="예: 연차"
                />
              </div>
              <div className="space-y-2">
                <Label>코드</Label>
                <Input
                  value={typeForm.code}
                  onChange={(e) => setTypeForm({ ...typeForm, code: e.target.value.toUpperCase() })}
                  placeholder="예: ANNUAL"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>최대일수 (비워두면 제한없음)</Label>
              <Input
                type="number"
                min={0}
                step={0.5}
                value={typeForm.maxDays}
                onChange={(e) =>
                  setTypeForm({
                    ...typeForm,
                    maxDays: e.target.value ? parseFloat(e.target.value) : '',
                  })
                }
                placeholder="미입력 시 제한없음"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="isPaid"
                  checked={typeForm.isPaid}
                  onCheckedChange={(checked) =>
                    setTypeForm({ ...typeForm, isPaid: checked === true })
                  }
                />
                <Label htmlFor="isPaid">유급 휴가</Label>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="isAnnualDeduct"
                  checked={typeForm.isAnnualDeduct}
                  onCheckedChange={(checked) =>
                    setTypeForm({ ...typeForm, isAnnualDeduct: checked === true })
                  }
                />
                <Label htmlFor="isAnnualDeduct">연차에서 차감</Label>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="requiresDoc"
                  checked={typeForm.requiresDoc}
                  onCheckedChange={(checked) =>
                    setTypeForm({ ...typeForm, requiresDoc: checked === true })
                  }
                />
                <Label htmlFor="requiresDoc">증빙서류 필요</Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label>정렬순서</Label>
              <Input
                type="number"
                min={0}
                value={typeForm.sortOrder}
                onChange={(e) =>
                  setTypeForm({ ...typeForm, sortOrder: parseInt(e.target.value) || 0 })
                }
              />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setTypeDialogOpen(false)}>
              취소
            </Button>
            <Button className="w-full sm:w-auto" onClick={handleSaveType} disabled={saving}>
              {saving ? '저장 중...' : '저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
