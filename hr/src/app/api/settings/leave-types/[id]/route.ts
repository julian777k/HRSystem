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

    if (!['SYSTEM_ADMIN', 'COMPANY_ADMIN'].includes(user.role)) {
      return NextResponse.json({ message: '권한이 없습니다.' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, code, isPaid, isAnnualDeduct, maxDays, requiresDoc, isActive, sortOrder } = body;

    const existing = await prisma.leaveType.findFirst({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: '휴가유형을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (name && name !== existing.name) {
      const dup = await prisma.leaveType.findFirst({ where: { name } });
      if (dup) {
        return NextResponse.json({ message: '이미 존재하는 유형명입니다.' }, { status: 409 });
      }
    }

    if (code && code !== existing.code) {
      const dup = await prisma.leaveType.findFirst({ where: { code } });
      if (dup) {
        return NextResponse.json({ message: '이미 존재하는 코드입니다.' }, { status: 409 });
      }
    }

    const leaveType = await prisma.leaveType.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(code !== undefined && { code }),
        ...(isPaid !== undefined && { isPaid }),
        ...(isAnnualDeduct !== undefined && { isAnnualDeduct }),
        ...(maxDays !== undefined && { maxDays }),
        ...(requiresDoc !== undefined && { requiresDoc }),
        ...(isActive !== undefined && { isActive }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
    });

    return NextResponse.json({ leaveType });
  } catch (error) {
    console.error('Leave type update error:', error);
    return NextResponse.json(
      { message: '휴가유형 수정 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
