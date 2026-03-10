import { prisma } from '@/lib/prisma';

interface WebhookConfig {
  enabled: boolean;
  url: string;
  platform: 'slack' | 'kakaowork' | 'teams' | 'custom';
  events: string[];
}

// --- URL validation (SSRF prevention) ---

const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^localhost$/i,
  /^\[::1\]$/,
];

export function isValidWebhookUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname;
    if (PRIVATE_IP_PATTERNS.some(p => p.test(hostname))) return false;
    return true;
  } catch {
    return false;
  }
}

export async function getWebhookConfig(): Promise<WebhookConfig | null> {
  try {
    const configs = await prisma.systemConfig.findMany({
      where: { group: 'webhook' },
    });

    const map = new Map(configs.map((c: any) => [c.key, c.value]));

    if (map.get('webhook_enabled') !== 'true') return null;

    const url = map.get('webhook_url');
    if (!url || !isValidWebhookUrl(url)) return null;

    return {
      enabled: true,
      url,
      platform: (map.get('webhook_platform') || 'custom') as WebhookConfig['platform'],
      events: JSON.parse(map.get('webhook_events') || '[]'),
    };
  } catch {
    return null;
  }
}

function formatPayload(platform: string, event: string, message: string) {
  switch (platform) {
    case 'slack':
      return { text: `[${event}] ${message}` };
    case 'kakaowork':
      return { text: `[${event}] ${message}` };
    case 'teams':
      return {
        '@type': 'MessageCard',
        '@context': 'http://schema.org/extensions',
        themeColor: '0076D7',
        summary: `[${event}]`,
        text: `[${event}] ${message}`,
      };
    default:
      return { event, message, timestamp: new Date().toISOString() };
  }
}

export async function sendWebhookNotification(event: string, message: string) {
  try {
    const config = await getWebhookConfig();
    if (!config) return;
    if (!config.events.includes(event)) return;

    const payload = formatPayload(config.platform, event, message);

    // Fire-and-forget with timeout
    fetch(config.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    }).catch(() => {});
  } catch {
    // Silently fail — webhook should never block main flow
  }
}
