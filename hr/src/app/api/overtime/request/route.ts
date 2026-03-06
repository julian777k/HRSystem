import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: '인증 필요' }, { status: 401 });
    }

    const body = await request.json();
    const { date, overtimeType, startTime, endTime, hours, reason } = body;

    if (!date || !overtimeType || !hours || !reason) {
      return NextResponse.json(
        { message: '날짜, 근무 유형, 시간, 사유를 입력해주세요.' },
        { status: 400 }
      );
    }

    const overtimeRequest = await prisma.overtimeRequest.create({
      data: {
        employeeId: user.id,
        date: new Date(date),
        overtimeType,
        startTime: startTime || '',
        endTime: endTime || '',
        hours: parseFloat(hours),
        reason,
      },
      include: {
        employee: {
          select: { id: true, name: true, employeeNumber: true },
        },
      },
    });

    return NextResponse.json({ overtimeRequest }, { status: 201 });
  } catch (error) {
    console.error('Overtime request create error:', error);
    return NextResponse.json(
      { message: '시간외근무 신청 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
