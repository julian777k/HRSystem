import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';
import { parseJson } from '@/lib/json-field';

const ADMIN_ROLES = ['SYSTEM_ADMIN', 'COMPANY_ADMIN'];

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: '인증 필요' }, { status: 401 });

    const isAdmin = ADMIN_ROLES.includes(user.role);
    const { searchParams } = new URL(request.url);
    const adminView = searchParams.get('view') === 'admin' && isAdmin;

    const categories = await prisma.welfareCategory.findMany({
      where: adminView ? undefined : { isActive: true },
      include: {
        items: {
          where: adminView ? undefined : { isActive: true },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    const parsed = categories.map(cat => ({
      ...cat,
      items: cat.items.map(item => ({
        ...item,
        formFields: parseJson(item.formFields),
      })),
    }));

    return NextResponse.json({ categories: parsed });
  } catch (error) {
    console.error('Welfare category list error:', error);
    return NextResponse.json(
      { message: '복지 카테고리 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: '인증 필요' }, { status: 401 });

    if (!ADMIN_ROLES.includes(user.role)) {
      return NextResponse.json({ message: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, icon, sortOrder } = body;

    if (!name?.trim()) {
      return NextResponse.json({ message: '카테고리 이름을 입력해주세요.' }, { status: 400 });
    }

    const category = await prisma.welfareCategory.create({
      data: {
        name: name.trim(),
        description: description || null,
        icon: icon || null,
        sortOrder: sortOrder ?? 0,
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error: unknown) {
    console.error('Welfare category create error:', error);
    const prismaError = error as { code?: string };
    if (prismaError.code === 'P2002') {
      return NextResponse.json(
        { message: '같은 이름의 카테고리가 이미 존재합니다.' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { message: '복지 카테고리 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
