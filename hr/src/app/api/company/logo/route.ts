import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const isCloudflare = process.env.DEPLOY_TARGET === 'cloudflare';

export async function GET() {
  try {
    const config = await prisma.systemConfig.findFirst({
      where: { key: 'company_logo' },
    });

    if (!config) {
      return NextResponse.json({ message: 'No logo' }, { status: 404 });
    }

    let pngBytes: Uint8Array;

    if (config.value === 'r2' && isCloudflare) {
      const { getCloudflareContext } = await import('@opennextjs/cloudflare');
      const { env } = await getCloudflareContext();
      const { getTenantId } = await import('@/lib/tenant-context');
      const tenantId = await getTenantId();
      const obj = await (env as any).HR_FILES.get(`tenants/${tenantId}/logo.png`);
      if (!obj) {
        return NextResponse.json({ message: 'Logo not found in storage' }, { status: 404 });
      }
      pngBytes = new Uint8Array(await obj.arrayBuffer());
    } else if (config.value.startsWith('base64:')) {
      pngBytes = Buffer.from(config.value.slice(7), 'base64');
    } else {
      return NextResponse.json({ message: 'Invalid logo data' }, { status: 500 });
    }

    return new NextResponse(new Uint8Array(pngBytes).buffer as ArrayBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    console.error('Logo fetch error:', error);
    return NextResponse.json({ message: '서버 오류' }, { status: 500 });
  }
}
