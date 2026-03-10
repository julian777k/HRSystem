'use client';

import { useEffect, useState } from 'react';

interface Stats {
  totalTenants: number;
  tenantsByStatus: Record<string, number>;
  recentSignups: Array<{
    id: string;
    name: string;
    subdomain: string;
    ownerEmail: string;
    status: string;
    createdAt: string;
  }>;
}

export default function SuperAdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/super-admin/stats', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch stats');
      const data = await res.json();
      setStats(data);
    } catch {
      setError('통계를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-red-500">{error || '데이터를 불러올 수 없습니다.'}</div>
      </div>
    );
  }

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
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">대시보드</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-sm text-gray-500 mb-1">전체 테넌트</div>
          <div className="text-3xl font-bold text-gray-900">{stats.totalTenants}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-sm text-gray-500 mb-1">활성 테넌트</div>
          <div className="text-3xl font-bold text-green-600">{stats.tenantsByStatus['active'] || 0}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-sm text-gray-500 mb-1">최근 7일 가입</div>
          <div className="text-3xl font-bold text-purple-600">{stats.recentSignups.length}</div>
        </div>
      </div>

      {/* Tenants by Status */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">상태별 테넌트</h2>
        <div className="space-y-3">
          {Object.entries(stats.tenantsByStatus).length > 0 ? (
            Object.entries(stats.tenantsByStatus).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[status] || 'bg-gray-100 text-gray-800'}`}>
                  {statusLabels[status] || status}
                </span>
                <div className="flex items-center gap-3">
                  <div className="w-32 bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-slate-600 h-2 rounded-full"
                      style={{ width: `${Math.min((count / stats.totalTenants) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-900 w-8 text-right">{count}</span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-400">데이터가 없습니다.</p>
          )}
        </div>
      </div>

      {/* Recent Signups */}
      <div className="mt-6 bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">최근 가입 테넌트 (7일)</h2>
        {stats.recentSignups.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-2 text-gray-500 font-medium">회사명</th>
                  <th className="text-left py-3 px-2 text-gray-500 font-medium">서브도메인</th>
                  <th className="text-left py-3 px-2 text-gray-500 font-medium">상태</th>
                  <th className="text-left py-3 px-2 text-gray-500 font-medium">가입일</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentSignups.map((tenant) => (
                  <tr key={tenant.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 px-2 font-medium text-gray-900">{tenant.name}</td>
                    <td className="py-3 px-2 text-gray-600">{tenant.subdomain}</td>
                    <td className="py-3 px-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[tenant.status] || 'bg-gray-100 text-gray-800'}`}>
                        {statusLabels[tenant.status] || tenant.status}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-gray-600">
                      {new Date(tenant.createdAt).toLocaleDateString('ko-KR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-400 py-4">최근 7일 이내 가입한 테넌트가 없습니다.</p>
        )}
      </div>
    </div>
  );
}
