require("dotenv").config();
const runMongoDB = async () => {
  const { MongoDB } = require("./index");

  var db = await MongoDB.createData(
    "database",
    "collection",
    "data",
    undefined,
    "mongourl"
  );

  db.set("foo", "bar");
};

const runMySQL = async () => {
  const { MySQLDatabase } = require("./index");
  const db = new MySQLDatabase();
  await db.connect({
    host: "localhost",
    port: "3306",
    user: "root",
    password: "",
    database: "database",
    charset: "utf8mb4",
  });

  db.on("connected", async (connection) => {
    console.log("Database Connected");
  });

  db.set("table", "foo", "bar");
};

//runMySQL()

const runJsonDatabase = async () => {
  const { JsonDatabase } = require("./index");
  var db = new JsonDatabase();
  db.set("foo", "bar");
};

const runSQLite = async () => {
  const { database } = require("../index");
  var db = new database.SQLiteDatabase();
  await db.set("foo.test2", { Date: Date.now(), name: "Onur" });
  console.log(await db.has("foo.test2.a"));
};

runSQLite();
