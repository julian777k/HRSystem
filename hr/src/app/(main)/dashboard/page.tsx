"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CalendarDays,
  ClipboardCheck,
  Users,
  Clock,
  ArrowRight,
  Plus,
  Wallet,
  Heart,
  AlarmClock,
  LayoutDashboard,
  Loader2,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
} from "lucide-react";

interface UserInfo {
  name: string;
  role: string;
  positionName: string;
  departmentName: string;
}

interface PendingItem {
  id: string;
  stepOrder: number;
  createdAt: string;
  leaveRequest?: {
    employee: { name: string; employeeNumber: string };
    leaveType: { name: string };
    startDate: string;
    endDate: string;
    requestDays: number;
  } | null;
  overtime?: {
    employee: { name: string; employeeNumber: string };
    date: string;
    hours: number;
    reason: string;
  } | null;
}

interface TimeWalletData {
  compTime: { earned: number; used: number; remain: number };
  annual: { earned: number; used: number; remain: number };
  totalRemainHours: number;
  totalRemainDays: number;
  dailyWorkHours: number;
  halfDayHours: number;
}

interface PendingWelfareItem {
  id: string;
  createdAt: string;
  employee: { name: string; employeeNumber: string };
  item: { name: string; category: { name: string } };
}

interface TodayAttendance {
  clockIn: string | null;
  clockOut: string | null;
  workHours: number | null;
  overtimeHours?: number | null;
  status: 'NOT_CLOCKED_IN' | 'CLOCKED_IN' | 'CLOCKED_OUT' | 'DAY_OFF';
  isWorkday?: boolean;
}

interface DashboardData {
  leaveBalance: number;
  leaveBalancesByType?: Record<string, { granted: number; used: number; remain: number }>;
  pendingApprovals: number;
  pendingWelfareCount?: number;
  pendingWelfareItems?: PendingWelfareItem[];
  deptMembers: number;
  monthlyOvertime: number;
  pendingItems: PendingItem[];
  timeWallet?: TimeWalletData;
  todayAttendance?: TodayAttendance;
}

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  PENDING: {
    label: "대기",
    className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
  },
  IN_PROGRESS: {
    label: "진행중",
    className: "bg-blue-100 text-blue-800 hover:bg-blue-100",
  },
  APPROVED: {
    label: "승인",
    className: "bg-green-100 text-green-800 hover:bg-green-100",
  },
  REJECTED: {
    label: "반려",
    className: "bg-red-100 text-red-800 hover:bg-red-100",
  },
  CANCELLED: {
    label: "취소",
    className: "bg-gray-100 text-gray-800 hover:bg-gray-100",
  },
};

const ADMIN_ROLES = ["SYSTEM_ADMIN", "COMPANY_ADMIN"];

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTimeWallet, setShowTimeWallet] = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [userRes, dashRes] = await Promise.all([
          fetch("/api/auth/me"),
          fetch("/api/dashboard"),
        ]);

        if (userRes.status === 401) {
          window.location.href = '/login';
          return;
        }

        if (userRes.ok) {
          const userData = await userRes.json();
          if (userData?.user) setUser(userData.user);
        }

        if (dashRes.ok) {
          const dashData = await dashRes.json();
          setData(dashData);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  const formatDate = (dateStr: string) => {
    return dateStr ? dateStr.split("T")[0] : "-";
  };

  const isAdmin = user && ADMIN_ROLES.includes(user.role);

  const formatTime = (isoStr: string | null | undefined) => {
    if (!isoStr) return '-';
    const d = new Date(isoStr);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const attendanceStatus = data?.todayAttendance?.status;
  const att = data?.todayAttendance;
  const overtimeText = att?.overtimeHours ? ` +${att.overtimeHours}h 연장` : '';
  const attendanceValue = attendanceStatus === 'DAY_OFF'
    ? '휴무일'
    : attendanceStatus === 'CLOCKED_OUT'
      ? `${att?.workHours ?? 0}시간${overtimeText}`
      : attendanceStatus === 'CLOCKED_IN'
        ? `근무중 (${formatTime(att?.clockIn)}~)`
        : '미출근';
  const attendanceDesc = attendanceStatus === 'DAY_OFF'
    ? '주말 또는 공휴일'
    : attendanceStatus === 'CLOCKED_OUT'
      ? `${formatTime(att?.clockIn)} ~ ${formatTime(att?.clockOut)}`
      : attendanceStatus === 'CLOCKED_IN'
        ? `${formatTime(att?.clockIn)} 출근`
        : '출근 기록 없음';
  const attendanceColor = attendanceStatus === 'DAY_OFF'
    ? "text-gray-400"
    : attendanceStatus === 'CLOCKED_OUT'
      ? "text-blue-600"
      : attendanceStatus === 'CLOCKED_IN'
        ? "text-emerald-600"
        : "text-gray-600";
  const attendanceBg = attendanceStatus === 'DAY_OFF'
    ? "bg-gray-50"
    : attendanceStatus === 'CLOCKED_OUT'
      ? "bg-blue-50"
      : attendanceStatus === 'CLOCKED_IN'
        ? "bg-emerald-50"
        : "bg-gray-50";

  const summaryCards = [
    {
      title: "오늘 근태",
      value: attendanceValue,
      description: attendanceDesc,
      icon: AlarmClock,
      color: attendanceColor,
      bg: attendanceBg,
      href: "/attendance/clock",
    },
    {
      title: "잔여 휴가",
      value: data ? `${data.leaveBalance}일` : "-",
      description: data?.leaveBalancesByType && Object.keys(data.leaveBalancesByType).length > 0
        ? Object.entries(data.leaveBalancesByType).map(([code, b]) => {
            const names: Record<string, string> = { ANNUAL: '연차', SICK: '병가', FAMILY: '경조', PUBLIC: '공가', MATERNITY: '출산', PATERNITY: '배우자출산' };
            return `${names[code] || code} ${b.remain}일`;
          }).join(' / ')
        : "올해 남은 휴가 일수",
      icon: CalendarDays,
      color: "text-blue-600",
      bg: "bg-blue-50",
      href: "/leave/my",
    },
    {
      title: "결재 대기",
      value: data ? `${data.pendingApprovals}건` : "-",
      description: data?.pendingWelfareCount ? `복지 ${data.pendingWelfareCount}건 별도 대기` : "처리 대기중인 결재",
      icon: ClipboardCheck,
      color: "text-orange-600",
      bg: "bg-orange-50",
      href: "/leave/requests",
    },
    {
      title: "부서 인원",
      value: data ? `${data.deptMembers}명` : "-",
      description: "소속 부서 재직 인원",
      icon: Users,
      color: "text-green-600",
      bg: "bg-green-50",
      href: isAdmin ? "/settings/employees" : "/leave/usage",
    },
    {
      title: "이번 달 시간외근무",
      value: data ? `${data.monthlyOvertime}시간` : "-",
      description: "승인된 시간외근무",
      icon: Clock,
      color: "text-purple-600",
      bg: "bg-purple-50",
      href: "/settings/overtime",
    },
  ];

  return (
    <div>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 sm:mb-8">
        <div className="flex items-center gap-3">
          <LayoutDashboard className="w-7 h-7 text-blue-600" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              {user ? `${user.name}님, 환영합니다!` : "대시보드"}
            </h1>
            {user && (
              <p className="text-sm text-gray-500 mt-0.5">
                {user.departmentName} · {user.positionName}
              </p>
            )}
          </div>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 sm:flex-none"
              onClick={() => router.push("/settings/employees")}
            >
              <Users className="w-4 h-4 mr-1" />
              직원관리
            </Button>
            <Button
              size="sm"
              className="flex-1 sm:flex-none"
              onClick={() => router.push("/leave/my")}
            >
              <Plus className="w-4 h-4 mr-1" />
              휴가신청
            </Button>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {summaryCards.map((card) => (
          <Link key={card.title} href={card.href}>
            <Card className="cursor-pointer hover:shadow-md transition-shadow hover:border-blue-200 active:scale-[0.98]">
              <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 p-3 sm:p-6">
                <CardTitle className="text-xs sm:text-sm font-medium text-gray-600">
                  {card.title}
                </CardTitle>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                <div className="text-lg sm:text-2xl font-bold">
                  {loading ? "-" : card.value}
                </div>
                <p className="text-[10px] sm:text-xs text-gray-500 mt-1 line-clamp-2">{card.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Time Wallet Section (collapsible, default closed) */}
      {data?.timeWallet && (data.timeWallet.compTime.earned > 0 || data.timeWallet.annual.earned > 0) && (
        <div className="mb-6 sm:mb-8">
          <button
            onClick={() => setShowTimeWallet(!showTimeWallet)}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            {showTimeWallet ? <ChevronDown className="w-4 h-4" /> : <ChevronRightIcon className="w-4 h-4" />}
            <Wallet className="w-4 h-4 text-indigo-600" />
            시간 지갑 잔액
            <span className="text-xs text-indigo-600 font-medium">{data.timeWallet.totalRemainHours}h</span>
          </button>
          {showTimeWallet && (
            <Card className="mt-2">
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">보상시간 잔액</p>
                    <p className="text-lg font-bold text-indigo-600">{data.timeWallet.compTime.remain}h</p>
                    <p className="text-xs text-gray-400">적립 {data.timeWallet.compTime.earned}h / 사용 {data.timeWallet.compTime.used}h</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">연차시간 잔액</p>
                    <p className="text-lg font-bold text-blue-600">{data.timeWallet.annual.remain}h</p>
                    <p className="text-xs text-gray-400">부여 {data.timeWallet.annual.earned}h / 사용 {data.timeWallet.annual.used}h</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">총 잔여 시간</p>
                    <p className="text-lg font-bold">{data.timeWallet.totalRemainHours}h</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">총 잔여 일수</p>
                    <p className="text-lg font-bold">{data.timeWallet.totalRemainDays}일</p>
                    <p className="text-xs text-gray-400">1일 = {data.timeWallet.dailyWorkHours}시간</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Pending Approvals (full-width) */}
      <div>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">결재 대기 항목</CardTitle>
            <Link
              href="/leave/requests"
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              결재하기 <ArrowRight className="w-3 h-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12 text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                불러오는 중...
              </div>
            ) : !data?.pendingItems?.length && !data?.pendingWelfareItems?.length ? (
              <div className="text-center py-12">
                <ClipboardCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-400">대기중인 결재가 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data?.pendingItems?.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => router.push("/leave/requests")}
                  >
                    <div>
                      {item.leaveRequest ? (
                        <>
                          <p className="font-medium text-sm">
                            {item.leaveRequest.employee.name} -{" "}
                            {item.leaveRequest.leaveType.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatDate(item.leaveRequest.startDate)} ~{" "}
                            {formatDate(item.leaveRequest.endDate)} (
                            {item.leaveRequest.requestDays}일)
                          </p>
                        </>
                      ) : item.overtime ? (
                        <>
                          <p className="font-medium text-sm">
                            {item.overtime.employee.name} - 시간외근무
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatDate(item.overtime.date)} ·{" "}
                            {item.overtime.hours}시간
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-gray-500">알 수 없는 항목</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
                      >
                        대기
                      </Badge>
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                ))}
                {data?.pendingWelfareItems?.map((wItem) => (
                  <div
                    key={`welfare-${wItem.id}`}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => router.push("/welfare/request")}
                  >
                    <div className="flex items-center gap-2">
                      <Heart className="w-4 h-4 text-purple-500 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-sm">
                          {wItem.employee.name} - {wItem.item.category.name}/{wItem.item.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatDate(wItem.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className="bg-purple-100 text-purple-800 hover:bg-purple-100"
                      >
                        복지
                      </Badge>
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
