import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-actions';
import { serializeJson, parseJson } from '@/lib/json-field';

const ADMIN_ROLES = ['SYSTEM_ADMIN', 'COMPANY_ADMIN'];

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: '인증 필요' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const employeeId = searchParams.get('employeeId');
    const isAdmin = ADMIN_ROLES.includes(user.role);

    const where: Record<string, unknown> = {};

    if (isAdmin) {
      if (status) where.status = status;
      if (employeeId) where.employeeId = employeeId;
    } else {
      where.employeeId = user.id;
      if (status) where.status = status;
    }

    const requests = await prisma.welfareRequest.findMany({
      where,
      include: {
        item: {
          include: { category: true },
        },
        employee: {
          select: { id: true, name: true, employeeNumber: true, department: { select: { name: true } }, position: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const parsed = requests.map(req => ({
      ...req,
      formValues: parseJson(req.formValues),
      item: {
        ...req.item,
        formFields: parseJson(req.item.formFields),
      },
    }));

    return NextResponse.json({ requests: parsed });
  } catch (error) {
    console.error('Welfare request list error:', error);
    return NextResponse.json(
      { message: '복지 신청 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: '인증 필요' }, { status: 401 });

    const body = await request.json();
    const { itemId, note, formValues } = body;
    let { amount } = body;

    if (!itemId) {
      return NextResponse.json({ message: '복지 항목을 선택해주세요.' }, { status: 400 });
    }

    // Validate amount if provided
    if (amount !== undefined && amount !== null) {
      amount = parseFloat(amount);
      if (isNaN(amount) || amount < 0) {
        return NextResponse.json({ message: '금액이 올바르지 않습니다.' }, { status: 400 });
      }
    }

    const item = await prisma.welfareItem.findUnique({
      where: { id: itemId },
      include: { category: true },
    });

    if (!item || !item.isActive) {
      return NextResponse.json({ message: '유효하지 않은 복지 항목입니다.' }, { status: 400 });
    }

    if (item.maxPerYear) {
      const currentYear = new Date().getFullYear();
      const startOfYear = new Date(currentYear, 0, 1);
      const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59);

      const usedCount = await prisma.welfareRequest.count({
        where: {
          employeeId: user.id,
          itemId,
          status: { in: ['APPROVED', 'PENDING'] },
          createdAt: { gte: startOfYear, lte: endOfYear },
        },
      });

      if (usedCount >= item.maxPerYear) {
        return NextResponse.json(
          { message: `이 항목은 연간 ${item.maxPerYear}회까지 신청 가능합니다. (현재 ${usedCount}회 신청/승인)` },
          { status: 400 }
        );
      }
    }

    // Verify employee exists before creating request
    const employee = await prisma.employee.findUnique({ where: { id: user.id } });
    if (!employee) {
      return NextResponse.json(
        { message: '세션이 만료되었습니다. 다시 로그인해주세요.' },
        { status: 401 }
      );
    }

    const isAutoApproval = item.requireApproval === false;

    const welfareRequest = await prisma.welfareRequest.create({
      data: {
        employeeId: user.id,
        itemId,
        amount: amount ?? item.amount,
        note: note || null,
        formValues: serializeJson(formValues ?? null),
        ...(isAutoApproval ? {
          status: 'APPROVED',
          approvedBy: 'AUTO',
          approvedAt: new Date(),
        } : {}),
      },
      include: {
        item: { include: { category: true } },
      },
    });

    return NextResponse.json({
      ...welfareRequest,
      formValues: parseJson(welfareRequest.formValues),
      item: {
        ...welfareRequest.item,
        formFields: parseJson(welfareRequest.item.formFields),
      },
      autoApproved: isAutoApproval,
    }, { status: 201 });
  } catch (error: unknown) {
    console.error('Welfare request create error:', error);
    const prismaError = error as { code?: string };
    if (prismaError.code === 'P2003') {
      return NextResponse.json(
        { message: '세션이 만료되었습니다. 다시 로그인해주세요.' },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { message: '복지 신청 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
