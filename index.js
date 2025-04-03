var database = require("./database/index");
var functions = require("./functions/functions");

module.exports = {
  database: {
    JsonDatabase: database.JsonDatabase,
    MongoDB: database.MongoDB,
    MySQLDatabase: database.MySQLDatabase,
    SQLiteDatabase: database.SQLiteDatabase,
  },
  functions,
};
