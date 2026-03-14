'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CreateTenantPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    subdomain: '',
    plan: 'standard',
    ownerEmail: '',
    adminPassword: '',
    adminName: '',
    bizNumber: '',
    maxEmployees: 50,
    status: 'active' as string,
    trialDays: 7,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === 'maxEmployees' ? parseInt(value) || 0 : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/super-admin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...form,
          trialExpiresAt: form.status === 'trial'
            ? new Date(Date.now() + form.trialDays * 86400000).toISOString()
            : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || '테넌트 생성에 실패했습니다.');
        return;
      }

      router.push(`/super-admin/tenants/${data.tenant.id}`);
    } catch {
      setError('서버 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">새 테넌트 생성</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">회사명 *</label>
          <input
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="예: 주식회사 테스트"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">서브도메인 *</label>
          <div className="flex items-center">
            <input
              type="text"
              name="subdomain"
              value={form.subdomain}
              onChange={(e) => {
                const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                setForm((prev) => ({ ...prev, subdomain: value }));
              }}
              required
              className="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="company-name"
            />
            <span className="px-3 py-2 bg-gray-100 border border-l-0 border-gray-300 rounded-r-lg text-sm text-gray-500">
              .keystonehr.app
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-400">영문 소문자, 숫자, 하이픈만 사용 가능</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">관리자 이메일 *</label>
          <input
            type="email"
            name="ownerEmail"
            value={form.ownerEmail}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="admin@company.com"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">관리자 이름</label>
            <input
              type="text"
              name="adminName"
              value={form.adminName}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="관리자 (미입력 시 기본값)"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">관리자 비밀번호 *</label>
            <input
              type="password"
              name="adminPassword"
              value={form.adminPassword}
              onChange={handleChange}
              required
              minLength={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="8자 이상"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">최대 직원 수</label>
          <input
            type="number"
            name="maxEmployees"
            value={form.maxEmployees}
            onChange={handleChange}
            min={1}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-gray-400">기본값 50명 (필요 시 변경 가능)</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">초기 상태</label>
            <select
              name="status"
              value={form.status}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="active">활성</option>
              <option value="trial">체험</option>
            </select>
          </div>
          {form.status === 'trial' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">체험 기간</label>
              <select
                value={form.trialDays}
                onChange={(e) => setForm((prev) => ({ ...prev, trialDays: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={7}>7일</option>
                <option value={14}>14일</option>
                <option value={30}>30일</option>
                <option value={60}>60일</option>
                <option value={90}>90일</option>
              </select>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">사업자번호</label>
          <input
            type="text"
            name="bizNumber"
            value={form.bizNumber}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="000-00-00000"
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? '생성 중...' : '테넌트 생성'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition"
          >
            취소
          </button>
        </div>
      </form>
    </div>
  );
}
