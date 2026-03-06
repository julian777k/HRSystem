import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import {
  leaveRequestNotification,
  leaveApprovedNotification,
  leaveRejectedNotification,
} from '@/lib/email-templates';

export async function createNotification(
  employeeId: string,
  type: string,
  title: string,
  message: string,
  link?: string
) {
  try {
    await prisma.notification.create({
      data: { employeeId, type, title, message, link },
    });
  } catch (error) {
    console.error('[Notification] Failed to create:', error);
  }
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

    const startDate = leaveRequest.startDate.toISOString().split('T')[0];
    const endDate = leaveRequest.endDate.toISOString().split('T')[0];

    for (const approval of leaveRequest.approvals) {
      const approver = approval.approver;

      await createNotification(
        approver.id,
        'LEAVE_REQUEST',
        '휴가 결재 요청',
        `${leaveRequest.employee.name}님이 ${leaveRequest.leaveType.name} 휴가를 신청했습니다. (${startDate} ~ ${endDate})`,
        '/approval'
      );

      await sendEmail(
        approver.email,
        `[HR] 휴가 결재 요청 - ${leaveRequest.employee.name}`,
        leaveRequestNotification(
          leaveRequest.employee.name,
          leaveRequest.leaveType.name,
          startDate,
          endDate,
          approver.name
        )
      );
    }
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

    await createNotification(
      leaveRequest.employeeId,
      isApproved ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
      isApproved ? '휴가 승인' : '휴가 반려',
      isApproved
        ? `${leaveRequest.leaveType.name} 휴가가 승인되었습니다. (${startDate} ~ ${endDate})`
        : `${leaveRequest.leaveType.name} 휴가가 반려되었습니다.${comment ? ` 사유: ${comment}` : ''}`,
      '/leave/my'
    );

    await sendEmail(
      leaveRequest.employee.email,
      `[HR] 휴가 ${isApproved ? '승인' : '반려'} 안내`,
      isApproved
        ? leaveApprovedNotification(
            leaveRequest.employee.name,
            leaveRequest.leaveType.name,
            startDate,
            endDate
          )
        : leaveRejectedNotification(
            leaveRequest.employee.name,
            leaveRequest.leaveType.name,
            comment
          )
    );
  } catch (error) {
    console.error('[Notification] notifyRequestResult error:', error);
  }
}
