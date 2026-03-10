"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { canAccessModule, type PermissionModule } from "@/lib/permissions";
import {
  Building2,
  Calendar,
  BarChart3,
  FileText,
  ClipboardList,
  Gift,
  Settings,
  Users,
  Shield,
  Clock,
  Link2,
  Wrench,
  X,
  Heart,
  ChevronDown,
  ChevronRight,
  AlarmClock,
  CalendarDays,
  ClockAlert,
  BookOpenText,
} from "lucide-react";

type RoleLevel = "ALL" | "ADMIN" | "DEPT_ADMIN_UP";

interface MenuItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  role: RoleLevel;
  permModule?: PermissionModule;
}

interface MenuGroup {
  group: string;
  icon: React.ComponentType<{ className?: string }>;
  items: MenuItem[];
}

const menuItems: MenuGroup[] = [
  {
    group: "근태관리",
    icon: Clock,
    items: [
      { label: "오늘 근무", href: "/attendance/clock", icon: AlarmClock, role: "ALL" },
      { label: "내 근태현황", href: "/attendance/my", icon: CalendarDays, role: "ALL" },
      { label: "연장근무 신청", href: "/attendance/overtime", icon: ClockAlert, role: "ALL" },
      { label: "연장근무 현황", href: "/attendance/overtime/requests", icon: FileText, role: "DEPT_ADMIN_UP", permModule: "overtime" },
    ],
  },
  {
    group: "휴가",
    icon: Calendar,
    items: [
      { label: "나의 휴가", href: "/leave/my", icon: Calendar, role: "ALL" },
      { label: "휴가사용현황", href: "/leave/usage", icon: BarChart3, role: "ALL" },
      { label: "휴가신청관리", href: "/leave/requests", icon: FileText, role: "DEPT_ADMIN_UP", permModule: "leave" },
      { label: "휴가관리대장", href: "/leave/register", icon: ClipboardList, role: "ADMIN", permModule: "leave" },
      { label: "휴가부여", href: "/leave/grant", icon: Gift, role: "ADMIN", permModule: "leave" },
    ],
  },
  {
    group: "복지",
    icon: Heart,
    items: [
      { label: "복지혜택", href: "/welfare", icon: Gift, role: "ALL" },
      { label: "복지신청내역", href: "/welfare/request", icon: FileText, role: "ALL" },
      { label: "복지관리", href: "/settings/welfare", icon: Settings, role: "ADMIN", permModule: "welfare" },
    ],
  },
  {
    group: "인사관리",
    icon: Users,
    items: [
      { label: "직원관리", href: "/settings/employees", icon: Users, role: "ADMIN", permModule: "employee" },
      { label: "부서관리", href: "/settings/departments", icon: Building2, role: "ADMIN", permModule: "department" },
      { label: "직급관리", href: "/settings/positions", icon: BarChart3, role: "ADMIN", permModule: "settings" },
    ],
  },
  {
    group: "규정/정책",
    icon: BookOpenText,
    items: [
      { label: "휴가규정 관리", href: "/settings/leave-policy", icon: FileText, role: "ADMIN", permModule: "leave" },
      { label: "공휴일 관리", href: "/settings/holidays", icon: Calendar, role: "ADMIN", permModule: "settings" },
      { label: "보상정책 설정", href: "/settings/compensation", icon: Clock, role: "ADMIN", permModule: "settings" },
      { label: "시간외근무 설정", href: "/settings/overtime", icon: Clock, role: "ADMIN", permModule: "overtime" },
    ],
  },
  {
    group: "설정",
    icon: Settings,
    items: [
      { label: "관리자 콘솔", href: "/admin", icon: Wrench, role: "ADMIN" },
      { label: "회사 정보", href: "/settings/company", icon: Building2, role: "ADMIN", permModule: "settings" },
      { label: "권한/결재선 설정", href: "/settings/approval", icon: Shield, role: "ADMIN", permModule: "approval" },
      { label: "외부서비스 연동", href: "/settings/integration", icon: Link2, role: "ADMIN", permModule: "settings" },
    ],
  },
];

const ADMIN_ROLES = ["SYSTEM_ADMIN", "COMPANY_ADMIN"];
const DEPT_ADMIN_UP_ROLES = ["SYSTEM_ADMIN", "COMPANY_ADMIN", "DEPT_ADMIN"];

function canSee(role: string, required: RoleLevel, customPerms: string | null, permModule?: PermissionModule): boolean {
  if (required === "ALL") return true;
  if (ADMIN_ROLES.includes(role)) return true;
  if (required === "DEPT_ADMIN_UP" && DEPT_ADMIN_UP_ROLES.includes(role)) return true;

  // Check custom permissions for non-admin users
  if (permModule && customPerms) {
    return canAccessModule(role, customPerms, permModule);
  }

  return false;
}

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [userRole, setUserRole] = useState<string>("BASIC");
  const [customPermissions, setCustomPermissions] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => {
        if (res.status === 401) { window.location.href = '/login'; return null; }
        return res.ok ? res.json() : null;
      })
      .then((data) => {
        if (data?.user?.role) setUserRole(data.user.role);
        if (data?.user?.customPermissions) setCustomPermissions(data.user.customPermissions);
      })
      .catch(() => {});
  }, []);

  // Initialize open groups from localStorage + auto-expand active group
  useEffect(() => {
    const saved = localStorage.getItem("sidebar-groups");
    const initial: Record<string, boolean> = saved ? JSON.parse(saved) : {};

    // Auto-expand group containing current path
    menuItems.forEach((group) => {
      if (group.items.some((item) => pathname.startsWith(item.href))) {
        initial[group.group] = true;
      }
    });

    setOpenGroups(initial);
  }, [pathname]);

  // Toggle handler
  const toggleGroup = (groupName: string) => {
    setOpenGroups((prev) => {
      const next = { ...prev, [groupName]: !prev[groupName] };
      localStorage.setItem("sidebar-groups", JSON.stringify(next));
      return next;
    });
  };

  // Close sidebar on mobile when navigating
  useEffect(() => {
    onClose?.();
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const navContent = (
    <nav className="p-4 space-y-1">
      {menuItems.map((group) => {
        const visibleItems = group.items.filter((item) =>
          canSee(userRole, item.role, customPermissions, item.permModule)
        );
        if (visibleItems.length === 0) return null;

        const isOpen = openGroups[group.group];
        const hasActivePath = visibleItems.some(
          (item) => pathname === item.href || pathname.startsWith(item.href + "/")
        );

        return (
          <div
            key={group.group}
            className={cn(
              "rounded-lg transition-all duration-200",
              isOpen
                ? "bg-slate-50/80 shadow-sm ring-1 ring-slate-200/60 mb-1.5"
                : "mb-0.5"
            )}
          >
            <button
              onClick={() => toggleGroup(group.group)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold uppercase tracking-wider rounded-lg transition-all duration-150",
                isOpen
                  ? "text-blue-700 bg-blue-50/60"
                  : hasActivePath
                    ? "text-blue-600 hover:bg-blue-50/60"
                    : "text-gray-400 hover:bg-gray-50 hover:text-gray-600"
              )}
            >
              <div className="flex items-center gap-2">
                <group.icon className={cn(
                  "w-3.5 h-3.5 transition-colors",
                  isOpen ? "text-blue-600" : hasActivePath ? "text-blue-500" : "text-gray-400"
                )} />
                {group.group}
              </div>
              <ChevronDown className={cn(
                "w-3.5 h-3.5 transition-transform duration-200",
                isOpen ? "rotate-0" : "-rotate-90"
              )} />
            </button>
            <div
              className={cn(
                "overflow-hidden transition-all duration-200",
                isOpen
                  ? "max-h-96 opacity-100"
                  : "max-h-0 opacity-0"
              )}
            >
              <ul className="pb-2 px-1 space-y-0.5">
                {visibleItems.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center gap-2.5 pl-5 pr-3 py-2 text-sm rounded-md transition-all duration-150 ml-2 border-l-2",
                          isActive
                            ? "bg-blue-100/70 text-blue-700 font-medium border-blue-500"
                            : "text-gray-600 border-transparent hover:bg-white hover:text-blue-700 hover:border-blue-300"
                        )}
                      >
                        <item.icon className={cn(
                          "w-4 h-4 shrink-0",
                          isActive ? "text-blue-600" : "text-gray-400"
                        )} />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-14 h-[calc(100vh-3.5rem)] bg-white border-r border-gray-200 overflow-y-auto z-40 transition-transform duration-200",
          "w-60",
          "lg:left-0 lg:translate-x-0",
          open ? "left-0 translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Mobile close button */}
        <div className="flex items-center justify-end p-2 lg:hidden">
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {navContent}
      </aside>
    </>
  );
}
