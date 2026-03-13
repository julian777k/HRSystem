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

    // Verify tenant exists
    const tenant = await basePrismaClient.tenant.findUnique({
      where: { id },
    });

    if (!tenant) {
      return NextResponse.json({ message: '테넌트를 찾을 수 없습니다.' }, { status: 404 });
    }

    // Get last 30 days of usage logs
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const usageLogs = await basePrismaClient.tenantUsageLog.findMany({
      where: {
        tenantId: id,
        date: { gte: thirtyDaysAgo },
      },
      orderBy: { date: 'asc' },
    });

    // Get employee count
    const employeeCount = await basePrismaClient.employee.count({
      where: { tenantId: id, status: 'ACTIVE' },
    });

    const totalEmployeeCount = await basePrismaClient.employee.count({
      where: { tenantId: id },
    });

    // Calculate totals from usage logs
    const totalApiCalls = usageLogs.reduce((sum: number, log: { apiCalls: number }) => sum + log.apiCalls, 0);
    const totalDbReads = usageLogs.reduce((sum: number, log: { dbReads: number }) => sum + log.dbReads, 0);
    const totalDbWrites = usageLogs.reduce((sum: number, log: { dbWrites: number }) => sum + log.dbWrites, 0);

    // Estimate storage (rough estimate based on employee count)
    const storageEstimateMB = Math.round(totalEmployeeCount * 0.5 * 100) / 100;

    return NextResponse.json({
      tenantId: id,
      tenantName: tenant.name,
      period: {
        from: thirtyDaysAgo.toISOString(),
        to: new Date().toISOString(),
      },
      summary: {
        employeeCount,
        totalEmployeeCount,
        totalApiCalls,
        totalDbReads,
        totalDbWrites,
        storageEstimateMB,
      },
      dailyLogs: usageLogs,
    });
  } catch (error) {
    console.error('Get tenant usage error:', error);
    return NextResponse.json(
      { message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
