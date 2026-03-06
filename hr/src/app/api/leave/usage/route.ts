import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: '인증 필요' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));
    const departmentId = searchParams.get('departmentId');

    // Build employee filter
    const employeeWhere: Record<string, unknown> = { status: 'ACTIVE' };
    if (departmentId) {
      employeeWhere.departmentId = departmentId;
    } else if (!['SYSTEM_ADMIN', 'COMPANY_ADMIN'].includes(user.role)) {
      // Non-admins can only see their department
      employeeWhere.departmentId = user.departmentId;
    }

    const employees = await prisma.employee.findMany({
      where: employeeWhere,
      include: {
        department: true,
        position: true,
        leaveBalances: { where: { year } },
      },
      orderBy: [{ department: { name: 'asc' } }, { name: 'asc' }],
    });

    const data = employees.map((emp) => {
      const totalGranted = emp.leaveBalances.reduce((sum, b) => sum + b.totalGranted, 0);
      const totalUsed = emp.leaveBalances.reduce((sum, b) => sum + b.totalUsed, 0);
      const totalRemain = emp.leaveBalances.reduce((sum, b) => sum + b.totalRemain, 0);
      const usageRate = totalGranted > 0 ? Math.round((totalUsed / totalGranted) * 100) : 0;

      // 유형별 잔여 정보
      const balancesByType: Record<string, { granted: number; used: number; remain: number }> = {};
      for (const b of emp.leaveBalances) {
        balancesByType[b.leaveTypeCode] = {
          granted: b.totalGranted,
          used: b.totalUsed,
          remain: b.totalRemain,
        };
      }

      return {
        employeeId: emp.id,
        name: emp.name,
        departmentName: emp.department.name,
        positionName: emp.position.name,
        hireDate: emp.hireDate,
        totalGranted,
        totalUsed,
        totalRemain,
        usageRate,
        balancesByType,
      };
    });

    // Summary stats
    const totalEmployees = data.length;
    const avgUsageRate = totalEmployees > 0
      ? Math.round(data.reduce((sum, d) => sum + d.usageRate, 0) / totalEmployees)
      : 0;
    const totalGrantedAll = data.reduce((sum, d) => sum + d.totalGranted, 0);
    const totalUsedAll = data.reduce((sum, d) => sum + d.totalUsed, 0);

    return NextResponse.json({
      summary: { totalEmployees, avgUsageRate, totalGrantedAll, totalUsedAll },
      data,
    });
  } catch (error) {
    console.error('Leave usage error:', error);
    return NextResponse.json(
      { message: '휴가 사용현황 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
