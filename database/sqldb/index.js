const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
class Database {
  constructor(dbFilePath) {
    this.dbFilePath = dbFilePath || path.join(__dirname, "database.sqlite");
    this.db = null;
  }

  initialize() {
    if (!fs.existsSync(this.dbFilePath)) {
      console.log("Creating database file...");
      fs.writeFileSync(this.dbFilePath, "");
    }

    this.db = new sqlite3.Database(this.dbFilePath, (err) => {
      if (err) {
        console.error("Error opening database:", err.message);
      } else {
        console.log("Connected to the SQLite database.");
        this.runQuery(
          `CREATE TABLE IF NOT EXISTS key_value_store (key TEXT PRIMARY KEY, value TEXT)`
        )
          .then(() => {
            console.log("Table initialized");
          })
          .catch((err) => console.error(err));
      }
    });
  }

  set(key, value) {
    return this.runQuery(
      `INSERT INTO key_value_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, JSON.stringify(value)]
    );
  }

  get(key) {
    return this.getQuery(`SELECT value FROM key_value_store WHERE key = ?`, [
      key,
    ]).then((row) => (row ? JSON.parse(row.value) : null));
  }

  delete(key) {
    return this.runQuery(`DELETE FROM key_value_store WHERE key = ?`, [key]);
  }

  has(key) {
    return this.getQuery(`SELECT 1 FROM key_value_store WHERE key = ?`, [
      key,
    ]).then((row) => !!row);
  }

  push(key, value) {
    return this.get(key).then((currentValue) => {
      if (!Array.isArray(currentValue)) {
        currentValue = [];
      }
      currentValue.push(value);
      return this.set(key, currentValue);
    });
  }

  add(key, value) {
    return this.get(key).then((currentValue) => {
      if (typeof currentValue !== "number") {
        currentValue = 0;
      }
      return this.set(key, currentValue + value);
    });
  }

  sub(key, value) {
    return this.get(key).then((currentValue) => {
      if (typeof currentValue !== "number") {
        currentValue = 0;
      }
      return this.set(key, currentValue - value);
    });
  }

  runQuery(query, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(query, params, function (err) {
        if (err) {
          reject(err);
        } else {
          resolve(this);
        }
      });
    });
  }

  getQuery(query, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(query, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  close() {
    this.db.close((err) => {
      if (err) {
        console.error("Error closing database:", err.message);
      } else {
        console.log("Database connection closed.");
      }
    });
  }
}

module.exports = Database;

// Example usage:
// const db = new Database();
// db.initialize();
// db.set('foo', 'bar')
//   .then(() => db.get('foo'))
//   .then((value) => console.log('Value:', value)) // Output: bar
//   .then(() => db.push('array', 'x'))
//   .then(() => db.get('array'))
//   .then((value) => console.log('Array:', value)) // Output: ['x']
//   .then(() => db.add('number', 1))
//   .then(() => db.get('number'))
//   .then((value) => console.log('Number:', value)) // Output: 1
//   .then(() => db.sub('number', 1))
//   .then(() => db.get('number'))
//   .then((value) => console.log('Number after sub:', value)) // Output: 0
//   .then(() => db.has('foo'))
//   .then((exists) => console.log('Exists:', exists)) // Output: true
//   .then(() => db.delete('foo'))
//   .then(() => db.has('foo'))
//   .then((exists) => console.log('Exists after delete:', exists)) // Output: false
//   .catch((err) => console.error(err))
//   .finally(() => db.close());
