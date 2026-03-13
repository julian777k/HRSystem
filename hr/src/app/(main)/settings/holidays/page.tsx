'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Calendar, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const ADMIN_ROLES = ['SYSTEM_ADMIN', 'COMPANY_ADMIN'];

interface Holiday {
  id: string;
  name: string;
  date: string;
  isRecurring: boolean;
  type: string;
  targetId: string | null;
}

interface Department {
  id: string;
  name: string;
  code: string;
}

const TYPE_LABELS: Record<string, string> = {
  PUBLIC: '공휴일',
  COMPANY: '회사휴무',
  DEPARTMENT: '부서휴무',
};

const TYPE_BADGE_STYLES: Record<string, string> = {
  PUBLIC: 'bg-blue-100 text-blue-700 border-blue-200',
  COMPANY: 'bg-green-100 text-green-700 border-green-200',
  DEPARTMENT: 'bg-orange-100 text-orange-700 border-orange-200',
};

function formatDate(dateStr: string) {
  return dateStr.split('T')[0];
}

function getDayOfWeek(dateStr: string) {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return days[new Date(dateStr.split('T')[0] + 'T00:00:00').getDay()];
}

export default function HolidaysPage() {
  const router = useRouter();
  const [userRole, setUserRole] = useState('');
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [filterType, setFilterType] = useState<string>('ALL');

  // Departments
  const [departments, setDepartments] = useState<Department[]>([]);

  // Form
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [formName, setFormName] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formIsRecurring, setFormIsRecurring] = useState(false);
  const [formType, setFormType] = useState<string>('PUBLIC');
  const [formTargetId, setFormTargetId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
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

  // Fetch departments on mount
  useEffect(() => {
    fetch('/api/departments')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.allDepartments) {
          setDepartments(data.allDepartments);
        }
      })
      .catch(() => {});
  }, []);

  const fetchHolidays = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/holidays?year=${selectedYear}`);
      if (res.ok) {
        const data = await res.json();
        setHolidays(data.holidays);
      }
    } catch {
      toast.error('공휴일을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    if (roleLoaded && ADMIN_ROLES.includes(userRole)) {
      fetchHolidays();
    }
  }, [fetchHolidays, roleLoaded, userRole]);

  const getDepartmentName = (targetId: string | null) => {
    if (!targetId) return '';
    const dept = departments.find((d) => d.id === targetId);
    return dept ? dept.name : '';
  };

  const filteredHolidays = filterType === 'ALL'
    ? holidays
    : holidays.filter((h) => h.type === filterType);

  const openCreateDialog = () => {
    setEditingHoliday(null);
    setFormName('');
    setFormDate('');
    setFormIsRecurring(false);
    setFormType('PUBLIC');
    setFormTargetId('');
    setDialogOpen(true);
  };

  const openEditDialog = (holiday: Holiday) => {
    setEditingHoliday(holiday);
    setFormName(holiday.name);
    setFormDate(formatDate(holiday.date));
    setFormIsRecurring(holiday.isRecurring);
    setFormType(holiday.type || 'PUBLIC');
    setFormTargetId(holiday.targetId || '');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formDate) {
      toast.error('이름과 날짜를 입력해주세요.');
      return;
    }

    if (formType === 'DEPARTMENT' && !formTargetId) {
      toast.error('부서를 선택해주세요.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formName,
        date: formDate,
        isRecurring: formIsRecurring,
        type: formType,
        targetId: formType === 'DEPARTMENT' ? formTargetId : null,
      };

      if (editingHoliday) {
        const res = await fetch(`/api/holidays/${editingHoliday.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          toast.success('휴무일이 수정되었습니다.');
          setDialogOpen(false);
          fetchHolidays();
        } else {
          const data = await res.json();
          toast.error(data.message || '수정에 실패했습니다.');
        }
      } else {
        const res = await fetch('/api/holidays', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          toast.success('휴무일이 추가되었습니다.');
          setDialogOpen(false);
          fetchHolidays();
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

  const handleDelete = (id: string) => {
    setConfirmDialog({
      open: true,
      title: '휴무일 삭제',
      description: '이 휴무일을 삭제하시겠습니까?',
      action: async () => {
        try {
          const res = await fetch(`/api/holidays/${id}`, { method: 'DELETE' });
          if (res.ok) {
            toast.success('삭제되었습니다.');
            fetchHolidays();
          } else {
            toast.error('삭제에 실패했습니다.');
          }
        } catch {
          toast.error('삭제 중 오류가 발생했습니다.');
        }
      },
    });
  };

  const handleSeedHolidays = () => {
    setConfirmDialog({
      open: true,
      title: '공휴일 자동생성',
      description: `${selectedYear}년 법정공휴일을 자동 생성하시겠습니까?`,
      action: async () => {
        setSeeding(true);
        try {
          const res = await fetch('/api/holidays/seed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ year: parseInt(selectedYear) }),
          });
          if (res.ok) {
            const data = await res.json();
            toast.success(`${data.created}건 생성, ${data.skipped}건 스킵`);
            fetchHolidays();
          } else {
            const data = await res.json();
            toast.error(data.message || '자동생성에 실패했습니다.');
          }
        } catch {
          toast.error('자동생성 중 오류가 발생했습니다.');
        } finally {
          setSeeding(false);
        }
      },
    });
  };

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => String(currentYear - 1 + i));

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
          <Calendar className="w-7 h-7 text-amber-600" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">공휴일 및 휴무일 관리</h1>
            <p className="text-sm text-gray-500 mt-0.5">법정공휴일, 회사 지정 휴일, 부서별 휴무일을 관리합니다.</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleSeedHolidays} disabled={seeding}>
            {seeding ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            법정공휴일 자동생성
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="w-4 h-4 mr-2" />
            휴무일 추가
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle>{selectedYear}년 휴무일 목록</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">전체</SelectItem>
                  <SelectItem value="PUBLIC">공휴일</SelectItem>
                  <SelectItem value="COMPANY">회사휴무</SelectItem>
                  <SelectItem value="DEPARTMENT">부서휴무</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={y}>
                      {y}년
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              불러오는 중...
            </div>
          ) : filteredHolidays.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 mb-4">
                {filterType === 'ALL'
                  ? `${selectedYear}년에 등록된 휴무일이 없습니다.`
                  : `${selectedYear}년에 등록된 ${TYPE_LABELS[filterType] || ''}이(가) 없습니다.`}
              </p>
              {filterType === 'ALL' && (
                <Button variant="outline" onClick={handleSeedHolidays}>
                  법정공휴일 자동생성
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="border-b bg-gray-50 text-left">
                    <th className="py-3 px-3 font-medium text-gray-600">날짜</th>
                    <th className="py-3 px-3 font-medium text-gray-600">요일</th>
                    <th className="py-3 px-3 font-medium text-gray-600">휴무일명</th>
                    <th className="py-3 px-3 font-medium text-gray-600">유형</th>
                    <th className="py-3 px-3 font-medium text-gray-600 hidden sm:table-cell">매년반복</th>
                    <th className="py-3 px-3 font-medium text-gray-600 text-right">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHolidays.map((h) => (
                    <tr key={h.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-3 px-3">{formatDate(h.date)}</td>
                      <td className="py-3 px-3">{getDayOfWeek(h.date)}</td>
                      <td className="py-3 px-3 font-medium">{h.name}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <Badge
                            variant="outline"
                            className={TYPE_BADGE_STYLES[h.type] || TYPE_BADGE_STYLES.PUBLIC}
                          >
                            {TYPE_LABELS[h.type] || '공휴일'}
                          </Badge>
                          {h.type === 'DEPARTMENT' && h.targetId && (
                            <span className="text-xs text-gray-500">
                              {getDepartmentName(h.targetId)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 hidden sm:table-cell">
                        {h.isRecurring ? 'O' : 'X'}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(h)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(h.id)}
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
            <DialogTitle>{editingHoliday ? '휴무일 수정' : '휴무일 추가'}</DialogTitle>
            <DialogDescription>휴무일 정보를 입력하세요.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>유형</Label>
              <Select value={formType} onValueChange={(value) => {
                setFormType(value);
                if (value !== 'DEPARTMENT') {
                  setFormTargetId('');
                }
              }}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PUBLIC">공휴일</SelectItem>
                  <SelectItem value="COMPANY">회사휴무</SelectItem>
                  <SelectItem value="DEPARTMENT">부서휴무</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formType === 'DEPARTMENT' && (
              <div>
                <Label>부서</Label>
                <Select value={formTargetId} onValueChange={setFormTargetId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="부서를 선택하세요" />
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
            )}
            <div>
              <Label>휴무일명</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="예: 설날"
                className="mt-1"
              />
            </div>
            <div>
              <Label>날짜</Label>
              <Input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="isRecurring"
                checked={formIsRecurring}
                onCheckedChange={(checked) => setFormIsRecurring(checked === true)}
              />
              <Label htmlFor="isRecurring">매년 반복</Label>
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
