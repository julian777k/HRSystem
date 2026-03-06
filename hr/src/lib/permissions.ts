// Permission modules and capabilities for custom admin permissions

export const PERMISSION_MODULES = {
  leave: '휴가',
  welfare: '복지',
  overtime: '시간외근무',
  employee: '직원관리',
  department: '부서관리',
  approval: '결재선',
  settings: '시스템설정',
} as const;

export type PermissionModule = keyof typeof PERMISSION_MODULES;
export type Capability = 'view' | 'manage' | 'approve';

export const CAPABILITIES: { key: Capability; label: string }[] = [
  { key: 'view', label: '조회' },
  { key: 'manage', label: '관리' },
  { key: 'approve', label: '승인' },
];

export type CustomPermissions = Partial<Record<PermissionModule, Capability[]>>;

const ADMIN_ROLES = ['SYSTEM_ADMIN', 'COMPANY_ADMIN'];

export function parsePermissions(jsonStr: string | null | undefined): CustomPermissions {
  if (!jsonStr) return {};
  try {
    return JSON.parse(jsonStr) as CustomPermissions;
  } catch {
    return {};
  }
}

export function serializePermissions(perms: CustomPermissions): string {
  return JSON.stringify(perms);
}

/**
 * Check if a user has a specific permission.
 * SYSTEM_ADMIN and COMPANY_ADMIN always have all permissions.
 * DEPT_ADMIN has leave.view, leave.approve by default.
 * BASIC users only get permissions from customPermissions.
 */
export function hasPermission(
  role: string,
  customPerms: string | null | undefined,
  module: PermissionModule,
  capability: Capability
): boolean {
  // System admins have all permissions
  if (ADMIN_ROLES.includes(role)) return true;

  // Check custom permissions
  const parsed = parsePermissions(customPerms);
  const moduleCaps = parsed[module];
  if (moduleCaps && moduleCaps.includes(capability)) return true;

  // DEPT_ADMIN default permissions
  if (role === 'DEPT_ADMIN') {
    if (module === 'leave' && (capability === 'view' || capability === 'approve')) return true;
  }

  return false;
}

/**
 * Check if user can see a sidebar menu item based on permission module.
 */
export function canAccessModule(
  role: string,
  customPerms: string | null | undefined,
  module: PermissionModule
): boolean {
  return hasPermission(role, customPerms, module, 'view');
}
