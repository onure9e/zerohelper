const JsonDatabase = require("../jsondatabase/index");
const YamlDatabase = require("../yamldatabase/index"); // Assuming you've saved the YAML class in this path
const MongoDB = require("../mongodb/index");
const MySQLDatabase = require("../mysql/index");
const SQLiteDatabase = require("../sqldb/index");
const RedisDatabase = require("../redis/index");
const PostgreSQL = require("../postgresql/index");

/**
 * Migrates data from one database to another.
 * @param {Object} source - Source database configuration.
 * @param {Object} target - Target database configuration.
 */
async function migrateData(source, target) {
  const sourceDb = await initializeDatabase(source);
  const targetDb = await initializeDatabase(target);

  const allData = await sourceDb.getAllData();
  console.log(allData);

  for (const [key, value] of Object.entries(allData)) {
    await targetDb.set(key, value);
  }

  console.log(`Migration completed from ${source.type} to ${target.type}`);
}

/**
 * Initializes a database instance based on the configuration.
 * @param {Object} config - Database configuration.
 * @returns {Object} - Database instance.
 */
async function initializeDatabase(config) {
  switch (config.type) {
    case "json":
      return new JsonDatabase(config.options.filePath);
    case "yaml":
      return new YamlDatabase(config.options.filePath);
    case "csv":
      return new YamlDatabase(config.options.filePath);
    case "mongodb":
      const mongoClient = await MongoDB.createData(
        config.options.database,
        config.options.collection,
        config.options.data,
        undefined,
        config.options.url
      );
      return mongoClient;
    case "mysql":
      const mysqlDb = new MySQLDatabase();
      await mysqlDb.connect(config.options);
      return mysqlDb;
    case "sqlite":
      return new SQLiteDatabase(config.options.filePath);
    case "redis":
      const redisDb = new RedisDatabase(config.options);
      await redisDb.connect();
      return redisDb;
    case "postgresql":
      return new PostgreSQL(config.options);
    default:
      throw new Error(`Unsupported database type: ${config.type}`);
  }
}

// Export the migrateData function
module.exports = migrateData;