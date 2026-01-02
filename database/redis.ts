import { IDatabase } from './IDatabase';
import { createClient, RedisClientType } from 'redis';
import { RedisConfig } from './types';

export class RedisDatabase extends IDatabase {
  private config: RedisConfig;
  private client: RedisClientType | null = null;
  private keyPrefix: string;
  private _queue: Array<{ operation: () => Promise<any>; resolve: (val: any) => void; reject: (err: any) => void }> = [];
  private _isReady: boolean = false;
  private _connectionPromise: Promise<void> | null = null;

  constructor(config: RedisConfig) {
    super();
    this.config = config;
    this.keyPrefix = config.keyPrefix || 'app:';
    this._ensureConnection();
  }

  private async _ensureConnection() {
    if (this._connectionPromise) return this._connectionPromise;
    this._connectionPromise = (async () => {
      try {
        this.client = createClient({
            url: this.config.url,
            socket: { 
                host: this.config.host || '127.0.0.1', 
                port: this.config.port || 6379,
                connectTimeout: 5000,
                reconnectStrategy: false 
            },
            password: this.config.password,
            database: Number(this.config.database) || 0,
        }) as RedisClientType;

        await this.client.connect();
        this._isReady = true;
        this._flushQueue();
      } catch (error) {
        this._flushQueueWithError(error);
      }
    })();
    return this._connectionPromise;
  }

  private _flushQueue() {
    while (this._queue.length > 0) {
      const item = this._queue.shift();
      if (item) item.operation().then(item.resolve).catch(item.reject);
    }
  }

  private _flushQueueWithError(error: any) {
    while (this._queue.length > 0) {
      const item = this._queue.shift();
      if (item) item.reject(error);
    }
  }

  private async _execute<T>(op: string, table: string, fn: () => Promise<T>): Promise<T> {
    const operation = async () => {
        const start = Date.now();
        const res = await fn();
        this.recordMetric(op, table, Date.now() - start);
        return res;
    };
    if (this._isReady) return operation();
    return new Promise((resolve, reject) => {
      this._queue.push({ operation, resolve, reject });
    });
  }

  private _getKey(table: string, id: string): string { return `${this.keyPrefix}${table}:${id}`; }
  private _getTableKey(table: string): string { return `${this.keyPrefix}${table}:*`; }

  async select<T = any>(table: string, where: Record<string, any> = {}): Promise<T[]> {
    return this._execute('select', table, async () => {
      const keys = await this.client!.keys(this._getTableKey(table));
      if (!keys.length) return [];
      const vals = await this.client!.mGet(keys);
      return vals.map(v => v ? JSON.parse(v) : null).filter(Boolean)
        .filter(item => Object.entries(where).every(([k, v]) => String(item[k]) === String(v))) as T[];
    });
  }

  async selectOne<T = any>(table: string, where: Record<string, any> = {}): Promise<T | null> {
    const res = await this.select<T>(table, where);
    return res[0] || null;
  }

  async insert(table: string, data: Record<string, any>): Promise<any> {
    await this.runHooks('beforeInsert', table, data);
    return this._execute('insert', table, async () => {
      const d = { ...data };
      if (!d._id && !d.id) d._id = Date.now().toString() + Math.random().toString(36).slice(2, 9);
      const id = String(d._id || d.id);
      await this.client!.set(this._getKey(table, id), JSON.stringify(d));
      await this.runHooks('afterInsert', table, d);
      return d._id || d.id;
    });
  }

  async update(table: string, data: Record<string, any>, where: Record<string, any>): Promise<number> {
    await this.runHooks('beforeUpdate', table, { data, where });
    return this._execute('update', table, async () => {
      const existing = await this.select(table, where);
      for (const item of existing) {
        const merged = { ...item, ...data };
        await this.client!.set(this._getKey(table, item._id || item.id), JSON.stringify(merged));
      }
      return existing.length;
    });
  }

  async delete(table: string, where: Record<string, any>): Promise<number> {
    await this.runHooks('beforeDelete', table, where);
    return this._execute('delete', table, async () => {
      const existing = await this.select(table, where);
      if (existing.length) {
        const keys = existing.map(i => this._getKey(table, String(i._id || i.id)));
        await this.client!.del(keys);
      }
      return existing.length;
    });
  }

  async set(table: string, data: Record<string, any>, where: Record<string, any>): Promise<any> {
    const ex = await this.selectOne(table, where);
    return ex ? this.update(table, data, where) : this.insert(table, { ...data, ...where });
  }

  async bulkInsert(table: string, dataArray: Record<string, any>[]): Promise<number> {
    for (const d of dataArray) await this.insert(table, d);
    return dataArray.length;
  }

  /**
   * Atomic Increment using Lua for Redis
   */
  async increment(table: string, incs: Record<string, number>, where: Record<string, any> = {}): Promise<number> {
    return this._execute('increment', table, async () => {
      const recs = await this.select(table, where);
      for (const r of recs) {
        const id = String(r._id || r.id);
        const key = this._getKey(table, id);
        
        // Redis'te JSON sakladığımız için her alanı ayrı artırmak yerine 
        // objeyi okuyup, güncelleyip tekrar yazmalıyız. 
        // Bunu Lua script ile Redis tarafında atomik yapalım.
        const lua = `
            local val = redis.call('get', KEYS[1])
            if not val then return 0 end
            local data = cjson.decode(val)
            local incs = cjson.decode(ARGV[1])
            for k, v in pairs(incs) do
                data[k] = (tonumber(data[k]) or 0) + v
            end
            redis.call('set', KEYS[1], cjson.encode(data))
            return 1
        `;
        await this.client!.eval(lua, {
            keys: [key],
            arguments: [JSON.stringify(incs)]
        });
      }
      return recs.length;
    });
  }

  async decrement(table: string, decs: Record<string, number>, where: Record<string, any> = {}): Promise<number> {
    const incs: any = {};
    for (const k in decs) incs[k] = -decs[k];
    return this.increment(table, incs, where);
  }

  async close(): Promise<void> { 
      if (this.client) { 
          await this.client.quit(); 
          this.client = null; 
          this._isReady = false; 
          this._connectionPromise = null;
      } 
  }
}

export default RedisDatabase;
