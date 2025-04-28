const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml"); // You'll need to install this package: npm install js-yaml

class database {
  constructor(name = "database", loc2) {
    var location = "database";
    var filePath = `databases/${name}.yaml`;
    if (name.endsWith(".yaml") || name.endsWith(".yml")) {
      filePath = `databases/${name}`;
    }
    if (location == "database" && !fs.existsSync(`databases`)) {
      fs.mkdirSync(`databases`, { recursive: true });
    } else if (!fs.existsSync(`${location}`)) {
      fs.mkdirSync(`databases`, { recursive: true });
    }
    if (loc2) {
      if (!fs.existsSync(`${loc2}`)) {
        fs.mkdirSync(`databases/${loc2}`, { recursive: true });
      }
      filePath = `databases/${loc2}/${name}.yaml`;
      if (name.endsWith(".yaml") || name.endsWith(".yml")) {
        filePath = `databases/${loc2}/${name}`;
      }
    }

    if (!fs.existsSync(filePath)) fs.closeSync(fs.openSync(filePath, "w"));
    this.FilePath = filePath;
    this.Location = location;
  }
  
  add(path, value) {
    let data = this.get(path);
    if (typeof data == "number") data += Number(value);
    else data = Number(value);
    this.set(path, data);
    return data;
  }
  
  getAllData() {
    let data = this.read();
    if (!data) data = {};
    return data;
  }
  
  get(path) {
    let data = this.read(),
      result = undefined;
    if (!data) data = {};
    result = _get(path, data);
    return result ? result : undefined;
  }
  
  has(path) {
    let data = this.read(),
      result = undefined;
    result = _get(path, data);
    if (!result) return false;
    else {
      return true;
    }
  }
  
  set(path, value) {
    let data = this.read();
    if (!data) data = {};
    data = _set(path, value, data);
    fs.truncateSync(this.FilePath);
    fs.writeFileSync(this.FilePath, yaml.dump(data), {
      encoding: "utf-8",
    });
    return data;
  }
  
  delete(path) {
    let data = this.read();
    if (!data) data = {};
    data = _set(path, undefined, data);
    fs.truncateSync(this.FilePath);
    fs.writeFileSync(this.FilePath, yaml.dump(data), {
      encoding: "utf-8",
    });
    return data;
  }
  
  push(path, value) {
    let data = this.read();
    if (!data) data = {};
    if (_get(path, data) && Array.isArray(_get(path, data))) {
      _get(path, data).push(value);
    } else if (!_get(path, data)) {
      _set(path, [value], data);
    }
    fs.truncateSync(this.FilePath);
    fs.writeFileSync(this.FilePath, yaml.dump(data), {
      encoding: "utf-8",
    });
    return data;
  }
  
  sub(path, value) {
    let data = this.get(path);
    if (typeof data == "number") data -= Number(value);
    else data = Number(value);
    this.set(path, data);
    return data;
  }
  
  read() {
    let data = fs.readFileSync(this.FilePath, { encoding: "utf-8" });
    if (!data || (data && data == null)) return {};
    try {
      let obj = yaml.load(data);
      return obj || {};
    } catch (e) {
      return {};
    }
  }
}

// The _set and _get helper functions remain the same as they work with objects
function _set(path, value, obj = undefined) {
  if (obj == undefined) return undefined;
  let locations = path.split("."),
    output = {};
  output = obj;
  let ref = output;
  for (let index = 0; index < locations.length - 1; index++) {
    if (!ref[locations[index]]) ref = ref[locations[index]] = {};
    else ref = ref[locations[index]];
  }
  ref[locations[locations.length - 1]] = value;
  return output;
}

function _get(path, obj = {}) {
  let locations = path.split("."),
    ref = obj;
  for (let index = 0; index < locations.length - 1; index++) {
    ref = ref[locations[index]] ? ref[locations[index]] : undefined;
    if (!ref) return undefined;
  }
  let output = ref[locations[locations.length - 1]];
  return output;
}

module.exports = database;