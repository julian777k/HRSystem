import { NextRequest, NextResponse } from 'next/server';
import { isSetupComplete } from '@/lib/setup-config';

// DB schema should be applied via CLI before starting the app.
// Run `npx prisma db push` to apply schema changes.

export async function POST(request: NextRequest) {
  try {
    // Setup secret check: required in production, optional in development
    const setupSecret = process.env.SETUP_SECRET;
    if (!setupSecret && process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { success: false, message: 'SETUP_SECRET 환경변수가 설정되지 않았습니다. 프로덕션에서는 필수입니다.' },
        { status: 403 }
      );
    }
    if (setupSecret && request.headers.get('x-setup-secret') !== setupSecret) {
      return NextResponse.json(
        { success: false, message: '설정 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // Guard: block if setup already completed
    if (await isSetupComplete()) {
      return NextResponse.json(
        { success: false, message: '이미 초기 설정이 완료되었습니다.' },
        { status: 403 }
      );
    }

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
