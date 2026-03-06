import { prisma } from '@/lib/prisma';

export interface SetupConfig {
  setupComplete: boolean;
  setupDate: string;
  companyName: string;
}

export async function getSetupConfig(): Promise<SetupConfig | null> {
  try {
    const configs = await prisma.systemConfig.findMany({
      where: { key: { in: ['setup_complete', 'setup_date', 'company_name'] } },
    });

    const map = new Map(configs.map((c) => [c.key, c.value]));

    if (map.get('setup_complete') === 'true') {
      return {
        setupComplete: true,
        setupDate: map.get('setup_date') || '',
        companyName: map.get('company_name') || '',
      };
    }

    return null;
  } catch {
    return null;
  }
}

export async function isSetupComplete(): Promise<boolean> {
  try {
    const config = await prisma.systemConfig.findUnique({
      where: { key: 'setup_complete' },
    });
    return config?.value === 'true';
  } catch {
    return false;
  }
}
