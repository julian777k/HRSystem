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

    const policies = await prisma.leavePolicy.findMany({
      include: {
        leaveType: {
          select: { id: true, name: true, code: true },
        },
      },
      orderBy: [{ leaveTypeId: 'asc' }, { yearFrom: 'asc' }],
    });

    return NextResponse.json({ policies });
  } catch (error) {
    console.error('Leave policy list error:', error);
    return NextResponse.json(
      { message: '휴가규정 조회 중 오류가 발생했습니다.' },
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
    const { id, name, leaveTypeId, description, yearFrom, yearTo, grantDays, grantType, isActive } = body;

    if (id) {
      // Update existing policy
      const policy = await prisma.leavePolicy.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(leaveTypeId !== undefined && { leaveTypeId }),
          ...(description !== undefined && { description }),
          ...(yearFrom !== undefined && { yearFrom }),
          ...(yearTo !== undefined && { yearTo }),
          ...(grantDays !== undefined && { grantDays }),
          ...(grantType !== undefined && { grantType }),
          ...(isActive !== undefined && { isActive }),
        },
        include: {
          leaveType: { select: { id: true, name: true, code: true } },
        },
      });
      return NextResponse.json({ policy });
    } else {
      // Create new policy
      if (!name || !leaveTypeId || yearFrom === undefined || !grantDays || !grantType) {
        return NextResponse.json(
          { message: '필수 항목을 모두 입력해주세요.' },
          { status: 400 }
        );
      }

      const policy = await prisma.leavePolicy.create({
        data: {
          name,
          leaveTypeId,
          description: description || null,
          yearFrom,
          yearTo: yearTo || null,
          grantDays,
          grantType,
        },
        include: {
          leaveType: { select: { id: true, name: true, code: true } },
        },
      });
      return NextResponse.json({ policy }, { status: 201 });
    }
  } catch (error) {
    console.error('Leave policy update error:', error);
    return NextResponse.json(
      { message: '휴가규정 수정 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
