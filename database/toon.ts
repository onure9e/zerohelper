import { IDatabase } from './IDatabase';
import fs from 'fs/promises';
import { writeFileSync, existsSync } from 'fs';
import path from 'path';
import { stringify, parse } from '../functions/toon';
import { ToonConfig } from './types';

export class ToonDatabase extends IDatabase {
  private filePath: string;
  private db: Record<string, any[]> = {};
  private isDirty: boolean = false;
  private isWriting: boolean = false;
  private writeQueue: Array<{ operation: () => any; resolve: (val: any) => void; reject: (err: any) => void }> = [];
  private saveDebounceTimeout: NodeJS.Timeout | null = null;
  private saveInterval: number;
  private initPromise: Promise<void>;

  constructor(config: ToonConfig) {
    super();
    if (!config || !config.path) throw new Error('ToonDB: "path" gereklidir.');
    this.filePath = config.path;
    this.saveInterval = config.saveInterval || 500;
    process.on('exit', () => this.flushSync());
    this.initPromise = this._load();
  }

  private async _execute<T>(op: string, table: string, fn: () => T): Promise<T> {
    const start = Date.now();
    const res = await fn();
    this.recordMetric(op, table, Date.now() - start);
    return res;
  }

  private async _load(): Promise<void> {
    try {
      const dir = path.dirname(this.filePath);
      if (!existsSync(dir)) await fs.mkdir(dir, { recursive: true });
      if (!existsSync(this.filePath)) {
        this.db = {};
        await this._saveNow();
        return;
      }
      const content = await fs.readFile(this.filePath, 'utf-8');
      const parsed = parse(content);

      // ✅ Parse sonucunu doğrula
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        this.db = {};
      } else {
        this.db = {};
        // Her tablonun array olduğundan emin ol
        for (const [key, value] of Object.entries(parsed)) {
          this.db[key] = Array.isArray(value) ? value : [];
        }
      }
    } catch (error) {
      console.error("ToonDB load error:", error);
      this.db = {};
    }
  }

  private _getTable(table: string): any[] {
    // ✅ Her zaman array döndüren yardımcı fonksiyon
    const data = this.db[table];
    return Array.isArray(data) ? data : [];
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
      await fs.writeFile(this.filePath, stringify(this.db));
      this.isDirty = false;
    } catch (error) {
      console.error("ToonDB save error:", error);
    }
  }

  private flushSync(): void {
    if (this.isDirty) {
      try {
        writeFileSync(this.filePath, stringify(this.db));
        this.isDirty = false;
      } catch (error) { }
    }
  }

  async ensureTable(table: string): Promise<void> {
    await this.initPromise;
    // ✅ Tablonun array olduğundan emin ol
    if (!Array.isArray(this.db[table])) {
      return this._queueRequest(() => {
        this.db[table] = [];
      });
    }
  }

  async insert(table: string, data: Record<string, any>): Promise<number> {
    await this.runHooks('beforeInsert', table, data);
    return this._execute('insert', table, async () => {
      await this.ensureTable(table);
      return this._queueRequest(() => {
        const tableData = this._getTable(table);
        const maxId = tableData.reduce((max, row) => (row._id > max ? row._id : max), 0);
        const newId = maxId + 1;
        const newRow = { _id: newId, ...data };
        this.db[table].push(newRow);
        this.runHooks('afterInsert', table, newRow);
        return newId;
      });
    });
  }

  async update(table: string, data: Record<string, any>, where: Record<string, any>): Promise<number> {
    await this.runHooks('beforeUpdate', table, { data, where });
    return this._execute('update', table, async () => {
      await this.ensureTable(table);
      return this._queueRequest(() => {
        let affected = 0;
        const tableData = this._getTable(table);
        tableData.forEach(row => {
          if (Object.keys(where).every(k => String(row[k]) === String(where[k]))) {
            Object.assign(row, data);
            affected++;
          }
        });
        this.runHooks('afterUpdate', table, { affected });
        return affected;
      });
    });
  }

  async delete(table: string, where: Record<string, any>): Promise<number> {
    await this.runHooks('beforeDelete', table, where);
    return this._execute('delete', table, async () => {
      await this.ensureTable(table);
      return this._queueRequest(() => {
        const tableData = this._getTable(table);
        const initial = tableData.length;
        this.db[table] = tableData.filter(row =>
          !Object.keys(where).every(k => String(row[k]) === String(where[k]))
        );
        const affected = initial - this.db[table].length;
        this.runHooks('afterDelete', table, { affected });
        return affected;
      });
    });
  }

  async select<T = any>(table: string, where: Record<string, any> | null = null): Promise<T[]> {
    return this._execute('select', table, async () => {
      await this.initPromise;
      // ✅ _getTable kullanarak array garantisi
      const tableData = this._getTable(table);
      const results = where && Object.keys(where).length > 0
        ? tableData.filter(row => Object.keys(where).every(k => String(row[k]) === String(where[k])))
        : tableData;
      return JSON.parse(JSON.stringify(results)) as T[];
    });
  }

  async selectOne<T = any>(table: string, where: Record<string, any> | null = null): Promise<T | null> {
    const res = await this.select<T>(table, where);
    return res[0] || null;
  }

  async set(table: string, data: Record<string, any>, where: Record<string, any>): Promise<any> {
    await this.ensureTable(table); // ✅ Önce tabloyu garantile
    const ex = await this.selectOne(table, where);
    return ex ? this.update(table, data, where) : this.insert(table, { ...where, ...data });
  }

  async bulkInsert(table: string, dataArray: Record<string, any>[]): Promise<number> {
    return this._execute('bulkInsert', table, async () => {
      if (!dataArray.length) return 0;
      await this.ensureTable(table);
      return this._queueRequest(() => {
        const tableData = this._getTable(table);
        let maxId = tableData.reduce((max, row) => (row._id > max ? row._id : max), 0);
        dataArray.forEach(data => {
          maxId++;
          this.db[table].push({ _id: maxId, ...data });
        });
        return dataArray.length;
      });
    });
  }

  async increment(table: string, incs: Record<string, number>, where: Record<string, any> = {}): Promise<number> {
    return this._execute('increment', table, async () => {
      await this.ensureTable(table);
      return this._queueRequest(() => {
        let affected = 0;
        const tableData = this._getTable(table);
        tableData.forEach(row => {
          if (Object.keys(where).every(k => String(row[k]) === String(where[k]))) {
            for (const [f, v] of Object.entries(incs)) row[f] = (Number(row[f]) || 0) + v;
            affected++;
          }
        });
        return affected;
      });
    });
  }

  async decrement(table: string, decs: Record<string, number>, where: Record<string, any> = {}): Promise<number> {
    const incs: any = {};
    for (const k in decs) incs[k] = -decs[k];
    return this.increment(table, incs, where);
  }

  async close(): Promise<void> { await this._saveNow(); }
}

export default ToonDatabase;
