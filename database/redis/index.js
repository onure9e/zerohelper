const { createClient } = require("redis");

class RedisDatabase {
  constructor(config = {}) {
    this.client = createClient(config);
    this.client.on("error", (err) => console.error("Redis Client Error", err));
  }

  async connect() {
    await this.client.connect();
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

    await this.client.set(rootKey, JSON.stringify(currentValue));
  }

  async get(key) {
    const keys = key.split(".");
    const rootKey = keys.shift();
    const value = await this.client.get(rootKey);
    const rootValue = value ? JSON.parse(value) : null;

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

    await this.client.set(rootKey, JSON.stringify(currentValue));
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

  async ping() {
    try {
      const pong = await this.client.ping();
      return pong === "PONG";
    } catch {
      return false;
    }
  }

  async close() {
    await this.client.quit();
  }
}

module.exports = RedisDatabase;
