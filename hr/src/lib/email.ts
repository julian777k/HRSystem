// Resend 기반 이메일 발송 유틸.
// RESEND_API_KEY 미설정이면 발송을 건너뛰고 false를 반환한다(키 등록 전까지 무해).
import { getCloudflareContext } from '@opennextjs/cloudflare';

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

const DEFAULT_FROM = 'KeystoneHR <noreply@keystonehr.app>';

// OpenNext는 Workers의 시크릿과 vars를 process.env로 주입한다.
// getCloudflareContext().env에는 D1·KV·R2 같은 **바인딩**만 들어오므로
// 거기서 시크릿을 찾으면 undefined가 되고, 예외가 아니라 값이 없는 것이라
// try/catch 폴백도 타지 않는다. (실제로 이 때문에 메일이 조용히 안 나갔다)
async function getEmailConfig(): Promise<{ apiKey?: string; from: string }> {
  let apiKey = process.env.RESEND_API_KEY;
  let from = process.env.EMAIL_FROM;

  if (!apiKey) {
    // 런타임에 따라 바인딩 쪽에 실려 오는 경우를 대비한 보조 경로
    try {
      const { env } = await getCloudflareContext();
      const e = env as unknown as Record<string, string | undefined>;
      apiKey = apiKey || e.RESEND_API_KEY;
      from = from || e.EMAIL_FROM;
    } catch {
      // 로컬 개발 등 Cloudflare 컨텍스트가 없는 환경 — process.env만 쓴다
    }
  }

  return { apiKey, from: from || DEFAULT_FROM };
}

/** 로그에 원문 주소를 남기지 않기 위한 마스킹 */
function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return '***';
  return `${email[0]}***${email.slice(at)}`;
}

// 발송 성공 시 true. 키 미설정·실패 시 false(호출측은 열거 방지 위해 결과와 무관하게 동일 응답).
export async function sendEmail(params: SendEmailParams): Promise<boolean> {
  const { apiKey, from } = await getEmailConfig();
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY 미설정 — 발송 건너뜀:', params.subject);
    return false;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: params.to,
        subject: params.subject,
        html: params.html,
        ...(params.text ? { text: params.text } : {}),
      }),
    });
    if (!res.ok) {
      console.error('[email] Resend 발송 실패:', res.status, await res.text().catch(() => ''));
      return false;
    }
    // 성공도 남긴다. 성공 시 무로그면 "발송됨"과 "호출 자체가 안 됨"을 구분할 수 없어
    // 장애 진단이 늦어진다(2026-07-31 실제로 겪음).
    console.log('[email] 발송 성공:', maskEmail(params.to), '|', params.subject);
    return true;
  } catch (e) {
    console.error('[email] Resend 요청 오류:', e);
    return false;
  }
}

// 비밀번호 재설정 메일 템플릿
export function passwordResetEmail(resetUrl: string): { subject: string; html: string; text: string } {
  const subject = '[KeystoneHR] 비밀번호 재설정 안내';
  const text = `비밀번호 재설정을 요청하셨습니다.\n아래 링크에서 새 비밀번호를 설정하세요 (30분 이내 유효):\n${resetUrl}\n\n요청하지 않으셨다면 이 메일을 무시하셔도 됩니다.`;
  const html = `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1a1a2e">
  <h2 style="font-size:20px;margin-bottom:16px">비밀번호 재설정</h2>
  <p style="font-size:14px;line-height:1.7;color:#555">비밀번호 재설정을 요청하셨습니다. 아래 버튼을 눌러 새 비밀번호를 설정하세요. 링크는 <strong>30분</strong> 동안 유효합니다.</p>
  <p style="margin:24px 0"><a href="${resetUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600">비밀번호 재설정</a></p>
  <p style="font-size:12px;color:#999;line-height:1.6">버튼이 안 되면 아래 주소를 브라우저에 붙여넣으세요:<br>${resetUrl}</p>
  <p style="font-size:12px;color:#999;margin-top:16px">요청하지 않으셨다면 이 메일을 무시하셔도 됩니다.</p>
</div>`;
  return { subject, html, text };
}
