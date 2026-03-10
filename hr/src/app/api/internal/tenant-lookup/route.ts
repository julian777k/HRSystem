import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const { subdomain } = await request.json();
    if (!subdomain) {
      return NextResponse.json({ message: 'subdomain required' }, { status: 400 });
    }

    const tenant = await (prisma as any).tenant.findFirst({
      where: { subdomain, status: 'active' },
      select: { id: true },
    });

    if (!tenant) {
      return NextResponse.json({ message: 'not found' }, { status: 404 });
    }

    return NextResponse.json({ tenantId: tenant.id });
  } catch {
    return NextResponse.json({ message: 'error' }, { status: 500 });
  }
}
