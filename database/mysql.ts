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
          host: config.host,
          port: config.port || 3306,
          user: config.user,
          password: config.password,
          typeCast: (field: any, next: () => any) => {
            if (field.type === 'TINY' && field.length === 1) return (field.string() === '1');
            if (['INT', 'DECIMAL', 'NEWDECIMAL', 'FLOAT', 'DOUBLE'].includes(field.type)) return Number(field.string());
            return next();
          }
        });

        await connection.query(`CREATE DATABASE IF NOT EXISTS 
${config.database}
`);
        await connection.end();

        this.pool = mysql.createPool({
          host: config.host, port: config.port || 3306, user: config.user, password: config.password, database: config.database,
          waitForConnections: true, connectionLimit: config.connectionLimit || 10, queueLimit: 0,
          typeCast: (field: any, next: () => any) => {
            if (field.type === 'TINY' && field.length === 1) return (field.string() === '1');
            if (['INT', 'DECIMAL', 'NEWDECIMAL', 'FLOAT', 'DOUBLE'].includes(field.type)) return Number(field.string());
            return next();
          }
        });

        this._connected = true;
        resolve(this.pool);
        this._processQueue();
      } catch (error) {
        reject(error);
      }
    });
  }

  private async _queueRequest<T>(operation: () => Promise<T>, opName: string, table: string): Promise<T> {
    const start = Date.now();
    const execute = async () => {
      const res = await operation();
      this.recordMetric(opName, table, Date.now() - start);
      return res;
    };

    if (this._connected) return execute();
    return new Promise((resolve, reject) => {
      this._queue.push({ operation: execute, resolve, reject });
    });
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

  async ensureTable(table: string, data: Record<string, any> = {}): Promise<void> {
    const escapedTable = mysql.escape(table);
    const tables: any[] = await this.query(`SHOW TABLES LIKE ${escapedTable}`);
    if (tables.length === 0) {
      const columnDefinitions = Object.keys(data).map(col => `
${col}
 ${this._getColumnType(data[col])}`);
      const columnsPart = columnDefinitions.length > 0 ? ', ' + columnDefinitions.join(", ") : '';
      await this.query(`CREATE TABLE 
${table}
 (_id INT PRIMARY KEY AUTO_INCREMENT ${columnsPart}) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    }
  }

  async insert(table: string, data: Record<string, any>): Promise<number> {
    await this.runHooks('beforeInsert', table, data);
    return this._queueRequest(async () => {
      await this.ensureTable(table, data);
      const keys = Object.keys(data);
      const placeholders = keys.map(() => "?").join(",");
      const values = Object.values(data).map(v => this._serializeValue(v));
      const sql = `INSERT INTO 
${table}
 (${keys.map(k => `
${k}
`).join(",")}) VALUES (${placeholders})`;
      const result = await this.query(sql, values);
      const finalData = { _id: result.insertId, ...data };
      await this.runHooks('afterInsert', table, finalData);
      return result.insertId;
    }, 'insert', table);
  }

  async update(table: string, data: Record<string, any>, where: Record<string, any>): Promise<number> {
    await this.runHooks('beforeUpdate', table, { data, where });
    return this._queueRequest(async () => {
      const setString = Object.keys(data).map(k => `
${k}
 = ?`).join(", ");
      const { whereClause, values: whereValues } = this._buildWhereClause(where);
      const sql = `UPDATE 
${table}
 SET ${setString} ${whereClause}`;
      const result = await this.query(sql, [...Object.values(data).map(v => this._serializeValue(v)), ...whereValues]);
      await this.runHooks('afterUpdate', table, { affected: result.affectedRows });
      return result.affectedRows;
    }, 'update', table);
  }

  async delete(table: string, where: Record<string, any>): Promise<number> {
    await this.runHooks('beforeDelete', table, where);
    return this._queueRequest(async () => {
      const { whereClause, values } = this._buildWhereClause(where);
      const sql = `DELETE FROM 
${table}
 ${whereClause}`;
      const result = await this.query(sql, values);
      await this.runHooks('afterDelete', table, { affected: result.affectedRows });
      return result.affectedRows;
    }, 'delete', table);
  }

  async select<T = any>(table: string, where: Record<string, any> | null = null): Promise<T[]> {
    return this._queueRequest(async () => {
      const { whereClause, values } = this._buildWhereClause(where || {});
      const rows = await this.query(`SELECT * FROM 
${table}
 ${whereClause}`, values);
      return rows.map((row: any) => {
        const newRow: any = {};
        for (const key in row) newRow[key] = this._deserializeValue(row[key]);
        return newRow as T;
      });
    }, 'select', table);
  }

  async selectOne<T = any>(table: string, where: Record<string, any> | null = null): Promise<T | null> {
    const results = await this.select<T>(table, where);
    return results[0] || null;
  }

  async set(table: string, data: Record<string, any>, where: Record<string, any>): Promise<any> {
    const existing = await this.selectOne(table, where);
    return existing ? this.update(table, data, where) : this.insert(table, { ...where, ...data });
  }

  async bulkInsert(table: string, dataArray: Record<string, any>[]): Promise<number> {
    return this._queueRequest(async () => {
      if (!dataArray.length) return 0;
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
    }, 'bulkInsert', table);
  }

  async increment(table: string, increments: Record<string, number>, where: Record<string, any>): Promise<number> {
    return this._queueRequest(async () => {
      const clauses = Object.keys(increments).map(f => `
${f}
 = 
${f}
 + ?`).join(', ');
      const { whereClause, values } = this._buildWhereClause(where);
      const sql = `UPDATE 
${table}
 SET ${clauses} ${whereClause}`;
      const result = await this.query(sql, [...Object.values(increments), ...values]);
      return result.affectedRows;
    }, 'increment', table);
  }

  async decrement(table: string, decrements: Record<string, number>, where: Record<string, any>): Promise<number> {
    const incs: any = {};
    for (const k in decrements) incs[k] = -decrements[k];
    return this.increment(table, incs, where);
  }

  async close(): Promise<void> { if (this.pool) await this.pool.end(); }

  private _getColumnType(v: any): string {
    if (v === null || v === undefined) return 'TEXT';
    if (typeof v === 'boolean') return 'BOOLEAN';
    if (typeof v === 'number') return Number.isInteger(v) ? 'INT' : 'DOUBLE';
    if (v instanceof Date) return 'DATETIME';
    return 'TEXT';
  }

  private _serializeValue(v: any): any {
    if (v instanceof Date) return v.toISOString().slice(0, 19).replace('T', ' ');
    return (typeof v === 'object' && v !== null) ? JSON.stringify(v) : v;
  }

  private _deserializeValue(v: any): any {
    if (typeof v === 'string' && (v.startsWith('{') || v.startsWith('['))) {
      try { return JSON.parse(v); } catch { return v; }
    }
    return v;
  }

  private _buildWhereClause(where: Record<string, any>): { whereClause: string; values: any[] } {
    const keys = Object.keys(where);
    if (!keys.length) return { whereClause: '', values: [] };
    return { whereClause: 'WHERE ' + keys.map(k => `
${k}
 = ?`).join(' AND '), values: Object.values(where).map(v => this._serializeValue(v)) };
  }
}

export default MySQLDatabase;
