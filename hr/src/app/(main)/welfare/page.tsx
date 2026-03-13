'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Gift, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';

interface FormFieldDef {
  id: string;
  type: 'text' | 'number' | 'textarea' | 'select' | 'date' | 'calendar' | 'section';
  label: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
  description?: string;
  children?: FormFieldDef[];
  rangeSelect?: boolean;
}

interface WelfareItem {
  id: string;
  name: string;
  description: string | null;
  benefitType: string;
  amount: number | null;
  unit: string;
  maxPerYear: number | null;
  isActive: boolean;
  formFields: FormFieldDef[] | null;
  requireApproval?: boolean;
}

interface WelfareCategory {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  items: WelfareItem[];
}

const BENEFIT_TYPE_LABEL: Record<string, string> = {
  MONEY: '금액지원',
  LEAVE: '휴가',
  VOUCHER: '바우처',
  OTHER: '기타',
};

const BENEFIT_TYPE_COLOR: Record<string, string> = {
  MONEY: 'bg-blue-100 text-blue-800',
  LEAVE: 'bg-green-100 text-green-800',
  VOUCHER: 'bg-purple-100 text-purple-800',
  OTHER: 'bg-gray-100 text-gray-800',
};

export default function WelfareCatalogPage() {
  const [categories, setCategories] = useState<WelfareCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Request dialog
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<WelfareItem | null>(null);
  const [requestAmount, setRequestAmount] = useState('');
  const [requestNote, setRequestNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [reservations, setReservations] = useState<Record<string, { date: string; employeeName: string; status: string; note?: string | null }[]>>({});
  const [calendarMonth, setCalendarMonth] = useState<Record<string, { year: number; month: number }>>({});
  const [holidayDates, setHolidayDates] = useState<Record<string, string>>({}); // dateStr -> name
  const [errorFieldId, setErrorFieldId] = useState<string | null>(null);
  // Track which sections should be forced open for validation
  const [forcedOpenSections, setForcedOpenSections] = useState<Set<string>>(new Set());

  const dialogContentRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const catRes = await fetch('/api/welfare/categories');
      if (catRes.status === 401) { window.location.href = '/login'; return; }

      if (catRes.ok) {
        const catData = await catRes.json();
        // Client-side defense: filter out inactive categories and inactive items
        const activeCategories = (catData.categories as WelfareCategory[])
          .filter((cat) => cat.items !== undefined)
          .map((cat) => ({
            ...cat,
            items: cat.items.filter((item) => item.isActive !== false),
          }));
        setCategories(activeCategories);
        setExpandedCategories(new Set(activeCategories.map((c) => c.id)));
      }
    } catch {
      toast.error('데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleCategory = (id: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openRequestDialog = (item: WelfareItem) => {
    setSelectedItem(item);
    setRequestAmount(item.amount ? String(item.amount) : '');
    setRequestNote('');
    setFormValues({});
    setReservations({});
    setHolidayDates({});
    setErrorFieldId(null);
    setForcedOpenSections(new Set());

    const now = new Date();
    // Recursively find all calendar fields (including inside sections)
    const findCalendarFields = (fields: FormFieldDef[]): FormFieldDef[] => {
      const result: FormFieldDef[] = [];
      for (const f of fields) {
        if (f.type === 'calendar') result.push(f);
        if (f.type === 'section' && f.children) result.push(...findCalendarFields(f.children));
      }
      return result;
    };
    const calendarFields = item.formFields ? findCalendarFields(item.formFields) : [];
    if (calendarFields.length > 0) {
      const initMonths: Record<string, { year: number; month: number }> = {};
      calendarFields.forEach(f => {
        initMonths[f.id] = { year: now.getFullYear(), month: now.getMonth() };
      });
      setCalendarMonth(initMonths);

      // Fetch holidays for current and next year
      const thisYear = now.getFullYear();
      Promise.all([
        fetch(`/api/holidays?year=${thisYear}`).then(r => r.ok ? r.json() : null),
        fetch(`/api/holidays?year=${thisYear + 1}`).then(r => r.ok ? r.json() : null),
      ]).then(([d1, d2]) => {
        const map: Record<string, string> = {};
        for (const data of [d1, d2]) {
          if (data?.holidays) {
            for (const h of data.holidays) {
              const d = new Date(h.date);
              const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
              map[ds] = h.name;
            }
          }
        }
        setHolidayDates(map);
      }).catch(() => {});

      Promise.all(calendarFields.map(async (field) => {
        try {
          const res = await fetch(`/api/welfare/items/${item.id}/reservations?fieldId=${field.id}`);
          if (res.ok) {
            const data = await res.json();
            setReservations(prev => ({ ...prev, [field.id]: data.reservations }));
          }
        } catch {
          // ignore
        }
      }));
    }

    setRequestDialogOpen(true);
  };

  const handleSubmitRequest = async () => {
    if (!selectedItem) return;

    setErrorFieldId(null);

    // Validate required custom fields (including section children)
    if (selectedItem.formFields) {
      // Also collect parent section IDs for auto-opening
      const findMissingField = (fields: FormFieldDef[], parentSectionIds: string[] = []): { fieldId: string; label: string; sectionIds: string[] } | null => {
        for (const field of fields) {
          if (field.type === 'section' && field.children) {
            const childError = findMissingField(field.children, [...parentSectionIds, field.id]);
            if (childError) return childError;
          } else if (field.required && !formValues[field.id]) {
            return { fieldId: field.id, label: field.label, sectionIds: parentSectionIds };
          }
        }
        return null;
      };
      const missing = findMissingField(selectedItem.formFields);
      if (missing) {
        // Force open parent sections
        if (missing.sectionIds.length > 0) {
          setForcedOpenSections(new Set(missing.sectionIds));
        }
        setErrorFieldId(missing.fieldId);
        toast.error(`"${missing.label}" 항목을 입력해주세요.`);
        // Scroll to the missing field after a short delay for sections to open
        setTimeout(() => {
          const el = document.getElementById(`field-${missing.fieldId}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/welfare/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: selectedItem.id,
          amount: requestAmount ? parseFloat(requestAmount) : null,
          note: requestNote || null,
          formValues: Object.keys(formValues).length > 0 ? formValues : null,
        }),
      });

      if (res.ok) {
        const result = await res.json();
        if (result.autoApproved) {
          toast.success('자동 승인되었습니다.');
        } else {
          toast.success('복지 신청이 완료되었습니다.');
        }
        setRequestDialogOpen(false);
        fetchData();
      } else if (res.status === 401) {
        toast.error('세션이 만료되었습니다. 다시 로그인합니다.');
        setTimeout(() => { window.location.href = '/login'; }, 1500);
      } else {
        const data = await res.json();
        toast.error(data.message || '신청에 실패했습니다.');
      }
    } catch {
      toast.error('신청 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
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
        <Gift className="w-7 h-7 text-pink-600" />
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">복지혜택</h1>
          <p className="text-sm text-gray-500 mt-1">회사에서 제공하는 복지 혜택을 확인하고 신청하세요.</p>
        </div>
      </div>

      {categories.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-400">등록된 복지 혜택이 없습니다.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {categories.map((cat) => (
            <Card key={cat.id}>
              <CardHeader
                className="cursor-pointer select-none"
                onClick={() => toggleCategory(cat.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{cat.icon || '📦'}</span>
                    <div>
                      <CardTitle className="text-lg">{cat.name}</CardTitle>
                      {cat.description && (
                        <p className="text-sm text-gray-500 mt-1">{cat.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{cat.items.length}개 항목</Badge>
                    {expandedCategories.has(cat.id) ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>
              </CardHeader>
              {expandedCategories.has(cat.id) && (
                <CardContent>
                  {cat.items.length === 0 ? (
                    <p className="text-gray-400 text-sm">등록된 항목이 없습니다.</p>
                  ) : (
                    <div className="divide-y">
                      {cat.items.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => openRequestDialog(item)}
                          className="flex items-center justify-between py-3 px-2 hover:bg-gray-50 transition-colors cursor-pointer group rounded"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="font-medium text-sm group-hover:text-primary transition-colors truncate">{item.name}</h3>
                                <div className="flex gap-1 flex-shrink-0">
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap ${BENEFIT_TYPE_COLOR[item.benefitType] || BENEFIT_TYPE_COLOR.OTHER}`}>
                                    {BENEFIT_TYPE_LABEL[item.benefitType] || item.benefitType}
                                  </span>
                                  {item.requireApproval === false && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 whitespace-nowrap">
                                      자동승인
                                    </span>
                                  )}
                                </div>
                              </div>
                              {item.description && (
                                <p className="text-xs text-gray-400 truncate mt-0.5">{item.description}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                            <div className="text-right">
                              {item.amount != null && (
                                <p className="text-sm font-semibold text-blue-600">{item.amount.toLocaleString()}{item.unit}</p>
                              )}
                              {item.maxPerYear && (
                                <p className="text-[10px] text-gray-400">연 {item.maxPerYear}회</p>
                              )}
                            </div>
                            <Send className="w-4 h-4 text-gray-300 group-hover:text-primary transition-colors flex-shrink-0" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Request Dialog */}
      <Dialog open={requestDialogOpen} onOpenChange={(open) => {
        setRequestDialogOpen(open);
        if (!open) {
          setErrorFieldId(null);
          setForcedOpenSections(new Set());
        }
      }}>
        <DialogContent
          ref={dialogContentRef}
          className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>복지 신청</DialogTitle>
            <DialogDescription>아래 복지 혜택을 신청합니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* 선택된 항목 요약 */}
            {selectedItem && (
              <div className="bg-blue-50 rounded-lg p-3 space-y-1">
                <p className="font-medium text-sm">{selectedItem.name}</p>
                {selectedItem.description && (
                  <p className="text-xs text-gray-500">{selectedItem.description}</p>
                )}
                <div className="flex gap-3 text-xs text-gray-600">
                  <span>유형: {BENEFIT_TYPE_LABEL[selectedItem.benefitType] || selectedItem.benefitType}</span>
                  {selectedItem.amount != null && (
                    <span>기준금액: {selectedItem.amount.toLocaleString()}{selectedItem.unit}</span>
                  )}
                  {selectedItem.maxPerYear && (
                    <span>연 {selectedItem.maxPerYear}회</span>
                  )}
                </div>
              </div>
            )}
            {/* 금액 입력 - 항목에 금액 설정이 있는 경우에만 표시 */}
            {selectedItem && (selectedItem.amount != null || selectedItem.benefitType === 'MONEY') && (
              <div>
                <Label>신청 금액 {selectedItem.unit && `(${selectedItem.unit})`}</Label>
                <Input
                  type="number"
                  value={requestAmount}
                  onChange={(e) => setRequestAmount(e.target.value)}
                  placeholder={selectedItem.amount ? `기준: ${selectedItem.amount.toLocaleString()}` : '금액 입력'}
                  className="mt-1"
                />
                {selectedItem.amount != null && !requestAmount && (
                  <p className="text-xs text-gray-400 mt-1">
                    미입력 시 기준금액 {selectedItem.amount.toLocaleString()}{selectedItem.unit}이 적용됩니다.
                  </p>
                )}
              </div>
            )}
            <div>
              <Label>신청 사유</Label>
              <Textarea
                value={requestNote}
                onChange={(e) => setRequestNote(e.target.value)}
                placeholder="예: 2026년 건강검진 비용 청구"
                className="mt-1"
                rows={3}
              />
            </div>

            {/* Dynamic custom form fields */}
            {selectedItem?.formFields && selectedItem.formFields.length > 0 && (
              <div className="space-y-4 border-t pt-4">
                <p className="text-sm font-medium text-gray-700">추가 입력 항목</p>
                {selectedItem.formFields.map((field) => (
                  <WelfareFormFieldRenderer
                    key={field.id}
                    field={field}
                    formValues={formValues}
                    setFormValues={setFormValues}
                    reservations={reservations}
                    calendarMonth={calendarMonth}
                    setCalendarMonth={setCalendarMonth}
                    selectedItemId={selectedItem.id}
                    setReservations={setReservations}
                    errorFieldId={errorFieldId}
                    onFieldFocus={() => setErrorFieldId(null)}
                    forcedOpenSections={forcedOpenSections}
                    holidayDates={holidayDates}
                  />
                ))}
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setRequestDialogOpen(false)}
            >
              취소
            </Button>
            <Button
              className="w-full sm:w-auto"
              onClick={handleSubmitRequest}
              disabled={submitting}
            >
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              신청하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// === WelfareFormFieldRenderer 컴포넌트 ===
function WelfareFormFieldRenderer({
  field,
  formValues,
  setFormValues,
  reservations,
  calendarMonth,
  setCalendarMonth,
  selectedItemId,
  setReservations,
  errorFieldId,
  onFieldFocus,
  forcedOpenSections,
  holidayDates,
  nested = false,
}: {
  field: FormFieldDef;
  formValues: Record<string, string>;
  setFormValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  reservations: Record<string, { date: string; employeeName: string; status: string }[]>;
  calendarMonth: Record<string, { year: number; month: number }>;
  setCalendarMonth: React.Dispatch<React.SetStateAction<Record<string, { year: number; month: number }>>>;
  selectedItemId: string;
  setReservations: React.Dispatch<React.SetStateAction<Record<string, { date: string; employeeName: string; status: string }[]>>>;
  errorFieldId: string | null;
  onFieldFocus: () => void;
  forcedOpenSections: Set<string>;
  holidayDates: Record<string, string>;
  nested?: boolean;
}) {
  const isForcedOpen = forcedOpenSections.has(field.id);
  const [sectionOpen, setSectionOpen] = useState(true);
  const isError = errorFieldId === field.id;

  // Force section open when validation requires it
  useEffect(() => {
    if (isForcedOpen) setSectionOpen(true);
  }, [isForcedOpen]);

  // 섹션 타입: 접이식 그룹
  if (field.type === 'section') {
    return (
      <div className={`border rounded-lg overflow-hidden ${nested ? 'ml-3' : ''}`}>
        <button
          type="button"
          onClick={() => setSectionOpen(!sectionOpen)}
          className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
        >
          <div>
            <span className="text-sm font-medium">{field.label || '섹션'}</span>
            {field.description && (
              <p className="text-xs text-gray-500 mt-0.5">{field.description}</p>
            )}
          </div>
          {sectionOpen ? (
            <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
          )}
        </button>
        {sectionOpen && field.children && field.children.length > 0 && (
          <div className="p-3 space-y-4 border-t">
            {field.children.map((child) => (
              <WelfareFormFieldRenderer
                key={child.id}
                field={child}
                formValues={formValues}
                setFormValues={setFormValues}
                reservations={reservations}
                calendarMonth={calendarMonth}
                setCalendarMonth={setCalendarMonth}
                selectedItemId={selectedItemId}
                setReservations={setReservations}
                errorFieldId={errorFieldId}
                onFieldFocus={onFieldFocus}
                forcedOpenSections={forcedOpenSections}
                holidayDates={holidayDates}
                nested
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const errorBorderClass = isError ? 'ring-2 ring-red-500 border-red-500' : '';

  return (
    <div id={`field-${field.id}`}>
      <Label>
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      {field.description && (
        <p className="text-xs text-gray-500 mt-0.5 mb-1">{field.description}</p>
      )}

      {field.type === 'text' && (
        <Input
          value={formValues[field.id] || ''}
          onChange={(e) => { setFormValues(prev => ({ ...prev, [field.id]: e.target.value })); onFieldFocus(); }}
          onFocus={onFieldFocus}
          placeholder={field.placeholder || ''}
          className={`mt-1 ${errorBorderClass}`}
        />
      )}

      {field.type === 'number' && (
        <Input
          type="number"
          value={formValues[field.id] || ''}
          onChange={(e) => { setFormValues(prev => ({ ...prev, [field.id]: e.target.value })); onFieldFocus(); }}
          onFocus={onFieldFocus}
          placeholder={field.placeholder || ''}
          className={`mt-1 ${errorBorderClass}`}
        />
      )}

      {field.type === 'textarea' && (
        <textarea
          value={formValues[field.id] || ''}
          onChange={(e) => { setFormValues(prev => ({ ...prev, [field.id]: e.target.value })); onFieldFocus(); }}
          onFocus={onFieldFocus}
          placeholder={field.placeholder || ''}
          className={`mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${errorBorderClass}`}
          rows={3}
        />
      )}

      {field.type === 'select' && field.options && (
        <div className={`flex flex-wrap gap-2 mt-1 p-2 rounded-md ${isError ? 'ring-2 ring-red-500' : ''}`}>
          {field.options.filter(opt => opt.trim() !== '').map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => { setFormValues(prev => ({ ...prev, [field.id]: opt })); onFieldFocus(); }}
              className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                formValues[field.id] === opt
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-primary hover:text-primary'
              }`}
            >
              {opt}
            </button>
          ))}
          {field.options.filter(opt => opt.trim() !== '').length === 0 && (
            <p className="text-xs text-gray-400">선택 옵션이 설정되지 않았습니다.</p>
          )}
        </div>
      )}

      {field.type === 'date' && (
        <Input
          type="date"
          value={formValues[field.id] || ''}
          onChange={(e) => { setFormValues(prev => ({ ...prev, [field.id]: e.target.value })); onFieldFocus(); }}
          onFocus={onFieldFocus}
          className={`mt-1 ${errorBorderClass}`}
        />
      )}

      {field.type === 'calendar' && (() => {
        const cm = calendarMonth[field.id] || { year: new Date().getFullYear(), month: new Date().getMonth() };
        const fieldReservations: { date: string; employeeName: string; status: string; note?: string | null }[] = reservations[field.id] || [];
        const firstDay = new Date(cm.year, cm.month, 1).getDay();
        const daysInMonth = new Date(cm.year, cm.month + 1, 0).getDate();
        const weeks: (number | null)[][] = [];
        let currentWeek: (number | null)[] = Array(firstDay).fill(null);

        for (let d = 1; d <= daysInMonth; d++) {
          currentWeek.push(d);
          if (currentWeek.length === 7) {
            weeks.push(currentWeek);
            currentWeek = [];
          }
        }
        if (currentWeek.length > 0) {
          while (currentWeek.length < 7) currentWeek.push(null);
          weeks.push(currentWeek);
        }

        const isRange = field.rangeSelect === true;
        const selectedValue = formValues[field.id] || '';
        const [rangeStart, rangeEnd] = isRange ? selectedValue.split('~') : [selectedValue, ''];
        const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

        const getReservationsForDate = (day: number) => {
          const dateStr = `${cm.year}-${String(cm.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          return fieldReservations.filter(r => r.date === dateStr);
        };

        const isApprovedDate = (day: number) => getReservationsForDate(day).some(r => r.status === 'APPROVED');
        const hasPendingReservation = (day: number) => getReservationsForDate(day).some(r => r.status === 'PENDING');
        const getHolidayName = (day: number) => {
          const dateStr = `${cm.year}-${String(cm.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          return holidayDates[dateStr] || null;
        };
        const isWeekend = (day: number) => {
          const dow = new Date(cm.year, cm.month, day).getDay();
          return dow === 0 || dow === 6;
        };

        const isInRange = (dateStr: string) => {
          if (!isRange || !rangeStart || !rangeEnd) return false;
          return dateStr >= rangeStart && dateStr <= rangeEnd;
        };

        const handleDayClick = (dateStr: string) => {
          onFieldFocus();
          if (!isRange) {
            setFormValues(prev => ({ ...prev, [field.id]: dateStr }));
          } else {
            if (!rangeStart || (rangeStart && rangeEnd)) {
              setFormValues(prev => ({ ...prev, [field.id]: dateStr }));
            } else {
              if (dateStr < rangeStart) {
                setFormValues(prev => ({ ...prev, [field.id]: `${dateStr}~${rangeStart}` }));
              } else {
                setFormValues(prev => ({ ...prev, [field.id]: `${rangeStart}~${dateStr}` }));
              }
            }
          }
        };

        return (
          <div className={`mt-2 border rounded-lg p-3 ${isError ? 'ring-2 ring-red-500 border-red-500' : ''}`}>
            {/* Mode indicator */}
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isRange ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                {isRange ? '📅 기간 선택' : '📅 날짜 선택'}
              </span>
              {isRange && (
                <span className="text-xs text-gray-500">
                  {!rangeStart ? '시작일을 선택하세요' : !rangeEnd ? '종료일을 선택하세요' : ''}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={() => setCalendarMonth(prev => {
                  const p = prev[field.id] || cm;
                  const newMonth = p.month === 0 ? 11 : p.month - 1;
                  const newYear = p.month === 0 ? p.year - 1 : p.year;
                  return { ...prev, [field.id]: { year: newYear, month: newMonth } };
                })}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-medium">
                {cm.year}년 {monthNames[cm.month]}
              </span>
              <button
                type="button"
                onClick={() => setCalendarMonth(prev => {
                  const p = prev[field.id] || cm;
                  const newMonth = p.month === 11 ? 0 : p.month + 1;
                  const newYear = p.month === 11 ? p.year + 1 : p.year;
                  return { ...prev, [field.id]: { year: newYear, month: newMonth } };
                })}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-0 text-center mb-1">
              {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
                <div key={d} className={`text-xs py-1 ${i === 0 || i === 6 ? 'text-red-400' : 'text-gray-500'}`}>{d}</div>
              ))}
            </div>

            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-0">
                {week.map((day, di) => {
                  if (day === null) return <div key={di} className="h-9" />;

                  const dateStr = `${cm.year}-${String(cm.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const approved = isApprovedDate(day);
                  const pending = hasPendingReservation(day);
                  const holiday = getHolidayName(day);
                  const weekend = isWeekend(day);
                  const isStart = dateStr === rangeStart;
                  const isEnd = dateStr === rangeEnd;
                  const isSelected = isRange ? (isStart || isEnd) : dateStr === rangeStart;
                  const inRange = isInRange(dateStr);
                  const dayReservations = getReservationsForDate(day);
                  const todayDate = new Date();
                  todayDate.setHours(0, 0, 0, 0);
                  const isPast = new Date(cm.year, cm.month, day) < todayDate;
                  const isDisabled = approved || isPast;

                  return (
                    <div key={di} className="relative group">
                      <button
                        type="button"
                        disabled={isDisabled}
                        onClick={() => {
                          if (!isDisabled) handleDayClick(dateStr);
                        }}
                        className={`w-full min-h-[2.75rem] py-1 text-sm transition-colors relative flex flex-col items-center ${
                          approved ? 'bg-red-100 text-red-400 cursor-not-allowed rounded'
                            : isPast ? 'text-gray-300 cursor-not-allowed rounded'
                              : isSelected ? 'bg-blue-600 text-white font-medium rounded'
                                : inRange ? 'bg-blue-100 text-blue-800'
                                  : holiday ? 'bg-red-50 hover:bg-red-100 rounded'
                                    : 'hover:bg-gray-100 rounded'
                        }`}
                      >
                        <span className={holiday || weekend ? 'text-red-500' : ''}>{day}</span>
                        {holiday && !isSelected && !inRange && (
                          <span className="text-[9px] leading-tight truncate max-w-full px-0.5 text-red-400">
                            {holiday}
                          </span>
                        )}
                        {!holiday && dayReservations.length > 0 && !isSelected && !inRange && (
                          <span className={`text-[9px] leading-tight truncate max-w-full px-0.5 ${
                            approved ? 'text-red-400' : pending ? 'text-yellow-600' : 'text-gray-500'
                          }`}>
                            {dayReservations.length === 1
                              ? `${dayReservations[0].employeeName}${dayReservations[0].note ? `(${dayReservations[0].note})` : ''}`
                              : `${dayReservations[0].employeeName} 외 ${dayReservations.length - 1}`
                            }
                          </span>
                        )}
                      </button>
                      {dayReservations.length > 0 && (
                        <div className="hidden group-hover:block absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1 bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                          {dayReservations.map((r, ri) => (
                            <div key={ri}>
                              {r.employeeName}{r.note ? `(${r.note})` : ''} - {r.status === 'APPROVED' ? '승인됨' : '대기중'}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

            <div className="flex flex-wrap gap-3 mt-2 pt-2 border-t text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> 예약불가</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" /> 대기중</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-50 border border-red-200 inline-block" /> 공휴일</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-600 inline-block" /> 선택됨</span>
              {isRange && <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-100 inline-block" /> 범위</span>}
            </div>
            {isRange ? (
              rangeStart && rangeEnd ? (
                <p className="text-sm text-blue-600 font-medium mt-2">선택: {rangeStart} ~ {rangeEnd}</p>
              ) : rangeStart ? (
                <p className="text-sm text-blue-600 mt-2">시작일: {rangeStart} <span className="text-gray-400">(종료일을 선택하세요)</span></p>
              ) : null
            ) : (
              rangeStart && <p className="text-sm text-blue-600 font-medium mt-2">선택: {rangeStart}</p>
            )}
          </div>
        );
      })()}

      {/* Error message for this field */}
      {isError && (
        <p className="text-xs text-red-500 mt-1 animate-pulse">이 항목을 입력해주세요.</p>
      )}
    </div>
  );
}
