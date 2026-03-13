import { NextRequest, NextResponse } from 'next/server';
import { basePrismaClient } from '@/lib/prisma';
import { verifySuperAdmin, requirePasswordChanged } from '@/lib/super-admin-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await verifySuperAdmin(request);
    if (!admin) {
      return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 });
    }
    const pwBlock = requirePasswordChanged(admin);
    if (pwBlock) return pwBlock;

    const { id } = await params;

    const tenant = await basePrismaClient.tenant.findUnique({
      where: { id },
    });

    if (!tenant) {
      return NextResponse.json({ message: '테넌트를 찾을 수 없습니다.' }, { status: 404 });
    }

    // Get employee count
    const employeeCount = await basePrismaClient.employee.count({
      where: { tenantId: id, status: 'ACTIVE' },
    });

    const totalEmployeeCount = await basePrismaClient.employee.count({
      where: { tenantId: id },
    });

    return NextResponse.json({
      tenant: {
        ...tenant,
        employeeCount,
        totalEmployeeCount,
      },
    });
  } catch (error) {
    console.error('Get tenant error:', error);
    return NextResponse.json(
      { message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await verifySuperAdmin(request);
    if (!admin) {
      return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 });
    }
    const pwBlock2 = requirePasswordChanged(admin);
    if (pwBlock2) return pwBlock2;

    const { id } = await params;
    const body = await request.json();
    const { name, maxEmployees, status, trialExpiresAt } = body;

    const existing = await basePrismaClient.tenant.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ message: '테넌트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (maxEmployees !== undefined) updateData.maxEmployees = maxEmployees;
    if (status !== undefined) updateData.status = status;
    if (trialExpiresAt !== undefined) {
      updateData.trialExpiresAt = trialExpiresAt ? new Date(trialExpiresAt).toISOString() : null;
    }
    // Auto-set trialExpiresAt when switching to trial status without a date
    if (status === 'trial' && !trialExpiresAt && !existing.trialExpiresAt) {
      const defaultExpiry = new Date();
      defaultExpiry.setDate(defaultExpiry.getDate() + 14); // 14일 기본 체험
      updateData.trialExpiresAt = defaultExpiry.toISOString();
    }
    // Clear trialExpiresAt when switching away from trial
    if (status && status !== 'trial') {
      updateData.trialExpiresAt = null;
    }

    const tenant = await basePrismaClient.tenant.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ tenant });
  } catch (error) {
    console.error('Update tenant error:', error);
    return NextResponse.json(
      { message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await verifySuperAdmin(request);
    if (!admin) {
      return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 });
    }
    const pwBlock3 = requirePasswordChanged(admin);
    if (pwBlock3) return pwBlock3;

    const { id } = await params;

    const tenant = await basePrismaClient.tenant.findUnique({
      where: { id },
    });

    if (!tenant) {
      return NextResponse.json({ message: '테넌트를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (tenant.status !== 'suspended') {
      return NextResponse.json(
        { message: '정지 상태의 테넌트만 삭제할 수 있습니다. 먼저 테넌트를 정지해주세요.' },
        { status: 400 }
      );
    }

    // Check for active employees
    const activeEmployees = await basePrismaClient.employee.count({
      where: { tenantId: id, status: 'ACTIVE' },
    });

    if (activeEmployees > 0) {
      return NextResponse.json(
        { message: `활성 직원이 ${activeEmployees}명 있습니다. 모든 직원을 비활성화한 후 삭제해주세요.` },
        { status: 400 }
      );
    }

    await basePrismaClient.tenant.delete({
      where: { id },
    });

    return NextResponse.json({ message: '테넌트가 삭제되었습니다.' });
  } catch (error) {
    console.error('Delete tenant error:', error);
    return NextResponse.json(
      { message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
