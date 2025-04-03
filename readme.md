# ZeroHelper

ZeroHelper is a package with database and some functions.

## Installing ZeroHelper

```bash
npm i @onurege3467/zerohelper
```

## Using ZeroHelper for helper functions

```js
var { functions } = require("@onurege3467/zerohelper");

console.log(functions.makeUniqueId()); // returns like this m63ku5dsi45hppk24i
console.log(functions.uid.uuid()); // returns a uuid like 280fbb78-913a-4694-9b7b-f44eb74deb28
console.log(functions.uid.isUUID("some text")); // returns true or false
console.log(functions.randomArray([1, 2, 3, 4, 5])); // selects random variable in this array
console.log(functions.randomEmoji()); // returns a random emoji
console.log(functions.randomHex()); // returns a random hex code
console.log(functions.randomNumber()); // returns random number
console.log(functions.randomText()); // returns random text
console.log(functions.shuffleArray([1, 2, 3, 4, 5, 6, 7, 8, 9, 0])); // returns shuffled array like [3,5,2,1,7,6,8,9,0]
console.log(functions.titleCase("HellO tHis iS DEMO teXt")); // returns Hello This Is Demo Text
```

## Using ZeroHelper As Database

ZeroHelper's database is divided into 3 parts.

### Firtst Step

```js
const zerohelper = require("@onurege3467/zerohelper"); // if you don't do this the functions may crush
```

### 1. JsonDatabase

```js
const JsonDatabase = require("@onurege3467/zerohelper/database/jsondatabase");
const db = new JsonDatabase();

db.set("foo", "bar"); // sets foo to bar
db.push("array", "x"); // pushs x to array
db.delete("foo"); // deletes foo

db.add("number", 1); // adds 1 to number
db.sub("number", 1); // subtracts 1 from number

db.get("foo"); // gets foo value
db.has("foo"); // returns true or false
```

### 2. MongoDB

```js
(async function () {
  const MongoDB = require("@onurege3467/zerohelper/database/mongodb");
  var db = await MongoDB.createData(
    "database",
    "collection",
    "data",
    undefined,
    "mongourl"
  );
  db.set("foo", "bar"); // sets foo to bar
  db.push("array", "x"); // pushs x to array
  db.delete("foo"); // deletes foo

  db.add("number", 1); // adds 1 to number
  db.sub("number", 1); // subtracts 1 from number

  db.get("foo"); // gets foo value
  db.has("foo"); // returns true or false

  db.ping(); // returns database ping
})();
```

### 3. MySQL

```js
(async function () {
  const mysql = require("@onurege3467/zerohelper/database/mysql");

  const db = new mysql();
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

  db.set("table", "foo", "bar"); // sets foo to bar
  db.push("table", "array", "x"); // pushs x to array
  db.delete("table", "foo"); // deletes foo

  db.add("table", "number", 1); // adds 1 to number
  db.sub("table", "number", 1); // subtracts 1 from number

  db.get("table", "foo"); // gets foo value
  db.has("table", "foo"); // returns true or false

  db.ping(); // returns database ping
})();
```

### 3. SQLiteDB

```js
(async function () {
  const SQLDB = require("@onurege3467/zerohelper/database/sqldb");

  const db = new SQLDB();

  await db.initialize();

  db.set("table", "foo", "bar"); // sets foo to bar
  db.push("table", "array", "x"); // pushs x to array
  db.delete("table", "foo"); // deletes foo

  db.add("table", "number", 1); // adds 1 to number
  db.sub("table", "number", 1); // subtracts 1 from number

  db.get("table", "foo"); // gets foo value
  db.has("table", "foo"); // returns true or false
})();
```
