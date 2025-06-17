const IDatabase = require('./IDatabase'); // Arayüzü import et

/**
 * @implements {IDatabase}
 */
const mysql = require("mysql2/promise");

class MySQLDatabase extends IDatabase{
  constructor(config) {
    super()
    this.config = config;
    this.pool = null;

    this.poolPromise = (async () => {
      const connection = await mysql.createConnection({
        host: config.host,
        port: config.port || 3306,
        user: config.user,
        password: config.password,
      });

      await connection.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\``);
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
      });

      return this.pool;
    })();
  }

  async query(sql, params = []) {
    const pool = await this.poolPromise;
    const [rows] = await pool.execute(sql, params);
    return rows;
  }

  async ensureTable(table, data = {}) {
    if (!data || Object.keys(data).length === 0) return;

    const escapedTable = mysql.escape(table);
    const tables = await this.query(`SHOW TABLES LIKE ${escapedTable}`);
    if (tables.length === 0) {
      const columns = Object.keys(data).map(col => `\`${col}\` VARCHAR(255)`).join(", ");
      const createTableSQL = `
        CREATE TABLE \`${table}\` (
          id INT PRIMARY KEY AUTO_INCREMENT,
          ${columns}
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `;
      await this.query(createTableSQL);
    }
  }

  async insert(table, data) {
    const copy = { ...data };
    await this.ensureTable(table, copy);
    const existingColumns = await this.query(`DESCRIBE \`${table}\``).catch(() => null);
    if (!existingColumns) throw new Error(`Table ${table} does not exist.`);

    const existingNames = existingColumns.map(col => col.Field);
    for (const key of Object.keys(copy)) {
      if (!existingNames.includes(key)) {
        await this.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${key}\` VARCHAR(255)`);
      }
    }

    const keys = Object.keys(copy);
    const placeholders = keys.map(() => "?").join(",");
    const values = Object.values(copy);
    const sql = `INSERT INTO \`${table}\` (${keys.map(k => `\`${k}\``).join(",")}) VALUES (${placeholders})`;

    const result = await this.query(sql, values);
    return result.insertId;
  }

  async update(table, data, where) {
    await this.ensureTable(table, { ...data, ...where });
    const existingColumns = await this.query(`DESCRIBE \`${table}\``).catch(() => null);
    if (!existingColumns) throw new Error(`Table ${table} does not exist.`);

    const existingColumnNames = existingColumns.map(col => col.Field);
    for (const key of Object.keys(data)) {
      if (!existingColumnNames.includes(key)) {
        const alterSQL = `ALTER TABLE \`${table}\` ADD COLUMN \`${key}\` VARCHAR(255)`;
        await this.query(alterSQL);
        console.log(`Added missing column '${key}' to table '${table}'`);
      }
    }
    const setString = Object.keys(data).map(k => `\`${k}\` = ?`).join(", ");
    const whereString = Object.keys(where).map(k => `\`${k}\` = ?`).join(" AND ");
    const sql = `UPDATE \`${table}\` SET ${setString} WHERE ${whereString}`;
    const result = await this.query(sql, [...Object.values(data), ...Object.values(where)]);
    return result.affectedRows;
  }

  async delete(table, where) {
    if (!where || Object.keys(where).length === 0) return 0;
    await this.ensureTable(table, { ...where });
    const whereString = Object.keys(where).map(k => `\`${k}\` = ?`).join(" AND ");
    const sql = `DELETE FROM \`${table}\` WHERE ${whereString}`;
    const result = await this.query(sql, Object.values(where));
    return result.affectedRows;
  }

  async select(table, where = null) {
    await this.ensureTable(table, where || {});
    let sql = `SELECT * FROM \`${table}\``;
    let params = [];

    if (where && Object.keys(where).length > 0) {
      const whereString = Object.keys(where).map(k => `\`${k}\` = ?`).join(" AND ");
      sql += ` WHERE ${whereString}`;
      params = Object.values(where);
    }

    return await this.query(sql, params);
  }

  async set(table, data, where) {
    await this.ensureTable(table, { ...data, ...where });
    const existingColumns = await this.query(`DESCRIBE \`${table}\``).catch(() => null);
    if (!existingColumns) throw new Error(`Table ${table} does not exist.`);

    const existingColumnNames = existingColumns.map(col => col.Field);
    for (const key of Object.keys(data)) {
      if (!existingColumnNames.includes(key)) {
        const alterSQL = `ALTER TABLE \`${table}\` ADD COLUMN \`${key}\` VARCHAR(255)`;
        await this.query(alterSQL);
        console.log(`Added missing column '${key}' to table '${table}'`);
      }
    }
    const existing = await this.select(table, where);
    if (existing.length === 0) {
      return await this.insert(table, { ...where, ...data });
    } else {
      return await this.update(table, data, where);
    }
  }

  async selectOne(table, where = null) {
    const results = await this.select(table, where);
    return results[0] || null;
  }

  async deleteOne(table, where) {
    const row = await this.selectOne(table, where);
    if (!row) return 0;
    const whereString = Object.keys(where).map(k => `\`${k}\` = ?`).join(" AND ");
    const sql = `DELETE FROM \`${table}\` WHERE ${whereString} LIMIT 1`;
    const result = await this.query(sql, Object.values(where));
    return result.affectedRows;
  }

  async updateOne(table, data, where) {
    await this.ensureTable(table, { ...data, ...where });
    const existingColumns = await this.query(`DESCRIBE \`${table}\``).catch(() => null);
    if (!existingColumns) throw new Error(`Table ${table} does not exist.`);

    const existingColumnNames = existingColumns.map(col => col.Field);
    for (const key of Object.keys(data)) {
      if (!existingColumnNames.includes(key)) {
        const alterSQL = `ALTER TABLE \`${table}\` ADD COLUMN \`${key}\` VARCHAR(255)`;
        await this.query(alterSQL);
        console.log(`Added missing column '${key}' to table '${table}'`);
      }
    }
    const setString = Object.keys(data).map(k => `\`${k}\` = ?`).join(", ");
    const whereString = Object.keys(where).map(k => `\`${k}\` = ?`).join(" AND ");
    const sql = `UPDATE \`${table}\` SET ${setString} WHERE ${whereString} LIMIT 1`;
    const result = await this.query(sql, [...Object.values(data), ...Object.values(where)]);
    return result.affectedRows;
  }

  async bulkInsert(table, dataArray) {
    if (!Array.isArray(dataArray) || dataArray.length === 0) return 0;
    await this.ensureTable(table, dataArray[0]);

    const existingColumns = await this.query(`DESCRIBE \`${table}\``);
    const existingColumnNames = existingColumns.map(col => col.Field);
    const keys = Object.keys(dataArray[0]);

    // Eksik kolonları sadece ilk elemana göre kontrol et
    for (const key of keys) {
      if (!existingColumnNames.includes(key)) {
        await this.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${key}\` VARCHAR(255)`);
      }
    }

    const placeholders = dataArray.map(() => `(${keys.map(() => '?').join(',')})`).join(',');
    const values = dataArray.flatMap(obj => keys.map(k => obj[k]));
    const sql = `INSERT INTO \`${table}\` (${keys.map(k => `\`${k}\``).join(",")}) VALUES ${placeholders}`;

    const result = await this.query(sql, values);
    return result.affectedRows;
  }

  async close() {
    if (this.pool) await this.pool.end();
  }
}

module.exports = MySQLDatabase;
