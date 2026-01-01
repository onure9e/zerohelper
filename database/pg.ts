import { IDatabase } from './IDatabase';
import { Pool, PoolConfig } from 'pg';
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
        const tempPool = new Pool({
          host: config.host,
          port: config.port || 5432,
          user: config.user,
          password: config.password,
          database: 'postgres'
        });

        try {
          await tempPool.query(`CREATE DATABASE "${config.database}"`);
        } catch (error: any) {
          if (!error.message.includes('already exists')) {
            console.warn('Database creation warning:', error.message);
          }
        }
        await tempPool.end();

        this.pool = new Pool({
          host: config.host,
          port: config.port || 5432,
          user: config.user,
          password: config.password,
          database: config.database,
          max: config.connectionLimit || 10,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 2000,
        });

        this._connected = true;
        resolve(this.pool);
        this._processQueue();
      } catch (error) {
        console.error("PostgreSQL connection error:", error);
        reject(error);
      }
    });
  }

  private _getColumnType(value: any): string {
    if (value === null || value === undefined) return 'TEXT';
    if (typeof value === 'boolean') return 'BOOLEAN';
    if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        if (value >= -32768 && value <= 32767) return 'SMALLINT';
        if (value >= -2147483648 && value <= 2147483647) return 'INTEGER';
        return 'BIGINT';
      }
      return 'DOUBLE PRECISION';
    }
    if (typeof value === 'string') {
      return value.length <= 255 ? 'VARCHAR(255)' : 'TEXT';
    }
    if (typeof value === 'object') return 'JSONB';
    if (value instanceof Date) return 'TIMESTAMP';
    return 'TEXT';
  }

  private _getBestColumnType(values: any[]): string {
    const types = values.map(val => this._getColumnType(val));
    const uniqueTypes = [...new Set(types)];
    if (uniqueTypes.length === 1) return uniqueTypes[0];

    const typePriority: Record<string, number> = {
      'TEXT': 10, 'JSONB': 9, 'VARCHAR(255)': 8, 'TIMESTAMP': 7,
      'DOUBLE PRECISION': 6, 'BIGINT': 5, 'INTEGER': 4, 'SMALLINT': 3, 'BOOLEAN': 2
    };

    return uniqueTypes.sort((a, b) => (typePriority[b] || 0) - (typePriority[a] || 0))[0];
  }

  private async _ensureMissingColumns(table: string, data: Record<string, any>): Promise<void> {
    const existingColumns: any[] = await this.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = $1 AND table_schema = 'public'
    `, [table]);
    
    if (!existingColumns || existingColumns.length === 0) throw new Error(`Table ${table} does not exist.`);
    const existingColumnNames = existingColumns.map(col => col.column_name);
    
    for (const key of Object.keys(data)) {
      if (!existingColumnNames.includes(key)) {
        const columnType = this._getColumnType(data[key]);
        await this.query(`ALTER TABLE "${table}" ADD COLUMN "${key}" ${columnType}`);
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
      const result = await pool.query(sql, params);
      return result.rows;
    });
  }

  async ensureTable(table: string, data: Record<string, any> = {}): Promise<void> {
    return this._queueRequest(async () => {
      const tables: any[] = await this.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = $1
      `, [table]);
      
      if (tables.length === 0) {
        const columnDefinitions = Object.keys(data).map(col => {
          const columnType = this._getColumnType(data[col]);
          return `"${col}" ${columnType}`;
        });
        const columnsPart = columnDefinitions.length > 0 ? ', ' + columnDefinitions.join(", ") : '';
        const createTableSQL = `CREATE TABLE "${table}" ("_id" SERIAL PRIMARY KEY ${columnsPart})`;
        await this.query(createTableSQL);
      }
    });
  }

  async insert(table: string, data: Record<string, any>): Promise<any> {
    return this._queueRequest(async () => {
      const copy = { ...data };
      await this.ensureTable(table, copy);
      await this._ensureMissingColumns(table, copy);
      
      const existingColumns: any[] = await this.query(`
        SELECT column_name, column_default 
        FROM information_schema.columns 
        WHERE table_name = $1 AND table_schema = 'public'
      `, [table]);

      const primaryKeyColumn = existingColumns.find(col => col.column_default && col.column_default.includes('nextval'));
      if (primaryKeyColumn && copy[primaryKeyColumn.column_name] !== undefined) {
        delete copy[primaryKeyColumn.column_name];
      }

      const keys = Object.keys(copy);
      const placeholders = keys.map((_, index) => `$${index + 1}`).join(",");
      const values = Object.values(copy).map(value => this._serializeValue(value));
      const sql = `INSERT INTO "${table}" (${keys.map(k => `"${k}"`).join(",")}) VALUES (${placeholders}) RETURNING "_id"`;
      const result = await this.query(sql, values);
      return result[0]._id;
    });
  }

  async update(table: string, data: Record<string, any>, where: Record<string, any>): Promise<number> {
    return this._queueRequest(async () => {
      await this.ensureTable(table, { ...data, ...where });
      await this._ensureMissingColumns(table, { ...data, ...where });
      const setString = Object.keys(data).map((k, i) => `"${k}" = $${i + 1}`).join(", ");
      const whereString = Object.keys(where).map((k, i) => `"${k}" = $${Object.keys(data).length + i + 1}`).join(" AND ");
      const sql = `UPDATE "${table}" SET ${setString} WHERE ${whereString}`;
      const pool = await this._connectionPromise;
      const result = await pool.query(sql, [...Object.values(data).map(v => this._serializeValue(v)), ...Object.values(where).map(v => this._serializeValue(v))]);
      return result.rowCount ?? 0;
    });
  }

  async delete(table: string, where: Record<string, any>): Promise<number> {
    return this._queueRequest(async () => {
      if (!where || Object.keys(where).length === 0) return 0;
      await this.ensureTable(table, { ...where });
      await this._ensureMissingColumns(table, where);
      const whereString = Object.keys(where).map((k, i) => `"${k}" = $${i + 1}`).join(" AND ");
      const sql = `DELETE FROM "${table}" WHERE ${whereString}`;
      const pool = await this._connectionPromise;
      const result = await pool.query(sql, Object.values(where).map(v => this._serializeValue(v)));
      return result.rowCount ?? 0;
    });
  }

  async select<T = any>(table: string, where: Record<string, any> | null = null): Promise<T[]> {
    return this._queueRequest(async () => {
      await this.ensureTable(table, where || {});
      if (where && Object.keys(where).length > 0) {
        await this._ensureMissingColumns(table, where);
      }
      let sql = `SELECT * FROM "${table}"`;
      let params: any[] = [];
      if (where && Object.keys(where).length > 0) {
        const whereString = Object.keys(where).map((k, i) => `"${k}" = $${i + 1}`).join(" AND ");
        sql += ` WHERE ${whereString}`;
        params = Object.values(where).map(v => this._serializeValue(v));
      }
      const rows = await this.query(sql, params);
      return rows as T[];
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
      const allKeys = new Set<string>();
      dataArray.forEach(obj => Object.keys(obj).forEach(key => allKeys.add(key)));
      const existingColumns: any[] = await this.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = $1 AND table_schema = 'public'
      `, [table]);
      const existingColumnNames = existingColumns.map(col => col.column_name);

      for (const key of allKeys) {
        if (!existingColumnNames.includes(key)) {
          const columnValues = dataArray.map(obj => obj[key]).filter(val => val !== undefined && val !== null);
          const columnType = columnValues.length > 0 ? this._getBestColumnType(columnValues) : 'TEXT';
          await this.query(`ALTER TABLE "${table}" ADD COLUMN "${key}" ${columnType}`);
        }
      }

      const keys = Array.from(allKeys);
      const placeholders = dataArray.map((_, rowIndex) => `(${keys.map((_, colIndex) => `$${rowIndex * keys.length + colIndex + 1}`).join(',')})`).join(',');
      const values = dataArray.flatMap(obj => keys.map(k => this._serializeValue(obj[k])));
      const sql = `INSERT INTO "${table}" (${keys.map(k => `"${k}"`).join(",")}) VALUES ${placeholders}`;
      const pool = await this._connectionPromise;
      const result = await pool.query(sql, values);
      return result.rowCount ?? 0;
    });
  }

  async close(): Promise<void> {
    if (this.pool) await this.pool.end();
  }

  private _serializeValue(value: any): any {
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value) || (typeof value === 'object' && value !== null)) return JSON.stringify(value);
    return value;
  }

  async increment(table: string, increments: Record<string, number>, where: Record<string, any> = {}): Promise<number> {
    const incrementClauses = Object.keys(increments).map((field, index) => `"${field}" = "${field}" + $${index + 1}`).join(', ');
    const incrementValues = Object.values(increments);
    const { whereClause, values: whereValues } = this._buildWhereClause(where, incrementValues.length);
    const sql = `UPDATE "${table}" SET ${incrementClauses}${whereClause}`;
    const pool = await this._connectionPromise;
    const result = await pool.query(sql, [...incrementValues, ...whereValues]);
    return result.rowCount ?? 0;
  }

  async decrement(table: string, decrements: Record<string, number>, where: Record<string, any> = {}): Promise<number> {
    const decrementClauses = Object.keys(decrements).map((field, index) => `"${field}" = "${field}" - $${index + 1}`).join(', ');
    const decrementValues = Object.values(decrements);
    const { whereClause, values: whereValues } = this._buildWhereClause(where, decrementValues.length);
    const sql = `UPDATE "${table}" SET ${decrementClauses}${whereClause}`;
    const pool = await this._connectionPromise;
    const result = await pool.query(sql, [...decrementValues, ...whereValues]);
    return result.rowCount ?? 0;
  }

  private _buildWhereClause(where: Record<string, any> = {}, startIndex: number = 0): { whereClause: string; values: any[] } {
    const conditions = Object.keys(where);
    if (conditions.length === 0) return { whereClause: '', values: [] };
    const whereClause = ' WHERE ' + conditions.map((key, index) => `"${key}" = $${startIndex + index + 1}`).join(' AND ');
    const values = Object.values(where).map(v => this._serializeValue(v));
    return { whereClause, values };
  }
}

export default PostgreSQLDatabase;
