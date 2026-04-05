import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';
import { getTenantId } from '@/lib/tenant-context';
import { checkRateLimit } from '@/lib/rate-limit';

const ADMIN_ROLES = ['SYSTEM_ADMIN', 'COMPANY_ADMIN'];
const VALID_TYPES = ['PARENTAL', 'MEDICAL', 'PERSONAL', 'MILITARY', 'STUDY', 'OTHER'];

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: '인증 필요' }, { status: 401 });

    // Rate limit: 10 absence requests per 15 minutes per user
    const rl = await checkRateLimit(`absence-req:${user.id}`, 10, 15 * 60 * 1000);
    if (!rl.success) {
      return NextResponse.json(
        { message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
        { status: 429 }
      );
    }

    const { type, reason, startDate, endDate } = await request.json();

    if (!type || !startDate || !endDate) {
      return NextResponse.json({ message: '휴직 유형, 시작일, 종료일은 필수입니다.' }, { status: 400 });
    }
    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json({ message: '유효하지 않은 휴직 유형입니다.' }, { status: 400 });
    }
    // Validate date format (ISO 8601)
    if (isNaN(Date.parse(startDate)) || isNaN(Date.parse(endDate))) {
      return NextResponse.json({ message: '유효하지 않은 날짜 형식입니다.' }, { status: 400 });
    }
    if (startDate >= endDate) {
      return NextResponse.json({ message: '종료일은 시작일 이후여야 합니다.' }, { status: 400 });
    }
    // Prevent absurdly far-future dates (max 2 years)
    const maxDate = new Date();
    maxDate.setFullYear(maxDate.getFullYear() + 2);
    if (new Date(endDate) > maxDate) {
      return NextResponse.json({ message: '종료일은 2년 이내여야 합니다.' }, { status: 400 });
    }

    const tenantId = await getTenantId();

    // Check overlapping absences for same employee
    const overlapping = await (prisma as any).$queryRawUnsafe(
      `SELECT id FROM leave_of_absences WHERE employeeId = ? AND tenantId = ? AND status IN ('PENDING','APPROVED') AND startDate < ? AND endDate > ?`,
      user.id, tenantId, endDate, startDate
    );
    if (overlapping && overlapping.length > 0) {
      return NextResponse.json({ message: '해당 기간에 이미 휴직 신청이 있습니다.' }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await (prisma as any).$executeRawUnsafe(
      `INSERT INTO leave_of_absences (id, tenantId, employeeId, type, reason, startDate, endDate, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)`,
      id, tenantId, user.id, type, reason || null, startDate, endDate, now, now
    );

    return NextResponse.json({
      id, type, reason, startDate, endDate, status: 'PENDING', createdAt: now,
    }, { status: 201 });
  } catch (error) {
    console.error('Absence request error:', error);
    return NextResponse.json({ message: '휴직 신청 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: '인증 필요' }, { status: 401 });

    if (!ADMIN_ROLES.includes(user.role)) {
      return NextResponse.json({ message: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const employeeId = searchParams.get('employeeId');

    // Allowlist validation for status parameter
    const VALID_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];
    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ message: '유효하지 않은 상태 값입니다.' }, { status: 400 });
    }
    // Validate employeeId format (UUID)
    if (employeeId && !/^[0-9a-f-]{36}$/i.test(employeeId)) {
      return NextResponse.json({ message: '유효하지 않은 직원 ID입니다.' }, { status: 400 });
    }

    let sql = `SELECT a.*, e.name as employeeName, d.name as departmentName FROM leave_of_absences a LEFT JOIN employees e ON a.employeeId = e.id LEFT JOIN departments d ON e.departmentId = d.id WHERE a.tenantId = ?`;
    const params: unknown[] = [await getTenantId()];

    if (status) {
      sql += ` AND a.status = ?`;
      params.push(status);
    }
    if (employeeId) {
      sql += ` AND a.employeeId = ?`;
      params.push(employeeId);
    }

    sql += ` ORDER BY a.createdAt DESC`;

    const rows = await (prisma as any).$queryRawUnsafe(sql, ...params);
    return NextResponse.json({ absences: rows || [] });
  } catch (error) {
    console.error('Absence list error:', error);
    return NextResponse.json({ message: '휴직 목록 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
