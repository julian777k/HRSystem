import { NextRequest, NextResponse } from 'next/server';
import { checkSetupGuard } from '@/lib/setup-guard';

// DB schema should be applied via CLI before starting the app.
// Run `npx prisma db push` to apply schema changes.

export async function POST(request: NextRequest) {
  try {
    const guardResult = await checkSetupGuard(request);
    if (guardResult) return guardResult;

    // Cloudflare D1: schema is applied via wrangler d1 migrations
    // Self-hosted: schema is applied via `npx prisma db push`
    return NextResponse.json({
      success: true,
      message: '데이터베이스 스키마가 준비되었습니다.',
    });
  } catch (error: unknown) {
    console.error('Initialize error:', error);
    return NextResponse.json({ success: false, message: '초기화 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
