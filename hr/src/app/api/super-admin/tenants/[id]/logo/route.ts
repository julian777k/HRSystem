import { NextRequest, NextResponse } from 'next/server';
import { basePrismaClient } from '@/lib/prisma';
import { verifySuperAdmin } from '@/lib/super-admin-auth';

const isCloudflare = process.env.DEPLOY_TARGET === 'cloudflare';
const MAX_SIZE = 50 * 1024; // 50KB
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await verifySuperAdmin(request);
    if (!admin) {
      return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 });
    }

    const { id: tenantId } = await params;

    const config = await basePrismaClient.systemConfig.findFirst({
      where: { tenantId, key: 'company_logo' },
    });

    if (!config) {
      return NextResponse.json({ hasLogo: false });
    }

    // Return logo bytes
    let pngBytes: Uint8Array;

    if (config.value === 'r2' && isCloudflare) {
      const { getCloudflareContext } = await import('@opennextjs/cloudflare');
      const { env } = await getCloudflareContext();
      const obj = await (env as any).HR_FILES.get(`tenants/${tenantId}/logo.png`);
      if (!obj) {
        return NextResponse.json({ hasLogo: false });
      }
      pngBytes = new Uint8Array(await obj.arrayBuffer());
    } else if (config.value.startsWith('base64:')) {
      pngBytes = Buffer.from(config.value.slice(7), 'base64');
    } else {
      return NextResponse.json({ hasLogo: false });
    }

    return new NextResponse(new Uint8Array(pngBytes).buffer as ArrayBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Logo GET error:', error);
    return NextResponse.json({ message: '서버 오류' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await verifySuperAdmin(request);
    if (!admin) {
      return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 });
    }

    const { id: tenantId } = await params;

    const tenant = await basePrismaClient.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return NextResponse.json({ message: '테넌트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('logo') as File | null;
    if (!file) {
      return NextResponse.json({ message: '파일이 없습니다.' }, { status: 400 });
    }

    const buffer = new Uint8Array(await file.arrayBuffer());

    // Validate PNG magic bytes
    if (buffer.length < 8 || !PNG_MAGIC.every((b, i) => buffer[i] === b)) {
      return NextResponse.json({ message: 'PNG 파일만 업로드 가능합니다.' }, { status: 400 });
    }

    if (buffer.length > MAX_SIZE) {
      return NextResponse.json({ message: '파일 크기는 50KB 이하여야 합니다.' }, { status: 400 });
    }

    let storageValue: string;

    if (isCloudflare) {
      const { getCloudflareContext } = await import('@opennextjs/cloudflare');
      const { env } = await getCloudflareContext();
      await (env as any).HR_FILES.put(`tenants/${tenantId}/logo.png`, buffer.buffer);
      storageValue = 'r2';
    } else {
      // Local dev: store as base64
      storageValue = `base64:${Buffer.from(buffer).toString('base64')}`;
    }

    // Upsert system_configs for this tenant
    const existing = await basePrismaClient.systemConfig.findFirst({
      where: { tenantId, key: 'company_logo' },
    });

    if (existing) {
      await basePrismaClient.systemConfig.update({
        where: { id: existing.id },
        data: { value: storageValue },
      });
    } else {
      await basePrismaClient.systemConfig.create({
        data: { tenantId, key: 'company_logo', value: storageValue, group: 'general' },
      });
    }

    return NextResponse.json({ message: '로고가 업로드되었습니다.' });
  } catch (error) {
    console.error('Logo upload error:', error);
    return NextResponse.json({ message: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await verifySuperAdmin(request);
    if (!admin) {
      return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 });
    }

    const { id: tenantId } = await params;

    const config = await basePrismaClient.systemConfig.findFirst({
      where: { tenantId, key: 'company_logo' },
    });

    if (!config) {
      return NextResponse.json({ message: '로고가 없습니다.' }, { status: 404 });
    }

    // Delete from R2 if on Cloudflare
    if (isCloudflare && config.value === 'r2') {
      try {
        const { getCloudflareContext } = await import('@opennextjs/cloudflare');
        const { env } = await getCloudflareContext();
        await (env as any).HR_FILES.delete(`tenants/${tenantId}/logo.png`);
      } catch {
        // R2 delete failure is non-critical
      }
    }

    await basePrismaClient.systemConfig.delete({ where: { id: config.id } });

    return NextResponse.json({ message: '로고가 삭제되었습니다.' });
  } catch (error) {
    console.error('Logo delete error:', error);
    return NextResponse.json({ message: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
