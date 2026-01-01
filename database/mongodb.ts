import { IDatabase } from './IDatabase';
import { MongoClient, Db, ObjectId } from "mongodb";
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
      } catch (error) {
        console.error("MongoDB connection error:", error);
        reject(error);
      }
    });
  }

  private async _queueRequest<T>(operation: () => Promise<T>): Promise<T> {
    if (this._connected) {
      return operation();
    } else {
      return new Promise((resolve, reject) => {
        this._queue.push({ operation, resolve, reject });
      });
    }
  }

  private async _processQueue(): Promise<void> {
    if (!this._connected) return;
    while (this._queue.length > 0) {
      const item = this._queue.shift();
      if (item) {
        try {
          const result = await item.operation();
          item.resolve(result);
        } catch (error) {
          item.reject(error);
        }
      }
    }
  }

  async ensureCollection(collection: string): Promise<void> {
    return this._queueRequest(async () => {
      const db = await this._connectionPromise;
      const collections = await db.listCollections({ name: collection }).toArray();
      if (collections.length === 0) {
        await db.createCollection(collection);
      }
    });
  }

  async insert(collection: string, data: Record<string, any>): Promise<any> {
    return this._queueRequest(async () => {
      await this.ensureCollection(collection);
      const db = await this._connectionPromise;
      const result = await db.collection(collection).insertOne(data);
      return result.insertedId;
    });
  }

  async bulkInsert(collection: string, dataArray: Record<string, any>[]): Promise<number> {
    return this._queueRequest(async () => {
      if (!Array.isArray(dataArray) || dataArray.length === 0) return 0;
      await this.ensureCollection(collection);
      const db = await this._connectionPromise;
      const result = await db.collection(collection).insertMany(dataArray);
      return result.insertedCount;
    });
  }

  async update(collection: string, data: Record<string, any>, where: Record<string, any>): Promise<number> {
    return this._queueRequest(async () => {
      await this.ensureCollection(collection);
      const db = await this._connectionPromise;
      const result = await db.collection(collection).updateMany(where, { $set: data });
      return Number(result.modifiedCount);
    });
  }

  async delete(collection: string, where: Record<string, any>): Promise<number> {
    return this._queueRequest(async () => {
      await this.ensureCollection(collection);
      const db = await this._connectionPromise;
      const result = await db.collection(collection).deleteMany(where);
      return result.deletedCount;
    });
  }

  async select<T = any>(collection: string, where: Record<string, any> = {}): Promise<T[]> {
    return this._queueRequest(async () => {
      await this.ensureCollection(collection);
      const db = await this._connectionPromise;
      const results = await db.collection(collection).find(where).toArray();
      return results as unknown as T[];
    });
  }

  async selectOne<T = any>(collection: string, where: Record<string, any> = {}): Promise<T | null> {
    return this._queueRequest(async () => {
      await this.ensureCollection(collection);
      const db = await this._connectionPromise;
      const result = await db.collection(collection).findOne(where);
      return result as unknown as T | null;
    });
  }

  async set(collection: string, data: Record<string, any>, where: Record<string, any>): Promise<any> {
    return this._queueRequest(async () => {
      await this.ensureCollection(collection);
      const db = await this._connectionPromise;
      const existing = await db.collection(collection).findOne(where);
      if (!existing) {
        const result = await db.collection(collection).insertOne({ ...where, ...data });
        return result.insertedId;
      } else {
        const result = await db.collection(collection).updateOne(where, { $set: data });
        return result.modifiedCount;
      }
    });
  }

  async increment(collection: string, increments: Record<string, number>, where: Record<string, any> = {}): Promise<number> {
    return this._queueRequest(async () => {
      await this.ensureCollection(collection);
      const db = await this._connectionPromise;
      const result = await db.collection(collection).updateMany(where, { $inc: increments });
      return Number(result.modifiedCount);
    });
  }

  async decrement(collection: string, decrements: Record<string, number>, where: Record<string, any> = {}): Promise<number> {
    return this._queueRequest(async () => {
      await this.ensureCollection(collection);
      const db = await this._connectionPromise;
      const negativeIncrements: Record<string, number> = {};
      for (const [key, value] of Object.entries(decrements)) {
        negativeIncrements[key] = -value;
      }
      const result = await db.collection(collection).updateMany(where, { $inc: negativeIncrements });
      return Number(result.modifiedCount);
    });
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}

export default MongoDBDatabase;
