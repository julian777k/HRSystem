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

    if (user.role !== 'SYSTEM_ADMIN' && user.role !== 'COMPANY_ADMIN') {
      return NextResponse.json({ message: '권한이 없습니다.' }, { status: 403 });
    }

    const { id } = await params;
    const { name, level, isActive } = await request.json();

    const existing = await prisma.position.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { message: '직급을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (level !== undefined) updateData.level = Number(level);
    if (isActive !== undefined) updateData.isActive = isActive;

    const position = await prisma.position.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ position });
  } catch (error) {
    console.error('Position update error:', error);
    const message =
      error instanceof Error && error.message.includes('Unique constraint')
        ? '이미 존재하는 직급명 또는 레벨입니다.'
        : '직급 수정 중 오류가 발생했습니다.';
    return NextResponse.json({ message }, { status: 500 });
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

    if (user.role !== 'SYSTEM_ADMIN' && user.role !== 'COMPANY_ADMIN') {
      return NextResponse.json({ message: '권한이 없습니다.' }, { status: 403 });
    }

    const { id } = await params;

    const employeeCount = await prisma.employee.count({
      where: { positionId: id },
    });

    if (employeeCount > 0) {
      return NextResponse.json(
        { message: `해당 직급에 ${employeeCount}명의 직원이 배정되어 있어 삭제할 수 없습니다.` },
        { status: 400 }
      );
    }

    await prisma.position.delete({ where: { id } });

    return NextResponse.json({ message: '직급이 삭제되었습니다.' });
  } catch (error) {
    console.error('Position delete error:', error);
    return NextResponse.json(
      { message: '직급 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
