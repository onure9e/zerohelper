const { Pool } = require("pg");

class PostgreSQL {
  constructor(config) {
    this.pool = new Pool(config);

    // Ensure the table exists when the class is instantiated
    this.ensureTableExists(config).catch((error) => {
      console.error("Error ensuring table exists:", error);
    });
  }

  async ensureTableExists(config) {
    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS key_value_store (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        )
      `);
    } catch (error) {
      console.error("Failed to create table:", error);
      throw error;
    }
  }

  async set(key, value) {
    const keys = key.split(".");
    const rootKey = keys.shift();
    const currentValue = (await this.get(rootKey)) || {};

    let target = currentValue;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!target[keys[i]]) target[keys[i]] = {};
      target = target[keys[i]];
    }
    target[keys[keys.length - 1]] = value;

    await this.pool.query(
      "INSERT INTO key_value_store (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2",
      [rootKey, JSON.stringify(currentValue)]
    );
  }

  async get(key) {
    const keys = key.split(".");
    const rootKey = keys.shift();
    const res = await this.pool.query(
      "SELECT value FROM key_value_store WHERE key = $1",
      [rootKey]
    );
    const rootValue = res.rows[0] ? JSON.parse(res.rows[0].value) : null;

    if (!rootValue) return null;

    let target = rootValue;
    for (const k of keys) {
      if (target[k] === undefined) return null;
      target = target[k];
    }
    return target;
  }

  async has(key) {
    return (await this.get(key)) !== null;
  }

  async delete(key) {
    const keys = key.split(".");
    const rootKey = keys.shift();
    const currentValue = (await this.get(rootKey)) || {};

    let target = currentValue;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!target[keys[i]]) return; // Key path does not exist
      target = target[keys[i]];
    }
    delete target[keys[keys.length - 1]];

    await this.pool.query(
      "INSERT INTO key_value_store (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2",
      [rootKey, JSON.stringify(currentValue)]
    );
  }

  async add(key, amount) {
    const currentValue = (await this.get(key)) || 0;
    if (typeof currentValue !== "number") {
      throw new TypeError("The value is not a number.");
    }
    await this.set(key, currentValue + amount);
  }

  async sub(key, amount) {
    const currentValue = (await this.get(key)) || 0;
    if (typeof currentValue !== "number") {
      throw new TypeError("The value is not a number.");
    }
    await this.set(key, currentValue - amount);
  }

  async push(key, value) {
    const currentValue = (await this.get(key)) || [];
    if (!Array.isArray(currentValue)) {
      throw new TypeError("The value is not an array.");
    }
    currentValue.push(value);
    await this.set(key, currentValue);
  }
  async getAllData() {
    try {
      const res = await this.pool.query(
        "SELECT key, value FROM key_value_store"
      );
      const result = {};

      res.rows.forEach((row) => {
        let value = row.value;

        // JSON parse işlemi
        try {
          value = JSON.parse(value);
        } catch (e) {
          // JSON değilse olduğu gibi bırak
        }

        result[row.key] = value;
      });

      return result;
    } catch (error) {
      console.error("Error fetching all data:", error);
      throw error;
    }
  }
  async ping() {
    try {
      await this.pool.query("SELECT 1");
      return true;
    } catch {
      return false;
    }
  }

  async close() {
    await this.pool.end();
  }
}

module.exports = PostgreSQL;
