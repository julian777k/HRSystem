import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';
import { containsFilter } from '@/lib/db-utils';
import { writeAuditLog } from '@/lib/audit-log';

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

    // 역할 값 화이트리스트 검증 (임의 값 주입 차단)
    const VALID_ROLES = ['SYSTEM_ADMIN', 'COMPANY_ADMIN', 'DEPT_ADMIN', 'BASIC'];
    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json(
        { message: '유효하지 않은 역할입니다.' },
        { status: 400 }
      );
    }

    // 관리자 역할 부여는 시스템 관리자만 가능 (권한 상승 차단)
    const ADMIN_ROLES_SET = ['SYSTEM_ADMIN', 'COMPANY_ADMIN'];
    if (ADMIN_ROLES_SET.includes(role) && user.role !== 'SYSTEM_ADMIN') {
      return NextResponse.json(
        { message: '관리자 역할은 시스템 관리자만 부여할 수 있습니다.' },
        { status: 403 }
      );
    }

    // 본인 역할 변경 금지 (자기 권한 상승·강등 차단)
    if (employeeId === user.id && role !== user.role) {
      return NextResponse.json(
        { message: '본인의 역할은 변경할 수 없습니다.' },
        { status: 403 }
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

    writeAuditLog({
      action: 'PERMISSION_CHANGE',
      target: 'employee',
      targetId: employeeId,
      employeeId: user.id,
      after: { role, viewScopes: viewScopes ?? null },
    });

    return NextResponse.json({ message: '권한이 변경되었습니다.' });
  } catch (error) {
    console.error('Permission update error:', error);
    return NextResponse.json(
      { message: '권한 변경 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
