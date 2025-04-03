/**
 * @module Database
 */

var JsonDatabase = require("./jsondatabase/index");
var MongoDB = require("./mongodb/index");
var MySQLDatabase = require("./mysql/index");
var SQLiteDatabase = require("./sqldb/index");

module.exports = {
  /**
   * JSON-based database.
   * @type {JsonDatabase}
   */
  JsonDatabase,

  /**
   * MongoDB-based database.
   * @type {MongoDB}
   */
  MongoDB,

  /**
   * MySQL-based database.
   * @type {MySQLDatabase}
   */
  MySQLDatabase,

  /**
   * SQLite-based database.
   * @type {SQLiteDatabase}
   */
  SQLiteDatabase,
};
