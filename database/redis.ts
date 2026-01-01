import { IDatabase } from './IDatabase';
import { createClient, RedisClientType } from 'redis';

export class RedisDatabase extends IDatabase {
  private config: any;
  private client: RedisClientType | null = null;
  private isConnecting: boolean = false;
  private keyPrefix: string;

  constructor(config: any = {}) {
    super();
    this.config = {
      host: config.host || '127.0.0.1',
      port: config.port || 6379,
      password: config.password,
      db: config.db || 0,
      connectTimeout: config.connectTimeout || 5000,
    };
    this.keyPrefix = config.keyPrefix || 'app:';
  }

  private async _execute<T>(op: string, table: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    const res = await fn();
    this.recordMetric(op, table, Date.now() - start);
    return res;
  }

  async connect(): Promise<RedisClientType> {
    if (this.client && this.client.isReady) return this.client;
    if (this.isConnecting) {
      while (this.isConnecting) await new Promise(r => setTimeout(r, 100));
      return this.client!;
    }
    this.isConnecting = true;
    try {
      this.client = createClient({
        socket: { host: this.config.host, port: this.config.port, connectTimeout: this.config.connectTimeout },
        password: this.config.password,
        database: this.config.db,
      }) as RedisClientType;
      await this.client.connect();
      return this.client;
    } finally { this.isConnecting = false; }
  }

  private _getKey(table: string, id: string): string { return `${this.keyPrefix}${table}:${id}`; }
  private _getTableKey(table: string): string { return `${this.keyPrefix}${table}:*`; }

  async select<T = any>(table: string, where: Record<string, any> = {}): Promise<T[]> {
    return this._execute('select', table, async () => {
      const client = await this.connect();
      const keys = await client.keys(this._getTableKey(table));
      if (!keys.length) return [];
      const vals = await client.mGet(keys);
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
      const client = await this.connect();
      const d = { ...data };
      if (!d._id && !d.id) d._id = Date.now().toString() + Math.random().toString(36).slice(2, 9);
      const id = String(d._id || d.id);
      await client.set(this._getKey(table, id), JSON.stringify(d));
      await this.runHooks('afterInsert', table, d);
      return d._id || d.id;
    });
  }

  async update(table: string, data: Record<string, any>, where: Record<string, any>): Promise<number> {
    await this.runHooks('beforeUpdate', table, { data, where });
    return this._execute('update', table, async () => {
      const existing = await this.select(table, where);
      const client = await this.connect();
      for (const item of existing) {
        const merged = { ...item, ...data };
        const id = String(item._id || item.id);
        await client.set(this._getKey(table, id), JSON.stringify(merged));
      }
      return existing.length;
    });
  }

  async delete(table: string, where: Record<string, any>): Promise<number> {
    await this.runHooks('beforeDelete', table, where);
    return this._execute('delete', table, async () => {
      const existing = await this.select(table, where);
      const client = await this.connect();
      if (existing.length) {
        const keys = existing.map(i => this._getKey(table, String(i._id || i.id)));
        await client.del(keys);
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

  async increment(table: string, incs: Record<string, number>, where: Record<string, any> = {}): Promise<number> {
    const recs = await this.select(table, where);
    const client = await this.connect();
    for (const r of recs) {
      for (const [f, v] of Object.entries(incs)) r[f] = (Number(r[f]) || 0) + v;
      const id = String(r._id || r.id);
      await client.set(this._getKey(table, id), JSON.stringify(r));
    }
    return recs.length;
  }

  async decrement(table: string, decs: Record<string, number>, where: Record<string, any> = {}): Promise<number> {
    const incs: any = {};
    for (const k in decs) incs[k] = -decs[k];
    return this.increment(table, incs, where);
  }

  async close(): Promise<void> { if (this.client) { await this.client.quit(); this.client = null; } }
}

export default RedisDatabase;
