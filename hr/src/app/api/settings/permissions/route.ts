import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';
import { containsFilter } from '@/lib/db-utils';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: '인증 필요' }, { status: 401 });
    }

    if (!['SYSTEM_ADMIN', 'COMPANY_ADMIN'].includes(user.role)) {
      return NextResponse.json({ message: '권한이 없습니다.' }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const search = searchParams.get('search') || '';

    const where: Record<string, unknown> = {
      status: 'ACTIVE',
    };

    if (search) {
      where.OR = [
        { name: containsFilter(search) },
        { employeeNumber: containsFilter(search) },
        { email: containsFilter(search) },
      ];
    }

    const employees = await prisma.employee.findMany({
      where,
      select: {
        id: true,
        employeeNumber: true,
        name: true,
        email: true,
        role: true,
        customPermissions: true,
        department: { select: { id: true, name: true } },
        position: { select: { id: true, name: true } },
      },
      orderBy: [{ department: { name: 'asc' } }, { name: 'asc' }],
    });

    return NextResponse.json({ employees });
  } catch (error) {
    console.error('Permissions list error:', error);
    return NextResponse.json(
      { message: '권한 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: '인증 필요' }, { status: 401 });
    }

    if (!['SYSTEM_ADMIN', 'COMPANY_ADMIN'].includes(user.role)) {
      return NextResponse.json({ message: '권한이 없습니다.' }, { status: 403 });
    }

    const body = await request.json();
    const { employeeId, role, viewScopes, customPermissions } = body;

    if (!employeeId || !role) {
      return NextResponse.json(
        { message: '필수 항목을 모두 입력해주세요.' },
        { status: 400 }
      );
    }

    // Prevent changing own role (safety)
    if (employeeId === user.id && user.role === 'SYSTEM_ADMIN' && role !== 'SYSTEM_ADMIN') {
      return NextResponse.json(
        { message: '자신의 시스템 관리자 권한은 변경할 수 없습니다.' },
        { status: 400 }
      );
    }

    await prisma.employee.update({
      where: { id: employeeId },
      data: {
        role,
        ...(customPermissions !== undefined && {
          customPermissions: customPermissions ? JSON.stringify(customPermissions) : null,
        }),
      },
    });

    // Update view permissions if provided
    if (viewScopes !== undefined) {
      await prisma.viewPermission.deleteMany({
        where: { employeeId },
      });

      if (viewScopes && viewScopes.length > 0) {
        await prisma.viewPermission.createMany({
          data: viewScopes.map((scope: string) => ({
            employeeId,
            scope: scope as 'COMPANY' | 'DEPARTMENT',
          })),
        });
      }
    }

    return NextResponse.json({ message: '권한이 변경되었습니다.' });
  } catch (error) {
    console.error('Permission update error:', error);
    return NextResponse.json(
      { message: '권한 변경 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
