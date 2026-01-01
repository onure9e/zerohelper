import { IDatabase } from './IDatabase';
import { createClient, RedisClientType } from 'redis';
import { RedisConfig } from './types';

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

  async connect(): Promise<RedisClientType> {
    if (this.client && this.client.isReady) return this.client;
    if (this.isConnecting) {
      while (this.isConnecting) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return this.client!;
    }

    this.isConnecting = true;
    try {
      this.client = createClient({
        socket: {
          host: this.config.host,
          port: this.config.port,
          connectTimeout: this.config.connectTimeout,
        },
        password: this.config.password,
        database: this.config.db,
      }) as RedisClientType;

      this.client.on('error', (err) => console.error('Redis Error:', err.message));
      await this.client.connect();
      return this.client;
    } finally {
      this.isConnecting = false;
    }
  }

  private _getKey(table: string, id: string): string {
    return `${this.keyPrefix}${table}:${id}`;
  }

  private _getTableKey(table: string): string {
    return `${this.keyPrefix}${table}:*`;
  }

  async select<T = any>(table: string, where: Record<string, any> = {}): Promise<T[]> {
    const client = await this.connect();
    const pattern = this._getTableKey(table);
    const keys = await client.keys(pattern);
    if (!keys.length) return [];

    const values = await client.mGet(keys);
    return values
      .map(v => {
        try {
          return v ? JSON.parse(v) : null;
        } catch (e) {
          return null;
        }
      })
      .filter(Boolean)
      .filter(item => Object.entries(where).every(([k, val]) => item[k] === val)) as T[];
  }

  async selectOne<T = any>(table: string, where: Record<string, any> = {}): Promise<T | null> {
    const results = await this.select<T>(table, where);
    return results.length ? results[0] : null;
  }

  async insert(table: string, data: Record<string, any>): Promise<any> {
    const client = await this.connect();
    const insertData = { ...data };
    if (!insertData._id && !insertData.id) {
      insertData._id = Date.now().toString() + Math.random().toString(36).slice(2, 9);
    }
    const id = insertData._id || insertData.id;
    const key = this._getKey(table, id);
    await client.set(key, JSON.stringify(insertData));
    return insertData;
  }

  async update(table: string, data: Record<string, any>, where: Record<string, any>): Promise<number> {
    const existing = await this.select(table, where);
    if (!existing.length) return 0;

    const client = await this.connect();
    for (const item of existing) {
      const merged = { ...item, ...data };
      const id = item._id || item.id;
      await client.set(this._getKey(table, id), JSON.stringify(merged));
    }
    return existing.length;
  }

  async delete(table: string, where: Record<string, any>): Promise<number> {
    const existing = await this.select(table, where);
    if (!existing.length) return 0;

    const client = await this.connect();
    const keys = existing.map(item => this._getKey(table, item._id || item.id));
    await client.del(keys);
    return existing.length;
  }

  async set(table: string, data: Record<string, any>, where: Record<string, any>): Promise<any> {
    const existing = await this.selectOne(table, where);
    if (existing) {
      await this.update(table, data, where);
      return existing;
    } else {
      return await this.insert(table, { ...data, ...where });
    }
  }

  async bulkInsert(table: string, dataArray: Record<string, any>[]): Promise<number> {
    for (const data of dataArray) {
      await this.insert(table, data);
    }
    return dataArray.length;
  }

  async increment(table: string, increments: Record<string, number>, where: Record<string, any> = {}): Promise<number> {
    const records = await this.select(table, where);
    const client = await this.connect();
    for (const record of records) {
      for (const [field, value] of Object.entries(increments)) {
        record[field] = (Number(record[field]) || 0) + value;
      }
      const id = record._id || record.id;
      await client.set(this._getKey(table, id), JSON.stringify(record));
    }
    return records.length;
  }

  async decrement(table: string, decrements: Record<string, number>, where: Record<string, any> = {}): Promise<number> {
    const records = await this.select(table, where);
    const client = await this.connect();
    for (const record of records) {
      for (const [field, value] of Object.entries(decrements)) {
        record[field] = (Number(record[field]) || 0) - value;
      }
      const id = record._id || record.id;
      await client.set(this._getKey(table, id), JSON.stringify(record));
    }
    return records.length;
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
  }
}

export default RedisDatabase;
