import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';

interface AuditLogParams {
  action: string;
  target: string;
  targetId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  employeeId?: string;
  ipAddress?: string;
}

/**
 * Write audit log entry -- fire-and-forget.
 * Call without await to avoid blocking the main flow.
 */
export function writeAuditLog(params: AuditLogParams): void {
  (async () => {
    try {
      let employeeId = params.employeeId;
      if (!employeeId) {
        try {
          const user = await getCurrentUser();
          employeeId = user?.id || undefined;
        } catch {
          employeeId = undefined;
        }
      }

      await prisma.auditLog.create({
        data: {
          action: params.action,
          target: params.target,
          targetId: params.targetId,
          before: params.before ? JSON.stringify(params.before) : null,
          after: params.after ? JSON.stringify(params.after) : null,
          employeeId: employeeId || null,
          ipAddress: params.ipAddress || null,
        },
      });
    } catch (error) {
      console.error('[AuditLog] Failed to write audit log:', error);
    }
  })();
}
