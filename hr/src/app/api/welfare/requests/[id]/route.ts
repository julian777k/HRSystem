import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';
import { parseJson } from '@/lib/json-field';

const ADMIN_ROLES = ['SYSTEM_ADMIN', 'COMPANY_ADMIN'];

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: '인증 필요' }, { status: 401 });

    if (!ADMIN_ROLES.includes(user.role)) {
      return NextResponse.json({ message: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json({ message: '유효하지 않은 상태입니다.' }, { status: 400 });
    }

    const existing = await prisma.welfareRequest.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: '신청을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (existing.status !== 'PENDING') {
      return NextResponse.json({ message: '대기 중인 신청만 처리할 수 있습니다.' }, { status: 400 });
    }

    const updated = await prisma.welfareRequest.update({
      where: { id },
      data: {
        status,
        approvedBy: user.id,
        approvedAt: new Date(),
      },
      include: {
        item: { include: { category: true } },
        employee: {
          select: { id: true, name: true, employeeNumber: true },
        },
      },
    });

    return NextResponse.json({
      ...updated,
      formValues: parseJson(updated.formValues),
      item: {
        ...updated.item,
        formFields: parseJson(updated.item.formFields),
      },
    });
  } catch (error) {
    console.error('Welfare request update error:', error);
    return NextResponse.json(
      { message: '복지 신청 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: '인증 필요' }, { status: 401 });

    const { id } = await params;

    const existing = await prisma.welfareRequest.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: '신청을 찾을 수 없습니다.' }, { status: 404 });
    }

    const isAdmin = ADMIN_ROLES.includes(user.role);

    // 관리자: 어떤 상태든 삭제 가능 (DB에서 실제 삭제)
    if (isAdmin) {
      await prisma.welfareRequest.delete({ where: { id } });
      return NextResponse.json({ message: '삭제되었습니다.' });
    }

    // 일반 사용자: 본인의 PENDING만 취소 가능
    if (existing.employeeId !== user.id) {
      return NextResponse.json({ message: '본인의 신청만 취소할 수 있습니다.' }, { status: 403 });
    }

    if (existing.status !== 'PENDING') {
      return NextResponse.json({ message: '대기 중인 신청만 취소할 수 있습니다.' }, { status: 400 });
    }

    await prisma.welfareRequest.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    return NextResponse.json({ message: '신청이 취소되었습니다.' });
  } catch (error) {
    console.error('Welfare request cancel error:', error);
    return NextResponse.json(
      { message: '복지 신청 취소 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
