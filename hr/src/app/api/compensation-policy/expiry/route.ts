import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-actions';
import { listExpiringCompTime, expireCompTime } from '@/lib/time-wallet';

const ADMIN_ROLES = ['SYSTEM_ADMIN', 'COMPANY_ADMIN'];

// GET: 만료됐거나 만료 임박한 보상시간 목록 (관리자)
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: '인증 필요' }, { status: 401 });
    if (!ADMIN_ROLES.includes(user.role)) {
      return NextResponse.json({ message: '권한이 없습니다.' }, { status: 403 });
    }
    const items = await listExpiringCompTime();
    return NextResponse.json({ items });
  } catch (error) {
    console.error('Comp-time expiry list error:', error);
    return NextResponse.json({ message: '만료 목록 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

// POST: 특정 직원의 특정 연도 보상시간을 수동 소멸 (관리자, 수당 정산 후)
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: '인증 필요' }, { status: 401 });
    if (!ADMIN_ROLES.includes(user.role)) {
      return NextResponse.json({ message: '권한이 없습니다.' }, { status: 403 });
    }
    const { employeeId, year } = await request.json();
    if (!employeeId || !year) {
      return NextResponse.json({ message: 'employeeId와 year가 필요합니다.' }, { status: 400 });
    }
    const { expired } = await expireCompTime(employeeId, parseInt(String(year)));
    return NextResponse.json({ message: `${expired}시간을 소멸 처리했습니다.`, expired });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : '소멸 처리 중 오류가 발생했습니다.' },
      { status: 400 }
    );
  }
}
