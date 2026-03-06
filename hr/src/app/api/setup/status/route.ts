import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const configs = await prisma.systemConfig.findMany({
      where: { key: { in: ['setup_complete', 'company_name'] } },
    });

    const map = new Map(configs.map((c) => [c.key, c.value]));

    return NextResponse.json({
      isComplete: map.get('setup_complete') === 'true',
      companyName: map.get('company_name') || '',
    });
  } catch {
    // If DB is not reachable or table doesn't exist, setup is not complete
    return NextResponse.json({ isComplete: false });
  }
}
