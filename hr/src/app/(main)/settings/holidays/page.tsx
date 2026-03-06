'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toISOString().split('T')[0];
}

function getDayOfWeek(dateStr: string) {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return days[new Date(dateStr).getDay()];
}

export default function HolidaysPage() {
  const router = useRouter();
  const [userRole, setUserRole] = useState('');
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));

  // Form
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [formName, setFormName] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formIsRecurring, setFormIsRecurring] = useState(false);
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

  const openCreateDialog = () => {
    setEditingHoliday(null);
    setFormName('');
    setFormDate('');
    setFormIsRecurring(false);
    setDialogOpen(true);
  };

  const openEditDialog = (holiday: Holiday) => {
    setEditingHoliday(holiday);
    setFormName(holiday.name);
    setFormDate(formatDate(holiday.date));
    setFormIsRecurring(holiday.isRecurring);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formDate) {
      toast.error('이름과 날짜를 입력해주세요.');
      return;
    }

    setSaving(true);
    try {
      if (editingHoliday) {
        const res = await fetch(`/api/holidays/${editingHoliday.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: formName, date: formDate, isRecurring: formIsRecurring }),
        });
        if (res.ok) {
          toast.success('공휴일이 수정되었습니다.');
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
          body: JSON.stringify({ name: formName, date: formDate, isRecurring: formIsRecurring }),
        });
        if (res.ok) {
          toast.success('공휴일이 추가되었습니다.');
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
      title: '공휴일 삭제',
      description: '이 공휴일을 삭제하시겠습니까?',
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
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">공휴일 관리</h1>
            <p className="text-sm text-gray-500 mt-0.5">법정공휴일 및 회사 지정 휴일을 관리합니다.</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleSeedHolidays} disabled={seeding}>
            {seeding ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            법정공휴일 자동생성
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="w-4 h-4 mr-2" />
            공휴일 추가
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle>{selectedYear}년 공휴일 목록</CardTitle>
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
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              불러오는 중...
            </div>
          ) : holidays.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 mb-4">{selectedYear}년에 등록된 공휴일이 없습니다.</p>
              <Button variant="outline" onClick={handleSeedHolidays}>
                법정공휴일 자동생성
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[500px]">
                <thead>
                  <tr className="border-b bg-gray-50 text-left">
                    <th className="py-3 px-3 font-medium text-gray-600">날짜</th>
                    <th className="py-3 px-3 font-medium text-gray-600">요일</th>
                    <th className="py-3 px-3 font-medium text-gray-600">공휴일명</th>
                    <th className="py-3 px-3 font-medium text-gray-600 hidden sm:table-cell">매년반복</th>
                    <th className="py-3 px-3 font-medium text-gray-600 text-right">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {holidays.map((h) => (
                    <tr key={h.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-3 px-3">{formatDate(h.date)}</td>
                      <td className="py-3 px-3">{getDayOfWeek(h.date)}</td>
                      <td className="py-3 px-3 font-medium">{h.name}</td>
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
            <Button variant="destructive" onClick={() => { confirmDialog.action(); setConfirmDialog(prev => ({...prev, open: false})); }}>확인</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{editingHoliday ? '공휴일 수정' : '공휴일 추가'}</DialogTitle>
            <DialogDescription>공휴일 정보를 입력하세요.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>공휴일명</Label>
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
