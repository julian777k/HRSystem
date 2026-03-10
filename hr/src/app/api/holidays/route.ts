import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: '인증 필요' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : new Date().getFullYear();
    const type = searchParams.get('type');
    const departmentId = searchParams.get('departmentId');

    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59);

    const whereClause: Record<string, unknown> = {
      date: {
        gte: startOfYear,
        lte: endOfYear,
      },
    };

    if (type) {
      whereClause.type = type;
    }

    if (departmentId) {
      // Include PUBLIC, COMPANY, and DEPARTMENT holidays for the specified department
      whereClause.OR = [
        { type: 'PUBLIC' },
        { type: 'COMPANY' },
        { type: 'DEPARTMENT', targetId: departmentId },
      ];
      // Remove the top-level type filter if departmentId is set
      delete whereClause.type;
    }

    const holidays = await prisma.holiday.findMany({
      where: whereClause,
      orderBy: { date: 'asc' },
    });

    return NextResponse.json({ holidays });
  } catch (error) {
    console.error('Holiday list error:', error);
    return NextResponse.json(
      { message: '공휴일 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: '인증 필요' }, { status: 401 });

    if (!['SYSTEM_ADMIN', 'COMPANY_ADMIN'].includes(user.role)) {
      return NextResponse.json({ message: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const body = await request.json();
    const { name, date, isRecurring, type = 'PUBLIC', targetId } = body;

    if (!name || !date) {
      return NextResponse.json({ message: '이름과 날짜를 입력해주세요.' }, { status: 400 });
    }

    if (!['PUBLIC', 'COMPANY', 'DEPARTMENT'].includes(type)) {
      return NextResponse.json({ message: '유효하지 않은 유형입니다.' }, { status: 400 });
    }

    if (type === 'DEPARTMENT' && !targetId) {
      return NextResponse.json({ message: '부서 휴무일은 부서를 지정해야 합니다.' }, { status: 400 });
    }

    const holiday = await prisma.holiday.create({
      data: {
        name,
        date: new Date(date),
        isRecurring: isRecurring ?? false,
        type,
        targetId: type === 'DEPARTMENT' ? targetId : null,
      },
    });

    return NextResponse.json(holiday, { status: 201 });
  } catch (error) {
    console.error('Holiday create error:', error);
    return NextResponse.json(
      { message: '공휴일 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
