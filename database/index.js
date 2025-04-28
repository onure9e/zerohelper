/**
 * @module Database
 */

var JsonDatabase = require("./jsondatabase/index");
var MongoDB = require("./mongodb/index");
var MySQLDatabase = require("./mysql/index");
var SQLiteDatabase = require("./sqldb/index");
var RedisDatabase = require("./redis/index");
var PostgreSQL = require("./postgresql/index");
var YamlDatabase = require("./yamldatabase/index"); // Assuming you've saved the YAML class in this path
var MigrateDatabase = require("./migrate/index");

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

  /**
   * Redis-based database.
   * @type {RedisDatabase}
   */
  RedisDatabase,

  /**
   * PostgreSQL-based database.
   * @type {PostgreSQL}
   */
  PostgreSQL,
  YamlDatabase,
  /**
   * Migration utility for databases.
   * @type {MigrateDatabase}
   */
  MigrateDatabase,
};
