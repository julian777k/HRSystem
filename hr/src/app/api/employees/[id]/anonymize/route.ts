import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-actions';
import { prisma } from '@/lib/prisma';
import { writeAuditLog } from '@/lib/audit-log';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: '인증 필요' }, { status: 401 });
    }

    if (user.role !== 'SYSTEM_ADMIN' && user.role !== 'COMPANY_ADMIN') {
      return NextResponse.json({ message: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { id } = await params;

    const employee = await prisma.employee.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, status: true, employeeNumber: true },
    });

    if (!employee) {
      return NextResponse.json({ message: '직원을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (employee.status !== 'RESIGNED') {
      return NextResponse.json(
        { message: '퇴직 상태의 직원만 개인정보 삭제가 가능합니다.' },
        { status: 400 }
      );
    }

    // Anonymize personal data
    const anonymizedEmail = `anonymized_${employee.id}@deleted.local`;
    await prisma.employee.update({
      where: { id },
      data: {
        name: '삭제됨',
        email: anonymizedEmail,
        phone: null,
        passwordHash: 'ANONYMIZED',
      },
    });

    // Delete all sessions for this employee
    await prisma.session.deleteMany({
      where: { employeeId: id },
    });

    // Audit log
    writeAuditLog({
      action: 'ANONYMIZE_EMPLOYEE',
      target: 'employee',
      targetId: id,
      before: { name: employee.name, email: employee.email },
      after: { name: '삭제됨', email: anonymizedEmail },
    });

    return NextResponse.json({
      message: '퇴직자 개인정보가 삭제(익명화)되었습니다.',
    });
  } catch (error) {
    console.error('Employee anonymize error:', error);
    return NextResponse.json(
      { message: '개인정보 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
