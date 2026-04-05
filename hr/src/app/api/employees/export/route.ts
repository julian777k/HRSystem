import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';
import { getTenantId } from '@/lib/tenant-context';
import { checkRateLimit } from '@/lib/rate-limit';

const STATUS_LABELS: Record<string, string> = {
  PENDING: '승인대기',
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

    // Rate limit: 10 exports per 15 minutes per user
    const rl = await checkRateLimit(`export:emp:${user.id}`, 10, 15 * 60 * 1000);
    if (!rl.success) {
      return NextResponse.json(
        { message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
        { status: 429 }
      );
    }

    const tenantId = await getTenantId();

    // Limit export rows to prevent memory exhaustion on large datasets
    const employees = await prisma.employee.findMany({
      where: { tenantId, status: { not: 'RESIGNED' } },
      include: {
        department: { select: { name: true } },
        position: { select: { name: true } },
      },
      orderBy: { employeeNumber: 'asc' },
      take: 5000,
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

    // Generate CSV
    const csvHeaders = Object.keys(data[0] || {});
    const csvLines = [
      csvHeaders.join(','),
      ...data.map((row) =>
        csvHeaders.map((h) => {
          const val = String(row[h as keyof typeof row] ?? '');
          return val.includes(',') || val.includes('"') || val.includes('\n')
            ? `"${val.replace(/"/g, '""')}"`
            : val;
        }).join(',')
      ),
    ];
    const csvString = '\uFEFF' + csvLines.join('\r\n'); // BOM for Excel UTF-8

    return new NextResponse(csvString, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="employees_${new Date().toISOString().split('T')[0]}.csv"`,
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
