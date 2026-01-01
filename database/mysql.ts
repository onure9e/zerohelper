import { IDatabase } from './IDatabase';
import mysql, { Pool, Connection, FieldPacket } from "mysql2/promise";
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
            if (field.type === 'TINY' && field.length === 1) {
              return (field.string() === '1');
            }
            if (['INT', 'DECIMAL', 'NEWDECIMAL', 'FLOAT', 'DOUBLE'].includes(field.type)) {
              return Number(field.string());
            }
            return next();
          }
        });

        await connection.query(`CREATE DATABASE IF NOT EXISTS 
${config.database}
`);
        await connection.end();

        this.pool = mysql.createPool({
          host: config.host,
          port: config.port || 3306,
          user: config.user,
          password: config.password,
          database: config.database,
          waitForConnections: true,
          connectionLimit: config.connectionLimit || 10,
          queueLimit: 0,
          typeCast: (field: any, next: () => any) => {
            if (field.type === 'TINY' && field.length === 1) {
              return (field.string() === '1');
            }
            if (['INT', 'DECIMAL', 'NEWDECIMAL', 'FLOAT', 'DOUBLE'].includes(field.type)) {
              return Number(field.string());
            }
            return next();
          }
        });

        this._connected = true;
        resolve(this.pool);
        this._processQueue();
      } catch (error) {
        console.error("MySQL connection error:", error);
        reject(error);
      }
    });
  }

  private _getColumnType(value: any): string {
    if (value === null || value === undefined) return 'TEXT';
    if (typeof value === 'boolean') return 'BOOLEAN';
    if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        if (value >= -128 && value <= 127) return 'TINYINT';
        if (value >= -32768 && value <= 32767) return 'SMALLINT';
        if (value >= -2147483648 && value <= 2147483647) return 'INT';
        return 'BIGINT';
      }
      return 'DOUBLE';
    }
    if (typeof value === 'string') {
      const length = value.length;
      if (length <= 255) return 'VARCHAR(255)';
      if (length <= 65535) return 'TEXT';
      if (length <= 16777215) return 'MEDIUMTEXT';
      return 'LONGTEXT';
    }
    if (typeof value === 'object') {
      const jsonString = JSON.stringify(value);
      return jsonString.length <= 65535 ? 'JSON' : 'LONGTEXT';
    }
    if (value instanceof Date) return 'DATETIME';
    return 'TEXT';
  }

  private _getBestColumnType(values: any[]): string {
    const types = values.map(val => this._getColumnType(val));
    const uniqueTypes = [...new Set(types)];
    if (uniqueTypes.length === 1) return uniqueTypes[0];

    const typePriority: Record<string, number> = {
      'LONGTEXT': 10, 'MEDIUMTEXT': 9, 'TEXT': 8, 'JSON': 7, 'VARCHAR(255)': 6,
      'DATETIME': 5, 'DOUBLE': 4, 'BIGINT': 3, 'INT': 2, 'SMALLINT': 1, 'TINYINT': 0, 'BOOLEAN': -1
    };

    return uniqueTypes.sort((a, b) => (typePriority[b] || 0) - (typePriority[a] || 0))[0];
  }

  private async _ensureMissingColumns(table: string, data: Record<string, any>): Promise<void> {
    const existingColumns: any[] = await this.query(`DESCRIBE 
${table}
`).catch(() => []);
    const existingColumnNames = existingColumns.map((col: any) => col.Field);
    
    for (const key of Object.keys(data)) {
      if (!existingColumnNames.includes(key)) {
        const columnType = this._getColumnType(data[key]);
        await this.query(`ALTER TABLE 
${table}
 ADD COLUMN 
${key}
 ${columnType}`);
      }
    }
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

  async query(sql: string, params: any[] = []): Promise<any> {
    return this._queueRequest(async () => {
      const pool = await this._connectionPromise;
      const [rows] = await pool.execute(sql, params);
      return rows;
    });
  }

  async ensureTable(table: string, data: Record<string, any> = {}): Promise<void> {
    return this._queueRequest(async () => {
      const escapedTable = mysql.escape(table);
      const tables: any[] = await this.query(`SHOW TABLES LIKE ${escapedTable}`);
      if (tables.length === 0) {
        const columnDefinitions = Object.keys(data).map(col => {
          const columnType = this._getColumnType(data[col]);
          return `
${col}
 ${columnType}`;
        });
        
        const columnsPart = columnDefinitions.length > 0 ? ', ' + columnDefinitions.join(", ") : '';
        const createTableSQL = `
          CREATE TABLE 
${table}
 (
            _id INT PRIMARY KEY AUTO_INCREMENT
            ${columnsPart}
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `;
        await this.query(createTableSQL);
      }
    });
  }

  async insert(table: string, data: Record<string, any>): Promise<number> {
    return this._queueRequest(async () => {
      const copy = { ...data };
      await this.ensureTable(table, copy);
      await this._ensureMissingColumns(table, copy);

      const existingColumns: any[] = await this.query(`DESCRIBE 
${table}
`);
      const primaryKeyColumn = existingColumns.find(col => col.Key === 'PRI' && col.Extra.includes('auto_increment'));

      if (primaryKeyColumn && copy[primaryKeyColumn.Field] !== undefined) {
        delete copy[primaryKeyColumn.Field];
      }

      const keys = Object.keys(copy);
      const placeholders = keys.map(() => "?").join(",");
      const values = Object.values(copy).map(value => this._serializeValue(value));
      const sql = `INSERT INTO 
${table}
 (${keys.map(k => `
${k}
`).join(",")}) VALUES (${placeholders})`;

      const result = await this.query(sql, values);
      return result.insertId;
    });
  }

  async update(table: string, data: Record<string, any>, where: Record<string, any>): Promise<number> {
    return this._queueRequest(async () => {
      await this.ensureTable(table, { ...data, ...where });
      await this._ensureMissingColumns(table, { ...data, ...where });
      
      const setString = Object.keys(data).map(k => `
${k}
 = ?`).join(", ");
      const whereString = Object.keys(where).map(k => `
${k}
 = ?`).join(" AND ");
      const sql = `UPDATE 
${table}
 SET ${setString} WHERE ${whereString}`;
      const values = [...Object.values(data).map(v => this._serializeValue(v)), ...Object.values(where).map(v => this._serializeValue(v))];
      const result = await this.query(sql, values);
      return result.affectedRows;
    });
  }

  async delete(table: string, where: Record<string, any>): Promise<number> {
    return this._queueRequest(async () => {
      if (!where || Object.keys(where).length === 0) return 0;
      await this.ensureTable(table, { ...where });
      await this._ensureMissingColumns(table, where);
      
      const whereString = Object.keys(where).map(k => `
${k}
 = ?`).join(" AND ");
      const sql = `DELETE FROM 
${table}
 WHERE ${whereString}`;
      const result = await this.query(sql, Object.values(where).map(v => this._serializeValue(v)));
      return result.affectedRows;
    });
  }

  async select<T = any>(table: string, where: Record<string, any> | null = null): Promise<T[]> {
    return this._queueRequest(async () => {
      await this.ensureTable(table, where || {});
      if (where && Object.keys(where).length > 0) {
        await this._ensureMissingColumns(table, where);
      }
      
      let sql = `SELECT * FROM 
${table}
`;
      let params: any[] = [];
      if (where && Object.keys(where).length > 0) {
        const whereString = Object.keys(where).map(k => `
${k}
 = ?`).join(" AND ");
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
    });
  }

  async set(table: string, data: Record<string, any>, where: Record<string, any>): Promise<any> {
    return this._queueRequest(async () => {
      const existing = await this.select(table, where);
      if (existing.length === 0) {
        return await this.insert(table, { ...where, ...data });
      } else {
        return await this.update(table, data, where);
      }
    });
  }

  async selectOne<T = any>(table: string, where: Record<string, any> | null = null): Promise<T | null> {
    const results = await this.select<T>(table, where);
    return results[0] || null;
  }

  async bulkInsert(table: string, dataArray: Record<string, any>[]): Promise<number> {
    return this._queueRequest(async () => {
      if (!Array.isArray(dataArray) || dataArray.length === 0) return 0;
      await this.ensureTable(table, dataArray[0]);

      const existingColumns: any[] = await this.query(`DESCRIBE 
${table}
`);
      const existingColumnNames = existingColumns.map((col: any) => col.Field);
      const allKeys = new Set<string>();
      dataArray.forEach(obj => Object.keys(obj).forEach(key => allKeys.add(key)));

      for (const key of allKeys) {
        if (!existingColumnNames.includes(key)) {
          const columnValues = dataArray.map(obj => obj[key]).filter(val => val !== undefined && val !== null);
          const columnType = columnValues.length > 0 ? this._getBestColumnType(columnValues) : 'TEXT';
          await this.query(`ALTER TABLE 
${table}
 ADD COLUMN 
${key}
 ${columnType}`);
        }
      }

      const keys = Array.from(allKeys);
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

  async close(): Promise<void> {
    if (this.pool) await this.pool.end();
  }

  private _serializeValue(value: any): any {
    if (value instanceof Date) return value.toISOString().slice(0, 19).replace('T', ' ');
    if (Array.isArray(value) || (typeof value === 'object' && value !== null)) return JSON.stringify(value);
    return value;
  }

  private _deserializeValue(value: any): any {
    try {
      if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) {
        const parsed = JSON.parse(value);
        if (typeof parsed === 'object' && parsed !== null) return parsed;
      }
    } catch (e) {}
    return value;
  }

  async increment(table: string, increments: Record<string, number>, where: Record<string, any> = {}): Promise<number> {
    return this._queueRequest(async () => {
      const incrementClauses = Object.keys(increments).map(field => `
${field}
 = 
${field}
 + ?`).join(', ');
      const incrementValues = Object.values(increments);
      const { whereClause, values: whereValues } = this._buildWhereClause(where);
      const sql = `UPDATE 
${table}
 SET ${incrementClauses}${whereClause}`;
      const result = await this.query(sql, [...incrementValues, ...whereValues]);
      return result.affectedRows;
    });
  }

  async decrement(table: string, decrements: Record<string, number>, where: Record<string, any> = {}): Promise<number> {
    return this._queueRequest(async () => {
      const decrementClauses = Object.keys(decrements).map(field => `
${field}
 = 
${field}
 + ?`).join(', ');
      const decrementValues = Object.values(decrements);
      const { whereClause, values: whereValues } = this._buildWhereClause(where);
      const sql = `UPDATE 
${table}
 SET ${decrementClauses}${whereClause}`;
      const result = await this.query(sql, [...decrementValues, ...whereValues]);
      return result.affectedRows;
    });
  }

  private _buildWhereClause(where: Record<string, any> = {}): { whereClause: string; values: any[] } {
    const conditions = Object.keys(where);
    if (conditions.length === 0) return { whereClause: '', values: [] };
    const whereClause = ' WHERE ' + conditions.map(key => `
${key}
 = ?`).join(' AND ');
    const values = Object.values(where).map(v => this._serializeValue(v));
    return { whereClause, values };
  }
}

export default MySQLDatabase;
