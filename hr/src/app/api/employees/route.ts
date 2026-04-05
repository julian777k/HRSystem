import { NextRequest, NextResponse } from 'next/server';
import { hashPassword } from '@/lib/password';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';
import { containsFilter } from '@/lib/db-utils';
import { getTenantId } from '@/lib/tenant-context';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: '인증 필요' }, { status: 401 });
    }

    if (!['SYSTEM_ADMIN', 'COMPANY_ADMIN'].includes(user.role)) {
      return NextResponse.json({ message: '권한이 없습니다.' }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const search = searchParams.get('search') || '';
    const department = searchParams.get('department') || '';
    const position = searchParams.get('position') || '';
    const status = searchParams.get('status') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { name: containsFilter(search) },
        { employeeNumber: containsFilter(search) },
        { email: containsFilter(search) },
      ];
    }

    if (department) {
      where.departmentId = department;
    }

    if (position) {
      where.positionId = position;
    }

    if (status) {
      where.status = status;
    }

    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        include: {
          department: { select: { id: true, name: true } },
          position: { select: { id: true, name: true, level: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.employee.count({ where }),
    ]);

    const sanitized = employees.map(({ passwordHash, ...rest }) => rest);

    return NextResponse.json({ employees: sanitized, total, page, limit });
  } catch (error) {
    console.error('Employee list error:', error);
    return NextResponse.json(
      { message: '직원 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: '인증 필요' }, { status: 401 });
    }

    if (user.role !== 'SYSTEM_ADMIN' && user.role !== 'COMPANY_ADMIN') {
      return NextResponse.json({ message: '권한이 없습니다.' }, { status: 403 });
    }

    const body = await request.json();
    const {
      employeeNumber: inputEmployeeNumber,
      name,
      email,
      password,
      phone,
      departmentId,
      positionId,
      hireDate,
      role,
    } = body;

    if (!name || !email || !password || !departmentId || !positionId || !hireDate) {
      return NextResponse.json(
        { message: '필수 항목을 모두 입력해주세요.' },
        { status: 400 }
      );
    }

    const tenantId = await getTenantId();
    const existingEmail = await prisma.employee.findFirst({ where: { email, tenantId } });
    if (existingEmail) {
      return NextResponse.json(
        { message: '이미 사용 중인 이메일입니다.' },
        { status: 409 }
      );
    }

    // 사번 자동생성: 비어있으면 EMP-YYYYMMDD-NNN 형식으로 생성
    let employeeNumber = (inputEmployeeNumber || '').trim();
    if (!employeeNumber) {
      const today = new Date();
      const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
      const prefix = `EMP-${dateStr}-`;
      const lastEmp = await prisma.employee.findFirst({
        where: { employeeNumber: { startsWith: prefix } },
        orderBy: { employeeNumber: 'desc' },
      });
      const seq = lastEmp
        ? parseInt(lastEmp.employeeNumber.slice(prefix.length), 10) + 1
        : 1;
      employeeNumber = `${prefix}${String(seq).padStart(3, '0')}`;
    }

    const existingNumber = await prisma.employee.findFirst({
      where: { employeeNumber, tenantId },
    });
    if (existingNumber) {
      return NextResponse.json(
        { message: '이미 사용 중인 사번입니다.' },
        { status: 409 }
      );
    }

    // Role validation: enforce role hierarchy
    const assignedRole = role || 'BASIC';
    const ADMIN_ROLES = ['SYSTEM_ADMIN', 'COMPANY_ADMIN'];
    if (ADMIN_ROLES.includes(assignedRole) && user.role !== 'SYSTEM_ADMIN') {
      return NextResponse.json(
        { message: '관리자 역할은 시스템 관리자만 부여할 수 있습니다.' },
        { status: 403 }
      );
    }

    const passwordHash = await hashPassword(password);

    const employee = await prisma.employee.create({
      data: {
        employeeNumber,
        name,
        email,
        passwordHash,
        phone: phone || null,
        departmentId,
        positionId,
        hireDate: new Date(hireDate),
        role: assignedRole,
      },
      include: {
        department: { select: { id: true, name: true } },
        position: { select: { id: true, name: true, level: true } },
      },
    });

    const { passwordHash: _, ...sanitized } = employee;

    return NextResponse.json({ employee: sanitized }, { status: 201 });
  } catch (error) {
    console.error('Employee create error:', error);
    return NextResponse.json(
      { message: '직원 등록 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
