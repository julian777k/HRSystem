import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';
import { getTenantId } from '@/lib/tenant-context';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: '인증 필요' }, { status: 401 });

    const tenantId = await getTenantId();

    const rows = await (prisma as any).$queryRawUnsafe(
      `SELECT * FROM leave_of_absences WHERE employeeId = ? AND tenantId = ? ORDER BY createdAt DESC`,
      user.id, tenantId
    );

    return NextResponse.json({ absences: rows || [] });
  } catch (error) {
    console.error('My absence list error:', error);
    return NextResponse.json({ message: '휴직 내역 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
