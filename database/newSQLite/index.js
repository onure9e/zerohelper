// adapters/sqlite.js

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

class SQLiteDatabase {
  /**
   * @param {object} config - Yapılandırma nesnesi.
   * @param {string} config.filePath - SQLite veritabanı dosyasının yolu.
   */
  constructor(config) {
    if (!config || !config.filePath) {
      throw new Error('SQLite yapılandırması için "filePath" gereklidir.');
    }

    // Veritabanı dosyasının bulunacağı klasörün var olduğundan emin ol
    const dir = path.dirname(config.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // better-sqlite3 senkron çalıştığı için bağlantı anında kurulur.
    this.db = new Database(config.filePath);
  }

  /**
   * SQL sorgusu çalıştırır. SELECT için satırları, diğerleri için bilgiyi döndürür.
   * @param {string} sql - Çalıştırılacak SQL sorgusu.
   * @param {Array} params - Sorgu parametreleri.
   */
  query(sql, params = []) {
    try {
      // SELECT sorguları için .all() kullanılır ve bir dizi döndürür.
      return this.db.prepare(sql).all(params);
    } catch (error) {
      // INSERT, UPDATE, DELETE gibi sorgular .all() ile çalışmaz, .run() kullanılır.
      // Bu sorgular bir bilgi nesnesi döndürür (örn: { changes: 1, lastInsertRowid: 5 })
      if (error.message.includes('This statement does not return data')) {
        return this.db.prepare(sql).run(params);
      }
      // Başka bir hata varsa fırlat
      throw error;
    }
  }

  /**
   * Bir tablonun var olup olmadığını kontrol eder, yoksa oluşturur.
   * @param {string} table - Tablo adı.
   * @param {object} data - Tablo oluşturulurken sütunları belirlemek için örnek veri.
   */
  ensureTable(table, data = {}) {
    if (!data || Object.keys(data).length === 0) return;

    try {
      // Tablonun varlığını kontrol etmenin en hızlı yolu bir sorgu denemektir.
      this.db.prepare(`SELECT 1 FROM \`${table}\` LIMIT 1`).get();
    } catch (error) {
      // "no such table" hatası alırsak, tabloyu oluştur.
      if (error.message.includes('no such table')) {
        // SQLite tipleri esnek olduğu için TEXT çoğu veri tipi için yeterlidir.
        const columns = Object.keys(data).map(col => `\`${col}\` TEXT`).join(', ');
        const createTableSQL = `
          CREATE TABLE \`${table}\` (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ${columns}
          )
        `;
        this.query(createTableSQL);
      } else {
        throw error;
      }
    }
  }

  /**
   * Verilen verideki anahtarların tabloda sütun olarak var olduğundan emin olur.
   * @private
   */
  _ensureColumns(table, data) {
    const columnsInfo = this.db.prepare(`PRAGMA table_info(\`${table}\`)`).all();
    const existingNames = columnsInfo.map(col => col.name);

    for (const key of Object.keys(data)) {
      if (!existingNames.includes(key)) {
        this.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${key}\` TEXT`);
      }
    }
  }

  /**
   * Bir tabloya yeni veri ekler.
   * @returns {number} Eklenen satırın ID'si.
   */
  insert(table, data) {
    const copy = { ...data };
    this.ensureTable(table, copy);
    this._ensureColumns(table, copy);

    const keys = Object.keys(copy);
    const placeholders = keys.map(() => '?').join(',');
    const values = Object.values(copy);
    const sql = `INSERT INTO \`${table}\` (${keys.map(k => `\`${k}\``).join(',')}) VALUES (${placeholders})`;

    const result = this.query(sql, values);
    return result.lastInsertRowid; // SQLite'ta `insertId` yerine `lastInsertRowid` kullanılır.
  }

  /**
   * Tablodaki verileri günceller.
   * @returns {number} Etkilenen satır sayısı.
   */
  update(table, data, where) {
    this.ensureTable(table, { ...data, ...where });
    this._ensureColumns(table, data);

    const setString = Object.keys(data).map(k => `\`${k}\` = ?`).join(', ');
    const whereString = Object.keys(where).map(k => `\`${k}\` = ?`).join(' AND ');
    const sql = `UPDATE \`${table}\` SET ${setString} WHERE ${whereString}`;
    const result = this.query(sql, [...Object.values(data), ...Object.values(where)]);
    return result.changes; // SQLite'ta `affectedRows` yerine `changes` kullanılır.
  }

  /**
   * Tablodan veri siler.
   * @returns {number} Etkilenen satır sayısı.
   */
  delete(table, where) {
    if (!where || Object.keys(where).length === 0) return 0;
    this.ensureTable(table, { ...where });
    const whereString = Object.keys(where).map(k => `\`${k}\` = ?`).join(' AND ');
    const sql = `DELETE FROM \`${table}\` WHERE ${whereString}`;
    const result = this.query(sql, Object.values(where));
    return result.changes;
  }

  /**
   * Tablodan veri seçer.
   * @returns {Array<object>} Sonuç satırları.
   */
  select(table, where = null) {
    this.ensureTable(table, where || {});
    let sql = `SELECT * FROM \`${table}\``;
    let params = [];

    if (where && Object.keys(where).length > 0) {
      const whereString = Object.keys(where).map(k => `\`${k}\` = ?`).join(' AND ');
      sql += ` WHERE ${whereString}`;
      params = Object.values(where);
    }

    return this.query(sql, params);
  }

  /**
   * Veri varsa günceller, yoksa ekler (upsert).
   */
  set(table, data, where) {
    this.ensureTable(table, { ...data, ...where });
    this._ensureColumns(table, data);
    const existing = this.select(table, where);
    if (existing.length === 0) {
      return this.insert(table, { ...where, ...data });
    } else {
      return this.update(table, data, where);
    }
  }

  /**
   * Koşula uyan ilk veriyi seçer.
   * @returns {object|null} Bulunan satır veya null.
   */
  selectOne(table, where = null) {
    const results = this.select(table, where);
    return results[0] || null;
  }

  /**
   * Koşula uyan ilk veriyi siler.
   * @returns {number} Etkilenen satır sayısı (0 veya 1).
   */
  deleteOne(table, where) {
    if (!where || Object.keys(where).length === 0) return 0;
    this.ensureTable(table, where);
    const whereString = Object.keys(where).map(k => `\`${k}\` = ?`).join(' AND ');
    const sql = `DELETE FROM \`${table}\` WHERE rowid IN (SELECT rowid FROM \`${table}\` WHERE ${whereString} LIMIT 1)`;
    const result = this.query(sql, Object.values(where));
    return result.changes;
  }

  /**
   * Koşula uyan ilk veriyi günceller.
   * @returns {number} Etkilenen satır sayısı (0 veya 1).
   */
  updateOne(table, data, where) {
    this.ensureTable(table, { ...data, ...where });
    this._ensureColumns(table, data);
    const setString = Object.keys(data).map(k => `\`${k}\` = ?`).join(', ');
    const whereString = Object.keys(where).map(k => `\`${k}\` = ?`).join(' AND ');
    const sql = `UPDATE \`${table}\` SET ${setString} WHERE rowid IN (SELECT rowid FROM \`${table}\` WHERE ${whereString} LIMIT 1)`;
    const result = this.query(sql, [...Object.values(data), ...Object.values(where)]);
    return result.changes;
  }

  /**
   * Toplu veri ekleme.
   * @returns {number} Eklenen satır sayısı.
   */
  bulkInsert(table, dataArray) {
    if (!Array.isArray(dataArray) || dataArray.length === 0) return 0;
    this.ensureTable(table, dataArray[0]);
    this._ensureColumns(table, dataArray[0]);

    const keys = Object.keys(dataArray[0]);
    const placeholders = keys.map(() => '?').join(',');
    const sql = `INSERT INTO \`${table}\` (${keys.map(k => `\`${k}\``).join(',')}) VALUES (${placeholders})`;
    
    // better-sqlite3'nin transaction özelliği toplu işlemlerde çok yüksek performans sağlar.
    const insertMany = this.db.transaction((items) => {
      const stmt = this.db.prepare(sql);
      for (const item of items) {
        stmt.run(Object.values(item));
      }
    });

    insertMany(dataArray);
    return dataArray.length;
  }

  /**
   * Veritabanı bağlantısını kapatır.
   */
  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

module.exports = SQLiteDatabase;