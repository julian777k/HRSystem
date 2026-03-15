import { NextRequest, NextResponse } from 'next/server';
import { hashPassword, validatePasswordPolicy } from '@/lib/password';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';
import { getTenantIdSafe } from '@/lib/tenant-context';

/**
 * POST /api/auth/register - 직원 자체 회원가입
 * 사원번호는 선택사항 (없으면 자동 생성)
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limit: 5 registrations per IP per hour
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const rateLimitResult = await checkRateLimit(`register:${ip}`, 5, 60 * 60 * 1000);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { message: '회원가입 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { name, email, password, phone, departmentId, positionId, employeeNumber, departmentName, positionName } = body;

    if (!name || !email || !password || !phone) {
      return NextResponse.json(
        { message: '이름, 이메일, 비밀번호, 연락처는 필수입니다.' },
        { status: 400 }
      );
    }

    const pwError = validatePasswordPolicy(password);
    if (pwError) {
      return NextResponse.json({ message: pwError }, { status: 400 });
    }

    const tenantId = await getTenantIdSafe();

    // 이메일 중복 확인 (테넌트 범위)
    const existing = await prisma.employee.findFirst({ where: { tenantId, email } });
    if (existing) {
      return NextResponse.json(
        { message: '이미 등록된 이메일입니다.' },
        { status: 409 }
      );
    }

    // 사원번호 처리 (입력값 또는 자동생성)
    let finalEmployeeNumber = employeeNumber?.trim();
    if (!finalEmployeeNumber) {
      // 자동생성: EMP + 년도 + 순번 (기존 최대값 기반으로 충돌 방지)
      const year = new Date().getFullYear().toString().slice(-2);
      const prefix = `EMP${year}`;
      const lastEmp = await prisma.employee.findFirst({
        where: { employeeNumber: { startsWith: prefix } },
        orderBy: { employeeNumber: 'desc' },
      });
      const seq = lastEmp
        ? parseInt(lastEmp.employeeNumber.slice(prefix.length), 10) + 1
        : 1;
      finalEmployeeNumber = `${prefix}${String(seq).padStart(4, '0')}`;
    }

    // 사원번호 중복 확인 (테넌트 범위)
    const existingNumber = await prisma.employee.findFirst({
      where: { tenantId, employeeNumber: finalEmployeeNumber },
    });
    if (existingNumber) {
      return NextResponse.json(
        { message: '이미 사용중인 사원번호입니다.' },
        { status: 409 }
      );
    }

    // 부서 결정: ID 선택 > 이름 입력으로 찾기/생성 > 기본값
    let deptId = departmentId;
    let posId = positionId;

    if (!deptId && departmentName?.trim()) {
      // 이름으로 기존 부서 찾기 (생성은 관리자만 가능)
      const existing = await prisma.department.findFirst({
        where: { name: departmentName.trim() },
      });
      if (existing) {
        deptId = existing.id;
      }
    }

    if (!deptId) {
      const defaultDept = await prisma.department.findFirst({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      });
      if (!defaultDept) {
        return NextResponse.json(
          { message: '등록된 부서가 없습니다. 부서명을 입력해주세요.' },
          { status: 400 }
        );
      }
      deptId = defaultDept.id;
    }

    // 직급 결정: ID 선택 > 이름 입력으로 찾기/생성 > 기본값
    if (!posId && positionName?.trim()) {
      // 이름으로 기존 직급 찾기 (생성은 관리자만 가능)
      const existing = await prisma.position.findFirst({
        where: { name: positionName.trim() },
      });
      if (existing) {
        posId = existing.id;
      }
    }

    if (!posId) {
      const defaultPos = await prisma.position.findFirst({
        where: { isActive: true },
        orderBy: { level: 'asc' },
      });
      if (!defaultPos) {
        return NextResponse.json(
          { message: '등록된 직급이 없습니다. 직급명을 입력해주세요.' },
          { status: 400 }
        );
      }
      posId = defaultPos.id;
    }

    const passwordHash = await hashPassword(password);

    const employee = await prisma.employee.create({
      data: {
        employeeNumber: finalEmployeeNumber,
        name,
        email,
        passwordHash,
        phone: phone || null,
        departmentId: deptId,
        positionId: posId,
        hireDate: new Date(),
        status: 'ACTIVE',
        role: 'BASIC',
      },
    });

    return NextResponse.json(
      {
        message: '회원가입이 완료되었습니다. 바로 로그인할 수 있습니다.',
        employee: {
          name: employee.name,
          email: employee.email,
          employeeNumber: employee.employeeNumber,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json(
      { message: '회원가입 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
