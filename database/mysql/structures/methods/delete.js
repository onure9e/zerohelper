"use strict";

const unset = require("lodash/unset");
const errors = require("../errors/strings.js");

module.exports = async function (key, table = "default") {
  if (!key || typeof key !== "string")
    throw new TypeError(errors.key.replace("{received}", typeof key));

  let res = true;
  let keys = key.split(".");
  if (keys.length > 1) {
    key = keys.shift();
    let data = (await this.get(table, key)) || {};
    if (typeof data !== "object")
      throw new TypeError(errors.targetNotObject.replace("{key}", key));
    res = unset(data, keys.join("."));
    await this.set(key, data, table);
  } else {
    let oldData = await this.get(table, key);
    await this.query(`DELETE FROM \`${table}\` WHERE key_name = '${key}'`);
    this.emit("dataModification", {
      oldData,
      newData: null,
      type: "DELETE",
      table,
      modifiedAt: Date.now(),
    });
  }
  return res;
};
