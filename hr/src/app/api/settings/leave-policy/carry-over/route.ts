import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: '인증 필요' }, { status: 401 });

    if (!['SYSTEM_ADMIN', 'COMPANY_ADMIN'].includes(user.role)) {
      return NextResponse.json({ message: '권한이 없습니다.' }, { status: 403 });
    }

    const configs = await prisma.systemConfig.findMany({
      where: {
        key: {
          in: [
            'leave_carry_over_enabled',
            'leave_carry_over_max_days',
            'leave_carry_over_expiry_months',
          ],
        },
      },
    });

    const configMap: Record<string, string> = {};
    for (const c of configs) {
      configMap[c.key] = c.value;
    }

    return NextResponse.json({
      enabled: configMap['leave_carry_over_enabled'] === 'true',
      maxDays: parseFloat(configMap['leave_carry_over_max_days'] || '5'),
      expiryMonths: parseInt(configMap['leave_carry_over_expiry_months'] || '3'),
    });
  } catch (error) {
    console.error('Carry-over settings GET error:', error);
    return NextResponse.json(
      { message: '이월 설정 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: '인증 필요' }, { status: 401 });

    if (!['SYSTEM_ADMIN', 'COMPANY_ADMIN'].includes(user.role)) {
      return NextResponse.json({ message: '권한이 없습니다.' }, { status: 403 });
    }

    const body = await request.json();
    const { enabled, maxDays, expiryMonths } = body;

    const settings = [
      { key: 'leave_carry_over_enabled', value: String(!!enabled), group: 'leave' },
      { key: 'leave_carry_over_max_days', value: String(maxDays || 0), group: 'leave' },
      { key: 'leave_carry_over_expiry_months', value: String(expiryMonths || 3), group: 'leave' },
    ];

    for (const s of settings) {
      await prisma.systemConfig.upsert({
        where: { key: s.key },
        create: { key: s.key, value: s.value, group: s.group },
        update: { value: s.value },
      });
    }

    return NextResponse.json({
      enabled: !!enabled,
      maxDays: maxDays || 0,
      expiryMonths: expiryMonths || 3,
    });
  } catch (error) {
    console.error('Carry-over settings PUT error:', error);
    return NextResponse.json(
      { message: '이월 설정 저장 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
