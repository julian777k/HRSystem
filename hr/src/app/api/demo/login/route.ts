import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signToken, type AuthUser } from '@/lib/auth';
import { setAuthCookie } from '@/lib/auth-actions';
import { checkRateLimit } from '@/lib/rate-limit';
import { getTenantIdSafe } from '@/lib/tenant-context';
import { isSaaSMode } from '@/lib/deploy-config';

// 공개 데모 자동 로그인.
// demo 서브도메인에서만 동작하므로 host-only 쿠키가 demo.keystonehr.app에만 붙는다
// (테넌트 격리 유지 — 절대 쿠키 domain을 넓히지 말 것).
const DEMO_SUBDOMAIN = 'demo';
const DEMO_SESSION_HOURS = 2;
// 방문자에게 "○○님, 환영합니다"로 보이는 계정. 실제 직원 이름이 뜨지 않도록 전용 계정을 쓴다.
const DEMO_ACCOUNT_EMAIL = 'demo@keystonehr.app';

export async function GET(request: NextRequest) {
    if (!isSaaSMode()) {
        return NextResponse.json({ message: 'Not found' }, { status: 404 });
    }

    // 이 라우트는 demo 테넌트 컨텍스트에서만 유효하다
    const subdomain = request.headers.get('x-tenant-subdomain');
    if (subdomain !== DEMO_SUBDOMAIN) {
        return NextResponse.json({ message: 'Not found' }, { status: 404 });
    }

    const ip = request.headers.get('cf-connecting-ip') ||
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rateLimit = await checkRateLimit(`demo-login:${ip}`, 10, 10 * 60 * 1000);
    if (!rateLimit.success) {
        return NextResponse.json(
            { message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
            { status: 429 }
        );
    }

    const tenantId = await getTenantIdSafe();
    if (!tenantId) {
        return NextResponse.json({ message: 'Not found' }, { status: 404 });
    }

    // 데모 전용 계정으로만 세션을 발급한다 (실제 직원 계정으로 로그인시키지 않는다)
    const employee = await prisma.employee.findFirst({
        where: { tenantId, email: DEMO_ACCOUNT_EMAIL, status: 'ACTIVE' },
        include: { department: true, position: true },
    });

    if (!employee) {
        return NextResponse.json({ message: '데모 계정을 찾을 수 없습니다.' }, { status: 503 });
    }

    const authUser: AuthUser = {
        id: employee.id,
        email: employee.email,
        name: employee.name,
        role: employee.role,
        departmentId: employee.departmentId,
        departmentName: employee.department.name,
        positionName: employee.position.name,
        tenantId,
    };

    const token = await signToken(authUser);

    // 일반 로그인과 달리 기존 세션을 지우지 않는다 — 여러 방문자가 동시에 데모를 볼 수 있어야 한다
    await prisma.session.create({
        data: {
            employeeId: employee.id,
            token,
            tenantId,
            expiresAt: new Date(Date.now() + DEMO_SESSION_HOURS * 60 * 60 * 1000),
            ipAddress: ip,
            userAgent: request.headers.get('user-agent') || 'unknown',
        },
    });

    await setAuthCookie(token);

    return NextResponse.redirect(new URL('/dashboard', request.url));
}
