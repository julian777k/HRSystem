import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: '재직',
  ON_LEAVE: '휴직',
  RESIGNED: '퇴직',
};

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: '인증 필요' }, { status: 401 });
    }

    if (!['SYSTEM_ADMIN', 'COMPANY_ADMIN'].includes(user.role)) {
      return NextResponse.json({ message: '권한이 없습니다.' }, { status: 403 });
    }

    const employees = await prisma.employee.findMany({
      where: { status: { not: 'RESIGNED' } },
      include: {
        department: { select: { name: true } },
        position: { select: { name: true } },
      },
      orderBy: { employeeNumber: 'asc' },
    });

    const data = employees.map((emp) => ({
      '사번': emp.employeeNumber,
      '이름': emp.name,
      '이메일': emp.email,
      '전화번호': emp.phone || '',
      '부서': emp.department.name,
      '직급': emp.position.name,
      '입사일': emp.hireDate.toISOString().split('T')[0],
      '상태': STATUS_LABELS[emp.status] || emp.status,
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '직원목록');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buffer, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="employees_${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('Employee export error:', error);
    return NextResponse.json(
      { message: '엑셀 내보내기 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
