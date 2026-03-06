import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/auth/register/options - 회원가입용 부서/직급 목록 (인증 불필요)
 * 활성 상태인 부서/직급만 반환 (id, name만)
 */
export async function GET() {
  try {
    const [departments, positions] = await Promise.all([
      prisma.department.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { sortOrder: 'asc' },
      }),
      prisma.position.findMany({
        where: { isActive: true },
        select: { id: true, name: true, level: true },
        orderBy: { level: 'asc' },
      }),
    ]);

    return NextResponse.json({ departments, positions });
  } catch (error) {
    console.error('Register options error:', error);
    return NextResponse.json(
      { message: '옵션 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
