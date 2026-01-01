import { IDatabase } from './IDatabase';
import mysql, { Pool } from "mysql2/promise";
import { MySQLConfig } from './types';

export class MySQLDatabase extends IDatabase {
  private config: MySQLConfig;
  private pool: Pool | null = null;
  private _queue: Array<{ operation: () => Promise<any>; resolve: (val: any) => void; reject: (err: any) => void }> = [];
  private _connected: boolean = false;
  private _connectionPromise: Promise<Pool>;

  constructor(config: MySQLConfig) {
    super();
    this.config = config;

    this._connectionPromise = new Promise(async (resolve, reject) => {
      try {
        const connection = await mysql.createConnection({
          host: config.host || 'localhost',
          port: config.port || 3306,
          user: config.username,
          password: config.password,
        });

        await connection.query(`CREATE DATABASE IF NOT EXISTS
${config.database}
`);
        await connection.end();

        this.pool = mysql.createPool({
          host: config.host || 'localhost',
          port: config.port || 3306,
          user: config.username,
          password: config.password,
          database: config.database,
          waitForConnections: true,
          connectionLimit: config.poolSize || 10,
          queueLimit: 0,
        });

        this._connected = true;
        resolve(this.pool);
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

  async query(sql: string, params: any[] = []): Promise<any> {
    const pool = await this._connectionPromise;
    const [rows] = await pool.execute(sql, params);
    return rows;
  }

  private async _ensureMissingColumns(table: string, data: Record<string, any>): Promise<void> {
    const existingColumns: any[] = await this.query(`DESCRIBE
${table}
`).catch(() => []);
    const columnNames = existingColumns.map(col => col.Field);
    for (const key of Object.keys(data)) {
      if (key !== '_id' && !columnNames.includes(key)) {
        await this.query(`ALTER TABLE
${table}
 ADD COLUMN
${key}
 TEXT`);
      }
    }
  }

  async ensureTable(table: string, data: any = {}): Promise<void> {
    const escapedTable = mysql.escape(table);
    const tables: any[] = await this.query(`SHOW TABLES LIKE ${escapedTable}`);
    if (tables.length === 0) {
      const defs = Object.keys(data).map(k => `
${k}
 TEXT`);
      const columnsPart = defs.length > 0 ? ', ' + defs.join(", ") : '';
      await this.query(`CREATE TABLE
${table}
 (_id INT PRIMARY KEY AUTO_INCREMENT ${columnsPart}) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    } else {
      await this._ensureMissingColumns(table, data);
    }
  }

  async insert(table: string, data: Record<string, any>): Promise<number> {
    await this.runHooks('beforeInsert', table, data);
    return this._execute('insert', table, async () => {
      await this.ensureTable(table, data);
      const keys = Object.keys(data);
      const sql = `INSERT INTO
${table}
 (${keys.map(k => `
${k}
`).join(",")}) VALUES (${keys.map(() => '?').join(",")})`;
      const result = await this.query(sql, Object.values(data).map(v => typeof v === 'object' ? JSON.stringify(v) : v));
      const finalData = { _id: result.insertId, ...data };
      await this.runHooks('afterInsert', table, finalData);
      return result.insertId;
    });
  }

  async update(table: string, data: Record<string, any>, where: Record<string, any>): Promise<number> {
    await this.runHooks('beforeUpdate', table, { data, where });
    return this._execute('update', table, async () => {
      await this.ensureTable(table, { ...data, ...where });
      const set = Object.keys(data).map(k => `
${k}
 = ?`).join(", ");
      const wKeys = Object.keys(where);
      const sql = `UPDATE
${table}
 SET ${set} WHERE ${wKeys.map(k => `
${k}
 = ?`).join(" AND ")}`;
      const result = await this.query(sql, [...Object.values(data).map(v => typeof v === 'object' ? JSON.stringify(v) : v), ...Object.values(where).map(v => typeof v === 'object' ? JSON.stringify(v) : v)]);
      return result.affectedRows;
    });
  }

  async delete(table: string, where: Record<string, any>): Promise<number> {
    await this.runHooks('beforeDelete', table, where);
    return this._execute('delete', table, async () => {
      await this.ensureTable(table, where);
      const keys = Object.keys(where);
      const sql = `DELETE FROM
${table}
 WHERE ${keys.map(k => `
${k}
 = ?`).join(" AND ")}`;
      const result = await this.query(sql, Object.values(where).map(v => typeof v === 'object' ? JSON.stringify(v) : v));
      return result.affectedRows;
    });
  }

  async select<T = any>(table: string, where: Record<string, any> | null = null): Promise<T[]> {
    return this._execute('select', table, async () => {
      await this.ensureTable(table, where || {});
      const keys = where ? Object.keys(where) : [];
      const sql = `SELECT * FROM
${table}
 ` + (keys.length ? ' WHERE ' + keys.map(k => `
${k}
 = ?`).join(" AND ") : '');
      const rows = await this.query(sql, keys.map(k => typeof where![k] === 'object' ? JSON.stringify(where![k]) : where![k]));
      return rows.map((row: any) => {
        const nr: any = {};
        for (const k in row) { try { nr[k] = JSON.parse(row[k]); } catch { nr[k] = row[k]; } }
        return nr as T;
      });
    });
  }

  async selectOne<T = any>(table: string, where: Record<string, any> | null = null): Promise<T | null> {
    const res = await this.select<T>(table, where);
    return res[0] || null;
  }

  async set(table: string, data: Record<string, any>, where: Record<string, any>): Promise<any> {
    const existing = await this.selectOne(table, where);
    return existing ? this.update(table, data, where) : this.insert(table, { ...where, ...data });
  }

  async bulkInsert(table: string, dataArray: Record<string, any>[]): Promise<number> {
    if (!dataArray.length) return 0;
    return this._execute('bulkInsert', table, async () => {
      await this.ensureTable(table, dataArray[0]);
      const keys = Object.keys(dataArray[0]);
      const placeholders = dataArray.map(() => `(${keys.map(() => '?').join(',')})`).join(',');
      const values = dataArray.flatMap(obj => keys.map(k => this._serializeValue(obj[k])));
      const sql = `INSERT INTO
${table}
 (${keys.map(k => `
${k}
`).join(",")}) VALUES ${placeholders}`;
      const result = await this.query(sql, values);
      return result.affectedRows;
    });
  }

  async increment(table: string, incs: Record<string, number>, where: Record<string, any>): Promise<number> {
    return this._execute('increment', table, async () => {
      await this.ensureTable(table, where);
      const set = Object.keys(incs).map(f => `
${f}
 =
${f}
 + ?`).join(', ');
      const wKeys = Object.keys(where);
      const sql = `UPDATE
${table}
 SET ${set} WHERE ${wKeys.map(k => `
${k}
 = ?`).join(" AND ")}`;
      const result = await this.query(sql, [...Object.values(incs), ...Object.values(where).map(v => typeof v === 'object' ? JSON.stringify(v) : v)]);
      return result.affectedRows;
    });
  }

  async decrement(table: string, decs: Record<string, number>, where: Record<string, any>): Promise<number> {
    const incs: any = {};
    for (const k in decs) incs[k] = -decs[k];
    return this.increment(table, incs, where);
  }

  async close(): Promise<void> { if (this.pool) await this.pool.end(); }

  private _getColumnType(v: any): string {
    if (v === null || v === undefined) return 'TEXT';
    if (typeof v === 'boolean') return 'BOOLEAN';
    if (typeof v === 'number') return Number.isInteger(v) ? 'INT' : 'DOUBLE';
    if (v instanceof Date) return 'DATETIME';
    if (typeof v === 'object') return 'JSON';
    return 'TEXT';
  }

  private _serializeValue(v: any): any {
    if (v instanceof Date) return v.toISOString().slice(0, 19).replace('T', ' ');
    return (typeof v === 'object' && v !== null) ? JSON.stringify(v) : v;
  }

  private _buildWhereClause(where: Record<string, any> | null): { whereClause: string; values: any[] } {
    if (!where) return { whereClause: '', values: [] };
    const keys = Object.keys(where);
    if (!keys.length) return { whereClause: '', values: [] };
    return {
      whereClause: 'WHERE ' + keys.map(k => `
${k}
 = ?`).join(' AND '),
      values: Object.values(where).map(v => this._serializeValue(v))
    };
  }
}

export default MySQLDatabase;
