'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ClipboardList, Check, X, Loader2, MoreVertical, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface WelfareRequest {
  id: string;
  status: string;
  amount: number | null;
  note: string | null;
  createdAt: string;
  item: {
    name: string;
    unit: string;
    category: { name: string };
  };
  employee?: {
    id: string;
    name: string;
    employeeNumber: string;
    department?: { name: string };
    position?: { name: string };
  };
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  PENDING: { label: '대기', className: 'bg-yellow-100 text-yellow-800' },
  APPROVED: { label: '승인', className: 'bg-green-100 text-green-800' },
  REJECTED: { label: '반려', className: 'bg-red-100 text-red-800' },
  CANCELLED: { label: '취소', className: 'bg-gray-100 text-gray-800' },
};

export default function WelfareRequestPage() {
  const [requests, setRequests] = useState<WelfareRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState('');

  // Admin approval tab state
  const [activeTab, setActiveTab] = useState('my');
  const [adminRequests, setAdminRequests] = useState<WelfareRequest[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminStatusFilter, setAdminStatusFilter] = useState('all');
  const [adminEmployeeFilter, setAdminEmployeeFilter] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{open: boolean; title: string; description: string; action: () => void}>({open: false, title: '', description: '', action: () => {}});

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState('');

  const isAdmin = ['SYSTEM_ADMIN', 'COMPANY_ADMIN'].includes(userRole);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/welfare/requests');
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests);
      }
    } catch {
      toast.error('신청 내역을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAdminRequests = useCallback(async () => {
    setAdminLoading(true);
    try {
      const params = new URLSearchParams();
      if (adminStatusFilter && adminStatusFilter !== 'all') {
        params.set('status', adminStatusFilter);
      }
      const res = await fetch(`/api/welfare/requests?${params}`);
      if (res.ok) {
        const data = await res.json();
        setAdminRequests(data.requests);
      }
    } catch {
      toast.error('신청 목록을 불러오지 못했습니다.');
    } finally {
      setAdminLoading(false);
    }
  }, [adminStatusFilter]);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.user?.role) setUserRole(d.user.role); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    if (isAdmin && activeTab === 'admin') {
      fetchAdminRequests();
    }
  }, [isAdmin, activeTab, fetchAdminRequests]);

  const filteredAdminRequests = adminEmployeeFilter
    ? adminRequests.filter(r => r.employee?.name?.includes(adminEmployeeFilter))
    : adminRequests;

  const handleCancel = (id: string) => {
    setConfirmDialog({
      open: true,
      title: '신청 취소',
      description: '이 신청을 취소하시겠습니까?',
      action: async () => {
        setCancellingId(id);
        try {
          const res = await fetch(`/api/welfare/requests/${id}`, { method: 'DELETE' });
          if (res.ok) {
            toast.success('신청이 취소되었습니다.');
            fetchRequests();
          } else {
            const data = await res.json();
            toast.error(data.message || '취소에 실패했습니다.');
          }
        } catch {
          toast.error('취소 중 오류가 발생했습니다.');
        } finally {
          setCancellingId(null);
        }
      },
    });
  };

  const handleApproval = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    setProcessingId(id);
    try {
      const res = await fetch(`/api/welfare/requests/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        toast.success(status === 'APPROVED' ? '복지 신청이 승인되었습니다.' : '복지 신청이 반려되었습니다.');
        fetchAdminRequests();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.message || '처리에 실패했습니다.');
      }
    } catch {
      toast.error('서버에 연결할 수 없습니다.');
    } finally {
      setProcessingId(null);
    }
  };

  const openDeleteDialog = (id: string) => {
    setDeleteTargetId(id);
    setDeleteDialogOpen(true);
  };

  const handleAdminDelete = async () => {
    if (!deleteTargetId) return;
    try {
      const res = await fetch(`/api/welfare/requests/${deleteTargetId}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('삭제되었습니다.');
        setDeleteDialogOpen(false);
        if (activeTab === 'admin') fetchAdminRequests();
        else fetchRequests();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.message || '삭제에 실패했습니다.');
      }
    } catch {
      toast.error('서버에 연결할 수 없습니다.');
    }
  };

  const renderRequestTable = (
    data: WelfareRequest[],
    showEmployee: boolean,
    renderActions: (req: WelfareRequest) => React.ReactNode,
  ) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[600px]">
        <thead>
          <tr className="border-b text-left">
            <th className="pb-3 font-medium">날짜</th>
            {showEmployee && <th className="pb-3 font-medium">신청자</th>}
            {showEmployee && <th className="pb-3 font-medium hidden sm:table-cell">부서</th>}
            <th className="pb-3 font-medium">카테고리</th>
            <th className="pb-3 font-medium">항목</th>
            <th className="pb-3 font-medium">금액</th>
            <th className="pb-3 font-medium">상태</th>
            <th className="pb-3 font-medium hidden sm:table-cell">메모</th>
            <th className="pb-3 font-medium text-right">관리</th>
          </tr>
        </thead>
        <tbody>
          {data.map((req) => {
            const badge = STATUS_BADGE[req.status] || STATUS_BADGE.PENDING;
            return (
              <tr key={req.id} className="border-b last:border-0">
                <td className="py-3">{new Date(req.createdAt).toLocaleDateString('ko-KR')}</td>
                {showEmployee && <td className="py-3 font-medium">{req.employee?.name || '-'}</td>}
                {showEmployee && <td className="py-3 hidden sm:table-cell">{req.employee?.department?.name || '-'}</td>}
                <td className="py-3">{req.item.category.name}</td>
                <td className="py-3 font-medium">{req.item.name}</td>
                <td className="py-3">
                  {req.amount != null
                    ? `${req.amount.toLocaleString()}${req.item.unit}`
                    : '-'}
                </td>
                <td className="py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${badge.className}`}>
                    {badge.label}
                  </span>
                </td>
                <td className="py-3 hidden sm:table-cell text-gray-500 max-w-[200px] truncate">
                  {req.note || '-'}
                </td>
                <td className="py-3 text-right">
                  {renderActions(req)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  // Non-admin: render without tabs (same as before)
  if (!isAdmin) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <ClipboardList className="w-7 h-7 text-pink-600" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">나의 복지 신청내역</h1>
            <p className="text-sm text-gray-500 mt-1">나의 복지 신청 현황을 확인합니다.</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>신청 목록</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8 text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                불러오는 중...
              </div>
            ) : requests.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400">신청 내역이 없습니다.</p>
              </div>
            ) : (
              renderRequestTable(requests, false, (req) =>
                req.status === 'PENDING' ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCancel(req.id)}
                    disabled={cancellingId === req.id}
                  >
                    {cancellingId === req.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      '취소'
                    )}
                  </Button>
                ) : null
              )
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Admin: render with tabs
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <ClipboardList className="w-7 h-7 text-pink-600" />
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">복지 신청내역</h1>
          <p className="text-sm text-gray-500 mt-1">복지 신청 현황을 확인하고 관리합니다.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="my">내 신청</TabsTrigger>
          <TabsTrigger value="admin">승인 관리</TabsTrigger>
        </TabsList>

        {/* My Requests Tab */}
        <TabsContent value="my">
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>내 신청 목록</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8 text-gray-400">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  불러오는 중...
                </div>
              ) : requests.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-400">신청 내역이 없습니다.</p>
                </div>
              ) : (
                renderRequestTable(requests, false, (req) =>
                  req.status === 'PENDING' ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCancel(req.id)}
                      disabled={cancellingId === req.id}
                    >
                      {cancellingId === req.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        '취소'
                      )}
                    </Button>
                  ) : null
                )
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Admin Approval Tab */}
        <TabsContent value="admin">
          <Card className="mt-4">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <CardTitle>전체 복지 신청 목록</CardTitle>
                <div className="flex flex-wrap gap-3">
                  <Input
                    placeholder="직원명 검색..."
                    value={adminEmployeeFilter}
                    onChange={(e) => setAdminEmployeeFilter(e.target.value)}
                    className="w-full sm:w-[160px]"
                  />
                  <Select value={adminStatusFilter} onValueChange={setAdminStatusFilter}>
                    <SelectTrigger className="w-full sm:w-[120px]">
                      <SelectValue placeholder="상태" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체</SelectItem>
                      <SelectItem value="PENDING">대기</SelectItem>
                      <SelectItem value="APPROVED">승인</SelectItem>
                      <SelectItem value="REJECTED">반려</SelectItem>
                      <SelectItem value="CANCELLED">취소</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {adminLoading ? (
                <div className="flex items-center justify-center py-8 text-gray-400">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  불러오는 중...
                </div>
              ) : filteredAdminRequests.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-400">신청 내역이 없습니다.</p>
                </div>
              ) : (
                renderRequestTable(filteredAdminRequests, true, (req) =>
                  req.status === 'PENDING' ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => handleApproval(req.id, 'APPROVED')}
                          disabled={processingId === req.id}
                        >
                          <Check className="w-4 h-4 mr-2 text-green-600" />
                          승인
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleApproval(req.id, 'REJECTED')}
                          disabled={processingId === req.id}
                        >
                          <X className="w-4 h-4 mr-2 text-red-600" />
                          반려
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => openDeleteDialog(req.id)} className="text-red-600">
                          <Trash2 className="w-4 h-4 mr-2" />
                          삭제
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-400 hover:text-red-500" onClick={() => openDeleteDialog(req.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )
                )
              )}
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
            <Button variant="destructive" onClick={async () => { await confirmDialog.action(); setConfirmDialog(prev => ({...prev, open: false})); }}>확인</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>기록 삭제</DialogTitle>
            <DialogDescription>이 복지 신청 기록을 삭제하시겠습니까? 삭제된 데이터는 복구할 수 없습니다.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setDeleteDialogOpen(false)}>
              취소
            </Button>
            <Button
              variant="destructive"
              className="w-full sm:w-auto"
              onClick={handleAdminDelete}
            >
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
