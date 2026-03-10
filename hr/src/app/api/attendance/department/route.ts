import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';
import { isHoliday, isWeekday } from '@/lib/attendance-utils';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: '인증 필요' }, { status: 401 });
    }

    const isAdmin = ['SYSTEM_ADMIN', 'COMPANY_ADMIN'].includes(user.role);
    const isManager = user.role === 'MANAGER';

    if (!isAdmin && !isManager) {
      return NextResponse.json(
        { message: '부서 근태 조회 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    const departmentId = searchParams.get('departmentId') || user.departmentId;

    if (!isAdmin && departmentId !== user.departmentId) {
      return NextResponse.json(
        { message: '다른 부서의 근태를 조회할 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const targetDate = dateParam ? new Date(dateParam) : new Date();
    const dayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());

    // 근무일 여부 판정 (공휴일 + 회사휴무 + 부서휴무 통합 확인)
    const workday = isWeekday(dayStart) && !(await isHoliday(dayStart, departmentId));

    const employees = await prisma.employee.findMany({
      where: {
        departmentId,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        name: true,
        employeeNumber: true,
        position: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    });

    const attendances = await prisma.attendance.findMany({
      where: {
        employeeId: { in: employees.map(e => e.id) },
        date: dayStart,
      },
    });

    const attendanceMap = new Map(
      attendances.map(a => [a.employeeId, a])
    );

    // 자동 근태 시스템: 근무일이면 기록이 없는 직원도 '정상근무'로 표시
    const departmentAttendance = employees.map(emp => {
      const att = attendanceMap.get(emp.id);
      if (att) {
        return {
          employee: emp,
          attendance: att,
          status: att.status || 'NORMAL',
        };
      }
      // 근무일인데 기록이 없으면 자동 기록 대상 (정상근무)
      if (workday) {
        return {
          employee: emp,
          attendance: null,
          status: 'NORMAL',
        };
      }
      // 비근무일
      return {
        employee: emp,
        attendance: null,
        status: 'DAY_OFF',
      };
    });

    const stats = {
      total: employees.length,
      normal: departmentAttendance.filter(d => d.status === 'NORMAL').length,
      dayOff: departmentAttendance.filter(d => d.status === 'DAY_OFF').length,
      late: attendances.filter(a => a.status === 'LATE').length,
    };

    return NextResponse.json({
      date: dayStart.toISOString(),
      departmentId,
      isWorkday: workday,
      stats,
      members: departmentAttendance,
    });
  } catch (error) {
    console.error('Department attendance error:', error);
    return NextResponse.json(
      { message: '부서 근태 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
