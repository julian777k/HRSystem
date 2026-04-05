import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-actions';
import { sendLeaveSummary, checkAndSendScheduled } from '@/lib/notifications';

const ADMIN_ROLES = ['SYSTEM_ADMIN', 'COMPANY_ADMIN'];

/** Constant-time string comparison to prevent timing attacks */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// POST: Manual send (admin) or scheduled cron trigger
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    // Cron secret auth (for automated scheduled calls)
    const cronSecret = process.env.CRON_SECRET;
    const providedSecret = request.headers.get('x-cron-secret') || '';

    if (providedSecret) {
      // Cron request: CRON_SECRET must be configured and match
      if (!cronSecret) {
        return NextResponse.json({ message: 'CRON_SECRET이 설정되지 않았습니다.' }, { status: 403 });
      }
      if (!timingSafeEqual(providedSecret, cronSecret)) {
        return NextResponse.json({ message: '인증에 실패했습니다.' }, { status: 403 });
      }
      await checkAndSendScheduled();
      return NextResponse.json({ message: '스케줄 확인 완료' });
    }

    // Admin auth for manual send
    const user = await getCurrentUser();
    if (!user || !ADMIN_ROLES.includes(user.role)) {
      return NextResponse.json({ message: '권한이 없습니다.' }, { status: 403 });
    }

    // If type specified, manual send
    if (body.type === 'daily' || body.type === 'weekly') {
      const result = await sendLeaveSummary(body.type);

      if (!result.sent) {
        return NextResponse.json(
          { message: result.reason || '전송 실패' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        message: `${body.type === 'daily' ? '오늘' : '이번 주'} 휴무 현황이 전송되었습니다.`,
        count: result.count,
      });
    }

    // No type = check schedule (admin can also trigger schedule check)
    await checkAndSendScheduled();
    return NextResponse.json({ message: '스케줄 확인 완료' });
  } catch (error) {
    console.error('Leave summary webhook error:', error);
    return NextResponse.json({ message: '서버 오류' }, { status: 500 });
  }
}
