import { IDatabase } from './IDatabase';
import { Pool } from 'pg';
import { PostgreSQLConfig } from './types';

export class PostgreSQLDatabase extends IDatabase {
  private config: PostgreSQLConfig;
  private pool: Pool | null = null;
  private _queue: Array<{ operation: () => Promise<any>; resolve: (val: any) => void; reject: (err: any) => void }> = [];
  private _connected: boolean = false;
  private _connectionPromise: Promise<Pool>;

  constructor(config: PostgreSQLConfig) {
    super();
    this.config = config;
    this._connectionPromise = new Promise(async (resolve, reject) => {
      try {
        const tempPool = new Pool({ host: config.host || 'localhost', port: config.port || 5432, user: config.username, password: config.password, database: 'postgres' });
        try { await tempPool.query(`CREATE DATABASE "${config.database}"`); } catch (e: any) { if (!e.message.includes('already exists')) console.warn(e.message); }
        await tempPool.end();
        this.pool = new Pool({ host: config.host || 'localhost', port: config.port || 5432, user: config.username, password: config.password, database: config.database, max: config.poolSize || 10 });
        this._connected = true;
        resolve(this.pool);
        this._processQueue();
      } catch (error) { reject(error); }
    });
  }

  private async _execute<T>(op: string, table: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    const res = await fn();
    this.recordMetric(op, table, Date.now() - start);
    return res;
  };

  private async _processQueue(): Promise<void> {
    if (!this._connected) return;
    while (this._queue.length > 0) {
      const item = this._queue.shift();
      if (item) { try { item.resolve(await item.operation()); } catch (error) { item.reject(error); } }
    }
  }

  async query(sql: string, params: any[] = []): Promise<any> {
    const pool = await this._connectionPromise;
    const res = await pool.query(sql, params);
    return res.rows;
  }

  async ensureTable(table: string, data: any = {}): Promise<void> {
    const tables = await this.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`, [table]);
    if (tables.length === 0) {
      const defs = Object.keys(data).map(k => `"${k}" TEXT`);
      await this.query(`CREATE TABLE "${table}" ("_id" SERIAL PRIMARY KEY ${defs.length ? ', ' + defs.join(",") : ''})`);
    } else {
      const existing = await this.query(`SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND table_schema = 'public'`, [table]);
      const names = existing.map((c: any) => c.column_name);
      for (const key of Object.keys(data)) {
        if (key !== '_id' && !names.includes(key)) {
          await this.query(`ALTER TABLE "${table}" ADD COLUMN "${key}" TEXT`);
        }
      }
    }
  }

  async insert(table: string, data: any): Promise<any> {
    await this.runHooks('beforeInsert', table, data);
    return this._execute('insert', table, async () => {
      await this.ensureTable(table, data);
      const keys = Object.keys(data);
      const sql = `INSERT INTO "${table}" (${keys.map(k => `"${k}"`).join(",")}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(",")}) RETURNING "_id"`;
      const res = await this.query(sql, Object.values(data).map(v => this._serializeValue(v)));
      const finalData = { _id: res[0]._id, ...data };
      await this.runHooks('afterInsert', table, finalData);
      return res[0]._id;
    });
  }

  async update(table: string, data: any, where: any): Promise<number> {
    await this.runHooks('beforeUpdate', table, { data, where });
    return this._execute('update', table, async () => {
      await this.ensureTable(table, { ...data, ...where });
      const set = Object.keys(data).map((k, i) => `"${k}" = $${i + 1}`).join(",");
      const { whereClause, values: whereValues } = this._buildWhereClause(where);
      const sql = `UPDATE "${table}" SET ${set} ${whereClause}`;
      const pool = await this._connectionPromise;
      const res = await pool.query(sql, [...Object.values(data).map(v => this._serializeValue(v)), ...whereValues]);
      return res.rowCount ?? 0;
    });
  }

  async delete(table: string, where: any): Promise<number> {
    await this.runHooks('beforeDelete', table, where);
    return this._execute('delete', table, async () => {
      await this.ensureTable(table, where);
      const { whereClause, values } = this._buildWhereClause(where);
      const sql = `DELETE FROM "${table}" ${whereClause}`;
      const pool = await this._connectionPromise;
      const res = await pool.query(sql, values);
      return res.rowCount ?? 0;
    });
  }

  async select<T = any>(table: string, where: any = null): Promise<T[]> {
    return this._execute('select', table, async () => {
      await this.ensureTable(table, where || {});
      const { whereClause, values } = this._buildWhereClause(where);
      const rows = await this.query(`SELECT * FROM "${table}" ${whereClause}`, values);
      return rows.map((r: any) => {
        const nr: any = {};
        for (const k in r) nr[k] = r[k];
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

  async increment(table: string, incs: Record<string, number>, where: any): Promise<number> {
    return this._execute('increment', table, async () => {
      await this.ensureTable(table, where);
      const set = Object.keys(incs).map((f, i) => `"${f}" = "${f}" + $${i + 1}`).join(',');
      const { whereClause, values } = this._buildWhereClause(where);
      const sql = `UPDATE "${table}" SET ${set} ${whereClause}`;
      const pool = await this._connectionPromise;
      const res = await pool.query(sql, [...Object.values(incs), ...values]);
      return res.rowCount ?? 0;
    });
  }

  async decrement(table: string, decs: Record<string, number>, where: any): Promise<number> {
    const incs: any = {};
    for (const k in decs) incs[k] = -decs[k];
    return this.increment(table, incs, where);
  }

  async close(): Promise<void> { if (this.pool) await this.pool.end(); }

  private _getColumnType(v: any): string {
    if (v === null || v === undefined) return 'TEXT';
    if (typeof v === 'boolean') return 'BOOLEAN';
    if (typeof v === 'number') return Number.isInteger(v) ? 'INTEGER' : 'DOUBLE PRECISION';
    if (v instanceof Date) return 'TIMESTAMP';
    if (typeof v === 'object') return 'JSONB';
    return 'TEXT';
  }

  private _serializeValue(v: any): any {
    if (v instanceof Date) return v.toISOString();
    return (typeof v === 'object' && v !== null) ? JSON.stringify(v) : v;
  }

  private _buildWhereClause(where: Record<string, any> | null): { whereClause: string; values: any[] } {
    if (!where) return { whereClause: '', values: [] };
    const safeWhere = where as Record<string, any>;
    const keys = Object.keys(safeWhere);
    if (!keys.length) return { whereClause: '', values: [] };
    return {
      whereClause: 'WHERE ' + keys.map((k, i) => `"${k}" = $${i + 1}`).join(' AND '),
      values: keys.map(k => this._serializeValue(safeWhere[k]))
    };
  }
}

export default PostgreSQLDatabase;
