import { NextResponse } from 'next/server';

export async function POST() {
  // Email service removed — password reset via email is not available.
  // Admins can reset passwords directly from the employee management page.
  return NextResponse.json({
    message: '비밀번호 재설정은 관리자에게 문의해주세요.',
  });
}
