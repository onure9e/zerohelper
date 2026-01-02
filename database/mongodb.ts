import { IDatabase } from './IDatabase';
import { MongoClient, Db, ObjectId } from "mongodb";
import { MongoDBConfig } from './types';

export class MongoDBDatabase extends IDatabase {
  private client: MongoClient;
  private db: Db | null = null;
  private _isConnected: boolean = false;
  private _queue: Array<{ operation: () => Promise<any>; resolve: (val: any) => void; reject: (err: any) => void }> = [];

  constructor(config: MongoDBConfig) {
    super();
    const uri = config.url || (config.uri ?? `mongodb://${config.host || 'localhost'}:${config.port || 27017}`);

    this.client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5000, // Fail fast if no server
      connectTimeoutMS: 5000
    });

    this._connect(config.database || 'test');
  }

  private async _connect(dbName: string) {
    try {
      await this.client.connect();
      this.db = this.client.db(dbName);
      this._isConnected = true;
      this._flushQueue();
    } catch (error) {
      this._flushQueueWithError(error);
      // Opsiyonel: Yeniden bağlanma mantığı buraya eklenebilir,
      // ama testler için fail-fast daha iyidir.
    }
  }

  private _flushQueue() {
    while (this._queue.length > 0) {
      const item = this._queue.shift();
      if (item) {
        item.operation().then(item.resolve).catch(item.reject);
      }
    }
  }

  private _flushQueueWithError(error: any) {
    while (this._queue.length > 0) {
      const item = this._queue.shift();
      if (item) item.reject(error);
    }
  }

  private async _execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this._isConnected) {
      return fn();
    }
    return new Promise((resolve, reject) => {
      this._queue.push({ operation: fn, resolve, reject });
    });
  }

  // --- Implementations ---

  async insert(collection: string, data: any): Promise<string> {
    await this.runHooks('beforeInsert', collection, data);
    return this._execute(async () => {
      const res = await this.db!.collection(collection).insertOne(data);
      const newId = res.insertedId.toString();
      const finalData = { _id: newId, ...data };
      await this.runHooks('afterInsert', collection, finalData);
      return newId;
    });
  }

  async update(collection: string, data: any, where: any): Promise<number> {
    await this.runHooks('beforeUpdate', collection, { data, where });
    const formattedWhere = this._formatQuery(where);
    return this._execute(async () => {
      const res = await this.db!.collection(collection).updateMany(formattedWhere, { $set: data });
      return res.modifiedCount;
    });
  }

  async delete(collection: string, where: any): Promise<number> {
    await this.runHooks('beforeDelete', collection, where);
    const formattedWhere = this._formatQuery(where);
    return this._execute(async () => {
      const res = await this.db!.collection(collection).deleteMany(formattedWhere);
      return res.deletedCount;
    });
  }

  async select<T = any>(collection: string, where: any = {}): Promise<T[]> {
    const formattedWhere = this._formatQuery(where);
    return this._execute(async () => {
      const docs = await this.db!.collection(collection).find(formattedWhere).toArray();
      return docs.map(doc => this._serialize(doc)) as T[];
    });
  }

  async selectOne<T = any>(collection: string, where: any = {}): Promise<T | null> {
    const formattedWhere = this._formatQuery(where);
    return this._execute(async () => {
      const doc = await this.db!.collection(collection).findOne(formattedWhere);
      return doc ? this._serialize(doc) as T : null;
    });
  }

  async set(collection: string, data: any, where: any): Promise<any> {
    const ex = await this.selectOne(collection, where);
    return ex ? this.update(collection, data, where) : this.insert(collection, { ...where, ...data });
  }

  async bulkInsert(collection: string, dataArray: any[]): Promise<number> {
    if (!dataArray.length) return 0;
    return this._execute(async () => {
      const res = await this.db!.collection(collection).insertMany(dataArray);
      return res.insertedCount;
    });
  }

  async increment(collection: string, incs: Record<string, number>, where: any = {}): Promise<number> {
    const formattedWhere = this._formatQuery(where);
    return this._execute(async () => {
      const res = await this.db!.collection(collection).updateMany(formattedWhere, { $inc: incs });
      return res.modifiedCount;
    });
  }

  async decrement(collection: string, decs: Record<string, number>, where: any = {}): Promise<number> {
    const incs: any = {};
    for (const k in decs) incs[k] = -decs[k];
    return this.increment(collection, incs, where);
  }

  async close(): Promise<void> {
    if (this.client) await this.client.close();
    this._isConnected = false;
  }

  // Helper: _id handling and query formatting
  private _formatQuery(where: any): any {
    if (!where) return {};
    const query: any = { ...where };
    if (query._id && typeof query._id === 'string' && ObjectId.isValid(query._id)) {
      query._id = new ObjectId(query._id);
    }
    return query;
  }

  private _serialize(doc: any): any {
    if (!doc) return doc;
    const { _id, ...rest } = doc;
    // _id'yi string olarak döndür, ZeroHelper standardı
    return { _id: _id.toString(), ...rest };
  }
}

export default MongoDBDatabase;
