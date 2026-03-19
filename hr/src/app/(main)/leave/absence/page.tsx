'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Clock, Plus, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const TYPES = [
  { value: 'PARENTAL', label: '육아휴직' },
  { value: 'MEDICAL', label: '병가휴직' },
  { value: 'PERSONAL', label: '개인사유 휴직' },
  { value: 'MILITARY', label: '군복무' },
  { value: 'STUDY', label: '학업휴직' },
  { value: 'OTHER', label: '기타' },
] as const;

const TYPE_MAP = Object.fromEntries(TYPES.map(t => [t.value, t.label]));

const STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: '대기중', cls: 'bg-yellow-100 text-yellow-800' },
  APPROVED: { label: '승인', cls: 'bg-green-100 text-green-800' },
  REJECTED: { label: '반려', cls: 'bg-red-100 text-red-800' },
};

interface AbsenceReq {
  id: string;
  absenceType: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: string;
  adminComment: string | null;
  createdAt: string;
}

const fmtDate = (s: string) => s?.split('T')[0] ?? '-';

export default function MyAbsencePage() {
  const [items, setItems] = useState<AbsenceReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [dlg, setDlg] = useState(false);
  const [sub, setSub] = useState(false);
  const [confirmDlg, setConfirmDlg] = useState<{ open: boolean; id: string }>({ open: false, id: '' });

  // form
  const [fType, setFType] = useState('');
  const [fStart, setFStart] = useState('');
  const [fEnd, setFEnd] = useState('');
  const [fReason, setFReason] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/absence/my');
      if (r.status === 401) { window.location.href = '/login'; return; }
      if (r.ok) setItems((await r.json()).data ?? []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const resetForm = () => { setFType(''); setFStart(''); setFEnd(''); setFReason(''); };

  const handleSubmit = async () => {
    if (!fType || !fStart || !fEnd) return;
    setSub(true);
    try {
      const r = await fetch('/api/absence/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ absenceType: fType, startDate: fStart, endDate: fEnd, reason: fReason }),
      });
      if (r.ok) {
        toast.success('휴직 신청이 완료되었습니다.');
        setDlg(false); resetForm(); fetchData();
      } else {
        const e = await r.json();
        toast.error(e.message || '신청에 실패했습니다.');
      }
    } catch { toast.error('서버에 연결할 수 없습니다.'); } finally { setSub(false); }
  };

  const handleCancel = async () => {
    if (!confirmDlg.id) return;
    try {
      const r = await fetch(`/api/absence/request/${confirmDlg.id}`, { method: 'DELETE' });
      if (r.ok) { toast.success('취소되었습니다.'); fetchData(); }
      else { const e = await r.json(); toast.error(e.message || '취소 실패'); }
    } catch { toast.error('서버에 연결할 수 없습니다.'); }
    setConfirmDlg({ open: false, id: '' });
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Clock className="w-7 h-7 text-blue-600" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">나의 휴직</h1>
            <p className="text-sm text-gray-500 mt-0.5">휴직 신청 및 현황을 확인합니다.</p>
          </div>
        </div>
        <Button className="w-full sm:w-auto" onClick={() => setDlg(true)}>
          <Plus className="w-4 h-4 mr-2" />휴직 신청
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>휴직 신청 내역</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />불러오는 중...
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 mb-4">휴직 신청 내역이 없습니다.</p>
              <Button onClick={() => setDlg(true)}><Plus className="w-4 h-4 mr-2" />휴직 신청하기</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="border-b text-left bg-gray-50">
                    <th className="py-3 px-2 font-medium">신청일</th>
                    <th className="py-3 px-2 font-medium">유형</th>
                    <th className="py-3 px-2 font-medium">기간</th>
                    <th className="py-3 px-2 font-medium">상태</th>
                    <th className="py-3 px-2 font-medium hidden sm:table-cell">사유</th>
                    <th className="py-3 px-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => {
                    const st = STATUS[item.status] ?? { label: item.status, cls: 'bg-gray-100 text-gray-800' };
                    return (
                      <tr key={item.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-3 px-2">{fmtDate(item.createdAt)}</td>
                        <td className="py-3 px-2">{TYPE_MAP[item.absenceType] ?? item.absenceType}</td>
                        <td className="py-3 px-2">
                          {fmtDate(item.startDate)}
                          {fmtDate(item.startDate) !== fmtDate(item.endDate) && ` ~ ${fmtDate(item.endDate)}`}
                        </td>
                        <td className="py-3 px-2">
                          <Badge variant="outline" className={st.cls}>{st.label}</Badge>
                        </td>
                        <td className="py-3 px-2 max-w-[200px] truncate hidden sm:table-cell">
                          {item.status === 'REJECTED' && item.adminComment
                            ? <span className="text-red-600">반려: {item.adminComment}</span>
                            : (item.reason || '-')}
                        </td>
                        <td className="py-3 px-2">
                          {item.status === 'PENDING' && (
                            <Button variant="ghost" size="sm" onClick={() => setConfirmDlg({ open: true, id: item.id })}>
                              <X className="w-4 h-4" /><span className="hidden sm:inline ml-1">취소</span>
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Request Dialog */}
      <Dialog open={dlg} onOpenChange={setDlg}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>휴직 신청</DialogTitle>
            <DialogDescription>휴직 정보를 입력하세요.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>휴직 유형</Label>
              <Select value={fType} onValueChange={setFType}>
                <SelectTrigger className="w-full mt-1"><SelectValue placeholder="유형 선택" /></SelectTrigger>
                <SelectContent>
                  {TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>시작일</Label>
                <Input type="date" value={fStart} onChange={e => { setFStart(e.target.value); if (!fEnd || e.target.value > fEnd) setFEnd(e.target.value); }} className="mt-1" />
              </div>
              <div>
                <Label>종료일</Label>
                <Input type="date" value={fEnd} onChange={e => setFEnd(e.target.value)} min={fStart} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>사유 (선택)</Label>
              <Textarea value={fReason} onChange={e => setFReason(e.target.value)} placeholder="휴직 사유를 입력하세요" className="mt-1" />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setDlg(false)}>취소</Button>
            <Button className="w-full sm:w-auto" onClick={handleSubmit} disabled={sub || !fType || !fStart || !fEnd}>
              {sub ? '신청 중...' : '신청'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Cancel Dialog */}
      <Dialog open={confirmDlg.open} onOpenChange={v => setConfirmDlg(p => ({ ...p, open: v }))}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>휴직 취소</DialogTitle>
            <DialogDescription>휴직 신청을 취소하시겠습니까?</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setConfirmDlg({ open: false, id: '' })}>취소</Button>
            <Button variant="destructive" onClick={handleCancel}>확인</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
