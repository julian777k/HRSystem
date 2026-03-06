import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: '인증 필요' }, { status: 401 });
    }

    if (!['SYSTEM_ADMIN', 'COMPANY_ADMIN'].includes(user.role)) {
      return NextResponse.json({ message: '권한이 없습니다.' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, type, isDefault, isActive, steps } = body;

    const existing = await prisma.approvalLine.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: '결재선을 찾을 수 없습니다.' }, { status: 404 });
    }

    // If setting as default, unset other defaults of same type
    if (isDefault) {
      await prisma.approvalLine.updateMany({
        where: { type: type || existing.type, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    // Delete existing steps and recreate if steps provided
    if (steps) {
      await prisma.approvalStep.deleteMany({ where: { approvalLineId: id } });
    }

    const line = await prisma.approvalLine.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(type !== undefined && { type }),
        ...(isDefault !== undefined && { isDefault }),
        ...(isActive !== undefined && { isActive }),
        ...(steps && {
          steps: {
            create: steps.map((step: { stepOrder: number; approverId?: string; approverRole: string; actionType: string; positionLevel?: number }) => ({
              stepOrder: step.stepOrder,
              approverId: step.approverId || null,
              approverRole: step.approverRole,
              actionType: step.actionType,
              positionLevel: step.approverRole === 'POSITION' ? step.positionLevel : null,
            })),
          },
        }),
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

    return NextResponse.json({ line });
  } catch (error) {
    console.error('Approval line update error:', error);
    return NextResponse.json(
      { message: '결재선 수정 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: '인증 필요' }, { status: 401 });
    }

    if (!['SYSTEM_ADMIN', 'COMPANY_ADMIN'].includes(user.role)) {
      return NextResponse.json({ message: '권한이 없습니다.' }, { status: 403 });
    }

    const { id } = await params;

    const existing = await prisma.approvalLine.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: '결재선을 찾을 수 없습니다.' }, { status: 404 });
    }

    await prisma.approvalLine.delete({ where: { id } });

    return NextResponse.json({ message: '삭제되었습니다.' });
  } catch (error) {
    console.error('Approval line delete error:', error);
    return NextResponse.json(
      { message: '결재선 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
