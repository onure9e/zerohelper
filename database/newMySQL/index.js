const mysql = require("mysql2/promise");

class MySQLDatabase {
  /**
   * 
   * @param {Object} config 
   * @param {string} config.host 
   * @param {number} config.port 
   * @param {string} config.user 
   * @param {string} config.password 
   * @param {string} config.database 
   * @param {number} [config.connectionLimit] 
   */
  constructor(config) {
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
  }

  // Genel sorgu çalıştırma (select, insert, update, delete, vs.)
  async query(sql, params = []) {
    const [rows, fields] = await this.pool.execute(sql, params);
    return rows;
  }

  async ensureTable(table, data) {
    // Tablo adını escape et
    const escapedTable = mysql.escape(table); // string olarak tırnaklı, örn: 'users'
  
    // SHOW TABLES LIKE 'tableName' şeklinde sorgu yaz, parametre yerine direkt string kullan
    const sql = `SHOW TABLES LIKE ${escapedTable}`;
    const tables = await this.query(sql);
  
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

  // Yeni kayıt ekleme (tablo, objede kolonlar ve değerler)
  async insert(table, data) {
    await this.ensureTable(table, {...data});
    // Önce tablo kolonlarını öğren
    const existingColumns = await this.query(`DESCRIBE \`${table}\``).catch(() => null);

    if (!existingColumns) {
      throw new Error(`Table ${table} does not exist.`);
    }

    // Varolan kolon isimlerini al
    const existingColumnNames = existingColumns.map(col => col.Field);

    // data'daki kolonlar varsa, olmayanları ekle
    for (const key of Object.keys(data)) {
      if (!existingColumnNames.includes(key)) {
        // Burada kolonu VARCHAR(255) olarak ekliyoruz, istersen bunu özelleştirebilirsin
        const alterSQL = `ALTER TABLE \`${table}\` ADD COLUMN \`${key}\` VARCHAR(255)`;
        await this.query(alterSQL);
        console.log(`Added missing column '${key}' to table '${table}'`);
      }
    }

    // Şimdi insert işlemini yap
    const keys = Object.keys(data);
    const placeholders = keys.map(() => "?").join(",");
    const values = Object.values(data);

    const sql = `INSERT INTO \`${table}\` (${keys.map(k => `\`${k}\``).join(",")}) VALUES (${placeholders})`;

    const result = await this.query(sql, values);
    return result.insertId;
  }

  // Kayıt güncelleme (tablo, data, koşul)
  // where şartı basit objeyle: {id: 1, status: 'active'}
  async update(table, data, where) {
    await this.ensureTable(table, {...data, ...where});
    const setKeys = Object.keys(data);
    const setValues = Object.values(data);
    const whereKeys = Object.keys(where);
    const whereValues = Object.values(where);

    const setString = setKeys.map(k => `\`${k}\` = ?`).join(", ");
    const whereString = whereKeys.map(k => `\`${k}\` = ?`).join(" AND ");

    const sql = `UPDATE \`${table}\` SET ${setString} WHERE ${whereString}`;

    const result = await this.query(sql, [...setValues, ...whereValues]);
    return result.affectedRows;
  }

  // Kayıt silme (tablo, koşul)
  async delete(table, where) {
    await this.ensureTable(table, {...where});
    const whereKeys = Object.keys(where);
    const whereValues = Object.values(where);
    const whereString = whereKeys.map(k => `\`${k}\` = ?`).join(" AND ");

    const sql = `DELETE FROM \`${table}\` WHERE ${whereString}`;
    const result = await this.query(sql, whereValues);
    return result.affectedRows;
  }

  // Kayıtları çekme (tablo, koşul veya null)
  async select(table, where = null) {
    await this.ensureTable(table, {...where});
    let sql = `SELECT * FROM \`${table}\``;
    let params = [];

    if (where && Object.keys(where).length > 0) {
      const whereKeys = Object.keys(where);
      const whereValues = Object.values(where);
      const whereString = whereKeys.map(k => `\`${k}\` = ?`).join(" AND ");
      sql += ` WHERE ${whereString}`;
      params = whereValues;
    }

    return await this.query(sql, params);
  }

  // Set (insert veya update)
async set(table, data, where) {
    await this.ensureTable(table, {...data, ...where});
    // where ile arama yap, kayıt var mı kontrol et
    const existing = await this.select(table, where);
    
    if (existing.length === 0) {
      // Kayıt yoksa: insert et
      // insert fonksiyonumuz otomatik kolon eklediği için onu kullanabiliriz
      return await this.insert(table, {...where, ...data});
    } else {
      // Kayıt varsa: update et
      return await this.update(table, data, where);
    }
  }
  
  // Bağlantıyı kapatma
  async close() {
    await this.pool.end();
  }
}

module.exports = MySQLDatabase;
