import { NextRequest, NextResponse } from 'next/server';
import { hashPassword } from '@/lib/password';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';
import { writeAuditLog } from '@/lib/audit-log';

function generateRandomPassword(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
  const array = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(array, (b) => chars[b % chars.length]).join('');
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: '인증 필요' }, { status: 401 });
    }

    if (user.role !== 'SYSTEM_ADMIN' && user.role !== 'COMPANY_ADMIN') {
      return NextResponse.json({ message: '권한이 없습니다.' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { message: '파일을 선택해주세요.' },
        { status: 400 }
      );
    }

    // File size limit: 5MB
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { message: '파일 크기는 5MB 이하만 가능합니다.' },
        { status: 400 }
      );
    }

    // File type validation — accept CSV and Excel
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    if (file.type && !allowedTypes.includes(file.type) && !file.name?.endsWith('.csv')) {
      return NextResponse.json(
        { message: '.csv 파일을 업로드해주세요.' },
        { status: 400 }
      );
    }

    // Parse CSV natively
    const text = await file.text();
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((l) => l.trim());

    if (lines.length < 2) {
      return NextResponse.json(
        { message: 'CSV 파일에 데이터가 없습니다.' },
        { status: 400 }
      );
    }

    // Parse CSV with proper quote handling
    function parseCsvLine(line: string): string[] {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
          if (ch === '"' && line[i + 1] === '"') {
            current += '"';
            i++;
          } else if (ch === '"') {
            inQuotes = false;
          } else {
            current += ch;
          }
        } else {
          if (ch === '"') {
            inQuotes = true;
          } else if (ch === ',') {
            result.push(current.trim());
            current = '';
          } else {
            current += ch;
          }
        }
      }
      result.push(current.trim());
      return result;
    }

    const headerLine = lines[0].replace(/^\uFEFF/, ''); // strip BOM
    const headers = parseCsvLine(headerLine);
    const rows: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCsvLine(lines[i]);
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
      rows.push(row);
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { message: 'CSV 파일에 데이터가 없습니다.' },
        { status: 400 }
      );
    }

    // Row limit: 1000 rows max
    if (rows.length > 1000) {
      return NextResponse.json(
        { message: `최대 1,000건까지 가져올 수 있습니다. (현재 ${rows.length}건)` },
        { status: 400 }
      );
    }

    const departments = await prisma.department.findMany();
    const positions = await prisma.position.findMany();

    const deptMap = new Map(departments.map((d) => [d.name, d.id]));
    const posMap = new Map(positions.map((p) => [p.name, p.id]));

    const results = { success: 0, failed: 0, errors: [] as string[] };
    const generatedPasswords: { employeeNumber: string; name: string; email: string; password: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      try {
        const employeeNumber = row['사번'] || row['employeeNumber'] || '';
        const name = row['이름'] || row['name'] || '';
        const email = row['이메일'] || row['email'] || '';
        const hasExplicitPassword = !!(row['비밀번호'] || row['password']);
        const password = row['비밀번호'] || row['password'] || generateRandomPassword();
        const phone = row['전화번호'] || row['phone'] || '';
        const deptName = row['부서'] || row['department'] || '';
        const posName = row['직급'] || row['position'] || '';
        const hireDate = row['입사일'] || row['hireDate'] || '';

        if (!employeeNumber || !name || !email || !deptName || !posName || !hireDate) {
          results.failed++;
          results.errors.push(`${rowNum}행: 필수 항목 누락`);
          continue;
        }

        const departmentId = deptMap.get(deptName);
        const positionId = posMap.get(posName);

        if (!departmentId) {
          results.failed++;
          results.errors.push(`${rowNum}행: 부서 '${deptName}' 없음`);
          continue;
        }

        if (!positionId) {
          results.failed++;
          results.errors.push(`${rowNum}행: 직급 '${posName}' 없음`);
          continue;
        }

        const passwordHash = await hashPassword(password);

        await prisma.employee.create({
          data: {
            employeeNumber,
            name,
            email,
            passwordHash,
            phone: phone || null,
            departmentId,
            positionId,
            hireDate: new Date(hireDate),
            role: 'BASIC',
          },
        });

        if (!hasExplicitPassword) {
          generatedPasswords.push({ employeeNumber, name, email, password });
        }
        results.success++;
      } catch (err) {
        results.failed++;
        const message = err instanceof Error ? err.message : '알 수 없는 오류';
        if (message.toLowerCase().includes('unique constraint')) {
          results.errors.push(`${rowNum}행: 중복된 사번 또는 이메일`);
        } else {
          results.errors.push(`${rowNum}행: ${message}`);
        }
      }
    }

    writeAuditLog({ action: 'EMPLOYEE_IMPORT', target: 'employee', targetId: 'batch', after: { success: results.success, failed: results.failed } });

    // Mask generated passwords in JSON response (show first 3 chars + ***)
    // Full passwords are only available at generation time; this prevents caching/logging exposure
    const maskedPasswords = generatedPasswords.map(({ employeeNumber, name, email, password }) => ({
      employeeNumber,
      name,
      email,
      password: password.length > 3 ? password.slice(0, 3) + '***' : '***',
    }));

    return NextResponse.json({
      message: `가져오기 완료: 성공 ${results.success}건, 실패 ${results.failed}건`,
      ...results,
      generatedPasswords: maskedPasswords,
    });
  } catch (error) {
    console.error('Employee import error:', error);
    return NextResponse.json(
      { message: 'CSV 가져오기 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
