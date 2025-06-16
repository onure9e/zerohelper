/** @typedef {import('./IDatabase').IDatabase} IDatabase */
/**
 * @implements {IDatabase}
 */
const fs = require('fs').promises; // Asenkron dosya işlemleri için
const path = require('path');

class JsonDatabase {
  /**
   * @param {object} config - Yapılandırma nesnesi.
   * @param {string} config.filePath - JSON veritabanı dosyasının yolu.
   * @param {number} [config.saveInterval=500] - Değişiklikleri dosyaya yazma gecikmesi (ms).
   */
  constructor(config) {
    if (!config || !config.filePath) {
      throw new Error('Yapılandırma içinde "filePath" belirtilmelidir.');
    }
    this.filePath = config.filePath;
    this.db = {};
    this.isDirty = false;
    this.isWriting = false;
    this.writeQueue = [];
    this.saveDebounceTimeout = null;
    this.saveInterval = config.saveInterval || 500;

    process.on('exit', () => this.flushSync());
    this.initPromise = this._load();
  }

  // --- ÖZEL (PRIVATE) METOTLAR ---

  async _load() {
    try {
      const dir = path.dirname(this.filePath);
      await fs.mkdir(dir, { recursive: true });
      const fileContent = await fs.readFile(this.filePath, 'utf-8');
      this.db = JSON.parse(fileContent);
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.db = {};
        await this._saveNow();
      } else {
        console.error("Veritabanı dosyası okunurken hata:", error);
        this.db = {};
      }
    }
  }

  _enqueueWrite(operation) {
    return new Promise((resolve, reject) => {
      this.writeQueue.push({ operation, resolve, reject });
      this._processQueue();
    });
  }

  async _processQueue() {
    if (this.isWriting || this.writeQueue.length === 0) return;
    this.isWriting = true;

    const { operation, resolve, reject } = this.writeQueue.shift();
    try {
      const result = operation();
      this.isDirty = true;
      this._scheduleSave();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.isWriting = false;
      this._processQueue();
    }
  }

  _scheduleSave() {
    if (this.saveDebounceTimeout) clearTimeout(this.saveDebounceTimeout);
    this.saveDebounceTimeout = setTimeout(() => this._saveNow(), this.saveInterval);
  }

  async _saveNow() {
    if (!this.isDirty) return;
    clearTimeout(this.saveDebounceTimeout);
    this.saveDebounceTimeout = null;
    try {
      await fs.writeFile(this.filePath, JSON.stringify(this.db, null, 2));
      this.isDirty = false;
    } catch (error) {
      console.error("Veritabanı dosyasına yazılırken hata:", error);
    }
  }

  flushSync() {
    if (this.isDirty) {
      console.log('Uygulama kapanıyor, bekleyen değişiklikler kaydediliyor...');
      try {
        require('fs').writeFileSync(this.filePath, JSON.stringify(this.db, null, 2));
        this.isDirty = false;
      } catch (error) {
        console.error('Senkron kaydetme sırasında hata:', error);
      }
    }
  }

  _matches(row, where) {
    return Object.keys(where).every(key => row[key] === where[key]);
  }

  // --- GENEL (PUBLIC) API ---

  async ensureTable(table) {
    await this.initPromise;
    if (!this.db[table]) {
      return this._enqueueWrite(() => {
        this.db[table] = [];
      });
    }
  }

  async insert(table, data) {
    await this.ensureTable(table);
    return this._enqueueWrite(() => {
      const maxId = this.db[table].reduce((max, row) => (row.id > max ? row.id : max), 0);
      const newId = maxId + 1;
      const newRow = { id: newId, ...data };
      this.db[table].push(newRow);
      return newId;
    });
  }

  async update(table, data, where) {
    await this.ensureTable(table);
    return this._enqueueWrite(() => {
      let affectedRows = 0;
      this.db[table].forEach(row => {
        if (this._matches(row, where)) {
          Object.assign(row, data);
          affectedRows++;
        }
      });
      return affectedRows;
    });
  }

  async delete(table, where) {
    await this.ensureTable(table);
    return this._enqueueWrite(() => {
      const initialLength = this.db[table].length;
      this.db[table] = this.db[table].filter(row => !this._matches(row, where));
      return initialLength - this.db[table].length;
    });
  }

  async select(table, where = null) {
    await this.initPromise;
    const tableData = this.db[table] || [];
    let results = tableData;
    if (where && Object.keys(where).length > 0) {
      results = results.filter(row => this._matches(row, where));
    }
    return JSON.parse(JSON.stringify(results));
  }

  async set(table, data, where) {
    await this.ensureTable(table);
    const existing = await this.select(table, where);
    if (existing.length === 0) {
      return this.insert(table, { ...where, ...data });
    } else {
      return this.update(table, data, where);
    }
  }

  async selectOne(table, where = null) {
    // Bu metot sadece okuma yaptığı için kuyruğa girmesine gerek yok.
    const results = await this.select(table, where);
    return results[0] || null;
  }

  async deleteOne(table, where) {
    await this.ensureTable(table);
    return this._enqueueWrite(() => {
      const index = this.db[table].findIndex(row => this._matches(row, where));
      if (index > -1) {
        this.db[table].splice(index, 1);
        return 1; // 1 satır etkilendi
      }
      return 0; // Hiçbir satır etkilenmedi
    });
  }

  async updateOne(table, data, where) {
    await this.ensureTable(table);
    return this._enqueueWrite(() => {
      const row = this.db[table].find(row => this._matches(row, where));
      if (row) {
        Object.assign(row, data);
        return 1; // 1 satır etkilendi
      }
      return 0; // Hiçbir satır etkilenmedi
    });
  }

  async bulkInsert(table, dataArray) {
    if (!Array.isArray(dataArray) || dataArray.length === 0) return 0;
    await this.ensureTable(table);
    return this._enqueueWrite(() => {
      let maxId = this.db[table].reduce((max, row) => (row.id > max ? row.id : max), 0);
      dataArray.forEach(data => {
        maxId++;
        this.db[table].push({ id: maxId, ...data });
      });
      return dataArray.length;
    });
  }

  async close() {
    await this._saveNow();
  }
}

module.exports = JsonDatabase;