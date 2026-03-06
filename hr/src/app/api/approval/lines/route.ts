import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: '인증 필요' }, { status: 401 });
    }

    if (!['SYSTEM_ADMIN', 'COMPANY_ADMIN'].includes(user.role)) {
      return NextResponse.json({ message: '권한이 없습니다.' }, { status: 403 });
    }

    const lines = await prisma.approvalLine.findMany({
      include: {
        steps: {
          include: {
            approver: {
              select: { id: true, name: true, employeeNumber: true },
            },
          },
          orderBy: { stepOrder: 'asc' },
        },
      },
      orderBy: [{ type: 'asc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json({ lines });
  } catch (error) {
    console.error('Approval lines list error:', error);
    return NextResponse.json(
      { message: '결재선 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: '인증 필요' }, { status: 401 });
    }

    if (!['SYSTEM_ADMIN', 'COMPANY_ADMIN'].includes(user.role)) {
      return NextResponse.json({ message: '권한이 없습니다.' }, { status: 403 });
    }

    const body = await request.json();
    const { name, type, isDefault, steps } = body;

    if (!name || !type || !steps || steps.length === 0) {
      return NextResponse.json(
        { message: '필수 항목을 모두 입력해주세요.' },
        { status: 400 }
      );
    }

    // If setting as default, unset other defaults of same type
    if (isDefault) {
      await prisma.approvalLine.updateMany({
        where: { type, isDefault: true },
        data: { isDefault: false },
      });
    }

    const line = await prisma.approvalLine.create({
      data: {
        name,
        type,
        isDefault: isDefault || false,
        steps: {
          create: steps.map((step: { stepOrder: number; approverId?: string; approverRole: string; actionType: string; positionLevel?: number }) => ({
            stepOrder: step.stepOrder,
            approverId: step.approverId || null,
            approverRole: step.approverRole,
            actionType: step.actionType,
            positionLevel: step.approverRole === 'POSITION' ? step.positionLevel : null,
          })),
        },
      },
      include: {
        steps: {
          include: {
            approver: {
              select: { id: true, name: true, employeeNumber: true },
            },
          },
          orderBy: { stepOrder: 'asc' },
        },
      },
    });

    return NextResponse.json({ line }, { status: 201 });
  } catch (error) {
    console.error('Approval line create error:', error);
    return NextResponse.json(
      { message: '결재선 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
