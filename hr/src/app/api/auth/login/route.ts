import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword } from '@/lib/password';
import { prisma } from '@/lib/prisma';
import { signToken, type AuthUser } from '@/lib/auth';
import { setAuthCookie } from '@/lib/auth-actions';
import { checkRateLimit } from '@/lib/rate-limit';
import { getTenantIdSafe } from '@/lib/tenant-context';
import { cleanupExpiredSessions } from '@/lib/session-cleanup';
import { writeAuditLog } from '@/lib/audit-log';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { message: '이메일과 비밀번호를 입력해주세요.' },
        { status: 400 }
      );
    }

    // Rate limit: 5 attempts per email per 15 minutes
    const rateLimitResult = await checkRateLimit(`login:${email}`, 5, 900 * 1000);
    if (!rateLimitResult.success) {
      const retrySeconds = Math.ceil((rateLimitResult.retryAfterMs || 0) / 1000);
      return NextResponse.json(
        { message: `로그인 시도가 너무 많습니다. ${retrySeconds}초 후 다시 시도해주세요.` },
        { status: 429 }
      );
    }

    const tenantId = await getTenantIdSafe();

    const employee = await prisma.employee.findFirst({
      where: { email, tenantId },
      include: { department: true, position: true },
    });

    if (!employee || !(await verifyPassword(password, employee.passwordHash))) {
      return NextResponse.json(
        { message: '이메일 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    if (employee.status === 'PENDING') {
      return NextResponse.json(
        { message: '계정이 아직 활성화되지 않았습니다. 관리자에게 문의하세요.' },
        { status: 403 }
      );
    }

    if (employee.status !== 'ACTIVE') {
      return NextResponse.json(
        { message: '비활성화된 계정입니다. 관리자에게 문의하세요.' },
        { status: 403 }
      );
    }

    const authUser: AuthUser = {
      id: employee.id,
      email: employee.email,
      name: employee.name,
      role: employee.role,
      departmentId: employee.departmentId,
      departmentName: employee.department.name,
      positionName: employee.position.name,
      tenantId: tenantId,
    };

    const token = await signToken(authUser);

    // Clean up old sessions for this employee, then create new one
    await prisma.session.deleteMany({
      where: { employeeId: employee.id },
    });

    await prisma.session.create({
      data: {
        employeeId: employee.id,
        token,
        tenantId: tenantId,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });

    await setAuthCookie(token);

    // Fire-and-forget: clean up expired sessions
    cleanupExpiredSessions().catch(() => {});

    writeAuditLog({ action: 'LOGIN', target: 'employee', targetId: employee.id, ipAddress: request.headers.get('x-forwarded-for') || 'unknown' });

    return NextResponse.json({
      message: '로그인 성공',
      user: authUser,
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
