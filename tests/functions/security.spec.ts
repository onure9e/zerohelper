import { checkRateLimit } from '../../functions/security';

// Redis client mock
const mockRedisClient = {
  multi: jest.fn().mockReturnThis(),
  incr: jest.fn().mockReturnThis(),
  ttl: jest.fn().mockReturnThis(),
  exec: jest.fn(),
  expire: jest.fn(),
};

describe('Security Functions', () => {
  describe('checkRateLimit()', () => {
    
    beforeEach(() => {
      jest.clearAllMocks();
      // Re-setup mocks because jest config might reset them
      mockRedisClient.multi.mockReturnThis();
      mockRedisClient.incr.mockReturnThis();
      mockRedisClient.ttl.mockReturnThis();
      mockRedisClient.exec.mockResolvedValue([1, 60]); // Default success
      mockRedisClient.expire.mockResolvedValue(true);
    });

    it('should allow requests within limit (Memory Store)', async () => {
      const key = 'user_123';
      const options = { limit: 2, window: 60 }; // 2 requests per 60s

      const res1 = await checkRateLimit(key, options);
      expect(res1.allowed).toBe(true);
      expect(res1.remaining).toBe(1);

      const res2 = await checkRateLimit(key, options);
      expect(res2.allowed).toBe(true);
      expect(res2.remaining).toBe(0);
    });

    it('should block requests exceeding limit (Memory Store)', async () => {
      const key = 'user_block';
      const options = { limit: 1, window: 60 };

      await checkRateLimit(key, options); // 1st req (allowed)
      const res2 = await checkRateLimit(key, options); // 2nd req (blocked)

      expect(res2.allowed).toBe(false);
      expect(res2.remaining).toBe(0);
    });

    it('should reset limit after window expires (Memory Store)', async () => {
      const key = 'user_reset';
      const options = { limit: 1, window: 1 }; // 1 sec window

      await checkRateLimit(key, options); // Count = 1
      
      // Wait 1.1 seconds
      await new Promise(r => setTimeout(r, 1100));

      const res = await checkRateLimit(key, options); // Should be allowed again
      expect(res.allowed).toBe(true);
    });

    it('should use Redis when configured', async () => {
      const key = 'redis_user';
      const options = { 
        limit: 5, 
        window: 60, 
        storage: 'redis' as const, 
        redisClient: mockRedisClient 
      };

      // Mock Redis responses: [count, ttl]
      mockRedisClient.exec.mockResolvedValueOnce([1, 59]); 

      const res = await checkRateLimit(key, options);

      expect(mockRedisClient.multi).toHaveBeenCalled();
      expect(mockRedisClient.incr).toHaveBeenCalledWith(`rate_limit:${key}`);
      expect(res.allowed).toBe(true);
    });
    
    it('should handle Redis blocking', async () => {
      const key = 'redis_block';
      const options = { 
        limit: 5, 
        window: 60, 
        storage: 'redis' as const, 
        redisClient: mockRedisClient 
      };

      // Mock Redis responses: count = 6 (limit exceeded)
      mockRedisClient.exec.mockResolvedValueOnce([6, 30]); 

      const res = await checkRateLimit(key, options);
      expect(res.allowed).toBe(false);
      expect(res.remaining).toBe(0);
    });

    it('should handle high concurrency correctly (Race Condition)', async () => {
      // Memory Store testi
      const key = 'concurrent_user';
      const limit = 10;
      const options = { limit, window: 60 };

      // 50 tane paralel istek gönder
      const promises = [];
      for(let i=0; i<50; i++) {
        promises.push(checkRateLimit(key, options));
      }

      const results = await Promise.all(promises);
      const allowedCount = results.filter(r => r.allowed).length;
      const blockedCount = results.filter(r => !r.allowed).length;

      expect(allowedCount).toBe(limit);
      expect(blockedCount).toBe(40);
    });
  });
});
