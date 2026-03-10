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
    const { name, code, parentId, sortOrder, isActive, workStartTime, workEndTime, lunchStartTime, lunchEndTime } = await request.json();

    const existing = await prisma.department.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { message: '부서를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (code !== undefined) updateData.code = code;
    if (parentId !== undefined) updateData.parentId = parentId || null;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (workStartTime !== undefined) updateData.workStartTime = workStartTime || null;
    if (workEndTime !== undefined) updateData.workEndTime = workEndTime || null;
    if (lunchStartTime !== undefined) updateData.lunchStartTime = lunchStartTime || null;
    if (lunchEndTime !== undefined) updateData.lunchEndTime = lunchEndTime || null;

    const department = await prisma.department.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ department });
  } catch (error) {
    console.error('Department update error:', error);
    return NextResponse.json(
      { message: '부서 수정 중 오류가 발생했습니다.' },
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

    if (user.role !== 'SYSTEM_ADMIN' && user.role !== 'COMPANY_ADMIN') {
      return NextResponse.json({ message: '권한이 없습니다.' }, { status: 403 });
    }

    const { id } = await params;

    const employeeCount = await prisma.employee.count({
      where: { departmentId: id },
    });

    if (employeeCount > 0) {
      return NextResponse.json(
        { message: `해당 부서에 ${employeeCount}명의 직원이 배정되어 있어 삭제할 수 없습니다.` },
        { status: 400 }
      );
    }

    const childCount = await prisma.department.count({
      where: { parentId: id },
    });

    if (childCount > 0) {
      return NextResponse.json(
        { message: '하위 부서가 있어 삭제할 수 없습니다. 하위 부서를 먼저 삭제해주세요.' },
        { status: 400 }
      );
    }

    await prisma.department.delete({ where: { id } });

    return NextResponse.json({ message: '부서가 삭제되었습니다.' });
  } catch (error) {
    console.error('Department delete error:', error);
    return NextResponse.json(
      { message: '부서 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
