import { IDatabase } from './IDatabase';
import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { SQLiteConfig } from './types';

export class SQLiteDatabase extends IDatabase {
  private db: sqlite3.Database;

  constructor(config: SQLiteConfig) {
    super();
    if (!config || !config.filename) throw new Error('SQLite "filename" gereklidir.');
    const dir = path.dirname(config.filename);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    this.db = new sqlite3.Database(config.filename);
  }

  private async _execute<T>(op: string, table: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    const res = await fn();
    this.recordMetric(op, table, Date.now() - start);
    return res;
  }

  async query(sql: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      const s = sql.trim().toUpperCase();
      if (s.startsWith('SELECT') || s.startsWith('PRAGMA')) {
        this.db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
      } else {
        this.db.run(sql, params, function(err) { err ? reject(err) : resolve({ changes: this.changes, lastID: this.lastID }); });
      }
    });
  }

  /**
   * SQLite dynamically adds missing columns using ALTER TABLE.
   */
  private async _ensureMissingColumns(table: string, data: Record<string, any>): Promise<void> {
    const info: any[] = await this.query(`PRAGMA table_info("${table}")`);
    const names = info.map(c => c.name);
    for (const key of Object.keys(data)) {
      if (key !== '_id' && !names.includes(key)) {
        await this.query(`ALTER TABLE "${table}" ADD COLUMN "${key}" TEXT`);
      }
    }
  }

  async ensureTable(table: string, data: any = {}): Promise<void> {
    try { 
      await this.query(`SELECT 1 FROM "${table}" LIMIT 1`); 
      await this._ensureMissingColumns(table, data);
    } catch {
      const defs = Object.keys(data).map(k => `"${k}" TEXT`);
      await this.query(`CREATE TABLE "${table}" (_id INTEGER PRIMARY KEY AUTOINCREMENT ${defs.length ? ', '+defs.join(',') : ''})`);
    }
  }

  async insert(table: string, data: any): Promise<number> {
    await this.runHooks('beforeInsert', table, data);
    return this._execute('insert', table, async () => {
      await this.ensureTable(table, data);
      const keys = Object.keys(data);
      const sql = `INSERT INTO "${table}" (${keys.map(k => `"${k}"`).join(',')}) VALUES (${keys.map(()=>'?').join(',')})`;
      const res = await this.query(sql, Object.values(data).map(v => JSON.stringify(v)));
      const finalData = { _id: res.lastID, ...data };
      await this.runHooks('afterInsert', table, finalData);
      return res.lastID;
    });
  }

  async update(table: string, data: any, where: any): Promise<number> {
    await this.runHooks('beforeUpdate', table, { data, where });
    return this._execute('update', table, async () => {
      await this.ensureTable(table, { ...data, ...where });
      const set = Object.keys(data).map(k => `"${k}" = ?`).join(',');
      const keys = Object.keys(where);
      const sql = `UPDATE "${table}" SET ${set} WHERE ${keys.map(k => `"${k}" = ?`).join(' AND ')}`;
      const res = await this.query(sql, [...Object.values(data).map(v => JSON.stringify(v)), ...Object.values(where).map(v => JSON.stringify(v))]);
      return res.changes;
    });
  }

  async delete(table: string, where: any): Promise<number> {
    await this.runHooks('beforeDelete', table, where);
    return this._execute('delete', table, async () => {
      await this.ensureTable(table, where);
      const keys = Object.keys(where);
      const sql = `DELETE FROM "${table}" WHERE ${keys.map(k => `"${k}" = ?`).join(' AND ')}`;
      const res = await this.query(sql, Object.values(where).map(v => JSON.stringify(v)));
      return res.changes;
    });
  }

  async select<T = any>(table: string, where: any = null): Promise<T[]> {
    return this._execute('select', table, async () => {
      await this.ensureTable(table, where || {});
      const keys = where ? Object.keys(where) : [];
      const sql = `SELECT * FROM "${table}"` + (keys.length ? ` WHERE ${keys.map(k => `"${k}" = ?`).join(' AND ')}` : '');
      const rows = await this.query(sql, keys.map(k => JSON.stringify(where[k])));
      return rows.map((r: any) => {
        const nr: any = {};
        for (const k in r) { try { nr[k] = JSON.parse(r[k]); } catch { nr[nr[k] = r[k]]; } }
        const { _id, ...rest } = r; // Handle _id vs id
        const finalObj: any = { _id };
        for (const k in rest) { try { finalObj[k] = JSON.parse(rest[k]); } catch { finalObj[k] = rest[k]; } }
        return finalObj as T;
      });
    });
  }

  async selectOne<T = any>(table: string, where: any = null): Promise<T | null> {
    const res = await this.select<T>(table, where);
    return res[0] || null;
  }

  async set(table: string, data: any, where: any): Promise<any> {
    const ex = await this.selectOne(table, where);
    return ex ? this.update(table, data, where) : this.insert(table, { ...where, ...data });
  }

  async bulkInsert(table: string, dataArray: any[]): Promise<number> {
    if (!dataArray.length) return 0;
    for (const d of dataArray) await this.insert(table, d);
    return dataArray.length;
  }

  async increment(table: string, incs: any, where: any): Promise<number> {
    return this._execute('increment', table, async () => {
      await this.ensureTable(table, where);
      const set = Object.keys(incs).map(f => `"${f}" = CAST("${f}" AS SKIP_CAST) + ?`.replace('SKIP_CAST', 'NUMERIC'));
      const keys = Object.keys(where);
      const sql = `UPDATE "${table}" SET ${set} WHERE ${keys.map(k => `"${k}" = ?`).join(' AND ')}`;
      const res = await this.query(sql, [...Object.values(incs), ...Object.values(where).map(v => JSON.stringify(v))]);
      return res.changes;
    });
  }

  async decrement(table: string, decs: any, where: any): Promise<number> {
    const incs: any = {};
    for (const k in decs) incs[k] = -decs[k];
    return this.increment(table, incs, where);
  }

  async close(): Promise<void> { return new Promise((resolve, reject) => this.db.close(err => err ? reject(err) : resolve())); }
}

export default SQLiteDatabase;