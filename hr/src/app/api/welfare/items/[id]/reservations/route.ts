import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';
import { parseJson } from '@/lib/json-field';

// 캘린더형 복지 항목의 기존 예약 조회 (승인/대기 상태)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: '인증 필요' }, { status: 401 });

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const fieldId = searchParams.get('fieldId');

    if (!fieldId) {
      return NextResponse.json({ message: 'fieldId가 필요합니다.' }, { status: 400 });
    }

    // 해당 항목의 승인/대기 상태 신청에서 date/calendar 필드 값 추출
    const requests = await prisma.welfareRequest.findMany({
      where: {
        itemId: id,
        status: { in: ['PENDING', 'APPROVED'] },
      },
      select: {
        id: true,
        status: true,
        formValues: true,
        note: true,
        employee: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // formValues에서 해당 fieldId의 날짜 값들을 추출
    const reservations: { date: string; employeeName: string; status: string; note: string | null }[] = [];
    for (const req of requests) {
      const values = parseJson<Record<string, unknown>>(req.formValues);
      if (values && values[fieldId] != null) {
        const rawValue = values[fieldId];
        const dateValue = typeof rawValue === 'string' ? rawValue : String(rawValue);
        // Handle both comma-separated and range (start~end) formats
        const parts = dateValue.split(',').map(d => d.trim()).filter(Boolean);
        for (const part of parts) {
          if (part.includes('~')) {
            // Range format: "2026-01-03~2026-01-07" -> expand to individual dates
            const [startStr, endStr] = part.split('~').map(s => s.trim());
            if (startStr && endStr) {
              const start = new Date(startStr);
              const end = new Date(endStr);
              // Validate dates and cap range to 365 days for safety
              if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end >= start) {
                const maxDays = 365;
                let count = 0;
                for (let dt = new Date(start); dt <= end && count < maxDays; count++) {
                  const y = dt.getFullYear();
                  const m = String(dt.getMonth() + 1).padStart(2, '0');
                  const day = String(dt.getDate()).padStart(2, '0');
                  reservations.push({
                    date: `${y}-${m}-${day}`,
                    employeeName: req.employee.name,
                    status: req.status,
                    note: req.note,
                  });
                  dt.setDate(dt.getDate() + 1);
                }
              }
            }
          } else {
            reservations.push({
              date: part,
              employeeName: req.employee.name,
              status: req.status,
              note: req.note,
            });
          }
        }
      }
    }

    return NextResponse.json({ reservations });
  } catch (error) {
    console.error('Reservation fetch error:', error);
    return NextResponse.json(
      { message: '예약 현황 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
