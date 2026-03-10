'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  maxEmployees: number;
  ownerEmail: string;
  bizNumber: string | null;
  status: string;
  trialExpiresAt: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  employeeCount?: number;
}

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    name: '',
    maxEmployees: 0,
    status: '',
    trialExpiresAt: '',
  });

  // Logo state
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [hasLogo, setHasLogo] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoMessage, setLogoMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchTenant();
    fetchLogo();
  }, [id]);

  const fetchTenant = async () => {
    try {
      const res = await fetch(`/api/super-admin/tenants/${id}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setTenant(data.tenant);
      setForm({
        name: data.tenant.name,
        maxEmployees: data.tenant.maxEmployees,
        status: data.tenant.status,
        trialExpiresAt: data.tenant.trialExpiresAt
          ? new Date(data.tenant.trialExpiresAt).toISOString().split('T')[0]
          : '',
      });
    } catch {
      setError('테넌트 정보를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  const fetchLogo = async () => {
    try {
      const res = await fetch(`/api/super-admin/tenants/${id}/logo`, { credentials: 'include' });
      if (res.ok && res.headers.get('content-type')?.includes('image/png')) {
        const blob = await res.blob();
        setLogoPreview(URL.createObjectURL(blob));
        setHasLogo(true);
      }
    } catch {
      // ignore
    }
  };

  const resizeAndCompress = (file: File): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const sizes = [256, 192, 128, 96];
        for (const maxSize of sizes) {
          const canvas = document.createElement('canvas');
          let w = img.width;
          let h = img.height;
          if (w > maxSize || h > maxSize) {
            if (w > h) {
              h = Math.round((h * maxSize) / w);
              w = maxSize;
            } else {
              w = Math.round((w * maxSize) / h);
              h = maxSize;
            }
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL('image/png');
          const byteString = atob(dataUrl.split(',')[1]);
          const ab = new ArrayBuffer(byteString.length);
          const ia = new Uint8Array(ab);
          for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
          }
          const blob = new Blob([ab], { type: 'image/png' });
          if (blob.size <= 50 * 1024) {
            resolve(blob);
            return;
          }
        }
        resolve(null); // Could not compress below 50KB
      };
      img.onerror = () => resolve(null);
      img.src = URL.createObjectURL(file);
    });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setLogoMessage('이미지 파일만 업로드 가능합니다.');
      return;
    }

    setUploadingLogo(true);
    setLogoMessage('');

    try {
      const blob = await resizeAndCompress(file);
      if (!blob) {
        setLogoMessage('이미지를 50KB 이하로 압축할 수 없습니다.');
        return;
      }

      const formData = new FormData();
      formData.append('logo', blob, 'logo.png');

      const res = await fetch(`/api/super-admin/tenants/${id}/logo`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        setLogoMessage('로고가 업로드되었습니다.');
        setHasLogo(true);
        setLogoPreview(URL.createObjectURL(blob));
      } else {
        setLogoMessage(data.message || '업로드 실패');
      }
    } catch {
      setLogoMessage('서버 오류');
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleLogoDelete = async () => {
    if (!confirm('로고를 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/super-admin/tenants/${id}/logo`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        setLogoMessage('로고가 삭제되었습니다.');
        setHasLogo(false);
        setLogoPreview(null);
      } else {
        const data = await res.json();
        setLogoMessage(data.message || '삭제 실패');
      }
    } catch {
      setLogoMessage('서버 오류');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch(`/api/super-admin/tenants/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || '저장 실패');
        return;
      }
      setMessage('저장되었습니다.');
      setTenant(data.tenant);
    } catch {
      setError('서버 오류');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('이 테넌트를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
    try {
      const res = await fetch(`/api/super-admin/tenants/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message || '삭제 실패');
        return;
      }
      router.push('/super-admin/tenants');
    } catch {
      setError('서버 오류');
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-gray-500">로딩 중...</div>;
  }

  if (error && !tenant) {
    return <div className="py-12 text-center text-red-500">{error}</div>;
  }

  if (!tenant) return null;

  const statusLabels: Record<string, string> = {
    active: '활성',
    suspended: '정지',
    trial: '체험',
  };

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    suspended: 'bg-red-100 text-red-800',
    trial: 'bg-yellow-100 text-yellow-800',
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <button
            onClick={() => router.push('/super-admin/tenants')}
            className="text-sm text-gray-500 hover:text-gray-700 mb-1"
          >
            &larr; 테넌트 목록
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{tenant.name}</h1>
        </div>
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
            statusColors[tenant.status] || 'bg-gray-100 text-gray-800'
          }`}
        >
          {statusLabels[tenant.status] || tenant.status}
        </span>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}
      {message && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg">
          {message}
        </div>
      )}

      {/* Info Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">기본 정보</h2>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-gray-500">서브도메인</dt>
            <dd className="font-medium text-gray-900">
              {`${tenant.subdomain}.${process.env.NEXT_PUBLIC_SAAS_DOMAIN || 'keystonehr.app'}`}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">관리자 이메일</dt>
            <dd className="font-medium text-gray-900">{tenant.ownerEmail}</dd>
          </div>
          <div>
            <dt className="text-gray-500">사업자번호</dt>
            <dd className="font-medium text-gray-900">{tenant.bizNumber || '-'}</dd>
          </div>
          <div>
            <dt className="text-gray-500">직원 수</dt>
            <dd className="font-medium text-gray-900">
              {tenant.employeeCount ?? 0} / {tenant.maxEmployees}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">생성일</dt>
            <dd className="font-medium text-gray-900">
              {new Date(tenant.createdAt).toLocaleDateString('ko-KR')}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">결제일</dt>
            <dd className="font-medium text-gray-900">
              {tenant.paidAt ? new Date(tenant.paidAt).toLocaleDateString('ko-KR') : '-'}
            </dd>
          </div>
          {tenant.status === 'trial' && tenant.trialExpiresAt && (
            <div>
              <dt className="text-gray-500">체험 만료일</dt>
              <dd className={`font-medium ${new Date(tenant.trialExpiresAt) <= new Date() ? 'text-red-600' : 'text-yellow-600'}`}>
                {new Date(tenant.trialExpiresAt).toLocaleDateString('ko-KR')}
                {new Date(tenant.trialExpiresAt) <= new Date() && ' (만료됨)'}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* Logo Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">회사 로고</h2>
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 overflow-hidden shrink-0">
            {logoPreview ? (
              <img src={logoPreview} alt="로고" className="w-full h-full object-contain" />
            ) : (
              <span className="text-xs text-gray-400 text-center">로고 없음</span>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-sm text-gray-500">
              PNG/JPG 이미지를 업로드하면 자동으로 256x256 이하, 50KB 이하로 변환됩니다.
            </p>
            {logoMessage && (
              <p className={`text-sm ${logoMessage.includes('실패') || logoMessage.includes('오류') || logoMessage.includes('없습니다') ? 'text-red-600' : 'text-green-600'}`}>
                {logoMessage}
              </p>
            )}
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingLogo}
                className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {uploadingLogo ? '업로드 중...' : hasLogo ? '로고 변경' : '로고 업로드'}
              </button>
              {hasLogo && (
                <button
                  onClick={handleLogoDelete}
                  className="px-4 py-1.5 bg-red-50 text-red-600 text-sm font-medium rounded-lg hover:bg-red-100 transition"
                >
                  삭제
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Form */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">설정 변경</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">회사명</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">최대 직원 수</label>
            <input
              type="number"
              value={form.maxEmployees}
              onChange={(e) =>
                setForm((f) => ({ ...f, maxEmployees: parseInt(e.target.value) || 0 }))
              }
              min={1}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="active">활성</option>
              <option value="suspended">정지</option>
              <option value="trial">체험</option>
            </select>
          </div>
          {form.status === 'trial' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">체험 기간</label>
              <select
                value={form.trialExpiresAt ? '' : '14'}
                onChange={(e) => {
                  const days = parseInt(e.target.value);
                  const date = new Date();
                  date.setDate(date.getDate() + days);
                  setForm((f) => ({ ...f, trialExpiresAt: date.toISOString().split('T')[0] }));
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="7">7일</option>
                <option value="14">14일</option>
                <option value="30">30일</option>
                <option value="60">60일</option>
                <option value="90">90일</option>
              </select>
              {form.trialExpiresAt && (
                <p className="mt-1 text-xs text-yellow-600">
                  만료일: {new Date(form.trialExpiresAt).toLocaleDateString('ko-KR')} (자동 정지)
                </p>
              )}
            </div>
          )}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {saving ? '저장 중...' : '변경사항 저장'}
            </button>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-white rounded-xl border border-red-200 p-6">
        <h2 className="text-lg font-semibold text-red-700 mb-2">위험 구역</h2>
        <p className="text-sm text-gray-600 mb-4">
          테넌트를 삭제하면 모든 데이터가 영구적으로 삭제됩니다.
          상태가 &quot;정지&quot;인 테넌트만 삭제할 수 있습니다.
        </p>
        <button
          onClick={handleDelete}
          disabled={tenant.status !== 'suspended'}
          className="px-5 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          테넌트 삭제
        </button>
        {tenant.status !== 'suspended' && (
          <p className="mt-2 text-xs text-gray-400">삭제하려면 먼저 테넌트를 정지 상태로 변경하세요.</p>
        )}
      </div>
    </div>
  );
}
