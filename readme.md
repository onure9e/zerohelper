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
   - [🗄️ MongoDB](#mongodb-️)
   - [🐬 MySQL](#mysql-)
   - [📱 SQLiteDB](#sqlitedb-)
   - [🍇 PostgreSQL](#postgresql-)
   - [⚡ Redis](#redis-)

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

  await db.set("table", "foo", "bar");
  await db.push("table", "array", "x");
  await db.delete("table", "foo");

  await db.add("table", "number", 1);
  await db.sub("table", "number", 1);

  console.log(await db.get("table", "foo"));
  console.log(await db.has("table", "foo"));

  console.log(await db.ping());
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
