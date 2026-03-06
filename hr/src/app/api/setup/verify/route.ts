import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isSetupComplete } from '@/lib/setup-config';

export async function GET() {
  const complete = await isSetupComplete();
  if (!complete) {
    return NextResponse.json({ message: '셋업이 완료되지 않았습니다.' }, { status: 400 });
  }

  const cookieStore = await cookies();
  cookieStore.set('setup_complete', 'true', {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });

  return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'));
}
