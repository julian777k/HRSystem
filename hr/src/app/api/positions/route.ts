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
    const all = searchParams.get('all') === 'true';

    const positions = await prisma.position.findMany({
      where: all ? {} : { isActive: true },
      include: { _count: { select: { employees: true } } },
      orderBy: { level: 'asc' },
    });

    return NextResponse.json({ positions });
  } catch (error) {
    console.error('Position list error:', error);
    return NextResponse.json(
      { message: '직급 목록 조회 중 오류가 발생했습니다.' },
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

    const { name, level } = await request.json();

    if (!name || level === undefined || level === null) {
      return NextResponse.json(
        { message: '직급명과 레벨을 입력해주세요.' },
        { status: 400 }
      );
    }

    const position = await prisma.position.create({
      data: { name, level: Number(level) },
    });

    return NextResponse.json({ position }, { status: 201 });
  } catch (error) {
    console.error('Position create error:', error);
    const message =
      error instanceof Error && error.message.includes('Unique constraint')
        ? '이미 존재하는 직급명 또는 레벨입니다.'
        : '직급 생성 중 오류가 발생했습니다.';
    return NextResponse.json({ message }, { status: 500 });
  }
}
