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

    const leaveTypes = await prisma.leaveType.findMany({
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json({ leaveTypes });
  } catch (error) {
    console.error('Leave types list error:', error);
    return NextResponse.json(
      { message: '휴가유형 조회 중 오류가 발생했습니다.' },
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
    const { name, code, isPaid, isAnnualDeduct, maxDays, requiresDoc, sortOrder } = body;

    if (!name || !code) {
      return NextResponse.json(
        { message: '유형명과 코드를 입력해주세요.' },
        { status: 400 }
      );
    }

    const existingName = await prisma.leaveType.findUnique({ where: { name } });
    if (existingName) {
      return NextResponse.json(
        { message: '이미 존재하는 유형명입니다.' },
        { status: 409 }
      );
    }

    const existingCode = await prisma.leaveType.findUnique({ where: { code } });
    if (existingCode) {
      return NextResponse.json(
        { message: '이미 존재하는 코드입니다.' },
        { status: 409 }
      );
    }

    const leaveType = await prisma.leaveType.create({
      data: {
        name,
        code,
        isPaid: isPaid ?? true,
        isAnnualDeduct: isAnnualDeduct ?? false,
        maxDays: maxDays || null,
        requiresDoc: requiresDoc ?? false,
        sortOrder: sortOrder ?? 0,
      },
    });

    return NextResponse.json({ leaveType }, { status: 201 });
  } catch (error) {
    console.error('Leave type create error:', error);
    return NextResponse.json(
      { message: '휴가유형 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
