import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';
import { serializeJson, parseJson } from '@/lib/json-field';

const ADMIN_ROLES = ['SYSTEM_ADMIN', 'COMPANY_ADMIN'];

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: '인증 필요' }, { status: 401 });

    if (!ADMIN_ROLES.includes(user.role)) {
      return NextResponse.json({ message: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const body = await request.json();
    const { categoryId, name, description, benefitType, amount, unit, maxPerYear, formFields, requireApproval } = body;

    if (!categoryId || !name?.trim()) {
      return NextResponse.json({ message: '카테고리와 항목 이름을 입력해주세요.' }, { status: 400 });
    }

    const category = await prisma.welfareCategory.findUnique({ where: { id: categoryId } });
    if (!category) {
      return NextResponse.json({ message: '카테고리를 찾을 수 없습니다.' }, { status: 404 });
    }

    const item = await prisma.welfareItem.create({
      data: {
        categoryId,
        name: name.trim(),
        description: description || null,
        benefitType: benefitType || 'MONEY',
        amount: amount ?? null,
        unit: unit || '원',
        maxPerYear: maxPerYear ?? null,
        formFields: serializeJson(formFields ?? null),
        requireApproval: requireApproval !== undefined ? requireApproval : true,
      },
    });

    return NextResponse.json({ ...item, formFields: parseJson(item.formFields) }, { status: 201 });
  } catch (error) {
    console.error('Welfare item create error:', error);
    return NextResponse.json(
      { message: '복지 항목 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
