const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitMap) {
    if (now > value.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 60 * 1000);

/**
 * Simple in-memory rate limiter.
 * Returns { success: true } if within limit, { success: false, retryAfterMs } if exceeded.
 */
export function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number
): { success: boolean; retryAfterMs?: number } {
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
