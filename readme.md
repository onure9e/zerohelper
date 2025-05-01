# ZeroHelper 🚀

ZeroHelper is a versatile JavaScript package providing helper functions and database utilities for developers. It includes essential tools for manipulating data, generating random values, performing cryptographic operations, and interacting with various databases like MySQL, MongoDB, PostgreSQL, SQLite, and Redis.

---

## 📑 Table of Contents

1. [📦 Installation](#-installation)
2. [✨ Helper Functions](#-helper-functions)
   - [🎲 Random Functions](#random-functions-)
   - [🔠 String Functions](#string-functions-)
   - [📊 Array Functions](#array-functions-)
   - [🔧 Object Functions](#object-functions-)
   - [🔒 Crypto Functions](#crypto-functions-)
   - [➗ Math Functions](#math-functions-)
3. [💾 Database Utilities](#-database-utilities)
   - [🗃️ JsonDatabase](#jsondatabase-️)
   - [♦️ YamlDatabase](#yamldatabase-️)
   - [🎋 CSV Database](#csv-database-)
   - [🗄️ MongoDB](#mongodb-️)
   - [🐬 MySQL](#mysql-)
   - [📱 SQLiteDB](#sqlitedb-)
   - [🍇 PostgreSQL](#postgresql-)
   - [⚡ Redis](#redis-)
4. [🔄 Database Migration](#database-migration)

---

## 🚀 Installing ZeroHelper

To install ZeroHelper, use npm:

```bash
npm i @onurege3467/zerohelper
```

## 🛠️ Using ZeroHelper for helper functions

# Random Functions 🎲

```js
const helpers = require("@onurege3467/zerohelper/functions");

const id = helpers.random.makeUniqueId();
console.log(id); // Example: "lzx8k9x8k9"

const item = helpers.random.randomArray([1, 2, 3, 4, 5]);
console.log(item); // Example: 3

const text = helpers.random.randomText(10);
console.log(text); // Example: "aBcDeFgHiJ"

const number = helpers.random.randomNumber(1, 100);
console.log(number); // Example: 42

const emoji = helpers.random.randomEmoji();
console.log(emoji); // Example: "😄"

const hex = helpers.random.randomHex();
console.log(hex); // Example: "#A1B2C3"

const float = helpers.random.randomFloat(1.5, 5.5);
console.log(float); // Example: 3.14
```

# String Functions 🔠

```js
const title = helpers.string.titleCase("hello world");
console.log(title); // "Hello World"

const randomString = helpers.string.generateRandomString(8);
console.log(randomString); // Example: "AbCdEfGh"
```

# Array Functions 📊

```js
const shuffled = helpers.array.shuffleArray([1, 2, 3, 4, 5]);
console.log(shuffled); // Example: [3, 1, 5, 4, 2]

const flat = helpers.array.flattenArray([1, [2, [3, 4]], 5]);
console.log(flat); // [1, 2, 3, 4, 5]

const filtered = helpers.array.removeFalsyValues([0, 1, false, 2, "", 3]);
console.log(filtered); // [1, 2, 3]

const grouped = helpers.array.groupBy(
  [
    { category: "fruit", name: "apple" },
    { category: "fruit", name: "banana" },
    { category: "vegetable", name: "carrot" },
  ],
  "category"
);
console.log(grouped);
// {
//   fruit: [{ category: "fruit", name: "apple" }, { category: "fruit", name: "banana" }],
//   vegetable: [{ category: "vegetable", name: "carrot" }]
// }

const names = helpers.array.pluck(
  [{ name: "Alice" }, { name: "Bob" }, { name: "Charlie" }],
  "name"
);
console.log(names); // ["Alice", "Bob", "Charlie"]

const sorted = helpers.array.sortBy(
  [{ age: 30 }, { age: 20 }, { age: 40 }],
  "age"
);
console.log(sorted); // [{ age: 20 }, { age: 30 }, { age: 40 }]
```

# Object Functions 🔧

```js
const filtered = helpers.object.filterObjectByKey(
  { name: "Alice", age: 25, city: "New York" },
  ["name", "city"]
);
console.log(filtered); // { name: "Alice", city: "New York" }

const merged = helpers.object.deepMerge(
  { a: 1, b: { c: 2 } },
  { b: { d: 3 }, e: 4 }
);
console.log(merged); // { a: 1, b: { c: 2, d: 3 }, e: 4 }
```

# Crypto Functions 🔒

```js
const secret = "mySecretKey";
const encrypted = helpers.crypto.encryptText("Hello, World!", secret);
console.log(encrypted); // Encrypted text

const decrypted = helpers.crypto.decryptText(encrypted, secret);
console.log(decrypted); // "Hello, World!"

const hash = helpers.crypto.hashPassword("myPassword");
console.log(hash); // Hashed password

const isValid = helpers.crypto.verifyPassword("myPassword", hash);
console.log(isValid); // true or false

const token = helpers.crypto.generateJWT({ userId: 1 }, "mySecret");
console.log(token); // JWT

const payload = helpers.crypto.verifyJWT(token, "mySecret");
console.log(payload); // { userId: 1, iat: ..., exp: ... }
```

# Math Functions ➗

```js
const avg = helpers.math.mean([1, 2, 3, 4, 5]);
console.log(avg); // 3

const prime = helpers.math.isPrime(7);
console.log(prime); // true
```

## 💾 Using ZeroHelper as Database

ZeroHelper provides multiple database utilities for seamless integration with various databases.

# JsonDatabase 🗃️

```js
(async function () {
  const JsonDatabase = require("@onurege3467/zerohelper/database/jsondatabase");
  const db = new JsonDatabase();

  await db.set("foo", "bar");
  await db.push("array", "x");
  await db.delete("foo");

  await db.add("number", 1);
  await db.sub("number", 1);

  await console.log(db.get("foo"));
  await console.log(db.has("foo"));
})();
```
# YamlDatabase 🗃️
```js
(async function () {
  const YamlDatabase = require("@onurege3467/zerohelper/database/yamldatabase");
  const db = new YamlDatabase();

  await db.set("foo", "bar");
  await db.push("array", "x");
  await db.delete("foo");

  await db.add("number", 1);
  await db.sub("number", 1);

  await console.log(db.get("foo"));
  await console.log(db.has("foo"));
})();
```
# CSV Database 🎋
```js
(async function () {
  const csvdb = require("@onurege3467/zerohelper/database/csvdb");
  const db = new csvdb();

  await db.set("foo", "bar");
  await db.push("array", "x");
  await db.delete("foo");

  await db.add("number", 1);
  await db.sub("number", 1);

  await console.log(db.get("foo"));
  await console.log(db.has("foo"));
})();
```
# MongoDB 🗄️

```js
(async function () {
  const MongoDB = require("@onurege3467/zerohelper/database/mongodb");
  const db = await MongoDB.createData(
    "database",
    "collection",
    "data",
    undefined,
    "mongourl"
  );

  await db.set("foo", "bar");
  await db.push("array", "x");
  await db.delete("foo");

  await db.add("number", 1);
  await db.sub("number", 1);

  console.log(await db.get("foo"));
  console.log(await db.has("foo"));

  console.log(await db.ping());
})();
```

# MySQL 🐬

```js
(async function () {
  const MySQL = require("@onurege3467/zerohelper/database/mysql");

  const db = new MySQL();
  await db.connect({
    host: "localhost",
    port: "3306",
    user: "root",
    password: "",
    database: "database",
    charset: "utf8mb4",
  });

  db.on("connected", async () => {
    console.log("Database Connected");
  });

  await db.set("key", "value"); // Uses the default table
  await db.set("key", "value", "custom_table"); // Uses the specified table

  const value = await db.get("key"); // Uses the default table
  const valueInCustomTable = await db.get("key", "custom_table"); // Uses the specified table

  await db.add("count", 10); // Uses the default table
  await db.add("count", 10, "custom_table"); // Uses the specified table

  await db.sub("count", 5); // Uses the default table
  await db.sub("count", 5, "custom_table"); // Uses the specified table

  await db.push("array", "value"); // Uses the default table
  await db.push("array", "value", "custom_table"); // Uses the specified table

  await db.pull("array", "value"); // Uses the default table
  await db.pull("array", "value", "custom_table"); // Uses the specified table

  await db.delete("key"); // Uses the default table
  await db.delete("key", "custom_table"); // Uses the specified table

  const exists = await db.exists("key"); // Uses the default table
  const existsInCustomTable = await db.exists("key", "custom_table"); // Uses the specified table

  const includes = await db.includes("array", "value"); // Uses the default table
  const includesInCustomTable = await db.includes(
    "array",
    "value",
    "custom_table"
  ); // Uses the specified table

  const allData = await db.all(); // Uses the default table
  const allDataInCustomTable = await db.all("custom_table"); // Uses the specified table

  await db.clear(); // Clears the default table
  await db.clear("custom_table"); // Clears the specified table

  await db.drop(); // Drops the default table
  await db.drop("custom_table"); // Drops the specified table

  await db.rename("old_table", "new_table");

  const ping = await db.ping();
  console.log(`Ping: ${ping}ms`);

  // Sets MySQL global variables
  await db.variables({
    max_connections: 100000,
    wait_timeout: 60,
  });
})();
```

# SQLiteDB 📱

```js
(async function () {
  const SQLiteDB = require("@onurege3467/zerohelper/database/sqldb");

  const db = new SQLiteDB();

  await db.set("foo", "bar");
  await db.push("array", "x");
  await db.delete("foo");

  await db.add("number", 1);
  await db.sub("number", 1);

  console.log(await db.get("foo"));
  console.log(await db.has("foo"));
})();
```

# PostgreSQL 🍇

```js
(async function () {
  const PostgreSQL = require("@onurege3467/zerohelper/database/postgresql");

  const db = new PostgreSQL({
    user: "your_username",
    host: "localhost",
    database: "your_database",
    password: "your_password",
    port: 5432,
  });

  await db.set("foo", "bar");
  console.log(await db.get("foo"));
  console.log(await db.has("foo"));
  await db.delete("foo");

  await db.add("number", 10);
  await db.sub("number", 5);

  await db.set("array", []);
  await db.push("array", "value");
  console.log(await db.get("array"));

  console.log(await db.ping());

  await db.close();
})();
```

# Redis ⚡

```js
(async function () {
  const RedisDatabase = require("@onurege3467/zerohelper/database/redis");

  const db = new RedisDatabase({
    url: "redis://localhost:6379",
  });

  await db.connect();

  await db.set("user.name", "John Doe");
  console.log(await db.get("user.name"));
  console.log(await db.has("user.name"));
  await db.delete("user.name");

  await db.add("stats.score", 10);
  await db.sub("stats.score", 5);

  await db.set("items", []);
  await db.push("items", "item1");
  console.log(await db.get("items"));

  console.log(await db.ping());

  await db.close();
})();
```

## Database Migration

The `migrateData` function allows you to migrate data between different types of databases. It supports JSON, MongoDB, MySQL, SQLite, Redis, and PostgreSQL.

# Example: Migrate Data from JSON to MongoDB

```js
const migrateData = require("@onurege3467/zerohelper/database/migrate");

const sourceConfig = {
  type: "json",
  options: {
    filePath: "databases/source.json", // Path to the JSON file
  },
};

const targetConfig = {
  type: "mongodb",
  options: {
    url: "mongodb://localhost:27017", // MongoDB connection URL
    database: "targetDatabase", // Target database name
    collection: "targetCollection", // Target collection name
  },
};

(async () => {
  try {
    await migrateData(sourceConfig, targetConfig);
    console.log("Data migration completed successfully!");
  } catch (error) {
    console.error("Error during migration:", error);
  }
})();
```

# Supported Database Types and Options

```json
{
  "type": "json",
  "options": {
    "filePath": "path/to/json/file.json"
  }
}
```
```json
{
  "type": "yaml",
  "options": {
    "filePath": "data.yaml"
  }
}
```
```json
{
  "type": "csv",
  "options": {
    "filePath": "data.csv"
  }
}
```
```json
{
  "type": "mongodb",
  "options": {
    "url": "mongodb://localhost:27017",
    "database": "databaseName",
    "collection": "collectionName"
  }
}
```

```json
{
  "type": "mysql",
  "options": {
    "host": "localhost:port",
    "user": "username",
    "password": "password",
    "database": "databaseName"
  }
}
```

```json
{
  "type": "sqlite",
  "options": {
    "filePath": "path/to/sqlite/file.db"
  }
}
```

```json
{
  "type": "redis",
  "options": {
    "host": "127.0.0.1",
    "port": 6379
  }
}
```

```json
{
  "type": "postgresql",
  "options": {
    "host": "localhost",
    "user": "username",
    "password": "password",
    "database": "databaseName",
    "port": 5432
  }
}
```
