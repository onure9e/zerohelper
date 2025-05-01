const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

class YAMLDatabase {
  constructor(filePath) {
    this.filePath = filePath || path.join(__dirname, "database.yaml");
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, yaml.dump({}));
    }
  }

  _readYAML() {
    const data = fs.readFileSync(this.filePath, "utf8");
    return yaml.load(data) || {};
  }

  _writeYAML(data) {
    fs.writeFileSync(this.filePath, yaml.dump(data));
  }

  async set(key, value) {
    const data = this._readYAML();
    data[key] = value;
    this._writeYAML(data);
  }

  async get(key) {
    const data = this._readYAML();
    return data[key] || null;
  }

  async delete(key) {
    const data = this._readYAML();
    delete data[key];
    this._writeYAML(data);
  }

  async has(key) {
    const data = this._readYAML();
    return key in data;
  }

  async push(key, value) {
    const data = this._readYAML();
    if (!Array.isArray(data[key])) {
      data[key] = [];
    }
    data[key].push(value);
    this._writeYAML(data);
  }

  async add(key, value) {
    const data = this._readYAML();
    if (typeof data[key] !== "number") {
      data[key] = 0;
    }
    data[key] += value;
    this._writeYAML(data);
  }

  async sub(key, value) {
    const data = this._readYAML();
    if (typeof data[key] !== "number") {
      data[key] = 0;
    }
    data[key] -= value;
    this._writeYAML(data);
  }

  async getAllData() {
    return this._readYAML();
  }
}

module.exports = YAMLDatabase;