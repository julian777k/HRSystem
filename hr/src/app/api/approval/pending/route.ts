import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: '인증 필요' }, { status: 401 });
    }

    const pendingApprovals = await prisma.approval.findMany({
      where: {
        approverId: user.id,
        action: 'PENDING',
      },
      include: {
        leaveRequest: {
          include: {
            employee: {
              select: { id: true, name: true, employeeNumber: true },
            },
            leaveType: {
              select: { id: true, name: true, code: true },
            },
          },
        },
        overtime: {
          include: {
            employee: {
              select: { id: true, name: true, employeeNumber: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // 상위 결재자는 현재 단계 이상이면 결재 가능 (선승인 지원)
    // - currentStep 이상인 stepOrder를 가진 결재건을 보여줌
    const filtered = pendingApprovals.filter((approval) => {
      if (approval.leaveRequest) {
        return approval.stepOrder >= approval.leaveRequest.currentStep;
      }
      return true;
    });

    return NextResponse.json({ approvals: filtered });
  } catch (error) {
    console.error('Pending approvals error:', error);
    return NextResponse.json(
      { message: '대기 결재 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
