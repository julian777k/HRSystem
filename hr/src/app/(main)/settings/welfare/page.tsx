'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Settings,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronUp,
  GripVertical,
  X,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

const ADMIN_ROLES = ['SYSTEM_ADMIN', 'COMPANY_ADMIN'];

interface FormFieldDef {
  id: string;
  type: 'text' | 'number' | 'textarea' | 'select' | 'date' | 'calendar' | 'section';
  label: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
  description?: string;
  children?: FormFieldDef[];
  rangeSelect?: boolean; // calendar: 시작일~종료일 범위 선택
}

interface WelfareItem {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  benefitType: string;
  amount: number | null;
  unit: string;
  maxPerYear: number | null;
  isActive: boolean;
  formFields: FormFieldDef[] | null;
  showAmount?: boolean;
  requireApproval?: boolean;
}

interface WelfareCategory {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  items: WelfareItem[];
}

const BENEFIT_TYPES = [
  { value: 'MONEY', label: '금액지원' },
  { value: 'LEAVE', label: '휴가' },
  { value: 'VOUCHER', label: '바우처' },
  { value: 'OTHER', label: '기타' },
];

const EMOJI_PRESETS = [
  { emoji: '🏥', label: '건강' },
  { emoji: '📚', label: '교육' },
  { emoji: '🏠', label: '주거' },
  { emoji: '🍽️', label: '식사' },
  { emoji: '🚗', label: '교통' },
  { emoji: '👶', label: '육아' },
  { emoji: '🎉', label: '경조' },
  { emoji: '💪', label: '체육' },
  { emoji: '✈️', label: '여행' },
  { emoji: '💰', label: '금융' },
  { emoji: '🎓', label: '학비' },
  { emoji: '📦', label: '기타' },
];

export default function WelfareSettingsPage() {
  const router = useRouter();
  const [userRole, setUserRole] = useState('');
  const [roleLoaded, setRoleLoaded] = useState(false);

  // Categories & Items
  const [categories, setCategories] = useState<WelfareCategory[]>([]);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [loadingCategories, setLoadingCategories] = useState(true);

  // Category dialog
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<WelfareCategory | null>(null);
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catIcon, setCatIcon] = useState('');
  const [catSortOrder, setCatSortOrder] = useState('0');
  const [savingCat, setSavingCat] = useState(false);

  // Item dialog
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WelfareItem | null>(null);
  const [itemCategoryId, setItemCategoryId] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemDesc, setItemDesc] = useState('');
  const [itemBenefitType, setItemBenefitType] = useState('MONEY');
  const [itemAmount, setItemAmount] = useState('');
  const [itemUnit, setItemUnit] = useState('원');
  const [itemMaxPerYear, setItemMaxPerYear] = useState('');
  const [itemFormFields, setItemFormFields] = useState<FormFieldDef[]>([]);
  const [savingItem, setSavingItem] = useState(false);
  // 선택적 옵션 토글
  const [showAmountField, setShowAmountField] = useState(false);
  const [showMaxPerYear, setShowMaxPerYear] = useState(false);
  const [itemRequireApproval, setItemRequireApproval] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState<{open: boolean; title: string; description: string; action: () => void}>({open: false, title: '', description: '', action: () => {}});

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
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

  const fetchCategories = useCallback(async () => {
    setLoadingCategories(true);
    try {
      const res = await fetch('/api/welfare/categories');
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories);
      }
    } catch {
      toast.error('카테고리를 불러오지 못했습니다.');
    } finally {
      setLoadingCategories(false);
    }
  }, []);

  useEffect(() => {
    if (roleLoaded && ADMIN_ROLES.includes(userRole)) {
      fetchCategories();
    }
  }, [fetchCategories, roleLoaded, userRole]);

  // Category CRUD
  const openCreateCatDialog = () => {
    setEditingCat(null);
    setCatName('');
    setCatDesc('');
    setCatIcon('');
    setCatSortOrder('0');
    setCatDialogOpen(true);
  };

  const openEditCatDialog = (cat: WelfareCategory) => {
    setEditingCat(cat);
    setCatName(cat.name);
    setCatDesc(cat.description || '');
    setCatIcon(cat.icon || '');
    setCatSortOrder(String(cat.sortOrder));
    setCatDialogOpen(true);
  };

  const handleSaveCat = async () => {
    if (!catName.trim()) {
      toast.error('카테고리 이름을 입력해주세요.');
      return;
    }

    setSavingCat(true);
    try {
      const payload = {
        name: catName.trim(),
        description: catDesc || null,
        icon: catIcon || null,
        sortOrder: parseInt(catSortOrder) || 0,
      };

      if (editingCat) {
        const res = await fetch(`/api/welfare/categories/${editingCat.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          toast.success('카테고리가 수정되었습니다.');
          setCatDialogOpen(false);
          fetchCategories();
        } else {
          const data = await res.json();
          toast.error(data.message || '수정에 실패했습니다.');
        }
      } else {
        const res = await fetch('/api/welfare/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          toast.success('카테고리가 추가되었습니다.');
          setCatDialogOpen(false);
          fetchCategories();
        } else {
          const data = await res.json();
          toast.error(data.message || '추가에 실패했습니다.');
        }
      }
    } catch {
      toast.error('저장 중 오류가 발생했습니다.');
    } finally {
      setSavingCat(false);
    }
  };

  const handleDeleteCat = (id: string) => {
    setConfirmDialog({
      open: true,
      title: '카테고리 삭제',
      description: '이 카테고리와 모든 하위 항목을 삭제하시겠습니까? 삭제된 데이터는 복구할 수 없습니다.',
      action: async () => {
        try {
          const res = await fetch(`/api/welfare/categories/${id}`, { method: 'DELETE' });
          if (res.ok) {
            toast.success('삭제되었습니다.');
            fetchCategories();
          } else {
            toast.error('삭제에 실패했습니다.');
          }
        } catch {
          toast.error('삭제 중 오류가 발생했습니다.');
        }
      },
    });
  };

  const handleToggleCatActive = async (cat: WelfareCategory) => {
    try {
      const res = await fetch(`/api/welfare/categories/${cat.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !cat.isActive }),
      });
      if (res.ok) {
        toast.success(cat.isActive ? '비활성화되었습니다.' : '활성화되었습니다.');
        fetchCategories();
      }
    } catch {
      toast.error('상태 변경에 실패했습니다.');
    }
  };

  // Item CRUD
  const openCreateItemDialog = (categoryId: string) => {
    setEditingItem(null);
    setItemCategoryId(categoryId);
    setItemName('');
    setItemDesc('');
    setItemBenefitType('MONEY');
    setItemAmount('');
    setItemUnit('원');
    setItemMaxPerYear('');
    setItemFormFields([]);
    setShowAmountField(false);
    setShowMaxPerYear(false);
    setItemRequireApproval(true);
    setItemDialogOpen(true);
  };

  const openEditItemDialog = (item: WelfareItem) => {
    setEditingItem(item);
    setItemCategoryId(item.categoryId);
    setItemName(item.name);
    setItemDesc(item.description || '');
    setItemBenefitType(item.benefitType);
    setItemAmount(item.amount != null ? String(item.amount) : '');
    setItemUnit(item.unit);
    setItemMaxPerYear(item.maxPerYear != null ? String(item.maxPerYear) : '');
    const fields = item.formFields;
    setItemFormFields(Array.isArray(fields) ? fields : []);
    setShowAmountField(item.amount != null);
    setShowMaxPerYear(item.maxPerYear != null);
    setItemRequireApproval(item.requireApproval !== false);
    setItemDialogOpen(true);
  };

  const handleSaveItem = async () => {
    if (!itemName.trim()) {
      toast.error('항목 이름을 입력해주세요.');
      return;
    }

    setSavingItem(true);
    try {
      const payload = {
        categoryId: itemCategoryId,
        name: itemName.trim(),
        description: itemDesc || null,
        benefitType: showAmountField ? itemBenefitType : 'OTHER',
        amount: showAmountField && itemAmount ? parseFloat(itemAmount) : null,
        unit: showAmountField ? (itemUnit || '원') : '원',
        maxPerYear: showMaxPerYear && itemMaxPerYear ? parseInt(itemMaxPerYear) : null,
        formFields: itemFormFields.length > 0 ? itemFormFields : null,
        requireApproval: itemRequireApproval,
      };

      if (editingItem) {
        const res = await fetch(`/api/welfare/items/${editingItem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          toast.success('항목이 수정되었습니다.');
          setItemDialogOpen(false);
          fetchCategories();
        } else {
          const data = await res.json();
          toast.error(data.message || '수정에 실패했습니다.');
        }
      } else {
        const res = await fetch('/api/welfare/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          toast.success('항목이 추가되었습니다.');
          setItemDialogOpen(false);
          fetchCategories();
        } else {
          const data = await res.json();
          toast.error(data.message || '추가에 실패했습니다.');
        }
      }
    } catch {
      toast.error('저장 중 오류가 발생했습니다.');
    } finally {
      setSavingItem(false);
    }
  };

  const handleDeleteItem = (id: string) => {
    setConfirmDialog({
      open: true,
      title: '항목 삭제',
      description: '이 항목을 삭제하시겠습니까? 삭제된 데이터는 복구할 수 없습니다.',
      action: async () => {
        try {
          const res = await fetch(`/api/welfare/items/${id}`, { method: 'DELETE' });
          if (res.ok) {
            toast.success('삭제되었습니다.');
            fetchCategories();
          } else {
            toast.error('삭제에 실패했습니다.');
          }
        } catch {
          toast.error('삭제 중 오류가 발생했습니다.');
        }
      },
    });
  };

  const handleToggleItemActive = async (item: WelfareItem) => {
    try {
      const res = await fetch(`/api/welfare/items/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      if (res.ok) {
        toast.success(item.isActive ? '비활성화되었습니다.' : '활성화되었습니다.');
        fetchCategories();
      }
    } catch {
      toast.error('상태 변경에 실패했습니다.');
    }
  };

  const totalItems = categories.reduce((sum, cat) => sum + cat.items.length, 0);

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
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Settings className="w-7 h-7 text-pink-600" />
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-bold">복지 관리</h1>
              {!loadingCategories && (
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                    카테고리 {categories.length}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 font-medium">
                    항목 {totalItems}
                  </span>
                </div>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-1">복지 카테고리와 항목을 관리합니다.</p>
          </div>
        </div>
        <Button onClick={openCreateCatDialog}>
          <Plus className="w-4 h-4 mr-2" />
          카테고리 추가
        </Button>
      </div>

      {/* Categories & Items */}
      {loadingCategories ? (
        <div className="flex items-center justify-center py-8 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          불러오는 중...
        </div>
      ) : categories.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-400 mb-4">등록된 카테고리가 없습니다.</p>
            <Button onClick={openCreateCatDialog}>
              <Plus className="w-4 h-4 mr-2" />
              카테고리 추가
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {categories.map((cat) => (
            <Card
              key={cat.id}
              className={`transition-all ${!cat.isActive ? 'opacity-60' : ''}`}
            >
              <CardHeader
                className="cursor-pointer select-none"
                onClick={() =>
                  setExpandedCategory(expandedCategory === cat.id ? null : cat.id)
                }
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-4xl leading-none">{cat.icon || '📦'}</span>
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        {cat.name}
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-normal">
                          {cat.items.length}개 항목
                        </span>
                        {!cat.isActive && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                            비활성
                          </span>
                        )}
                      </CardTitle>
                      {cat.description && (
                        <p className="text-sm text-gray-500 mt-1">{cat.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Switch
                      checked={cat.isActive}
                      onCheckedChange={() => handleToggleCatActive(cat)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditCatDialog(cat);
                      }}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCat(cat.id);
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </Button>
                    {expandedCategory === cat.id ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>
              </CardHeader>
              {expandedCategory === cat.id && (
                <CardContent>
                  <div className="flex justify-end mb-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openCreateItemDialog(cat.id)}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      항목 추가
                    </Button>
                  </div>
                  {cat.items.length === 0 ? (
                    <p className="text-gray-400 text-sm text-center py-4">
                      등록된 항목이 없습니다.
                    </p>
                  ) : (
                    <div className="divide-y">
                      {cat.items.map((item) => {
                        const typeBadge = BENEFIT_TYPES.find((t) => t.value === item.benefitType);
                        return (
                          <div
                            key={item.id}
                            className={`flex items-center justify-between py-2.5 px-1 ${
                              !item.isActive ? 'opacity-50' : ''
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <h4 className="font-medium text-sm truncate">{item.name}</h4>
                              <div className="flex flex-wrap gap-1 flex-shrink-0">
                                {typeBadge && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                                    {typeBadge.label}
                                  </span>
                                )}
                                <Switch
                                  checked={item.isActive}
                                  onCheckedChange={() => handleToggleItemActive(item)}
                                />
                                {!item.requireApproval && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                    자동승인
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                              <span className="text-xs text-gray-500">
                                {item.amount != null ? (
                                  <span className="font-medium text-gray-700">{item.amount.toLocaleString()}{item.unit}</span>
                                ) : '-'}
                                {item.maxPerYear ? ` · 연 ${item.maxPerYear}회` : ''}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => openEditItemDialog(item)}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => handleDeleteItem(item.id)}
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

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

      {/* Category Dialog */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent
          className="sm:max-w-[400px]"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{editingCat ? '카테고리 수정' : '카테고리 추가'}</DialogTitle>
            <DialogDescription>복지 카테고리 정보를 입력하세요.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>카테고리 이름</Label>
              <Input
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="예: 건강관리"
                className="mt-1"
              />
            </div>
            <div>
              <Label>설명</Label>
              <Textarea
                value={catDesc}
                onChange={(e) => setCatDesc(e.target.value)}
                placeholder="카테고리 설명"
                className="mt-1"
                rows={2}
              />
            </div>
            <div>
              <Label>아이콘</Label>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {EMOJI_PRESETS.map((p) => (
                  <button
                    key={p.emoji}
                    type="button"
                    onClick={() => setCatIcon(p.emoji)}
                    className={`w-10 h-10 rounded-lg border-2 text-xl flex items-center justify-center transition-all hover:scale-110 ${
                      catIcon === p.emoji
                        ? 'border-primary bg-primary/10 shadow-sm'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    title={p.label}
                  >
                    {p.emoji}
                  </button>
                ))}
              </div>
              {catIcon && (
                <p className="text-xs text-gray-500 mt-1">
                  선택됨: {catIcon} {EMOJI_PRESETS.find(p => p.emoji === catIcon)?.label || ''}
                </p>
              )}
            </div>
            <div>
              <Label>정렬 순서</Label>
              <Input
                type="number"
                value={catSortOrder}
                onChange={(e) => setCatSortOrder(e.target.value)}
                placeholder="낮을수록 먼저 표시"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setCatDialogOpen(false)}
            >
              취소
            </Button>
            <Button
              className="w-full sm:w-auto"
              onClick={handleSaveCat}
              disabled={savingCat}
            >
              {savingCat ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />저장 중...</> : '저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item Dialog */}
      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent
          className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{editingItem ? '항목 수정' : '항목 추가'}</DialogTitle>
            <DialogDescription>복지 항목 정보를 입력하세요.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* 기본 정보 섹션 */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">기본 정보</h3>
              <div>
                <Label>항목 이름</Label>
                <Input
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="예: 건강검진 지원금"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>설명</Label>
                <Textarea
                  value={itemDesc}
                  onChange={(e) => setItemDesc(e.target.value)}
                  placeholder="항목 설명"
                  className="mt-1"
                  rows={2}
                />
              </div>
            </div>

            {/* 금액 설정 섹션 */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">금액 설정</h3>
              <div className="border rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">금액 설정</Label>
                    <p className="text-xs text-gray-500">금액 지원이 있는 경우 활성화하세요</p>
                  </div>
                  <Switch checked={showAmountField} onCheckedChange={setShowAmountField} />
                </div>
                {showAmountField && (
                  <div className="space-y-3 pt-2 border-t">
                    <div>
                      <Label className="text-xs">혜택 유형</Label>
                      <Select value={itemBenefitType} onValueChange={setItemBenefitType}>
                        <SelectTrigger className="mt-1 h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {BENEFIT_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">금액</Label>
                        <Input
                          type="number"
                          value={itemAmount}
                          onChange={(e) => setItemAmount(e.target.value)}
                          placeholder="미입력 시 직원이 입력"
                          className="mt-1 h-9"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">단위</Label>
                        <Input
                          value={itemUnit}
                          onChange={(e) => setItemUnit(e.target.value)}
                          placeholder="원"
                          className="mt-1 h-9"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 제한/승인 섹션 */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">제한 / 승인</h3>
              <div className="border rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">연간 횟수 제한</Label>
                    <p className="text-xs text-gray-500">신청 횟수를 제한할 경우 활성화하세요</p>
                  </div>
                  <Switch checked={showMaxPerYear} onCheckedChange={setShowMaxPerYear} />
                </div>
                {showMaxPerYear && (
                  <div className="pt-3 mt-3 border-t">
                    <Label className="text-xs">최대 신청 횟수 (연간)</Label>
                    <Input
                      type="number"
                      value={itemMaxPerYear}
                      onChange={(e) => setItemMaxPerYear(e.target.value)}
                      placeholder="예: 3"
                      className="mt-1 h-9"
                    />
                  </div>
                )}
              </div>

              <div className="border rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">승인 필요</Label>
                    <p className="text-xs text-gray-500">비활성화하면 신청 시 자동 승인됩니다</p>
                  </div>
                  <Switch checked={itemRequireApproval} onCheckedChange={setItemRequireApproval} />
                </div>
                {!itemRequireApproval && (
                  <p className="text-xs text-amber-600 mt-2 bg-amber-50 p-2 rounded">
                    신청 시 자동 승인됩니다. 별도의 관리자 승인 없이 즉시 처리됩니다.
                  </p>
                )}
              </div>
            </div>

            {/* 신청 양식 섹션 */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">신청 양식 설정</h3>
              <p className="text-xs text-gray-500">직원이 신청 시 입력할 커스텀 필드를 설정합니다.</p>

              {/* 프리셋 템플릿 */}
              {itemFormFields.length === 0 && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs font-medium text-blue-700 mb-2">빠른 템플릿</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      {
                        label: '도서 지원',
                        fields: [
                          {
                            id: `s-${Date.now()}-1`,
                            type: 'section' as const,
                            label: '도서 정보',
                            required: false,
                            description: '구매할 도서 정보를 입력해주세요',
                            children: [
                              { id: `f-${Date.now()}-1a`, type: 'select' as const, label: '도서 플랫폼', required: true, options: ['교보문고', '영풍문고', '알라딘', 'YES24', '기타'] },
                              { id: `f-${Date.now()}-1b`, type: 'text' as const, label: '도서명', required: true, placeholder: '구매할 도서명을 입력하세요' },
                              { id: `f-${Date.now()}-1c`, type: 'number' as const, label: '도서 가격', required: false, placeholder: '원' },
                            ],
                          },
                        ],
                      },
                      {
                        label: '리조트/시설 예약',
                        fields: [
                          { id: `f-${Date.now()}-2a`, type: 'calendar' as const, label: '예약 날짜', required: true, description: '기존 예약을 확인하고 날짜를 선택하세요', rangeSelect: true },
                          { id: `f-${Date.now()}-2b`, type: 'number' as const, label: '인원', required: true, placeholder: '명' },
                          { id: `f-${Date.now()}-2c`, type: 'textarea' as const, label: '요청사항', required: false, placeholder: '추가 요청사항을 입력하세요' },
                        ],
                      },
                      {
                        label: '세차 지원',
                        fields: [
                          { id: `f-${Date.now()}-3a`, type: 'select' as const, label: '세차 업체', required: true, options: [] },
                          { id: `f-${Date.now()}-3b`, type: 'date' as const, label: '이용 날짜', required: true },
                          { id: `f-${Date.now()}-3c`, type: 'text' as const, label: '차량번호', required: true, placeholder: '예: 12가 3456' },
                        ],
                      },
                      {
                        label: '건강검진',
                        fields: [
                          { id: `f-${Date.now()}-4a`, type: 'date' as const, label: '검진일', required: true },
                          { id: `f-${Date.now()}-4b`, type: 'text' as const, label: '검진기관', required: true, placeholder: '검진 받은 병원/기관명' },
                          { id: `f-${Date.now()}-4c`, type: 'number' as const, label: '검진비용', required: false, placeholder: '원' },
                        ],
                      },
                    ].map((template) => (
                      <Button
                        key={template.label}
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => setItemFormFields(template.fields as FormFieldDef[])}
                      >
                        {template.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* 필드 목록 렌더링 */}
              {itemFormFields.length > 0 && (
                <div className="space-y-3">
                  {itemFormFields.map((field, idx) => (
                    <FormFieldEditor
                      key={field.id}
                      field={field}
                      onChange={(updated) => {
                        const newFields = [...itemFormFields];
                        newFields[idx] = updated;
                        setItemFormFields(newFields);
                      }}
                      onDelete={() => setItemFormFields(itemFormFields.filter((_, i) => i !== idx))}
                    />
                  ))}
                </div>
              )}

              {/* 필드 추가 버튼 */}
              <div className="flex flex-wrap gap-2">
                {([
                  { type: 'text' as const, label: '텍스트', icon: 'Aa' },
                  { type: 'number' as const, label: '숫자', icon: '#' },
                  { type: 'textarea' as const, label: '장문', icon: '¶' },
                  { type: 'select' as const, label: '선택', icon: '▾' },
                  { type: 'date' as const, label: '날짜', icon: '📅' },
                  { type: 'calendar' as const, label: '캘린더(예약)', icon: '🗓' },
                  { type: 'section' as const, label: '섹션(그룹)', icon: '📁' },
                ]).map((preset) => (
                  <Button
                    key={preset.type}
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => {
                      const newField: FormFieldDef = {
                        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                        type: preset.type,
                        label: '',
                        required: false,
                        ...(preset.type === 'text' || preset.type === 'number' || preset.type === 'textarea' ? { placeholder: '' } : {}),
                        ...(preset.type === 'select' ? { options: [''] } : {}),
                        ...(preset.type === 'section' ? { children: [], description: '' } : {}),
                      };
                      setItemFormFields([...itemFormFields, newField]);
                    }}
                  >
                    <span className="mr-1">{preset.icon}</span>
                    {preset.label}
                  </Button>
                ))}
              </div>
              {itemFormFields.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-red-500"
                  onClick={() => setItemFormFields([])}
                >
                  전체 삭제
                </Button>
              )}
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setItemDialogOpen(false)}
            >
              취소
            </Button>
            <Button
              className="w-full sm:w-auto"
              onClick={handleSaveItem}
              disabled={savingItem}
            >
              {savingItem ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />저장 중...</> : '저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// === FormFieldEditor 컴포넌트 ===
const TYPE_BADGES: Record<string, { label: string; className: string }> = {
  text: { label: '텍스트', className: 'bg-blue-100 text-blue-700' },
  number: { label: '숫자', className: 'bg-cyan-100 text-cyan-700' },
  textarea: { label: '장문', className: 'bg-teal-100 text-teal-700' },
  select: { label: '선택', className: 'bg-purple-100 text-purple-700' },
  date: { label: '날짜', className: 'bg-green-100 text-green-700' },
  calendar: { label: '캘린더', className: 'bg-orange-100 text-orange-700' },
  section: { label: '섹션', className: 'bg-indigo-100 text-indigo-700' },
};

function FormFieldEditor({
  field,
  onChange,
  onDelete,
  nested = false,
}: {
  field: FormFieldDef;
  onChange: (updated: FormFieldDef) => void;
  onDelete: () => void;
  nested?: boolean;
}) {
  const typeBadge = TYPE_BADGES[field.type] || TYPE_BADGES.text;
  const [expanded, setExpanded] = useState(true);

  const updateField = (partial: Partial<FormFieldDef>) => {
    onChange({ ...field, ...partial });
  };

  // 섹션 타입: 접이식 그룹
  if (field.type === 'section') {
    return (
      <div className={`border-2 border-indigo-200 rounded-lg ${nested ? 'ml-4' : ''}`}>
        <div className="flex items-center gap-2 p-3 bg-indigo-50/50 cursor-pointer" onClick={() => setExpanded(!expanded)}>
          <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeBadge.className}`}>
            {typeBadge.label}
          </span>
          <Input
            value={field.label}
            onChange={(e) => updateField({ label: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            placeholder="섹션 제목 (예: 도서 정보)"
            className="h-8 text-sm flex-1 font-medium"
          />
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 flex-shrink-0" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
            <Trash2 className="w-4 h-4 text-red-500" />
          </Button>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
        {expanded && (
          <div className="p-3 space-y-3 border-t border-indigo-200">
            <div>
              <Input
                value={field.description || ''}
                onChange={(e) => updateField({ description: e.target.value })}
                placeholder="섹션 설명 (선택사항)"
                className="h-8 text-sm text-gray-500"
              />
            </div>
            {/* 섹션 내 자식 필드 */}
            {(field.children || []).map((child, cidx) => (
              <FormFieldEditor
                key={child.id}
                field={child}
                nested
                onChange={(updated) => {
                  const newChildren = [...(field.children || [])];
                  newChildren[cidx] = updated;
                  updateField({ children: newChildren });
                }}
                onDelete={() => {
                  updateField({ children: (field.children || []).filter((_, i) => i !== cidx) });
                }}
              />
            ))}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {([
                { type: 'text' as const, label: '텍스트' },
                { type: 'number' as const, label: '숫자' },
                { type: 'textarea' as const, label: '장문' },
                { type: 'select' as const, label: '선택' },
                { type: 'date' as const, label: '날짜' },
                { type: 'calendar' as const, label: '캘린더' },
              ]).map((p) => (
                <Button
                  key={p.type}
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    const newChild: FormFieldDef = {
                      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                      type: p.type,
                      label: '',
                      required: false,
                      ...(p.type === 'text' || p.type === 'number' || p.type === 'textarea' ? { placeholder: '' } : {}),
                      ...(p.type === 'select' ? { options: [''] } : {}),
                    };
                    updateField({ children: [...(field.children || []), newChild] });
                  }}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  {p.label}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // 일반 필드 타입
  return (
    <div className={`border rounded-lg p-3 space-y-2 bg-gray-50/50 ${nested ? 'ml-4' : ''}`}>
      <div className="flex items-center gap-2">
        <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeBadge.className}`}>
          {typeBadge.label}
        </span>
        <Input
          value={field.label}
          onChange={(e) => updateField({ label: e.target.value })}
          placeholder="필드 라벨"
          className="h-8 text-sm flex-1"
        />
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Switch
            checked={field.required}
            onCheckedChange={(checked) => updateField({ required: checked })}
          />
          <span className="text-xs text-gray-500 whitespace-nowrap">필수</span>
        </div>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 flex-shrink-0" onClick={onDelete}>
          <Trash2 className="w-4 h-4 text-red-500" />
        </Button>
      </div>

      {/* 설명 필드 */}
      {(field.type === 'calendar' || field.type === 'date') && (
        <div className="ml-6 space-y-2">
          <Input
            value={field.description || ''}
            onChange={(e) => updateField({ description: e.target.value })}
            placeholder="도움말 텍스트 (선택)"
            className="h-8 text-sm text-gray-500"
          />
          {field.type === 'calendar' && (
            <div className="flex items-center gap-2">
              <Switch
                checked={field.rangeSelect || false}
                onCheckedChange={(checked) => updateField({ rangeSelect: checked })}
              />
              <span className="text-xs text-gray-500">시작일~종료일 범위 선택</span>
            </div>
          )}
        </div>
      )}

      {/* 텍스트/숫자/장문 플레이스홀더 */}
      {(field.type === 'text' || field.type === 'number' || field.type === 'textarea') && (
        <div className="ml-6">
          <Input
            value={field.placeholder || ''}
            onChange={(e) => updateField({ placeholder: e.target.value })}
            placeholder="플레이스홀더 텍스트"
            className="h-8 text-sm"
          />
        </div>
      )}

      {/* 선택 옵션 */}
      {field.type === 'select' && (
        <div className="ml-6 space-y-1.5">
          <Label className="text-xs text-gray-500">선택 옵션</Label>
          {(field.options || []).map((opt, optIdx) => (
            <div key={optIdx} className="flex items-center gap-1.5">
              <Input
                value={opt}
                onChange={(e) => {
                  const newOptions = [...(field.options || [])];
                  newOptions[optIdx] = e.target.value;
                  updateField({ options: newOptions });
                }}
                placeholder={`옵션 ${optIdx + 1}`}
                className="h-8 text-sm"
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 flex-shrink-0"
                onClick={() => {
                  updateField({ options: (field.options || []).filter((_, i) => i !== optIdx) });
                }}
              >
                <X className="w-3 h-3 text-gray-400" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => updateField({ options: [...(field.options || []), ''] })}
          >
            <Plus className="w-3 h-3 mr-1" />
            옵션 추가
          </Button>
        </div>
      )}
    </div>
  );
}
