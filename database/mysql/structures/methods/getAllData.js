"use strict";

const errors = require("../errors/strings.js");

module.exports = async function (table = "default") {
  if (!table || typeof table !== "string") {
    throw new TypeError(errors.table.replace("{received}", typeof table));
  }

  // Tabloları kontrol et
  let tables = await this.tables();
  if (!tables.includes(table)) {
    throw new TypeError(errors.tableNotFound.replace("{table}", table));
  }

  // Tüm verileri al
  let all = await this.query(`SELECT key_name, value FROM \`${table}\``);
  let result = {};

  all.forEach((row) => {
    let key = row.key_name;
    let value = row.value;

    // JSON parse işlemi
    try {
      value = JSON.parse(value);
    } catch (e) {
      // JSON değilse olduğu gibi bırak
    }

    result[key] = value;
  });

  return result;
};
