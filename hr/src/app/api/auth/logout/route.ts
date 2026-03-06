import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { COOKIE_NAME } from '@/lib/auth';
import { clearAuthCookie } from '@/lib/auth-actions';

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;

    if (token) {
      await prisma.session.deleteMany({ where: { token } });
    }

    await clearAuthCookie();

    return NextResponse.json({ message: '로그아웃 되었습니다.' });
  } catch (error) {
    console.error('Logout error:', error);
    await clearAuthCookie();
    return NextResponse.json({ message: '로그아웃 되었습니다.' });
  }
}
