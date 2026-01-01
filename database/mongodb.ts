import { IDatabase } from './IDatabase';
import { MongoClient, Db } from "mongodb";
import { MongoDBConfig } from './types';

export class MongoDBDatabase extends IDatabase {
  private config: MongoDBConfig;
  private client: MongoClient;
  private db: Db | null = null;
  private _queue: Array<{ operation: () => Promise<any>; resolve: (val: any) => void; reject: (err: any) => void }> = [];
  private _connected: boolean = false;
  private _connectionPromise: Promise<Db>;

  constructor(config: any) {
    super();
    this.config = config;
    this.client = new MongoClient(config.url || config.uri);
    this._connectionPromise = new Promise(async (resolve, reject) => {
      try {
        await this.client.connect();
        this.db = this.client.db(config.database || config.dbName);
        this._connected = true;
        resolve(this.db);
        this._processQueue();
      } catch (error) { reject(error); }
    });
  }

  private async _execute<T>(op: string, table: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    const execute = async () => {
      const res = await fn();
      this.recordMetric(op, table, Date.now() - start);
      return res;
    };
    if (this._connected) return execute();
    return new Promise((resolve, reject) => this._queue.push({ operation: execute, resolve, reject }));
  }

  private async _processQueue(): Promise<void> {
    if (!this._connected) return;
    while (this._queue.length > 0) {
      const item = this._queue.shift();
      if (item) { try { item.resolve(await item.operation()); } catch (error) { item.reject(error); } }
    }
  }

  async insert(collection: string, data: any): Promise<any> {
    await this.runHooks('beforeInsert', collection, data);
    return this._execute('insert', collection, async () => {
      const db = await this._connectionPromise;
      const res = await db.collection(collection).insertOne(data);
      const finalData = { _id: res.insertedId, ...data };
      await this.runHooks('afterInsert', collection, finalData);
      return res.insertedId;
    });
  }

  async update(collection: string, data: any, where: any): Promise<number> {
    await this.runHooks('beforeUpdate', collection, { data, where });
    return this._execute('update', collection, async () => {
      const db = await this._connectionPromise;
      const res = await db.collection(collection).updateMany(where, { $set: data });
      await this.runHooks('afterUpdate', collection, { affected: res.modifiedCount });
      return Number(res.modifiedCount);
    });
  }

  async delete(collection: string, where: any): Promise<number> {
    await this.runHooks('beforeDelete', collection, where);
    return this._execute('delete', collection, async () => {
      const db = await this._connectionPromise;
      const res = await db.collection(collection).deleteMany(where);
      await this.runHooks('afterDelete', collection, { affected: res.deletedCount });
      return res.deletedCount;
    });
  }

  async select<T = any>(collection: string, where: any = {}): Promise<T[]> {
    return this._execute('select', collection, async () => {
      const db = await this._connectionPromise;
      return await db.collection(collection).find(where).toArray() as unknown as T[];
    });
  }

  async selectOne<T = any>(collection: string, where: any = {}): Promise<T | null> {
    return this._execute('selectOne', collection, async () => {
      const db = await this._connectionPromise;
      return await db.collection(collection).findOne(where) as unknown as T | null;
    });
  }

  async set(collection: string, data: any, where: any): Promise<any> {
    const ex = await this.selectOne(collection, where);
    return ex ? this.update(collection, data, where) : this.insert(collection, { ...where, ...data });
  }

  async bulkInsert(collection: string, dataArray: any[]): Promise<number> {
    return this._execute('bulkInsert', collection, async () => {
      if (!dataArray.length) return 0;
      const db = await this._connectionPromise;
      const res = await db.collection(collection).insertMany(dataArray);
      return res.insertedCount;
    });
  }

  async increment(collection: string, incs: Record<string, number>, where: any = {}): Promise<number> {
    return this._execute('increment', collection, async () => {
      const db = await this._connectionPromise;
      const res = await db.collection(collection).updateMany(where, { $inc: incs });
      return Number(res.modifiedCount);
    });
  }

  async decrement(collection: string, decs: Record<string, number>, where: any = {}): Promise<number> {
    const incs: any = {};
    for (const k in decs) incs[k] = -decs[k];
    return this.increment(collection, incs, where);
  }

  async close(): Promise<void> { await this.client.close(); }
}

export default MongoDBDatabase;