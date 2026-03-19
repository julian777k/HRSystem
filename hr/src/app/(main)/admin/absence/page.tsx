'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { FileText, Check, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const ADMIN_ROLES = ['SYSTEM_ADMIN', 'COMPANY_ADMIN'];

const TYPE_MAP: Record<string, string> = {
  PARENTAL: '육아휴직', MEDICAL: '병가휴직', PERSONAL: '개인사유',
  MILITARY: '군복무', STUDY: '학업휴직', OTHER: '기타',
};

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
  employeeName: string;
  departmentName: string;
}

const fmtDate = (s: string) => s?.split('T')[0] ?? '-';

export default function AdminAbsencePage() {
  const router = useRouter();
  const [role, setRole] = useState('');
  const [roleOk, setRoleOk] = useState(false);
  const [items, setItems] = useState<AbsenceReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  // approval dialog
  const [dlg, setDlg] = useState(false);
  const [action, setAction] = useState<'approve' | 'reject'>('approve');
  const [targetId, setTargetId] = useState('');
  const [comment, setComment] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me').then(r => { if (r.status === 401) { window.location.href = '/login'; return null; } return r.ok ? r.json() : null; }).then(d => {
      if (d?.user?.role) {
        setRole(d.user.role);
        if (!ADMIN_ROLES.includes(d.user.role)) { router.replace('/dashboard'); return; }
      }
      setRoleOk(true);
    }).catch(() => setRoleOk(true));
  }, [router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = filter !== 'all' ? `?status=${filter}` : '';
      const r = await fetch(`/api/absence/request${params}`);
      if (r.ok) setItems((await r.json()).data ?? []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [filter]);

  useEffect(() => {
    if (roleOk && ADMIN_ROLES.includes(role)) fetchData();
  }, [fetchData, roleOk, role]);

  const openDlg = (id: string, act: 'approve' | 'reject') => {
    setTargetId(id); setAction(act); setComment(''); setDlg(true);
  };

  const handleAction = async () => {
    if (!targetId) return;
    setProcessing(true);
    try {
      const r = await fetch(`/api/absence/request/${targetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: action === 'approve' ? 'APPROVED' : 'REJECTED', adminComment: comment }),
      });
      if (r.ok) {
        toast.success(action === 'approve' ? '승인되었습니다.' : '반려되었습니다.');
        setDlg(false); fetchData();
      } else {
        const e = await r.json();
        toast.error(e.message || '처리에 실패했습니다.');
      }
    } catch { toast.error('서버에 연결할 수 없습니다.'); } finally { setProcessing(false); }
  };

  const filtered = items;

  if (!roleOk) return (
    <div className="flex items-center justify-center py-12 text-gray-400">
      <Loader2 className="w-5 h-5 animate-spin mr-2" />불러오는 중...
    </div>
  );

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <FileText className="w-7 h-7 text-blue-600" />
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">휴직 관리</h1>
          <p className="text-sm text-gray-500 mt-0.5">직원들의 휴직 신청을 관리합니다.</p>
        </div>
      </div>

      <div className="mb-4">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-full sm:w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="PENDING">대기중</SelectItem>
            <SelectItem value="APPROVED">승인</SelectItem>
            <SelectItem value="REJECTED">반려</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader><CardTitle>휴직 신청 목록</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />불러오는 중...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400">휴직 신청 내역이 없습니다.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="border-b text-left bg-gray-50">
                    <th className="py-3 px-2 font-medium">신청일</th>
                    <th className="py-3 px-2 font-medium">직원</th>
                    <th className="py-3 px-2 font-medium hidden sm:table-cell">부서</th>
                    <th className="py-3 px-2 font-medium">유형</th>
                    <th className="py-3 px-2 font-medium">기간</th>
                    <th className="py-3 px-2 font-medium">상태</th>
                    <th className="py-3 px-2 font-medium hidden sm:table-cell">사유</th>
                    <th className="py-3 px-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(item => {
                    const st = STATUS[item.status] ?? { label: item.status, cls: 'bg-gray-100 text-gray-800' };
                    return (
                      <tr key={item.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-3 px-2">{fmtDate(item.createdAt)}</td>
                        <td className="py-3 px-2 font-medium">{item.employeeName}</td>
                        <td className="py-3 px-2 hidden sm:table-cell">{item.departmentName}</td>
                        <td className="py-3 px-2">{TYPE_MAP[item.absenceType] ?? item.absenceType}</td>
                        <td className="py-3 px-2">
                          {fmtDate(item.startDate)}
                          {fmtDate(item.startDate) !== fmtDate(item.endDate) && ` ~ ${fmtDate(item.endDate)}`}
                        </td>
                        <td className="py-3 px-2">
                          <Badge variant="outline" className={st.cls}>{st.label}</Badge>
                        </td>
                        <td className="py-3 px-2 max-w-[180px] truncate hidden sm:table-cell">{item.reason || '-'}</td>
                        <td className="py-3 px-2">
                          {item.status === 'PENDING' && (
                            <div className="flex gap-1">
                              <Button size="sm" onClick={() => openDlg(item.id, 'approve')}>
                                <Check className="w-4 h-4 mr-1" />승인
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => openDlg(item.id, 'reject')}>
                                <X className="w-4 h-4 mr-1" />반려
                              </Button>
                            </div>
                          )}
                          {item.status === 'REJECTED' && item.adminComment && (
                            <span className="text-xs text-red-500 truncate block max-w-[120px]" title={item.adminComment}>
                              {item.adminComment}
                            </span>
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

      {/* Approval/Reject Dialog */}
      <Dialog open={dlg} onOpenChange={setDlg}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{action === 'approve' ? '휴직 승인' : '휴직 반려'}</DialogTitle>
            <DialogDescription>
              {action === 'approve' ? '이 휴직 신청을 승인합니다.' : '반려 사유를 입력해주세요.'}
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>{action === 'approve' ? '코멘트 (선택)' : '반려 사유'}</Label>
            <Textarea value={comment} onChange={e => setComment(e.target.value)}
              placeholder={action === 'approve' ? '코멘트 입력' : '반려 사유를 입력하세요'} className="mt-1" />
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setDlg(false)}>취소</Button>
            <Button variant={action === 'approve' ? 'default' : 'destructive'} className="w-full sm:w-auto"
              onClick={handleAction} disabled={processing}>
              {processing ? '처리 중...' : action === 'approve' ? '승인' : '반려'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
