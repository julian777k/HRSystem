import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';
import { getTenantId } from '@/lib/tenant-context';

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
    const { status, comment } = await request.json();
    const tenantId = await getTenantId();

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json({ message: '유효하지 않은 상태입니다.' }, { status: 400 });
    }

    const rows = await (prisma as any).$queryRawUnsafe(
      `SELECT id, employeeId, status FROM leave_of_absences WHERE id = ? AND tenantId = ?`, id, tenantId
    );
    const existing = rows?.[0];
    if (!existing) {
      return NextResponse.json({ message: '휴직 신청을 찾을 수 없습니다.' }, { status: 404 });
    }
    if (existing.status !== 'PENDING') {
      return NextResponse.json({ message: '대기 중인 신청만 처리할 수 있습니다.' }, { status: 400 });
    }

    const now = new Date().toISOString();

    await (prisma as any).$executeRawUnsafe(
      `UPDATE leave_of_absences SET status = ?, adminComment = ?, approvedBy = ?, approvedAt = ?, updatedAt = ? WHERE id = ? AND tenantId = ?`,
      status, comment || null, user.id, now, now, id, tenantId
    );

    // On APPROVED: set employee status to ON_LEAVE
    if (status === 'APPROVED') {
      await prisma.employee.update({
        where: { id: existing.employeeId },
        data: { status: 'ON_LEAVE' },
      });
    }

    return NextResponse.json({ message: status === 'APPROVED' ? '승인되었습니다.' : '반려되었습니다.' });
  } catch (error) {
    console.error('Absence approve/reject error:', error);
    return NextResponse.json({ message: '휴직 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: '인증 필요' }, { status: 401 });

    const { id } = await params;
    const isAdmin = ADMIN_ROLES.includes(user.role);

    const tenantId = await getTenantId();
    const rows = await (prisma as any).$queryRawUnsafe(
      `SELECT id, employeeId, status FROM leave_of_absences WHERE id = ? AND tenantId = ?`, id, tenantId
    );
    const existing = rows?.[0];
    if (!existing) {
      return NextResponse.json({ message: '휴직 신청을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (!isAdmin && existing.employeeId !== user.id) {
      return NextResponse.json({ message: '본인의 신청만 취소할 수 있습니다.' }, { status: 403 });
    }
    if (!isAdmin && existing.status !== 'PENDING') {
      return NextResponse.json({ message: '대기 중인 신청만 취소할 수 있습니다.' }, { status: 400 });
    }

    const now = new Date().toISOString();

    // If was APPROVED, restore employee to ACTIVE
    if (existing.status === 'APPROVED') {
      await prisma.employee.update({
        where: { id: existing.employeeId },
        data: { status: 'ACTIVE' },
      });
    }

    await (prisma as any).$executeRawUnsafe(
      `UPDATE leave_of_absences SET status = 'CANCELLED', updatedAt = ? WHERE id = ? AND tenantId = ?`, now, id, tenantId
    );

    return NextResponse.json({ message: '휴직 신청이 취소되었습니다.' });
  } catch (error) {
    console.error('Absence cancel error:', error);
    return NextResponse.json({ message: '휴직 취소 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
