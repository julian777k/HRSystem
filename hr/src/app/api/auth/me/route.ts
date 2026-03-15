import { NextResponse } from 'next/server';
import { getCurrentUserWithRefresh, clearAuthCookie, setAuthCookie } from '@/lib/auth-actions';
import { signToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkAndSendScheduled } from '@/lib/notifications';

export async function GET() {
  try {
    const result = await getCurrentUserWithRefresh();

    if (!result) {
      return NextResponse.json(
        { message: '인증되지 않았습니다.' },
        { status: 401 }
      );
    }

    const { user, shouldRefresh } = result;

    // Verify employee still exists in DB (handles DB re-seed case)
    const employee = await prisma.employee.findUnique({
      where: { id: user.id },
      select: { id: true, customPermissions: true },
    });

    if (!employee) {
      await clearAuthCookie();
      return NextResponse.json(
        { message: '세션이 만료되었습니다. 다시 로그인해주세요.' },
        { status: 401 }
      );
    }

    // 만료 4시간 전이면 자동 토큰 갱신 (사용자 끊김 방지)
    if (shouldRefresh) {
      const newToken = await signToken(user);
      await setAuthCookie(newToken);
    }

    // Lazy cron: check scheduled webhook summaries (fire-and-forget)
    checkAndSendScheduled().catch(() => {});

    // Fetch tenant trial info for trial banner display
    let tenantTrial: { status: string; trialExpiresAt: string | null } | null = null;
    if (user.tenantId) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: user.tenantId },
        select: { status: true, trialExpiresAt: true },
      });
      if (tenant && tenant.status === 'trial') {
        tenantTrial = {
          status: tenant.status,
          trialExpiresAt: tenant.trialExpiresAt ? new Date(tenant.trialExpiresAt).toISOString() : null,
        };
      }
    }

    return NextResponse.json({
      user: {
        ...user,
        customPermissions: employee.customPermissions || null,
      },
      ...(tenantTrial && { tenantTrial }),
    });
  } catch (error) {
    console.error('Auth me error:', error);
    return NextResponse.json(
      { message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
