import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken, COOKIE_NAME } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const user = token ? await verifyToken(token) : null;

  if (!user) {
    return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 });
  }

  try {
    const configs = await prisma.systemConfig.findMany({
      where: { group: 'company' },
    });

    const settings: Record<string, string> = {};
    for (const cfg of configs) {
      settings[cfg.key] = cfg.value;
    }

    return NextResponse.json({ settings });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '알 수 없는 오류';
    return NextResponse.json({ message: `조회 실패: ${msg}` }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const user = token ? await verifyToken(token) : null;

  if (!user || (user.role !== 'SYSTEM_ADMIN' && user.role !== 'COMPANY_ADMIN')) {
    return NextResponse.json({ message: '권한이 없습니다.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { settings } = body as { settings: Record<string, string> };

    const allowedKeys = [
      'company_name',
      'biz_number',
      'representative',
      'address',
      'work_start_time',
      'work_end_time',
      'lunch_start_time',
      'lunch_end_time',
      'server_url',
    ];

    for (const [key, value] of Object.entries(settings)) {
      if (!allowedKeys.includes(key)) continue;

      await prisma.systemConfig.upsert({
        where: { key },
        update: { value },
        create: { key, value, group: 'company' },
      });
    }

    return NextResponse.json({ success: true, message: '설정이 저장되었습니다.' });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '알 수 없는 오류';
    return NextResponse.json({ message: `저장 실패: ${msg}` }, { status: 500 });
  }
}
