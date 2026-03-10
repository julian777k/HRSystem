import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';
import { isValidWebhookUrl } from '@/lib/webhook';

const ADMIN_ROLES = ['SYSTEM_ADMIN', 'COMPANY_ADMIN'];

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || !ADMIN_ROLES.includes(user.role)) {
      return NextResponse.json({ message: '권한이 없습니다.' }, { status: 403 });
    }

    const configs = await prisma.systemConfig.findMany({
      where: { group: 'webhook' },
    });

    const settings: Record<string, string> = {};
    for (const c of configs) {
      settings[c.key] = c.value;
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Webhook settings GET error:', error);
    return NextResponse.json({ message: '서버 오류' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !ADMIN_ROLES.includes(user.role)) {
      return NextResponse.json({ message: '권한이 없습니다.' }, { status: 403 });
    }

    const body = await request.json();
    const { enabled, url, platform, events } = body;

    // URL validation (SSRF prevention)
    if (url && !isValidWebhookUrl(url)) {
      return NextResponse.json(
        { message: 'HTTPS URL만 허용됩니다. 내부 네트워크 주소는 사용할 수 없습니다.' },
        { status: 400 }
      );
    }

    const entries: { key: string; value: string }[] = [
      { key: 'webhook_enabled', value: enabled ? 'true' : 'false' },
      { key: 'webhook_url', value: url || '' },
      { key: 'webhook_platform', value: platform || 'custom' },
      { key: 'webhook_events', value: JSON.stringify(events || []) },
    ];

    for (const entry of entries) {
      const existing = await prisma.systemConfig.findFirst({
        where: { key: entry.key, group: 'webhook' },
      });

      if (existing) {
        await prisma.systemConfig.update({
          where: { id: existing.id },
          data: { value: entry.value },
        });
      } else {
        await prisma.systemConfig.create({
          data: { key: entry.key, value: entry.value, group: 'webhook' },
        });
      }
    }

    return NextResponse.json({ message: '저장되었습니다.' });
  } catch (error) {
    console.error('Webhook settings PUT error:', error);
    return NextResponse.json({ message: '서버 오류' }, { status: 500 });
  }
}

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user || !ADMIN_ROLES.includes(user.role)) {
      return NextResponse.json({ message: '권한이 없습니다.' }, { status: 403 });
    }

    const configs = await prisma.systemConfig.findMany({
      where: { group: 'webhook' },
    });

    const map = new Map(configs.map((c: any) => [c.key, c.value]));
    const url = map.get('webhook_url');
    const platform = map.get('webhook_platform') || 'custom';

    if (!url) {
      return NextResponse.json({ message: 'Webhook URL이 설정되지 않았습니다.' }, { status: 400 });
    }

    if (!isValidWebhookUrl(url)) {
      return NextResponse.json({ message: 'HTTPS URL만 허용됩니다.' }, { status: 400 });
    }

    // Format test payload (platform-specific)
    let payload;
    const testMessage = 'KeystoneHR 웹훅 테스트 메시지입니다.';
    switch (platform) {
      case 'slack':
      case 'kakaowork':
        payload = { text: `[TEST] ${testMessage}` };
        break;
      case 'teams':
        payload = {
          '@type': 'MessageCard',
          '@context': 'http://schema.org/extensions',
          themeColor: '0076D7',
          summary: '[TEST]',
          text: `[TEST] ${testMessage}`,
        };
        break;
      default:
        payload = { event: 'TEST', message: testMessage, timestamp: new Date().toISOString() };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      return NextResponse.json(
        { message: `웹훅 전송 실패 (HTTP ${res.status})` },
        { status: 400 }
      );
    }

    return NextResponse.json({ message: '테스트 웹훅이 전송되었습니다.' });
  } catch (error) {
    console.error('Webhook test error:', error);
    return NextResponse.json({ message: '웹훅 전송 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
