import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: '인증 필요' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const isAdmin = ['SYSTEM_ADMIN', 'COMPANY_ADMIN'].includes(user.role);
    const showAll = searchParams.get('all') === 'true' && isAdmin;
    const activeFilter = showAll ? undefined : { isActive: true };

    const departments = await prisma.department.findMany({
      include: {
        _count: { select: { employees: true } },
        children: {
          where: activeFilter,
          include: {
            _count: { select: { employees: true } },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
      where: { parentId: null, ...(!showAll ? { isActive: true } : {}) },
      orderBy: { sortOrder: 'asc' },
    });

    // Also get flat list for selects
    const allDepartments = await prisma.department.findMany({
      where: activeFilter,
      include: { _count: { select: { employees: true } } },
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json({ departments, allDepartments });
  } catch (error) {
    console.error('Department list error:', error);
    return NextResponse.json(
      { message: '부서 목록 조회 중 오류가 발생했습니다.' },
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

    if (user.role !== 'SYSTEM_ADMIN' && user.role !== 'COMPANY_ADMIN') {
      return NextResponse.json({ message: '권한이 없습니다.' }, { status: 403 });
    }

    const { name, code, parentId, sortOrder } = await request.json();

    if (!name || !code) {
      return NextResponse.json(
        { message: '부서명과 부서코드를 입력해주세요.' },
        { status: 400 }
      );
    }

    const department = await prisma.department.create({
      data: {
        name,
        code,
        parentId: parentId || null,
        sortOrder: sortOrder || 0,
      },
    });

    return NextResponse.json({ department }, { status: 201 });
  } catch (error) {
    console.error('Department create error:', error);
    if (error instanceof Error && error.message.toLowerCase().includes('unique constraint')) {
      return NextResponse.json(
        { message: '이미 존재하는 부서명 또는 부서코드입니다.' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { message: '부서 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
