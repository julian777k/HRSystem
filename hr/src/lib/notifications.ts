import { prisma } from '@/lib/prisma';
import { sendWebhookNotification, getWebhookConfig } from '@/lib/webhook';

async function shouldAnonymizeWebhook(): Promise<boolean> {
  try {
    const config = await prisma.systemConfig.findFirst({
      where: { key: 'webhook_anonymize', group: 'webhook' },
    });
    return config?.value === 'true';
  } catch {
    return false;
  }
}

function anonymizeName(employee: { name: string; employeeNumber: string }, anonymize: boolean): string {
  return anonymize ? employee.employeeNumber : employee.name;
}

// ─── KST Timezone Helpers ───

const KST_OFFSET = 9 * 60; // UTC+9 in minutes

function toKST(date: Date): Date {
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  return new Date(utc + KST_OFFSET * 60000);
}

function getKSTNow(): Date {
  return toKST(new Date());
}

function getKSTDateStr(d: Date): string {
  const kst = toKST(d);
  return `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, '0')}-${String(kst.getDate()).padStart(2, '0')}`;
}

function getKSTTimeStr(d: Date): string {
  const kst = toKST(d);
  return `${String(kst.getHours()).padStart(2, '0')}:${String(kst.getMinutes()).padStart(2, '0')}`;
}

// ─── Leave Summary (Daily / Weekly) ───

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function formatDateKST(d: Date): string {
  const kst = toKST(d);
  const m = kst.getMonth() + 1;
  const day = kst.getDate();
  const wd = WEEKDAYS[kst.getDay()];
  return `${m}/${day}(${wd})`;
}

function useUnitLabel(unit: string): string {
  switch (unit) {
    case 'AM_HALF': return '오전반차';
    case 'PM_HALF': return '오후반차';
    case 'HOURS': return '시간차';
    default: return '전일';
  }
}

// ─── Schedule Config ───

interface ScheduleConfig {
  dailyEnabled: boolean;
  dailyTime: string;       // "09:00"
  weeklyEnabled: boolean;
  weeklyDay: number;       // 0=Sun, 1=Mon, ..., 5=Fri
  weeklyTime: string;      // "09:00"
}

export async function getScheduleConfig(): Promise<ScheduleConfig> {
  try {
    const configs = await prisma.systemConfig.findMany({
      where: { group: 'webhook_schedule' },
    });
    const map = new Map(configs.map((c: any) => [c.key, c.value]));
    return {
      dailyEnabled: map.get('schedule_daily_enabled') === 'true',
      dailyTime: map.get('schedule_daily_time') || '09:00',
      weeklyEnabled: map.get('schedule_weekly_enabled') === 'true',
      weeklyDay: parseInt(map.get('schedule_weekly_day') || '1', 10),
      weeklyTime: map.get('schedule_weekly_time') || '09:00',
    };
  } catch {
    return { dailyEnabled: false, dailyTime: '09:00', weeklyEnabled: false, weeklyDay: 1, weeklyTime: '09:00' };
  }
}

async function getLastSent(key: string): Promise<string | null> {
  try {
    const config = await prisma.systemConfig.findFirst({
      where: { key, group: 'webhook_schedule' },
    });
    return config?.value || null;
  } catch {
    return null;
  }
}

async function setLastSent(key: string, value: string) {
  try {
    const existing = await prisma.systemConfig.findFirst({
      where: { key, group: 'webhook_schedule' },
    });
    if (existing) {
      await prisma.systemConfig.update({ where: { id: existing.id }, data: { value } });
    } else {
      await prisma.systemConfig.create({ data: { key, value, group: 'webhook_schedule' } });
    }
  } catch {
    // silent
  }
}

// In-memory throttle: only check DB once per 5 minutes
// Note: On CF Workers this may reset per isolate, but last_sent DB check prevents duplicates
let _lastScheduleCheck = 0;
const SCHEDULE_CHECK_INTERVAL = 5 * 60 * 1000; // 5 min

/**
 * Check scheduled webhooks and send if due.
 * Safe to call frequently — throttled to 5min intervals + last_sent prevents duplicates.
 * All time comparisons use KST (Asia/Seoul).
 */
export async function checkAndSendScheduled(): Promise<void> {
  const checkTimestamp = Date.now();
  if (checkTimestamp - _lastScheduleCheck < SCHEDULE_CHECK_INTERVAL) return;
  _lastScheduleCheck = checkTimestamp;

  try {
    const config = await getWebhookConfig();
    if (!config) return;

    const schedule = await getScheduleConfig();
    const kstNow = getKSTNow();
    const todayStr = getKSTDateStr(new Date());
    const currentTime = getKSTTimeStr(new Date());
    const kstDay = kstNow.getDay();

    // Daily check
    if (schedule.dailyEnabled && config.events.includes('DAILY_LEAVE_SUMMARY')) {
      if (currentTime >= schedule.dailyTime) {
        const lastSent = await getLastSent('schedule_daily_last_sent');
        if (lastSent !== todayStr) {
          // Send first, then mark as sent (so failures can be retried)
          const result = await sendLeaveSummary('daily');
          if (result.sent) {
            await setLastSent('schedule_daily_last_sent', todayStr);
          }
        }
      }
    }

    // Weekly check
    if (schedule.weeklyEnabled && config.events.includes('WEEKLY_LEAVE_SUMMARY')) {
      if (kstDay === schedule.weeklyDay && currentTime >= schedule.weeklyTime) {
        const weekKey = todayStr;
        const lastSent = await getLastSent('schedule_weekly_last_sent');
        if (lastSent !== weekKey) {
          const result = await sendLeaveSummary('weekly');
          if (result.sent) {
            await setLastSent('schedule_weekly_last_sent', weekKey);
          }
        }
      }
    }
  } catch (error) {
    console.error('[Notification] checkAndSendScheduled error:', error);
  }
}

export async function sendLeaveSummary(
  type: 'daily' | 'weekly'
): Promise<{ sent: boolean; count?: number; reason?: string }> {
  const config = await getWebhookConfig();
  const eventKey = type === 'daily' ? 'DAILY_LEAVE_SUMMARY' : 'WEEKLY_LEAVE_SUMMARY';

  if (!config) return { sent: false, reason: '웹훅이 비활성화되어 있습니다.' };
  if (!config.events.includes(eventKey)) return { sent: false, reason: `${eventKey} 이벤트가 비활성화되어 있습니다.` };

  // Use KST for date range calculation
  const kstNow = getKSTNow();
  let startDate: Date;
  let endDate: Date;
  let title: string;

  if (type === 'daily') {
    startDate = new Date(kstNow.getFullYear(), kstNow.getMonth(), kstNow.getDate());
    endDate = new Date(kstNow.getFullYear(), kstNow.getMonth(), kstNow.getDate(), 23, 59, 59);
    title = `오늘의 휴무 현황 (${formatDateKST(new Date())})`;
  } else {
    const dayOfWeek = kstNow.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    startDate = new Date(kstNow.getFullYear(), kstNow.getMonth(), kstNow.getDate() + mondayOffset);
    endDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 4, 23, 59, 59);
    title = `이번 주 휴무 현황 (${formatDateKST(startDate)} ~ ${formatDateKST(endDate)})`;
  }

  // Query approved leaves overlapping the date range
  const leaveRequests = await prisma.leaveRequest.findMany({
    where: {
      status: 'APPROVED',
      employee: { status: 'ACTIVE' },
      OR: [
        { startDate: { gte: startDate, lte: endDate } },
        { endDate: { gte: startDate, lte: endDate } },
        { AND: [{ startDate: { lte: startDate } }, { endDate: { gte: endDate } }] },
      ],
    },
    include: {
      employee: {
        select: {
          name: true,
          employeeNumber: true,
          department: { select: { name: true } },
        },
      },
      leaveType: { select: { name: true } },
    },
    orderBy: [{ startDate: 'asc' }, { employee: { name: 'asc' } }],
  });

  const anonymize = await shouldAnonymizeWebhook();

  if (leaveRequests.length === 0) {
    const noLeaveMsg = `[${title}]\n━━━━━━━━━━━━━━\n휴무자가 없습니다.`;
    const result = await sendWebhookNotification(eventKey, noLeaveMsg);
    if (!result.ok) return { sent: false, reason: result.error };
    return { sent: true, count: 0 };
  }

  // Build message
  let message: string;

  if (type === 'daily') {
    // Deduplicate by employee for accurate "명" count
    const seen = new Set<string>();
    const lines = leaveRequests.map((lr) => {
      const name = anonymizeName(lr.employee, anonymize);
      const dept = lr.employee.department?.name || '';
      const unit = useUnitLabel(lr.useUnit);
      seen.add(name);
      return `• ${name} (${dept}) — ${lr.leaveType.name} (${unit})`;
    });
    message = `[${title}]\n━━━━━━━━━━━━━━\n${lines.join('\n')}\n\n총 ${seen.size}명 휴무`;
  } else {
    // Group by date for weekly view
    const dayMap = new Map<string, string[]>();
    const cursor = new Date(startDate);
    while (cursor <= endDate) {
      dayMap.set(formatDateKST(cursor), []);
      cursor.setDate(cursor.getDate() + 1);
    }

    for (const lr of leaveRequests) {
      const lrStart = new Date(lr.startDate);
      const lrEnd = new Date(lr.endDate);
      const rangeStart = lrStart < startDate ? startDate : lrStart;
      const rangeEnd = lrEnd > endDate ? endDate : lrEnd;

      const d = new Date(rangeStart);
      while (d <= rangeEnd) {
        const key = formatDateKST(d);
        const name = anonymizeName(lr.employee, anonymize);
        const dept = lr.employee.department?.name || '';
        const entry = `${name}(${dept}/${lr.leaveType.name}/${useUnitLabel(lr.useUnit)})`;
        dayMap.get(key)?.push(entry);
        d.setDate(d.getDate() + 1);
      }
    }

    const lines: string[] = [];
    for (const [day, entries] of dayMap) {
      if (entries.length === 0) {
        lines.push(`${day}: 없음`);
      } else {
        lines.push(`${day}: ${entries.join(', ')}`);
      }
    }

    message = `[${title}]\n━━━━━━━━━━━━━━\n${lines.join('\n')}\n\n총 ${leaveRequests.length}건`;
  }

  const sendResult = await sendWebhookNotification(eventKey, message);
  if (!sendResult.ok) return { sent: false, reason: sendResult.error };
  return { sent: true, count: leaveRequests.length };
}

export async function notifyApprovers(leaveRequestId: string) {
  try {
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: leaveRequestId },
      include: {
        employee: true,
        leaveType: true,
        approvals: {
          where: { action: 'PENDING' },
          include: { approver: true },
          orderBy: { stepOrder: 'asc' },
          take: 1,
        },
      },
    });

    if (!leaveRequest) return;

    const anonymize = await shouldAnonymizeWebhook();
    const displayName = anonymizeName(leaveRequest.employee, anonymize);
    const startDate = leaveRequest.startDate.toISOString().split('T')[0];
    const endDate = leaveRequest.endDate.toISOString().split('T')[0];

    // Webhook notification (best-effort, don't block)
    sendWebhookNotification(
      'LEAVE_REQUEST',
      `${displayName}님이 ${leaveRequest.leaveType.name} 휴가를 신청했습니다. (${startDate} ~ ${endDate})`
    ).catch(() => {});
  } catch (error) {
    console.error('[Notification] notifyApprovers error:', error);
  }
}

export async function notifyRequestResult(
  leaveRequestId: string,
  status: 'APPROVED' | 'REJECTED',
  comment?: string
) {
  try {
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: leaveRequestId },
      include: {
        employee: true,
        leaveType: true,
      },
    });

    if (!leaveRequest) return;

    const anonymize = await shouldAnonymizeWebhook();
    const displayName = anonymizeName(leaveRequest.employee, anonymize);
    const startDate = leaveRequest.startDate.toISOString().split('T')[0];
    const endDate = leaveRequest.endDate.toISOString().split('T')[0];
    const isApproved = status === 'APPROVED';

    // Webhook notification (best-effort, don't block)
    sendWebhookNotification(
      isApproved ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
      isApproved
        ? `${displayName}님의 ${leaveRequest.leaveType.name} 휴가가 승인되었습니다. (${startDate} ~ ${endDate})`
        : `${displayName}님의 ${leaveRequest.leaveType.name} 휴가가 반려되었습니다.${comment ? ` 사유: ${comment}` : ''}`
    ).catch(() => {});
  } catch (error) {
    console.error('[Notification] notifyRequestResult error:', error);
  }
}
