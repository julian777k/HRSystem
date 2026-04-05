import { NextRequest, NextResponse } from 'next/server';
import { isSetupComplete } from '@/lib/setup-config';

/**
 * Guard for setup endpoints — blocks access once setup is complete,
 * and requires SETUP_SECRET in production.
 */
export async function checkSetupGuard(request: NextRequest): Promise<NextResponse | null> {
  // Block all mutating setup routes if setup is already complete
  const complete = await isSetupComplete();
  if (complete) {
    return NextResponse.json(
      { message: '초기 설정이 이미 완료되었습니다.' },
      { status: 403 }
    );
  }

  // Require SETUP_SECRET in all environments
  const setupSecret = process.env.SETUP_SECRET;
  if (!setupSecret) {
    return NextResponse.json(
      { message: 'SETUP_SECRET 환경변수가 필요합니다.' },
      { status: 403 }
    );
  }
  if (request.headers.get('x-setup-secret') !== setupSecret) {
    return NextResponse.json(
      { message: '인증에 실패했습니다.' },
      { status: 403 }
    );
  }

  return null; // OK — proceed
}
