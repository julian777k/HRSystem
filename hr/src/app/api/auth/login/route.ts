import { NextRequest, NextResponse, after } from 'next/server';
import { verifyPassword, DUMMY_PASSWORD_HASH } from '@/lib/password';
import { prisma } from '@/lib/prisma';
import { signToken, type AuthUser } from '@/lib/auth';
import { setAuthCookie } from '@/lib/auth-actions';
import { checkRateLimit } from '@/lib/rate-limit';
import { getTenantIdSafe } from '@/lib/tenant-context';
import { isSaaSMode } from '@/lib/deploy-config';
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

    // IP-based rate limit: 20 attempts per IP per 15 minutes (prevents credential stuffing across emails)
    const ip = request.headers.get('cf-connecting-ip') ||
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const ipRateLimit = await checkRateLimit(`login-ip:${ip}`, 20, 15 * 60 * 1000);
    if (!ipRateLimit.success) {
      const retryMinutes = Math.ceil((ipRateLimit.retryAfterMs || 0) / 60000);
      return NextResponse.json(
        { message: `로그인 시도가 너무 많습니다. ${retryMinutes > 0 ? retryMinutes + '분' : '잠시'} 후 다시 시도해주세요.` },
        { status: 429 }
      );
    }

    // Rate limit: 5 attempts per email per 15 minutes
    const rateLimitResult = await checkRateLimit(`login:${email}`, 5, 15 * 60 * 1000);
    if (!rateLimitResult.success) {
      const retryMinutes = Math.ceil((rateLimitResult.retryAfterMs || 0) / 60000);
      const retryDisplay = retryMinutes > 0 ? `${retryMinutes}분` : '잠시';
      return NextResponse.json(
        { message: `로그인 시도가 너무 많습니다. ${retryDisplay} 후 다시 시도해주세요.` },
        { status: 429 }
      );
    }

    const tenantId = await getTenantIdSafe();

    // SaaS 루트 도메인(tenantId 없음)에서는 로그인 불가
    if (isSaaSMode() && !tenantId) {
      return NextResponse.json(
        { message: '회사 전용 주소(예: 회사명.keystonehr.app)에서 로그인해주세요.' },
        { status: 400 }
      );
    }

    const employee = await prisma.employee.findFirst({
      where: { email, tenantId },
      include: { department: true, position: true },
    });

    if (!employee) {
      console.warn(`[Auth] Failed login: user not found — email=${email}, ip=${ip}`);
      // 타이밍 균일화: 존재하지 않는 계정도 동일한 해시 검증 시간 소요 (사용자 열거 방지)
      await verifyPassword(password, DUMMY_PASSWORD_HASH);
      return NextResponse.json(
        { message: '이메일 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    // 계정 잠금 확인 — DB 영속 카운터라 isolate 분산 무차별 대입도 차단
    if (employee.lockedUntil) {
      const lockedUntil = new Date(employee.lockedUntil as unknown as string);
      if (lockedUntil > new Date()) {
        const remainingMin = Math.ceil((lockedUntil.getTime() - Date.now()) / 60000);
        return NextResponse.json(
          { message: `계정이 잠겨 있습니다. ${remainingMin}분 후 다시 시도해주세요.` },
          { status: 423 }
        );
      }
    }

    if (!(await verifyPassword(password, employee.passwordHash))) {
      console.warn(`[Auth] Failed login: wrong password — email=${email}, ip=${ip}`);
      // 실패 횟수 누적 + 임계 초과 시 잠금 (5회→30분, 10회→2시간)
      const newCount = (employee.failedLoginCount || 0) + 1;
      const updateData: Record<string, unknown> = { failedLoginCount: newCount };
      if (newCount >= 10) {
        updateData.lockedUntil = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
      } else if (newCount >= 5) {
        updateData.lockedUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      }
      // 실패 카운트 기록은 응답 후(after)로 미룬다 — 존재 계정만 DB write 지연이
      // 생기는 타이밍 사이드채널(계정 열거)을 제거. after()는 Workers waitUntil로
      // 실행이 보장되어 잠금 기록이 누락되지 않는다.
      after(async () => {
        await prisma.employee.update({ where: { id: employee.id }, data: updateData }).catch(() => {});
      });
      return NextResponse.json(
        { message: '이메일 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    if (employee.status === 'PENDING') {
      console.warn(`[Auth] Failed login: account pending — email=${email}, ip=${ip}`);
      return NextResponse.json(
        { message: '계정이 아직 활성화되지 않았습니다. 관리자에게 문의하세요.' },
        { status: 403 }
      );
    }

    if (employee.status !== 'ACTIVE' && employee.status !== 'ON_LEAVE') {
      console.warn(`[Auth] Failed login: account suspended — email=${email}, ip=${ip}`);
      return NextResponse.json(
        { message: '비활성화된 계정입니다. 관리자에게 문의하세요.' },
        { status: 403 }
      );
    }

    // 로그인 성공: 실패 카운터 리셋 + 최근 로그인 시각 갱신
    await prisma.employee.update({
      where: { id: employee.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date().toISOString() },
    });

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
