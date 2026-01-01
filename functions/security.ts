// functions/security.ts
import { RedisClientType } from 'redis';

export interface RateLimiterOptions {
  limit: number;      // Max requests
  window: number;     // Window in seconds (e.g., 60 for 1 min)
  storage?: 'memory' | 'redis';
  redisClient?: any;  // Redis client if using redis storage
}

interface MemoryStore {
  count: number;
  resetTime: number;
}

const localStore = new Map<string, MemoryStore>();

/**
 * Advanced Rate Limiter for API protection.
 * Returns true if allowed, false if rate limited.
 */
export async function checkRateLimit(key: string, options: RateLimiterOptions): Promise<{ allowed: boolean; remaining: number; reset: number }> {
  const { limit, window, storage = 'memory', redisClient } = options;
  const now = Date.now();

  if (storage === 'redis' && redisClient) {
    const redisKey = `rate_limit:${key}`;
    const multi = redisClient.multi();
    multi.incr(redisKey);
    multi.ttl(redisKey);
    const [count, ttl] = await multi.exec();

    if (count === 1) {
      await redisClient.expire(redisKey, window);
    }

    const isAllowed = count <= limit;
    return {
      allowed: isAllowed,
      remaining: Math.max(0, limit - Number(count)),
      reset: ttl > 0 ? now + (ttl * 1000) : now + (window * 1000)
    };
  } else {
    // Memory Storage
    let data = localStore.get(key);

    if (!data || now > data.resetTime) {
      data = {
        count: 0,
        resetTime: now + (window * 1000)
      };
    }

    data.count++;
    localStore.set(key, data);

    const isAllowed = data.count <= limit;
    return {
      allowed: isAllowed,
      remaining: Math.max(0, limit - data.count),
      reset: data.resetTime
    };
  }
}
