import { NextRequest, NextResponse } from 'next/server';
import { basePrismaClient } from '@/lib/prisma';
import { verifySuperAdmin, requirePasswordChanged } from '@/lib/super-admin-auth';

export async function GET(request: NextRequest) {
  try {
    const admin = await verifySuperAdmin(request);
    if (!admin) {
      return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 });
    }
    const pwBlock = requirePasswordChanged(admin);
    if (pwBlock) return pwBlock;

    // Total tenants by status
    const tenantsByStatus = await basePrismaClient.tenant.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    const statusMap: Record<string, number> = {};
    let totalTenants = 0;
    for (const item of tenantsByStatus) {
      statusMap[item.status] = item._count.id;
      totalTenants += item._count.id;
    }

    // Recent signups (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentSignups = await basePrismaClient.tenant.findMany({
      where: {
        createdAt: { gte: sevenDaysAgo },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        subdomain: true,
        ownerEmail: true,
        status: true,
        createdAt: true,
      },
    });

    // Check mustChangePassword flag
    const adminRecord = await basePrismaClient.superAdmin.findUnique({
      where: { id: admin.id },
      select: { mustChangePassword: true },
    });

    return NextResponse.json({
      totalTenants,
      tenantsByStatus: statusMap,
      recentSignups,
      mustChangePassword: adminRecord?.mustChangePassword ?? false,
    });
  } catch (error) {
    console.error('Get stats error:', error);
    return NextResponse.json(
      { message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
