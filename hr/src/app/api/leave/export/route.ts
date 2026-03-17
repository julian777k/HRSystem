import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';
import type { Prisma } from '@prisma/client';

const STATUS_LABELS: Record<string, string> = {
  PENDING: '대기',
  IN_PROGRESS: '진행중',
  APPROVED: '승인',
  REJECTED: '반려',
  CANCELLED: '취소',
};

const UNIT_LABELS: Record<string, string> = {
  FULL_DAY: '종일',
  AM_HALF: '오전반차',
  PM_HALF: '오후반차',
  HOURS: '시간',
};

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: '인증 필요' }, { status: 401 });

    if (!['SYSTEM_ADMIN', 'COMPANY_ADMIN'].includes(user.role)) {
      return NextResponse.json({ message: '권한이 없습니다.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const departmentId = searchParams.get('departmentId');

    const where: Prisma.LeaveRequestWhereInput = {};
    if (startDate) where.startDate = { gte: new Date(startDate) };
    if (endDate) where.endDate = { lte: new Date(endDate) };
    if (departmentId) {
      where.employee = { departmentId };
    }

    // Limit export rows to prevent memory exhaustion on large datasets
    const requests = await prisma.leaveRequest.findMany({
      where,
      include: {
        employee: { include: { department: true, position: true } },
        leaveType: true,
      },
      orderBy: { appliedAt: 'desc' },
      take: 5000,
    });

    const rows = requests.map((r) => ({
      '신청일': new Date(r.appliedAt).toISOString().split('T')[0],
      '이름': r.employee.name,
      '부서': r.employee.department.name,
      '직급': r.employee.position.name,
      '휴가유형': r.leaveType.name,
      '시작일': new Date(r.startDate).toISOString().split('T')[0],
      '종료일': new Date(r.endDate).toISOString().split('T')[0],
      '구분': UNIT_LABELS[r.useUnit] || r.useUnit,
      '일수': r.requestDays,
      '상태': STATUS_LABELS[r.status] || r.status,
      '사유': r.reason || '',
    }));

    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);

    // Set column widths
    ws['!cols'] = [
      { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 10 },
      { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 8 },
      { wch: 6 }, { wch: 8 }, { wch: 30 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, '휴가관리대장');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="leave-register-${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('Leave export error:', error);
    return NextResponse.json(
      { message: '휴가 내역 내보내기 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
