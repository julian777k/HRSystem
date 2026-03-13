import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';
import { getTenantId } from '@/lib/tenant-context';
import { writeAuditLog } from '@/lib/audit-log';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 });
    }

    const configs = await prisma.systemConfig.findMany({
      where: { group: 'company' },
    });

    const settings: Record<string, string> = {};
    for (const cfg of configs) {
      settings[cfg.key] = cfg.value;
    }

    return NextResponse.json({ settings });
  } catch (error: unknown) {
    console.error('Company settings GET error:', error);
    return NextResponse.json({ message: '회사 설정 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 });
    }
    if (user.role !== 'SYSTEM_ADMIN' && user.role !== 'COMPANY_ADMIN') {
      return NextResponse.json({ message: '권한이 없습니다.' }, { status: 403 });
    }

    const tenantId = await getTenantId();
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
        where: { tenantId_key: { tenantId, key } },
        update: { value },
        create: { key, value, group: 'company' },
      });
    }

    writeAuditLog({ action: 'UPDATE_SETTINGS', target: 'systemConfig', targetId: 'company', after: settings });

    return NextResponse.json({ success: true, message: '설정이 저장되었습니다.' });
  } catch (error: unknown) {
    console.error('Company settings PUT error:', error);
    return NextResponse.json({ message: '회사 설정 저장 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
