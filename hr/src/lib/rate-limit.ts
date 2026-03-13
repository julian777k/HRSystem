/**
 * Rate limiter: KV-backed on Cloudflare, in-memory for self-hosted.
 */

// In-memory fallback (self-hosted / development)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// Clean up expired entries periodically (self-hosted only)
if (typeof setInterval !== 'undefined') {
  try {
    setInterval(() => {
      const now = Date.now();
      for (const [key, value] of rateLimitMap) {
        if (now > value.resetTime) {
          rateLimitMap.delete(key);
        }
      }
    }, 60 * 1000);
  } catch {
    // setInterval not available in some edge runtimes
  }
}

interface KVNamespaceLike {
  get(key: string, type: 'json'): Promise<unknown>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

async function getKVNamespace(): Promise<KVNamespaceLike | null> {
  if (process.env.DEPLOY_TARGET !== 'cloudflare') return null;
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const { env } = await getCloudflareContext();
    return (env as any).HR_CACHE || null;
  } catch {
    return null;
  }
}

export async function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number
): Promise<{ success: boolean; retryAfterMs?: number }> {
  const kv = await getKVNamespace();

  if (kv) {
    // KV-backed rate limiting (Cloudflare Workers)
    const kvKey = `rate:${key}`;
    const now = Date.now();

    const stored = await kv.get(kvKey, 'json') as { count: number; resetTime: number } | null;

    if (!stored || now > stored.resetTime) {
      await kv.put(kvKey, JSON.stringify({ count: 1, resetTime: now + windowMs }), {
        expirationTtl: Math.ceil(windowMs / 1000) + 60,
      });
      return { success: true };
    }

    if (stored.count >= maxAttempts) {
      return { success: false, retryAfterMs: stored.resetTime - now };
    }

    await kv.put(kvKey, JSON.stringify({ count: stored.count + 1, resetTime: stored.resetTime }), {
      expirationTtl: Math.ceil((stored.resetTime - now) / 1000) + 60,
    });
    return { success: true };
  }

  // In-memory fallback (self-hosted)
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return { success: true };
  }

  if (entry.count >= maxAttempts) {
    return { success: false, retryAfterMs: entry.resetTime - now };
  }

  entry.count++;
  return { success: true };
}
