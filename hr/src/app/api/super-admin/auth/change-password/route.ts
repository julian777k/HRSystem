import { NextRequest, NextResponse } from 'next/server';
import { verifySuperAdmin } from '@/lib/super-admin-auth';
import { verifyPassword, hashPassword, validatePasswordPolicy } from '@/lib/password';
import { basePrismaClient } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';
import { writeAuditLog } from '@/lib/audit-log';

export async function POST(request: NextRequest) {
  try {
    const admin = await verifySuperAdmin(request);
    if (!admin) {
      return NextResponse.json({ message: '인증 필요' }, { status: 401 });
    }

    // Rate limit: 5 attempts per admin per 15 minutes
    const rateResult = await checkRateLimit(`sa-change-pw:${admin.id}`, 5, 900_000);
    if (!rateResult.success) {
      return NextResponse.json(
        { message: `비밀번호 변경 시도가 너무 많습니다. ${Math.ceil((rateResult.retryAfterMs || 0) / 1000)}초 후 다시 시도해주세요.` },
        { status: 429 }
      );
    }

    const { currentPassword, newPassword } = await request.json();
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ message: '현재 비밀번호와 새 비밀번호를 입력해주세요.' }, { status: 400 });
    }

    // Validate password policy
    const policyError = validatePasswordPolicy(newPassword);
    if (policyError) {
      return NextResponse.json({ message: policyError }, { status: 400 });
    }

    const adminRecord = await basePrismaClient.superAdmin.findUnique({ where: { id: admin.id } });
    if (!adminRecord) {
      return NextResponse.json({ message: '관리자를 찾을 수 없습니다.' }, { status: 404 });
    }

    const isValid = await verifyPassword(currentPassword, adminRecord.passwordHash);
    if (!isValid) {
      return NextResponse.json({ message: '현재 비밀번호가 올바르지 않습니다.' }, { status: 400 });
    }

    const passwordHash = await hashPassword(newPassword);
    await basePrismaClient.superAdmin.update({
      where: { id: admin.id },
      data: { passwordHash, mustChangePassword: false },
    });

    writeAuditLog({ action: 'SUPER_ADMIN_CHANGE_PASSWORD', target: 'superAdmin', targetId: admin.id });

    return NextResponse.json({ message: '비밀번호가 변경되었습니다.' });
  } catch (error) {
    console.error('Super admin change password error:', error);
    return NextResponse.json({ message: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
