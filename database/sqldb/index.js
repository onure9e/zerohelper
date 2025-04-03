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

  _parseNestedKey(key) {
    return key.includes(".") ? key.split(".") : [key];
  }

  _buildNestedObject(keys, value) {
    return keys.reverse().reduce((acc, curr) => ({ [curr]: acc }), value);
  }

  _mergeObjects(target, source) {
    for (const key in source) {
      if (source[key] instanceof Object && key in target) {
        Object.assign(
          source[key],
          this._mergeObjects(target[key], source[key])
        );
      }
    }
    return { ...target, ...source };
  }

  set(key, value) {
    const keys = this._parseNestedKey(key);
    if (keys.length > 1) {
      return this.get(keys[0]).then((currentValue) => {
        const nestedObject = this._buildNestedObject(keys.slice(1), value);
        const mergedValue = this._mergeObjects(
          currentValue || {},
          nestedObject
        );
        return this.set(keys[0], mergedValue);
      });
    }

    return this.runQuery(
      `INSERT INTO key_value_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, JSON.stringify(value)]
    );
  }

  get(key) {
    const keys = this._parseNestedKey(key);
    return this.getQuery(`SELECT value FROM key_value_store WHERE key = ?`, [
      keys[0],
    ]).then((row) => {
      if (!row) return null;
      const value = JSON.parse(row.value);
      return keys.length > 1
        ? keys.slice(1).reduce((acc, curr) => (acc ? acc[curr] : null), value)
        : value;
    });
  }

  delete(key) {
    const keys = this._parseNestedKey(key);
    if (keys.length > 1) {
      return this.get(keys[0]).then((currentValue) => {
        if (!currentValue) return null;
        let ref = currentValue;
        for (let i = 0; i < keys.length - 1; i++) {
          if (!ref[keys[i]]) return null;
          if (i === keys.length - 2) {
            delete ref[keys[i + 1]];
          } else {
            ref = ref[keys[i]];
          }
        }
        return this.set(keys[0], currentValue);
      });
    }
    return this.runQuery(`DELETE FROM key_value_store WHERE key = ?`, [key]);
  }

  has(key) {
    return this.get(key).then((value) => value !== null);
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
// db.set('foo.bar.baz', 'value')
//   .then(() => db.get('foo.bar'))
//   .then((value) => console.log('Value:', value)) // Output: { baz: 'value' }
//   .then(() => db.delete('foo.bar.baz'))
//   .then(() => db.get('foo'))
//   .then((value) => console.log('After delete:', value)) // Output: {}
//   .catch((err) => console.error(err))
//   .finally(() => db.close());
