import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';

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
    const { name, description, icon, sortOrder, isActive } = body;

    // Validate name if provided
    if (name !== undefined && typeof name === 'string' && !name.trim()) {
      return NextResponse.json({ message: '카테고리 이름을 입력해주세요.' }, { status: 400 });
    }

    const category = await prisma.welfareCategory.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description }),
        ...(icon !== undefined && { icon }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json(category);
  } catch (error) {
    console.error('Welfare category update error:', error);
    return NextResponse.json(
      { message: '복지 카테고리 수정 중 오류가 발생했습니다.' },
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

    // Check for existing requests on items in this category
    const requestCount = await prisma.welfareRequest.count({
      where: { item: { categoryId: id } },
    });

    if (requestCount > 0) {
      return NextResponse.json(
        { message: `이 카테고리의 항목에 ${requestCount}건의 신청이 있어 삭제할 수 없습니다. 비활성화를 이용해주세요.` },
        { status: 400 }
      );
    }

    await prisma.welfareCategory.delete({
      where: { id },
    });

    return NextResponse.json({ message: '삭제되었습니다.' });
  } catch (error) {
    console.error('Welfare category delete error:', error);
    return NextResponse.json(
      { message: '복지 카테고리 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
