function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function baseTemplate(content: string) {
  return `
    <div style="font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #2563eb; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 20px;">HR SYSTEM 인사관리 시스템</h1>
      </div>
      <div style="background: #ffffff; border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
        ${content}
      </div>
      <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 16px;">
        본 메일은 자동 발송되었습니다. 문의사항은 시스템 관리자에게 연락해주세요.
      </p>
    </div>
  `;
}

export function leaveRequestNotification(
  requesterName: string,
  leaveType: string,
  startDate: string,
  endDate: string,
  approverName: string
) {
  return baseTemplate(`
    <h2 style="color: #1f2937; margin-top: 0;">휴가 결재 요청</h2>
    <p style="color: #4b5563;">${escapeHtml(approverName)}님, 새로운 휴가 결재 요청이 있습니다.</p>
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      <tr><td style="padding: 8px; color: #6b7280; width: 100px;">신청자</td><td style="padding: 8px; font-weight: 600;">${escapeHtml(requesterName)}</td></tr>
      <tr><td style="padding: 8px; color: #6b7280;">휴가 유형</td><td style="padding: 8px;">${escapeHtml(leaveType)}</td></tr>
      <tr><td style="padding: 8px; color: #6b7280;">기간</td><td style="padding: 8px;">${escapeHtml(startDate)} ~ ${escapeHtml(endDate)}</td></tr>
    </table>
    <p style="color: #4b5563;">시스템에 로그인하여 결재를 처리해주세요.</p>
  `);
}

export function leaveApprovedNotification(
  employeeName: string,
  leaveType: string,
  startDate: string,
  endDate: string
) {
  return baseTemplate(`
    <h2 style="color: #1f2937; margin-top: 0;">휴가 승인 안내</h2>
    <p style="color: #4b5563;">${escapeHtml(employeeName)}님, 휴가가 승인되었습니다.</p>
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      <tr><td style="padding: 8px; color: #6b7280; width: 100px;">휴가 유형</td><td style="padding: 8px;">${escapeHtml(leaveType)}</td></tr>
      <tr><td style="padding: 8px; color: #6b7280;">기간</td><td style="padding: 8px;">${escapeHtml(startDate)} ~ ${escapeHtml(endDate)}</td></tr>
    </table>
  `);
}

export function leaveRejectedNotification(
  employeeName: string,
  leaveType: string,
  reason?: string
) {
  return baseTemplate(`
    <h2 style="color: #1f2937; margin-top: 0;">휴가 반려 안내</h2>
    <p style="color: #4b5563;">${escapeHtml(employeeName)}님, 휴가가 반려되었습니다.</p>
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      <tr><td style="padding: 8px; color: #6b7280; width: 100px;">휴가 유형</td><td style="padding: 8px;">${escapeHtml(leaveType)}</td></tr>
      ${reason ? `<tr><td style="padding: 8px; color: #6b7280;">반려 사유</td><td style="padding: 8px;">${escapeHtml(reason)}</td></tr>` : ''}
    </table>
    <p style="color: #4b5563;">자세한 내용은 시스템에서 확인해주세요.</p>
  `);
}

export function passwordResetEmail(name: string, resetUrl: string) {
  return baseTemplate(`
    <h2 style="color: #1f2937; margin-top: 0;">비밀번호 재설정</h2>
    <p style="color: #4b5563;">${escapeHtml(name)}님, 비밀번호 재설정을 요청하셨습니다.</p>
    <p style="color: #4b5563;">아래 버튼을 클릭하여 비밀번호를 재설정해주세요. 이 링크는 30분간 유효합니다.</p>
    <div style="text-align: center; margin: 24px 0;">
      <a href="${resetUrl}" style="background: #2563eb; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600;">비밀번호 재설정</a>
    </div>
    <p style="color: #9ca3af; font-size: 13px;">본인이 요청하지 않은 경우, 이 메일을 무시해주세요.</p>
  `);
}

export function accountCreatedEmail(
  name: string,
  email: string,
  tempPassword: string,
  loginUrl: string
) {
  return baseTemplate(`
    <h2 style="color: #1f2937; margin-top: 0;">계정 생성 안내</h2>
    <p style="color: #4b5563;">${escapeHtml(name)}님, HR 시스템 계정이 생성되었습니다.</p>
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      <tr><td style="padding: 8px; color: #6b7280; width: 100px;">이메일</td><td style="padding: 8px;">${escapeHtml(email)}</td></tr>
      <tr><td style="padding: 8px; color: #6b7280;">임시 비밀번호</td><td style="padding: 8px; font-weight: 600;">${escapeHtml(tempPassword)}</td></tr>
    </table>
    <p style="color: #ef4444; font-size: 13px;">보안을 위해 로그인 후 반드시 비밀번호를 변경해주세요.</p>
    <div style="text-align: center; margin: 24px 0;">
      <a href="${loginUrl}" style="background: #2563eb; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600;">로그인하기</a>
    </div>
  `);
}
