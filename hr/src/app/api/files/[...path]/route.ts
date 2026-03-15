import { NextRequest, NextResponse } from 'next/server';

const isCloudflare = process.env.DEPLOY_TARGET === 'cloudflare';

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function getContentType(filePath: string): string {
  const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: segments } = await params;
    const filePath = segments.join('/');

    // Sanitize: block path traversal
    if (filePath.includes('..') || filePath.startsWith('/')) {
      return NextResponse.json({ message: 'Invalid path' }, { status: 400 });
    }

    if (!isCloudflare) {
      // Local dev: serve from public/ folder via redirect
      return NextResponse.redirect(new URL(`/${filePath}`, _request.url));
    }

    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const { env } = await getCloudflareContext();
    const obj = await (env as any).HR_FILES.get(filePath);
    if (!obj) {
      return NextResponse.json({ message: 'File not found' }, { status: 404 });
    }

    const contentType = getContentType(filePath);
    const bytes = new Uint8Array(await obj.arrayBuffer());

    return new NextResponse(bytes.buffer as ArrayBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, s-maxage=604800',
      },
    });
  } catch (error) {
    console.error('R2 file serve error:', error);
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
