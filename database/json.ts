import { IDatabase } from './IDatabase';
import fs from 'fs/promises';
import { writeFileSync } from 'fs';
import path from 'path';
import { JsonConfig } from './types';

export class JsonDatabase extends IDatabase {
  private filePath: string;
  private db: Record<string, any[]> = {};
  private isDirty: boolean = false;
  private isWriting: boolean = false;
  private writeQueue: Array<{ operation: () => any; resolve: (val: any) => void; reject: (err: any) => void }> = [];
  private saveDebounceTimeout: NodeJS.Timeout | null = null;
  private saveInterval: number;
  private initPromise: Promise<void>;

  constructor(config: JsonConfig) {
    super();
    if (!config || !config.filePath) throw new Error('Yapılandırma içinde "filePath" belirtilmelidir.');
    this.filePath = config.filePath;
    this.saveInterval = 500;
    process.on('exit', () => this.flushSync());
    this.initPromise = this._load();
  }

  private async _load(): Promise<void> {
    try {
      const dir = path.dirname(this.filePath);
      await fs.mkdir(dir, { recursive: true });
      const fileContent = await fs.readFile(this.filePath, 'utf-8');
      this.db = JSON.parse(fileContent);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        this.db = {};
        await this._saveNow();
      } else {
        this.db = {};
      }
    }
  }

  private _queueRequest<T>(operation: () => T): Promise<T> {
    return new Promise((resolve, reject) => {
      this.writeQueue.push({ operation, resolve, reject });
      this._processQueue();
    });
  }

  private async _processQueue(): Promise<void> {
    if (this.isWriting || this.writeQueue.length === 0) return;
    this.isWriting = true;
    const item = this.writeQueue.shift();
    if (item) {
      try {
        const result = item.operation();
        this.isDirty = true;
        this._scheduleSave();
        item.resolve(result);
      } catch (error) {
        item.reject(error);
      } finally {
        this.isWriting = false;
        this._processQueue();
      }
    }
  }

  private _scheduleSave(): void {
    if (this.saveDebounceTimeout) clearTimeout(this.saveDebounceTimeout);
    this.saveDebounceTimeout = setTimeout(() => this._saveNow(), this.saveInterval);
  }

  private async _saveNow(): Promise<void> {
    if (!this.isDirty) return;
    if (this.saveDebounceTimeout) clearTimeout(this.saveDebounceTimeout);
    this.saveDebounceTimeout = null;
    try {
      await fs.writeFile(this.filePath, JSON.stringify(this.db, null, 2));
      this.isDirty = false;
    } catch (error) {
      console.error("Veritabanı dosyasına yazılırken hata:", error);
    }
  }

  private flushSync(): void {
    if (this.isDirty) {
      try {
        writeFileSync(this.filePath, JSON.stringify(this.db, null, 2));
        this.isDirty = false;
      } catch (error) {}
    }
  }

  private _matches(row: any, where: Record<string, any>): boolean {
    return Object.keys(where).every(key => row[key] === where[key]);
  }

  async ensureTable(table: string): Promise<void> {
    await this.initPromise;
    if (!this.db[table]) {
      return this._queueRequest(() => {
        this.db[table] = [];
      });
    }
  }

  async insert(table: string, data: Record<string, any>): Promise<number> {
    await this.ensureTable(table);
    return this._queueRequest(() => {
      const maxId = this.db[table].reduce((max, row) => (row._id > max ? row._id : max), 0);
      const newId = maxId + 1;
      const newRow = { _id: newId, ...data };
      this.db[table].push(newRow);
      return newId;
    });
  }

  async update(table: string, data: Record<string, any>, where: Record<string, any>): Promise<number> {
    await this.ensureTable(table);
    return this._queueRequest(() => {
      let affectedRows = 0;
      this.db[table].forEach(row => {
        if (this._matches(row, where)) {
          Object.assign(row, data);
          affectedRows++;
        }
      });
      return affectedRows;
    });
  }

  async delete(table: string, where: Record<string, any>): Promise<number> {
    await this.ensureTable(table);
    return this._queueRequest(() => {
      const initialLength = this.db[table].length;
      this.db[table] = this.db[table].filter(row => !this._matches(row, where));
      return initialLength - this.db[table].length;
    });
  }

  async select<T = any>(table: string, where: Record<string, any> | null = null): Promise<T[]> {
    await this.initPromise;
    const tableData = this.db[table] || [];
    let results = tableData;
    if (where && Object.keys(where).length > 0) {
      results = results.filter(row => this._matches(row, where));
    }
    return JSON.parse(JSON.stringify(results)) as T[];
  }

  async set(table: string, data: Record<string, any>, where: Record<string, any>): Promise<any> {
    const existing = await this.select(table, where);
    if (existing.length === 0) {
      return this.insert(table, { ...where, ...data });
    } else {
      return this.update(table, data, where);
    }
  }

  async selectOne<T = any>(table: string, where: Record<string, any> | null = null): Promise<T | null> {
    const results = await this.select<T>(table, where);
    return results[0] || null;
  }

  async bulkInsert(table: string, dataArray: Record<string, any>[]): Promise<number> {
    if (!Array.isArray(dataArray) || dataArray.length === 0) return 0;
    await this.ensureTable(table);
    return this._queueRequest(() => {
      let maxId = this.db[table].reduce((max, row) => (row._id > max ? row._id : max), 0);
      dataArray.forEach(data => {
        maxId++;
        this.db[table].push({ _id: maxId, ...data });
      });
      return dataArray.length;
    });
  }

  async increment(table: string, increments: Record<string, number>, where: Record<string, any> = {}): Promise<number> {
    await this.ensureTable(table);
    return this._queueRequest(() => {
      let affectedCount = 0;
      this.db[table].forEach(row => {
        if (this._matches(row, where)) {
          for (const [field, value] of Object.entries(increments)) {
            row[field] = (Number(row[field]) || 0) + value;
          }
          affectedCount++;
        }
      });
      return affectedCount;
    });
  }

  async decrement(table: string, decrements: Record<string, number>, where: Record<string, any> = {}): Promise<number> {
    await this.ensureTable(table);
    return this._queueRequest(() => {
      let affectedCount = 0;
      this.db[table].forEach(row => {
        if (this._matches(row, where)) {
          for (const [field, value] of Object.entries(decrements)) {
            row[field] = (Number(row[field]) || 0) - value;
          }
          affectedCount++;
        }
      });
      return affectedCount;
    });
  }

  async close(): Promise<void> {
    await this._saveNow();
  }
}

export default JsonDatabase;
