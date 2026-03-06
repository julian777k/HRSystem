import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-actions';
import { getWalletBalance } from '@/lib/time-wallet';

/**
 * GET /api/time-wallet - 내 시간 지갑 잔액 조회
 * query: ?year=2026&employeeId=xxx (관리자만 다른 직원 조회 가능)
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: '인증 필요' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));
    let employeeId = user.id;

    // 관리자는 다른 직원 조회 가능
    const requestedId = searchParams.get('employeeId');
    if (requestedId) {
      if (!['SYSTEM_ADMIN', 'COMPANY_ADMIN'].includes(user.role)) {
        return NextResponse.json({ message: '권한이 없습니다.' }, { status: 403 });
      }
      employeeId = requestedId;
    }

    const balance = await getWalletBalance(employeeId, year);

    return NextResponse.json(balance);
  } catch (error) {
    console.error('Time wallet error:', error);
    return NextResponse.json(
      { message: '시간 지갑 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
