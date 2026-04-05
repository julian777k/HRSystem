/**
 * Rate limiter: in-memory for all environments.
 *
 * Previously used KV on Cloudflare, but KV free tier only allows 1,000 writes/day.
 * Each login = 2 KV writes → 500 logins/day hits the limit → service outage.
 * In-memory is sufficient: isolate restarts reset counters, but brute-force
 * protection still works within each isolate's lifetime (minutes to hours).
 */

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
let lastCleanupTime = 0;
const CLEANUP_INTERVAL_MS = 30_000;

export async function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number
): Promise<{ success: boolean; retryAfterMs?: number }> {
  const now = Date.now();

  // Periodic cleanup (every 30s, not every call)
  if (now - lastCleanupTime > CLEANUP_INTERVAL_MS) {
    lastCleanupTime = now;
    for (const [k, v] of rateLimitMap) {
      if (now > v.resetTime) {
        rateLimitMap.delete(k);
      }
    }
    // Emergency cap: evict oldest entries instead of clearing all
    if (rateLimitMap.size > 1000) {
      const entries = [...rateLimitMap.entries()]
        .sort((a, b) => a[1].resetTime - b[1].resetTime);
      const toRemove = entries.slice(0, entries.length - 500);
      for (const [k] of toRemove) {
        rateLimitMap.delete(k);
      }
    }
  }

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
