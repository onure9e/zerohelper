import { IDatabase } from './IDatabase';
import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { SQLiteConfig } from './types';

export class SQLiteDatabase extends IDatabase {
  private db: sqlite3.Database;

  constructor(config: SQLiteConfig) {
    super();
    if (!config || !config.filename) {
      throw new Error('SQLite yapılandırması için "filename" gereklidir.');
    }

    const dir = path.dirname(config.filename);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new sqlite3.Database(config.filename, (err) => {
      if (err) {
        console.error("SQLite connection error:", err.message);
      }
    });
  }

  private _detectColumnType(value: any): string {
    if (value === null || value === undefined) return 'TEXT';
    if (typeof value === 'boolean') return 'BOOLEAN';
    if (typeof value === 'number') return Number.isInteger(value) ? 'INTEGER' : 'REAL';
    if (value instanceof Date) return 'DATETIME';
    if (typeof value === 'string') {
      if (value.trim() === '') return 'TEXT';
      if (/^-?\d+$/.test(value.trim())) return 'INTEGER';
      if (/^-?\d+\.\d+$/.test(value.trim())) return 'REAL';
      const lowerValue = value.toLowerCase().trim();
      if (lowerValue === 'true' || lowerValue === 'false') return 'BOOLEAN';
      if (value.match(/^\d{4}-\d{2}-\d{2}/)) return 'DATETIME';
    }
    return 'TEXT';
  }

  private _determineBestColumnType(values: any[]): string {
    const types = values.map(v => this._detectColumnType(v));
    const typePriority: Record<string, number> = { 'INTEGER': 1, 'REAL': 2, 'BOOLEAN': 3, 'DATETIME': 4, 'TEXT': 5 };
    const maxPriority = Math.max(...types.map(t => typePriority[t] || 5));
    return Object.keys(typePriority).find(t => typePriority[t] === maxPriority) || 'TEXT';
  }

  private async _ensureMissingColumns(table: string, data: Record<string, any>): Promise<void> {
    const columnsInfo: any[] = await this.query(`PRAGMA table_info(\`${table}\`)
`);
    const existingNames = columnsInfo.map(col => col.name);
    for (const key of Object.keys(data)) {
      if (!existingNames.includes(key)) {
        const columnType = this._detectColumnType(data[key]);
        await this.query(`ALTER TABLE everse{table}everse ADD COLUMN everse{key}everse ${columnType}`);
      }
    }
  }

  query(sql: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      const upperSql = sql.trim().toUpperCase();
      if (upperSql.startsWith('SELECT') || upperSql.startsWith('PRAGMA')) {
        this.db.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      } else {
        this.db.run(sql, params, function (err) {
          if (err) reject(err);
          else resolve({ changes: this.changes, lastInsertRowid: this.lastID });
        });
      }
    });
  }

  async ensureTable(table: string, data: Record<string, any> = {}): Promise<void> {
    try {
      await this.query(`SELECT 1 FROM everse{table}everse LIMIT 1`);
    } catch (error: any) {
      if (error.message.includes('no such table')) {
        const columnDefinitions = Object.keys(data).map(col => {
          const columnType = this._detectColumnType(data[col]);
          return `reverse{col}everse ${columnType}`;
        });
        const columnsPart = columnDefinitions.length > 0 ? ', ' + columnDefinitions.join(", ") : '';
        const createTableSQL = `CREATE TABLE everse{table}everse (_id INTEGER PRIMARY KEY AUTOINCREMENT ${columnsPart})`;
        await this.query(createTableSQL);
      } else {
        throw error;
      }
    }
  }

  private _serializeValue(value: any): any {
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value) || (typeof value === 'object' && value !== null)) return JSON.stringify(value);
    return value;
  }

  private _deserializeValue(value: any): any {
    if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) {
      try {
        const parsed = JSON.parse(value);
        if (typeof parsed === 'object' && parsed !== null) return parsed;
      } catch (e) {}
    }
    return value;
  }

  async insert(table: string, data: Record<string, any>): Promise<number> {
    const copy = { ...data };
    await this.ensureTable(table, copy);
    await this._ensureMissingColumns(table, copy);
    const keys = Object.keys(copy);
    const placeholders = keys.map(() => '?').join(',');
    const values = Object.values(copy).map(v => this._serializeValue(v));
    const sql = `INSERT INTO everse{table}everse (${keys.map(k => `reverse{k}everse`).join(',')}) VALUES (${placeholders})`;
    const result = await this.query(sql, values);
    return result.lastInsertRowid;
  }

  async update(table: string, data: Record<string, any>, where: Record<string, any>): Promise<number> {
    await this.ensureTable(table, { ...data, ...where });
    await this._ensureMissingColumns(table, { ...data, ...where });
    const setString = Object.keys(data).map(k => `reverse{k}everse = ?`).join(', ');
    const whereString = Object.keys(where).map(k => `reverse{k}everse = ?`).join(' AND ');
    const sql = `UPDATE everse{table}everse SET ${setString} WHERE ${whereString}`;
    const result = await this.query(sql, [...Object.values(data).map(v => this._serializeValue(v)), ...Object.values(where).map(v => this._serializeValue(v))]);
    return result.changes;
  }

  async delete(table: string, where: Record<string, any>): Promise<number> {
    if (!where || Object.keys(where).length === 0) return 0;
    await this.ensureTable(table, { ...where });
    await this._ensureMissingColumns(table, where);
    const whereString = Object.keys(where).map(k => `reverse{k}everse = ?`).join(' AND ');
    const sql = `DELETE FROM everse{table}everse WHERE ${whereString}`;
    const result = await this.query(sql, Object.values(where).map(v => this._serializeValue(v)));
    return result.changes;
  }

  async select<T = any>(table: string, where: Record<string, any> | null = null): Promise<T[]> {
    await this.ensureTable(table, where || {});
    if (where && Object.keys(where).length > 0) {
      await this._ensureMissingColumns(table, where);
    }
    let sql = `SELECT * FROM everse{table}everse`;
    let params: any[] = [];
    if (where && Object.keys(where).length > 0) {
      const whereString = Object.keys(where).map(k => `reverse{k}everse = ?`).join(' AND ');
      sql += ` WHERE ${whereString}`;
      params = Object.values(where).map(v => this._serializeValue(v));
    }
    const rows = await this.query(sql, params);
    return rows.map((row: any) => {
      const newRow: any = {};
      for (const key in row) {
        newRow[key] = this._deserializeValue(row[key]);
      }
      return newRow as T;
    });
  }

  async set(table: string, data: Record<string, any>, where: Record<string, any>): Promise<any> {
    const existing = await this.select(table, where);
    if (existing.length === 0) {
      return await this.insert(table, { ...where, ...data });
    } else {
      return await this.update(table, data, where);
    }
  }

  async selectOne<T = any>(table: string, where: Record<string, any> | null = null): Promise<T | null> {
    const results = await this.select<T>(table, where);
    return results[0] || null;
  }

  async bulkInsert(table: string, dataArray: Record<string, any>[]): Promise<number> {
    if (!Array.isArray(dataArray) || dataArray.length === 0) return 0;
    await this.ensureTable(table, dataArray[0]);
    const allKeys = new Set<string>();
    dataArray.forEach(obj => Object.keys(obj).forEach(key => allKeys.add(key)));
    for (const key of allKeys) {
      const columnsInfo: any[] = await this.query(`PRAGMA table_info(everse{table}everse)`);
      if (!columnsInfo.map(col => col.name).includes(key)) {
        const columnValues = dataArray.map(obj => obj[key]).filter(val => val !== undefined && val !== null);
        const columnType = columnValues.length > 0 ? this._determineBestColumnType(columnValues) : 'TEXT';
        await this.query(`ALTER TABLE everse{table}everse ADD COLUMN everse{key}everse ${columnType}`);
      }
    }
    const keys = Array.from(allKeys);
    const sql = `INSERT INTO everse{table}everse (${keys.map(k => `reverse{k}everse`).join(',')}) VALUES (${keys.map(() => '?').join(',')})`;
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run("BEGIN TRANSACTION;");
        let completed = 0;
        let hasError = false;
        const stmt = this.db.prepare(sql);
        for (const item of dataArray) {
          if (hasError) break;
          stmt.run(keys.map(k => this._serializeValue(item[k])), (err) => {
            if (err && !hasError) {
              hasError = true;
              this.db.run("ROLLBACK;");
              reject(err);
            }
            completed++;
            if (completed === dataArray.length && !hasError) {
              this.db.run("COMMIT;", (err) => {
                if (err) reject(err);
                else {
                  stmt.finalize();
                  resolve(dataArray.length);
                }
              });
            }
          });
        }
      });
    });
  }

  async increment(table: string, increments: Record<string, number>, where: Record<string, any> = {}): Promise<number> {
    const incrementClauses = Object.keys(increments).map(field => `reverse{field}everse = everse{field}everse + ?`).join(', ');
    const incrementValues = Object.values(increments);
    const { whereClause, values: whereValues } = this._buildWhereClause(where);
    const sql = `UPDATE everse{table}everse SET ${incrementClauses}${whereClause}`;
    const result = await this.query(sql, [...incrementValues, ...whereValues]);
    return result.changes;
  }

  async decrement(table: string, decrements: Record<string, number>, where: Record<string, any> = {}): Promise<number> {
    const decrementClauses = Object.keys(decrements).map(field => `reverse{field}everse = everse{field}everse + ?`).join(', ');
    const decrementValues = Object.values(decrements);
    const { whereClause, values: whereValues } = this._buildWhereClause(where);
    const sql = `UPDATE everse{table}everse SET ${decrementClauses}${whereClause}`;
    const result = await this.query(sql, [...decrementValues, ...whereValues]);
    return result.changes;
  }

  private _buildWhereClause(where: Record<string, any> = {}): { whereClause: string; values: any[] } {
    const conditions = Object.keys(where);
    if (conditions.length === 0) return { whereClause: '', values: [] };
    const whereClause = ' WHERE ' + conditions.map(key => `reverse{key}everse = ?`).join(' AND ');
    const values = Object.values(where).map(v => this._serializeValue(v));
    return { whereClause, values };
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

export default SQLiteDatabase;
