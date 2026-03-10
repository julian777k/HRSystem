'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  plan: string;
  status: string;
  maxEmployees: number;
  ownerEmail: string;
  createdAt: string;
  _count?: { employees: number };
  employeeCount?: number;
}

export default function TenantsListPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  useEffect(() => {
    fetchTenants();
  }, [page, statusFilter]);

  const fetchTenants = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`/api/super-admin/tenants?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setTenants(data.tenants || []);
      setTotal(data.total || 0);
    } catch {
      setTenants([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchTenants();
  };

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

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">테넌트 관리</h1>
        <Link
          href="/super-admin/tenants/create"
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
        >
          새 테넌트 생성
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">검색</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="회사명, 서브도메인 검색..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">상태</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">전체</option>
              <option value="active">활성</option>
              <option value="suspended">정지</option>
              <option value="trial">체험</option>
            </select>
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition"
          >
            검색
          </button>
        </form>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-gray-500">로딩 중...</div>
        ) : tenants.length === 0 ? (
          <div className="py-12 text-center text-gray-400">테넌트가 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">회사명</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">서브도메인</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">상태</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">직원 수</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">생성일</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((tenant) => (
                  <tr key={tenant.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <Link
                        href={`/super-admin/tenants/${tenant.id}`}
                        className="font-medium text-blue-600 hover:text-blue-800"
                      >
                        {tenant.name}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-gray-600">{tenant.subdomain}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          statusColors[tenant.status] || 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {statusLabels[tenant.status] || tenant.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {tenant.employeeCount ?? tenant._count?.employees ?? 0} / {tenant.maxEmployees}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {new Date(tenant.createdAt).toLocaleDateString('ko-KR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <div className="text-sm text-gray-500">
              총 {total}개 중 {(page - 1) * limit + 1}-{Math.min(page * limit, total)}
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50"
              >
                이전
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50"
              >
                다음
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
