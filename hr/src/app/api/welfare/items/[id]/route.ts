import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';
import { serializeJson, parseJson } from '@/lib/json-field';

const ADMIN_ROLES = ['SYSTEM_ADMIN', 'COMPANY_ADMIN'];

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: '인증 필요' }, { status: 401 });

    if (!ADMIN_ROLES.includes(user.role)) {
      return NextResponse.json({ message: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, description, benefitType, amount, unit, maxPerYear, isActive, formFields, requireApproval } = body;

    // Validate name if provided
    if (name !== undefined && typeof name === 'string' && !name.trim()) {
      return NextResponse.json({ message: '항목 이름을 입력해주세요.' }, { status: 400 });
    }

    // Validate amount if provided
    if (amount !== undefined && amount !== null && (typeof amount !== 'number' || isNaN(amount) || amount < 0)) {
      return NextResponse.json({ message: '금액이 올바르지 않습니다.' }, { status: 400 });
    }

    // Validate maxPerYear if provided
    if (maxPerYear !== undefined && maxPerYear !== null && (typeof maxPerYear !== 'number' || !Number.isInteger(maxPerYear) || maxPerYear < 1)) {
      return NextResponse.json({ message: '연간 최대 신청 횟수는 1 이상의 정수여야 합니다.' }, { status: 400 });
    }

    const item = await prisma.welfareItem.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description }),
        ...(benefitType !== undefined && { benefitType }),
        ...(amount !== undefined && { amount }),
        ...(unit !== undefined && { unit }),
        ...(maxPerYear !== undefined && { maxPerYear }),
        ...(isActive !== undefined && { isActive }),
        ...(formFields !== undefined && { formFields: serializeJson(formFields) }),
        ...(requireApproval !== undefined && { requireApproval }),
      },
    });

    return NextResponse.json({ ...item, formFields: parseJson(item.formFields) });
  } catch (error) {
    console.error('Welfare item update error:', error);
    return NextResponse.json(
      { message: '복지 항목 수정 중 오류가 발생했습니다.' },
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

    if (!ADMIN_ROLES.includes(user.role)) {
      return NextResponse.json({ message: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { id } = await params;

    // 연결된 신청이 있으면 삭제 불가
    const requestCount = await prisma.welfareRequest.count({ where: { itemId: id } });
    if (requestCount > 0) {
      return NextResponse.json(
        { message: `이 항목에 ${requestCount}건의 신청이 있어 삭제할 수 없습니다. 비활성화를 이용해주세요.` },
        { status: 400 }
      );
    }

    await prisma.welfareItem.delete({
      where: { id },
    });

    return NextResponse.json({ message: '삭제되었습니다.' });
  } catch (error) {
    console.error('Welfare item delete error:', error);
    return NextResponse.json(
      { message: '복지 항목 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
