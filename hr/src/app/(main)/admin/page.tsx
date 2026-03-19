"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Users,
  Shield,
  FileText,
  Clock,
  Settings,
  Building2,
  CalendarDays,
  ClipboardList,
  ArrowRight,
  AlertCircle,
  Database,
  Download,
  BarChart3,
  Loader2,
} from "lucide-react";

interface AdminStats {
  totalEmployees: number;
  activeEmployees: number;
  totalDepartments: number;
  pendingRequests: number;
  approvedThisMonth: number;
  totalLeaveTypes: number;
}

const ADMIN_ROLES = ["SYSTEM_ADMIN", "COMPANY_ADMIN"];

export default function AdminPage() {
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [userRole, setUserRole] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const meRes = await fetch("/api/auth/me");
        if (meRes.status === 401) {
          window.location.href = '/login';
          return;
        }
        if (meRes.ok) {
          const meData = await meRes.json();
          setUserRole(meData.user?.role || "");
          if (!ADMIN_ROLES.includes(meData.user?.role)) {
            router.replace("/dashboard");
            return;
          }
        }

        const setupRes = await fetch("/api/setup/status");
        if (setupRes.ok) {
          const setupData = await setupRes.json();
          setCompanyName(setupData.companyName || "");
        }

        const [empRes, deptRes, leaveRes] = await Promise.all([
          fetch("/api/employees?limit=1"),
          fetch("/api/departments"),
          fetch("/api/leave/register?limit=1&status=PENDING"),
        ]);

        const empData = empRes.ok ? await empRes.json() : null;
        const deptData = deptRes.ok ? await deptRes.json() : null;
        const leaveData = leaveRes.ok ? await leaveRes.json() : null;

        setStats({
          totalEmployees: empData?.total || 0,
          activeEmployees: empData?.total || 0,
          totalDepartments: deptData?.allDepartments?.length || deptData?.departments?.length || 0,
          pendingRequests: leaveData?.total || 0,
          approvedThisMonth: 0,
          totalLeaveTypes: 0,
        });
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        불러오는 중...
      </div>
    );
  }

  if (!ADMIN_ROLES.includes(userRole)) {
    return null;
  }

  const managementItems = [
    {
      title: "회사 정보",
      description: "회사명, 사업자번호, 대표자, 근무 시간 설정",
      icon: Building2,
      href: "/settings/company",
      color: "text-slate-600",
      bg: "bg-slate-50",
      stat: companyName || "설정 필요",
    },
    {
      title: "직원관리",
      description: "직원 등록/수정/퇴사처리, 엑셀 가져오기/내보내기",
      icon: Users,
      href: "/settings/employees",
      color: "text-blue-600",
      bg: "bg-blue-50",
      stat: stats ? `${stats.totalEmployees}명 등록` : "",
    },
    {
      title: "부서관리",
      description: "부서 추가/수정/삭제, 계층 구조 관리",
      icon: Building2,
      href: "/settings/departments",
      color: "text-teal-600",
      bg: "bg-teal-50",
      stat: stats ? `${stats.totalDepartments}개 부서` : "",
    },
    {
      title: "직급관리",
      description: "직급 추가/수정/삭제, 레벨 관리",
      icon: BarChart3,
      href: "/settings/positions",
      color: "text-indigo-600",
      bg: "bg-indigo-50",
      stat: "직급 관리",
    },
    {
      title: "결재선 설정",
      description: "결재선 템플릿 관리, 직원별 권한/역할 설정",
      icon: Shield,
      href: "/settings/approval",
      color: "text-purple-600",
      bg: "bg-purple-50",
      stat: "결재선 관리",
    },
    {
      title: "휴가규정 관리",
      description: "연차 부여 규정, 휴가유형 추가/수정",
      icon: FileText,
      href: "/settings/leave-policy",
      color: "text-green-600",
      bg: "bg-green-50",
      stat: "근로기준법 기반",
    },
    {
      title: "시간외근무 설정",
      description: "주/월 최대시간, 수당 배율, 야간근무 시간대 설정",
      icon: Clock,
      href: "/settings/overtime",
      color: "text-orange-600",
      bg: "bg-orange-50",
      stat: "정책 설정",
    },
  ];

  const operationItems = [
    {
      title: "휴가신청 관리",
      description: "결재 대기 건 승인/반려 처리",
      icon: ClipboardList,
      href: "/leave/requests",
      color: "text-orange-600",
      bg: "bg-orange-50",
      badge: stats?.pendingRequests
        ? `${stats.pendingRequests}건 대기`
        : null,
    },
    {
      title: "휴가관리대장",
      description: "전체 휴가 기록 조회, 엑셀 다운로드",
      icon: CalendarDays,
      href: "/leave/register",
      color: "text-blue-600",
      bg: "bg-blue-50",
      badge: null,
    },
    {
      title: "휴가부여",
      description: "직원별 수동 연차 부여/조정",
      icon: CalendarDays,
      href: "/leave/grant",
      color: "text-green-600",
      bg: "bg-green-50",
      badge: null,
    },
    {
      title: "휴가사용 현황",
      description: "부서/전사 직원 연차 사용 현황 조회",
      icon: Building2,
      href: "/leave/usage",
      color: "text-teal-600",
      bg: "bg-teal-50",
      badge: null,
    },
  ];

  return (
    <div className="max-w-6xl">
      {/* Page Header */}
      <div className="flex items-center gap-3 mb-6 sm:mb-8">
        <Settings className="w-7 h-7 text-blue-600" />
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">관리자 콘솔</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {companyName || "회사"} KeystoneHR 관리
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <Link href="/settings/employees">
          <Card className="hover:shadow-md hover:border-blue-200 transition-all cursor-pointer h-full active:scale-[0.98]">
            <CardContent className="p-3 sm:pt-4 sm:pb-4 sm:px-6">
              <div className="flex items-center justify-between">
                <div className="text-xs sm:text-sm text-gray-500">전체 직원</div>
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-lg sm:text-2xl font-bold mt-1">{stats?.totalEmployees || 0}명</div>
              <div className="text-[10px] sm:text-xs text-gray-400 mt-1">직원관리 &rarr;</div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/settings/departments">
          <Card className="hover:shadow-md hover:border-blue-200 transition-all cursor-pointer h-full active:scale-[0.98]">
            <CardContent className="p-3 sm:pt-4 sm:pb-4 sm:px-6">
              <div className="flex items-center justify-between">
                <div className="text-xs sm:text-sm text-gray-500">부서</div>
                <Building2 className="w-5 h-5 text-teal-600" />
              </div>
              <div className="text-lg sm:text-2xl font-bold mt-1">{stats?.totalDepartments || 0}개</div>
              <div className="text-[10px] sm:text-xs text-gray-400 mt-1">부서관리 &rarr;</div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/leave/requests">
          <Card className="hover:shadow-md hover:border-orange-200 transition-all cursor-pointer h-full active:scale-[0.98]">
            <CardContent className="p-3 sm:pt-4 sm:pb-4 sm:px-6">
              <div className="flex items-center justify-between">
                <div className="text-xs sm:text-sm text-gray-500">결재 대기</div>
                <ClipboardList className="w-5 h-5 text-orange-600" />
              </div>
              <div className="text-lg sm:text-2xl font-bold mt-1 text-orange-600">
                {stats?.pendingRequests || 0}건
              </div>
              <div className="text-[10px] sm:text-xs text-gray-400 mt-1">결재처리 &rarr;</div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/settings/overtime">
          <Card className="hover:shadow-md hover:border-green-200 transition-all cursor-pointer h-full active:scale-[0.98]">
            <CardContent className="p-3 sm:pt-4 sm:pb-4 sm:px-6">
              <div className="flex items-center justify-between">
                <div className="text-xs sm:text-sm text-gray-500">시스템 상태</div>
                <Settings className="w-5 h-5 text-green-600" />
              </div>
              <div className="mt-1">
                <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs">
                  정상 운영중
                </Badge>
              </div>
              <div className="text-[10px] sm:text-xs text-gray-400 mt-1">시스템설정 &rarr;</div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Initial Setup Guide */}
      {stats && stats.totalEmployees <= 1 && (
        <Alert className="mb-6 border-blue-200 bg-blue-50">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            <strong>시스템 초기 설정이 필요합니다.</strong> 아래 순서로 진행하세요:
            <ol className="mt-2 ml-4 list-decimal space-y-1 text-sm">
              <li>
                <Link href="/settings/employees" className="underline font-medium">
                  직원관리
                </Link>
                에서 직원을 등록하세요 (엑셀 일괄 등록 가능)
              </li>
              <li>
                <Link href="/settings/approval" className="underline font-medium">
                  결재선 설정
                </Link>
                에서 결재 흐름을 설정하세요
              </li>
              <li>
                <Link href="/settings/leave-policy" className="underline font-medium">
                  휴가규정
                </Link>
                을 확인하고 필요시 수정하세요
              </li>
              <li>
                <Link href="/leave/grant" className="underline font-medium">
                  휴가부여
                </Link>
                에서 기존 직원의 연차를 부여하세요
              </li>
            </ol>
          </AlertDescription>
        </Alert>
      )}

      {/* System Settings */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-gray-600" />
          시스템 설정
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {managementItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <Card className="hover:shadow-md hover:border-blue-200 transition-all cursor-pointer h-full">
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-start gap-4">
                    <item.icon className={`w-6 h-6 ${item.color} shrink-0 mt-0.5`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">{item.title}</h3>
                        <ArrowRight className="w-4 h-4 text-gray-400 shrink-0" />
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {item.description}
                      </p>
                      {item.stat && (
                        <span className="text-xs text-gray-400 mt-2 inline-block">
                          {item.stat}
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Operations */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-gray-600" />
          운영 관리
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {operationItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <Card className="hover:shadow-md hover:border-blue-200 transition-all cursor-pointer h-full">
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-center gap-4">
                    <item.icon className={`w-6 h-6 ${item.color} shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium">{item.title}</h3>
                      <p className="text-sm text-gray-500">{item.description}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {item.badge && (
                        <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">
                          {item.badge}
                        </Badge>
                      )}
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Data Management */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Database className="w-5 h-5 text-gray-600" />
          데이터 관리
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-3">
                <Download className="w-6 h-6 text-blue-600 shrink-0" />
                <div>
                  <h3 className="font-medium">직원 데이터 내보내기</h3>
                  <p className="text-xs text-gray-500">엑셀 파일로 다운로드</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full"
                onClick={async () => {
                  const res = await fetch("/api/employees/export");
                  if (!res.ok) return;
                  const blob = await res.blob();
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `employees_${new Date().toISOString().split("T")[0]}.csv`;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  window.URL.revokeObjectURL(url);
                }}
              >
                직원 목록 다운로드
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-3">
                <Download className="w-6 h-6 text-green-600 shrink-0" />
                <div>
                  <h3 className="font-medium">휴가 데이터 내보내기</h3>
                  <p className="text-xs text-gray-500">엑셀 파일로 다운로드</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full"
                onClick={async () => {
                  const res = await fetch("/api/leave/export");
                  if (!res.ok) return;
                  const blob = await res.blob();
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `leave_${new Date().toISOString().split("T")[0]}.csv`;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  window.URL.revokeObjectURL(url);
                }}
              >
                휴가 내역 다운로드
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
