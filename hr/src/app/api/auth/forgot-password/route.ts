import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { passwordResetEmail } from '@/lib/email-templates';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { message: '이메일을 입력해주세요.' },
        { status: 400 }
      );
    }

    // Rate limit: 3 reset requests per email per hour
    const rateLimitResult = checkRateLimit(`reset:${email}`, 3, 60 * 60 * 1000);
    if (!rateLimitResult.success) {
      return NextResponse.json({
        message: '등록된 이메일이면 비밀번호 재설정 링크가 발송됩니다.',
      });
    }

    const employee = await prisma.employee.findUnique({
      where: { email },
    });

    // Always return success to prevent email enumeration
    if (!employee) {
      return NextResponse.json({
        message: '등록된 이메일이면 비밀번호 재설정 링크가 발송됩니다.',
      });
    }

    // Invalidate old tokens for this email
    await prisma.passwordReset.updateMany({
      where: { email, usedAt: null },
      data: { usedAt: new Date() },
    });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    await prisma.passwordReset.create({
      data: { email, token, expiresAt },
    });

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const resetUrl = `${appUrl}/reset-password?token=${token}`;

    await sendEmail(
      email,
      '[HR] 비밀번호 재설정',
      passwordResetEmail(employee.name, resetUrl)
    );

    return NextResponse.json({
      message: '등록된 이메일이면 비밀번호 재설정 링크가 발송됩니다.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
