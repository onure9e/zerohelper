import { IDatabase } from './IDatabase';
import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { SQLiteConfig } from './types';

export class SQLiteDatabase extends IDatabase {
  private db: sqlite3.Database;

  constructor(config: SQLiteConfig) {
    super();
    if (!config || !config.path) throw new Error('SQLite "path" gereklidir.');
    const dir = path.dirname(config.path);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    this.db = new sqlite3.Database(config.path);
  }

  private async _execute<T>(op: string, table: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    const res = await fn();
    this.recordMetric(op, table, Date.now() - start);
    return res;
  };

  async query(sql: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      const s = sql.trim().toUpperCase();
      if (s.startsWith('SELECT') || s.startsWith('PRAGMA')) {
        this.db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
      } else {
        this.db.run(sql, params, function (err) { err ? reject(err) : resolve({ changes: this.changes, lastID: this.lastID }); });
      }
    });
  }

  async ensureTable(table: string, data: any = {}): Promise<void> {
    try {
      await this.query(`SELECT 1 FROM "${table}" LIMIT 1`);
      const info: any[] = await this.query(`PRAGMA table_info("${table}")`);
      const names = info.map(c => c.name);
      for (const key of Object.keys(data)) {
        if (key !== '_id' && !names.includes(key)) {
          await this.query(`ALTER TABLE "${table}" ADD COLUMN "${key}" TEXT`);
        }
      }
    } catch {
      const defs = Object.keys(data).map(k => `"${k}" TEXT`);
      await this.query(`CREATE TABLE "${table}" (_id INTEGER PRIMARY KEY AUTOINCREMENT ${defs.length ? ', ' + defs.join(',') : ''})`);
    }
  }

  async insert(table: string, data: any): Promise<number> {
    await this.runHooks('beforeInsert', table, data);
    return this._execute('insert', table, async () => {
      await this.ensureTable(table, data);
      const keys = Object.keys(data);
      const sql = `INSERT INTO "${table}" (${keys.map(k => `"${k}"`).join(',')}) VALUES (${keys.map(() => '?').join(',')})`;
      const res = await this.query(sql, Object.values(data).map(v => typeof v === 'object' ? JSON.stringify(v) : v));
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
      const { whereClause, values: whereValues } = this._buildWhereClause(where);
      const sql = `UPDATE "${table}" SET ${set} ${whereClause}`;
      const res = await this.query(sql, [...Object.values(data).map(v => typeof v === 'object' ? JSON.stringify(v) : v), ...whereValues]);
      return res.changes;
    });
  }

  async delete(table: string, where: any): Promise<number> {
    await this.runHooks('beforeDelete', table, where);
    return this._execute('delete', table, async () => {
      await this.ensureTable(table, where);
      const { whereClause, values } = this._buildWhereClause(where);
      const sql = `DELETE FROM "${table}" ${whereClause}`;
      const res = await this.query(sql, values);
      return res.changes;
    });
  }

  async select<T = any>(table: string, where: any = null): Promise<T[]> {
    return this._execute('select', table, async () => {
      await this.ensureTable(table, where || {});
      const { whereClause, values } = this._buildWhereClause(where);
      const rows = await this.query(`SELECT * FROM "${table}" ${whereClause}`, values);
      return rows.map((r: any) => {
        const nr: any = {};
        for (const k in r) { try { nr[k] = JSON.parse(r[k]); } catch { nr[k] = r[k]; } }
        return nr as T;
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
      const set = Object.keys(incs).map(f => `"${f}" = CAST("${f}" AS NUMERIC) + ?`);
      const { whereClause, values } = this._buildWhereClause(where);
      const sql = `UPDATE "${table}" SET ${set} ${whereClause}`;
      const res = await this.query(sql, [...Object.values(incs), ...values]);
      return res.changes;
    });
  }

  async decrement(table: string, decs: any, where: any): Promise<number> {
    const incs: any = {};
    for (const k in decs) incs[k] = -decs[k];
    return this.increment(table, incs, where);
  }

  async close(): Promise<void> { return new Promise((resolve, reject) => this.db.close(err => err ? reject(err) : resolve())); }

  private _serializeValue(v: any): any {
    if (v instanceof Date) return v.toISOString().slice(0, 19).replace('T', ' ');
    return (typeof v === 'object' && v !== null) ? JSON.stringify(v) : v;
  }

  private _buildWhereClause(where: Record<string, any> | null): { whereClause: string; values: any[] } {
    if (!where) return { whereClause: '', values: [] };
    const safeWhere = where as Record<string, any>;
    const keys = Object.keys(safeWhere);
    if (!keys.length) return { whereClause: '', values: [] };
    return {
      whereClause: 'WHERE ' + keys.map(k => `"${k}" = ?`).join(' AND '),
      values: keys.map(k => this._serializeValue(safeWhere[k]))
    };
  }
}

export default SQLiteDatabase;
