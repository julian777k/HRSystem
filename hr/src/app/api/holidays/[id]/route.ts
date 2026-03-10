import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: '인증 필요' }, { status: 401 });

    if (!['SYSTEM_ADMIN', 'COMPANY_ADMIN'].includes(user.role)) {
      return NextResponse.json({ message: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, date, isRecurring, type, targetId } = body;

    if (type !== undefined && !['PUBLIC', 'COMPANY', 'DEPARTMENT'].includes(type)) {
      return NextResponse.json({ message: '유효하지 않은 유형입니다.' }, { status: 400 });
    }

    if (type === 'DEPARTMENT' && !targetId) {
      return NextResponse.json({ message: '부서 휴무일은 부서를 지정해야 합니다.' }, { status: 400 });
    }

    const holiday = await prisma.holiday.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(date !== undefined && { date: new Date(date) }),
        ...(isRecurring !== undefined && { isRecurring }),
        ...(type !== undefined && { type }),
        ...(type !== undefined && { targetId: type === 'DEPARTMENT' ? targetId : null }),
      },
    });

    return NextResponse.json(holiday);
  } catch (error) {
    console.error('Holiday update error:', error);
    return NextResponse.json(
      { message: '공휴일 수정 중 오류가 발생했습니다.' },
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

    if (!['SYSTEM_ADMIN', 'COMPANY_ADMIN'].includes(user.role)) {
      return NextResponse.json({ message: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { id } = await params;

    await prisma.holiday.delete({
      where: { id },
    });

    return NextResponse.json({ message: '삭제되었습니다.' });
  } catch (error) {
    console.error('Holiday delete error:', error);
    return NextResponse.json(
      { message: '공휴일 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
