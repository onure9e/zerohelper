const fs = require("fs");
const path = require("path");
const { parse, stringify } = require("csv");

class CSVDatabase {
  constructor(filePath) {
    this.filePath = filePath || path.join(__dirname, "database.csv");
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, "key,value\n"); // Başlık satırı
    }
  }

  async _readCSV() {
    const data = fs.readFileSync(this.filePath, "utf8");
    return new Promise((resolve, reject) => {
      parse(data, { columns: true }, (err, records) => {
        if (err) reject(err);
        else resolve(records);
      });
    });
  }

  async _writeCSV(records) {
    const data = await new Promise((resolve, reject) => {
      stringify(records, { header: true }, (err, output) => {
        if (err) reject(err);
        else resolve(output);
      });
    });
    fs.writeFileSync(this.filePath, data);
  }

  async set(key, value) {
    const records = await this._readCSV();
    const index = records.findIndex((record) => record.key === key);
    if (index !== -1) {
      records[index].value = JSON.stringify(value);
    } else {
      records.push({ key, value: JSON.stringify(value) });
    }
    await this._writeCSV(records);
  }

  async get(key) {
    const records = await this._readCSV();
    const record = records.find((record) => record.key === key);
    return record ? JSON.parse(record.value) : null;
  }

  async delete(key) {
    const records = await this._readCSV();
    const filteredRecords = records.filter((record) => record.key !== key);
    await this._writeCSV(filteredRecords);
  }

  async has(key) {
    const value = await this.get(key);
    return value !== null;
  }

  async push(key, value) {
    const currentValue = (await this.get(key)) || [];
    if (!Array.isArray(currentValue)) throw new Error("Value is not an array");
    currentValue.push(value);
    await this.set(key, currentValue);
  }

  async add(key, value) {
    const currentValue = (await this.get(key)) || 0;
    if (typeof currentValue !== "number") throw new Error("Value is not a number");
    await this.set(key, currentValue + value);
  }

  async sub(key, value) {
    const currentValue = (await this.get(key)) || 0;
    if (typeof currentValue !== "number") throw new Error("Value is not a number");
    await this.set(key, currentValue - value);
  }

  async getAllData() {
    const records = await this._readCSV();
    const result = {};
    records.forEach((record) => {
      result[record.key] = JSON.parse(record.value);
    });
    return result;
  }
}

module.exports = CSVDatabase;