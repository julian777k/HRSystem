import { prisma } from '@/lib/prisma';
import { sendWebhookNotification } from '@/lib/webhook';

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

    const startDate = leaveRequest.startDate.toISOString().split('T')[0];
    const endDate = leaveRequest.endDate.toISOString().split('T')[0];

    // Webhook notification (fire-and-forget)
    sendWebhookNotification(
      'LEAVE_REQUEST',
      `${leaveRequest.employee.name}님이 ${leaveRequest.leaveType.name} 휴가를 신청했습니다. (${startDate} ~ ${endDate})`
    );
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

    const startDate = leaveRequest.startDate.toISOString().split('T')[0];
    const endDate = leaveRequest.endDate.toISOString().split('T')[0];
    const isApproved = status === 'APPROVED';

    // Webhook notification (fire-and-forget)
    sendWebhookNotification(
      isApproved ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
      isApproved
        ? `${leaveRequest.employee.name}님의 ${leaveRequest.leaveType.name} 휴가가 승인되었습니다. (${startDate} ~ ${endDate})`
        : `${leaveRequest.employee.name}님의 ${leaveRequest.leaveType.name} 휴가가 반려되었습니다.${comment ? ` 사유: ${comment}` : ''}`
    );
  } catch (error) {
    console.error('[Notification] notifyRequestResult error:', error);
  }
}
