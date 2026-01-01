import { IDatabase, HookType, HookFunction } from './IDatabase';
import { LRUCache } from 'lru-cache';
import { createClient, RedisClientType } from 'redis';
import { telemetry } from './telemetry';

export class CacheWrapper extends IDatabase {
  public db: IDatabase;
  private cacheType: 'memory' | 'redis';
  private tableCaches: Record<string, LRUCache<string, any>> = {};
  private redisClient: RedisClientType | null = null;
  private redisAvailable: boolean = false;
  private ttl: number = 300;
  private keyPrefix: string = 'db_cache:';
  private cache: LRUCache<string, any> | null = null;

  constructor(databaseInstance: IDatabase, options: any = {}) {
    super();
    this.db = databaseInstance;
    this.cacheType = options.type || 'memory';
    if (this.cacheType === 'redis') {
      this._initRedisCache(options);
    } else {
      this._initMemoryCache(options);
    }
  }

  /**
   * Redirect hooks registration to the underlying database instance.
   */
  public override on(hook: HookType, fn: HookFunction): void {
    this.db.on(hook, fn);
  }

  private _initMemoryCache(options: any): void {
    this.cache = new LRUCache({
      max: options.max || 500,
      ttl: options.ttl || 1000 * 60 * 5,
    });
    this.redisAvailable = false;
  }

  private async _initRedisCache(options: any): Promise<void> {
    const redisConfig = {
      socket: {
        host: options.host || '127.0.0.1',
        port: options.port || 6379,
        connectTimeout: options.connectTimeout || 5000,
      },
      password: options.password,
      database: options.db || 0,
    };

    this.redisClient = createClient(redisConfig) as RedisClientType;
    this.ttl = (options.ttl || 300000) / 1000;
    this.keyPrefix = options.keyPrefix || 'db_cache:';

    this.redisClient.on('error', () => {
      this.redisAvailable = false;
    });

    this.redisClient.on('ready', () => {
      this.redisAvailable = true;
    });

    try {
      await this.redisClient.connect();
      this.redisAvailable = true;
    } catch (error) {
      this._initMemoryCache(options);
    }
  }

  private _getCache(table: string): any {
    if (this.cacheType === 'redis' && this.redisAvailable && this.redisClient) return this.redisClient;
    if (!this.tableCaches[table]) {
      this.tableCaches[table] = new LRUCache({
        max: this.cache?.max || 500,
        ttl: this.cache?.ttl || 300000,
      });
    }
    return this.tableCaches[table];
  }

  private _generateKey(table: string, where: Record<string, any> | null): string {
    const sortedWhere = where ? Object.keys(where).sort().reduce((acc: any, key) => {
      acc[key] = where[key];
      return acc;
    }, {}) : {};
    const key = `${table}:${JSON.stringify(sortedWhere)}`;
    return this.cacheType === 'redis' ? `${this.keyPrefix}${key}` : key;
  }

  private async _getCacheValue(cache: any, key: string, table: string): Promise<any> {
    if (this.cacheType === 'redis' && this.redisAvailable && this.redisClient) {
      try {
        const value = await cache.get(key);
        if (value) {
          telemetry.recordCacheHit();
          return JSON.parse(value);
        }
      } catch {
        this.redisAvailable = false;
      }
    } else if (cache instanceof LRUCache) {
      const value = cache.get(key);
      if (value) {
        telemetry.recordCacheHit();
        return value;
      }
    }
    telemetry.recordCacheMiss();
    return null;
  }

  private async _setCacheValue(cache: any, key: string, value: any, table: string): Promise<void> {
    if (this.cacheType === 'redis' && this.redisAvailable && this.redisClient) {
      try {
        await cache.setEx(key, Math.floor(this.ttl), JSON.stringify(value));
      } catch {
        this.redisAvailable = false;
        this._getCache(table).set(key, value);
      }
    } else {
      cache.set(key, value);
    }
  }

  private async _clearCache(table: string): Promise<void> {
    if (this.cacheType === 'redis' && this.redisAvailable && this.redisClient) {
      try {
        const keys = await this.redisClient.keys(`${this.keyPrefix}${table}:*`);
        if (keys.length) await this.redisClient.del(keys);
      } catch {
        this.redisAvailable = false;
      }
    }
    if (this.tableCaches[table]) this.tableCaches[table].clear();
  }

  async select<T = any>(table: string, where: Record<string, any> | null = null): Promise<T[]> {
    const cache = this._getCache(table);
    const key = this._generateKey(table, where);
    let data = await this._getCacheValue(cache, key, table);
    if (data !== null && data !== undefined) return data;

    const start = Date.now();
    data = await this.db.select(table, where);
    (this.db as any).recordMetric?.('select', table, Date.now() - start);

    if (data !== null && data !== undefined) await this._setCacheValue(cache, key, data, table);
    return data;
  }

  async selectOne<T = any>(table: string, where: Record<string, any> | null = null): Promise<T | null> {
    const cache = this._getCache(table);
    const key = this._generateKey(table + '_one', where);
    let data = await this._getCacheValue(cache, key, table);
    if (data !== null && data !== undefined) return data;

    const start = Date.now();
    data = await this.db.selectOne(table, where);
    (this.db as any).recordMetric?.('selectOne', table, Date.now() - start);

    if (data !== null && data !== undefined) await this._setCacheValue(cache, key, data, table);
    return data;
  }

  async insert(table: string, data: Record<string, any>): Promise<any> {
    const start = Date.now();
    const result = await this.db.insert(table, data);
    (this.db as any).recordMetric?.('insert', table, Date.now() - start);
    await this._clearCache(table);
    return result;
  }

  async update(table: string, data: Record<string, any>, where: Record<string, any>): Promise<number> {
    const start = Date.now();
    const result = await this.db.update(table, data, where);
    (this.db as any).recordMetric?.('update', table, Date.now() - start);
    if (result > 0) await this._clearCache(table);
    return result;
  }

  async set(table: string, data: Record<string, any>, where: Record<string, any>): Promise<any> {
    const result = await this.db.set(table, data, where);
    await this._clearCache(table);
    return result;
  }

  async delete(table: string, where: Record<string, any>): Promise<number> {
    const start = Date.now();
    const result = await this.db.delete(table, where);
    (this.db as any).recordMetric?.('delete', table, Date.now() - start);
    if (result > 0) await this._clearCache(table);
    return result;
  }

  async bulkInsert(table: string, dataArray: Record<string, any>[]): Promise<number> {
    const result = await this.db.bulkInsert(table, dataArray);
    await this._clearCache(table);
    return result;
  }

  async increment(table: string, increments: Record<string, number>, where: Record<string, any> = {}): Promise<number> {
    const result = await this.db.increment(table, increments, where);
    await this._clearCache(table);
    return result;
  }

  async decrement(table: string, decrements: Record<string, number>, where: Record<string, any> = {}): Promise<number> {
    const result = await this.db.decrement(table, decrements, where);
    await this._clearCache(table);
    return result;
  }

  async close(): Promise<void> {
    if (this.redisClient) {
      await this.redisClient.quit();
      this.redisClient = null;
    }
    await this.db.close();
  }
}

export default CacheWrapper;
