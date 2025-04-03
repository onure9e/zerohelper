var JsonDatabase = require("./jsondatabase/index");
var MongoDB = require("./mongodb/index");
var MySQLDatabase = require("./mysql/index");
var SQLiteDatabase = require("./sqldb/index");

module.exports = {
  JsonDatabase,
  MongoDB,
  MySQLDatabase,
  SQLiteDatabase,
};
