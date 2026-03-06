import { NextRequest, NextResponse } from 'next/server';
import bcryptjs from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: '인증 필요' }, { status: 401 });
    }

    const { id } = await params;

    // IDOR protection: non-admin users can only view their own profile
    const isAdmin = user.role === 'SYSTEM_ADMIN' || user.role === 'COMPANY_ADMIN';
    if (!isAdmin && id !== user.id) {
      return NextResponse.json({ message: '권한이 없습니다.' }, { status: 403 });
    }

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, name: true } },
        position: { select: { id: true, name: true, level: true } },
      },
    });

    if (!employee) {
      return NextResponse.json(
        { message: '직원을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const { passwordHash, ...sanitized } = employee;

    return NextResponse.json({ employee: sanitized });
  } catch (error) {
    console.error('Employee detail error:', error);
    return NextResponse.json(
      { message: '직원 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

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
    const body = await request.json();
    const { name, email, phone, departmentId, positionId, hireDate, role, status, password } = body;

    const existing = await prisma.employee.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { message: '직원을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (email && email !== existing.email) {
      const emailTaken = await prisma.employee.findUnique({ where: { email } });
      if (emailTaken) {
        return NextResponse.json(
          { message: '이미 사용 중인 이메일입니다.' },
          { status: 409 }
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (departmentId !== undefined) updateData.departmentId = departmentId;
    if (positionId !== undefined) updateData.positionId = positionId;
    if (hireDate !== undefined) updateData.hireDate = new Date(hireDate);
    if (role !== undefined) updateData.role = role;
    if (status !== undefined) updateData.status = status;
    if (password) {
      updateData.passwordHash = await bcryptjs.hash(password, 10);
    }

    const employee = await prisma.employee.update({
      where: { id },
      data: updateData,
      include: {
        department: { select: { id: true, name: true } },
        position: { select: { id: true, name: true, level: true } },
      },
    });

    // Invalidate sessions when role, department, position, or password changes
    if (role !== undefined || departmentId !== undefined || positionId !== undefined || password) {
      await prisma.session.deleteMany({ where: { employeeId: id } });
    }

    const { passwordHash, ...sanitized } = employee;

    return NextResponse.json({ employee: sanitized });
  } catch (error) {
    console.error('Employee update error:', error);
    return NextResponse.json(
      { message: '직원 수정 중 오류가 발생했습니다.' },
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

    const existing = await prisma.employee.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { message: '직원을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    await prisma.employee.update({
      where: { id },
      data: {
        status: 'RESIGNED',
        resignDate: new Date(),
      },
    });

    return NextResponse.json({ message: '직원이 퇴직 처리되었습니다.' });
  } catch (error) {
    console.error('Employee delete error:', error);
    return NextResponse.json(
      { message: '직원 퇴직 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
