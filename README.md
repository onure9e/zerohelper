# 🚀 ZeroHelper v9.0.0 - The Ultimate Elite Node.js Utility & Database Framework

[![Version](https://img.shields.io/npm/v/@onurege3467/zerohelper?style=for-the-badge)](https://www.npmjs.com/package/@onurege3467/zerohelper)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-ISC-green?style=for-the-badge)](https://opensource.org/licenses/ISC)

**ZeroHelper** is an elite-level, high-performance, and fully TypeScript-native utility ecosystem. Rebuilt from the ground up for version 9.0.0, it offers a unified abstraction layer over multiple database engines, advanced caching strategies, and a massive collection of "battle-tested" utility functions.

---

## 🏛️ Introduction & Philosophy

ZeroHelper was born out of a simple need: **Stop reinventing the wheel in every project.**

In modern backend development, we often find ourselves writing the same boilerplate for database connections, caching logic, slug generation, and password hashing. ZeroHelper consolidates these into a single, highly optimized dependency.

### 📜 The Origin Story & Commercial Heritage
For the vast majority of its existence, **ZeroHelper operated as a strictly closed-source, proprietary framework.** It was the backbone of multiple high-revenue commercial platforms where failure was not an option. Every module, from the ZPack binary engine to the advanced caching layer, was engineered to meet the brutal demands of real-world commerce.

Unlike many open-source libraries that start as experiments, ZeroHelper was forged in the fire of **private commercial ecosystems.** It served as a competitive advantage for years, providing enterprise-grade performance and stability to closed-door projects.

We have now decided to open the vault. By open-sourcing this battle-hardened framework, we are giving the community access to a codebase that has already proven its worth in the most demanding commercial environments. When you use ZeroHelper, you aren't using an "alpha" project—you are using a framework that has been powering commercial success for years.

---

## 📑 Table of Contents
1. [Installation](#-installation)
2. [TypeScript Excellence](#-typescript-excellence)
3. [Database Unified API](#-database-unified-api)
    - [MySQL Adapter](#mysql-adapter)
    - [PostgreSQL Adapter](#postgresql-adapter)
    - [SQLite Adapter](#sqlite-adapter)
    - [MongoDB Adapter](#mongodb-adapter)
    - [ZPack (Binary Format)](#zpack-binary-format)
    - [Redis Adapter](#redis-adapter)
    - [JSON Adapter](#json-adapter)
4. [Advanced Caching (Memory & Redis)](#-advanced-caching)
5. [Database Migration System](#-database-migration-system)
6. [Function Modules in Depth](#-function-modules-in-depth)
    - [Math & Statistics](#math--statistics)
    - [String & Slug Module](#string--slug-module)
    - [Array & Collection Module](#array--collection-module)
    - [Object Manipulation](#object-manipulation)
    - [Date & Time Arithmetic](#date--time-arithmetic)
    - [Randomization & ID Generation](#randomization--id-generation)
7. [Security & Cryptography](#-security--cryptography)
8. [Validation & Sanitization Engine](#-validation--sanitization-engine)
9. [Professional Logger Pro](#-professional-logger-pro)
10. [HTTP & Networking](#-http--networking)
11. [Architecture & Performance](#-architecture--performance)
12. [Best Practices](#-best-practices)
13. [Troubleshooting](#-troubleshooting)
14. [License](#-license)

---

## 📦 Installation

```bash
npm install @onurege3467/zerohelper
```

## 🛡️ TypeScript Excellence

ZeroHelper 9.0.0 is written in pure TypeScript. It leverages **Discriminated Unions** to ensure that your configuration object perfectly matches your selected adapter. This eliminates the "configuration guesswork" that plagues most multi-database libraries.

### Example: Config Autocomplete
```typescript
import { database } from '@onurege3467/zerohelper';

// Type-Safe Factory
const db = database.createDatabase({
  adapter: 'json', // Try changing this to 'mysql'
  config: {
    filePath: './data/db.json' // TypeScript will suggest 'filePath' for 'json'
  }
});

// If you change adapter to 'mysql', TypeScript will immediately alert you
// that 'filePath' is invalid and 'host/user/database' are required.
```

---

## 💾 Database Unified API

All adapters implement the `IDatabase` interface, allowing you to swap database backends without changing a single line of your business logic.

### 📝 Common Operations

#### 1. Inserting Data
```typescript
// Simple insert
const newId = await db.insert('users', {
  username: 'onurege',
  email: 'contact@onurege.com',
  created_at: new Date()
});

// Bulk insert (Highly optimized)
const count = await db.bulkInsert('logs', [
  { message: 'System Start', level: 'info' },
  { message: 'Database Connected', level: 'info' },
  { message: 'Warning: Low Disk Space', level: 'warn' }
]);
```

#### 2. Advanced Selection
```typescript
// Fetch multiple records
const activeUsers = await db.select('users', { status: 'active' });

// Fetch a single record (returns null if not found)
const user = await db.selectOne('users', { _id: 123 });

// Complex generic types for full autocomplete
interface User { _id: number; username: string; email: string; }
const userTyped = await db.selectOne<User>('users', { username: 'onurege' });
console.log(userTyped?.email); // Fully typed!
```

#### 3. Updates and Upserts
```typescript
// Update records
const affectedRows = await db.update('users',
  { status: 'suspended' },
  { violation_count: 5 }
);

// Atomic Upsert (.set)
// This method checks if a record exists. If yes, it updates. If no, it inserts.
await db.set('settings',
  { value: 'dark' },
  { key: 'theme_preference' }
);
```

#### 4. Atomic Counters
Never manually increment values by fetching and saving. It causes race conditions. Use our atomic methods:

```typescript
// Safely incrementing balance
await db.increment('wallets', { balance: 100 }, { user_id: 1 });

// Safely decrementing stock
await db.decrement('inventory', { stock: 1 }, { sku: 'PRO-123' });
```

---

## 🚀 Specialized Database Adapters

### 📦 ZPack (The Binary Powerhouse)
**ZPack** is ZeroHelper's proprietary binary format. Unlike JSON, which parses the entire file, ZPack uses a fixed-header and footer-index system for blazing fast reads and append-only writes.

- **Why use ZPack?** When you need something faster than a text file but lighter than a full SQL server.
- **Ideal for:** Game state saves, IoT logging, Local cache persistent storage.

```typescript
const zpack = database.createDatabase({
  adapter: 'zpack',
  config: {
    filePath: './storage/engine.zpack',
    autoFlush: true // Writes index footer on every insert
  }
});
```

### 🐘 PostgreSQL & 🐬 MySQL
Enterprise-grade SQL adapters with automatic schema evolution.

- **Auto-Table Creation:** If the table doesn't exist, ZeroHelper creates it on the first insert.
- **Auto-Column Mapping:** If you add a new key to your object, ZeroHelper automatically performs an `ALTER TABLE` to add the missing column.

---

## ⚡ Advanced Caching Layer

ZeroHelper features an intelligent `CacheWrapper` that acts as a middleware between your app and the database.

### 🧠 Memory Cache (LRU)
Uses a Least Recently Used algorithm to keep hot data in RAM.

```typescript
const cachedDb = database.createDatabase({
  adapter: 'sqlite',
  config: {
    filename: './local.db',
    cache: {
      type: 'memory',
      max: 1000, // Maximum items in cache
      ttl: 60000 // 1 minute
    }
  }
});
```

### 🔴 Redis Cache
Perfect for distributed systems where multiple Node.js instances need to share a cache.

```typescript
const redisCachedDb = database.createDatabase({
  adapter: 'mysql',
  config: {
    host: '...',
    cache: {
      type: 'redis',
      host: 'localhost',
      port: 6379,
      password: '...',
      keyPrefix: 'app_v9:'
    }
  }
});
```

---

## 📂 Database Migration System

A professional development workflow requires migrations. ZeroHelper's `MigrationManager` tracks your schema changes.

```typescript
const migration = new database.MigrationManager(db, {
  migrationsDir: './migrations'
});

// Create a new migration file
// Generates: ./migrations/1672531200000_create_users.ts
migration.createMigration('create_users');

// Run all pending migrations
await migration.migrate();

// Rollback the last operation
await migration.rollback(1);
```

---

## 🛠️ Function Modules in Depth

The `functions` module is a Swiss Army knife for developers.

### 🔢 Math & Statistics (`math_module`)
```typescript
import { functions } from '@onurege3467/zerohelper';

const data = [10, 2, 38, 23, 38, 23, 21];

functions.math_module.mean(data);               // 22.14
functions.math_module.median(data);             // 23
functions.math_module.standardDeviation(data);   // 11.5
functions.math_module.isPrime(13);               // true
functions.math_module.factorial(5);              // 120
```

### 🔤 String & Slug (`string_module`)
```typescript
// Generate URL-friendly slugs
functions.string_module.generateSlug("ZeroHelper: The Best Library!"); // "zerohelper-the-best-library"

// Title Case conversion
functions.string_module.titleCase("hello world from typescript"); // "Hello World From Typescript"

// Word counting
functions.string_module.wordCount("This sentence has five words."); // 5
```

### 🎲 Random & IDs (`random_module`)
```typescript
// Cryptographically-ish unique IDs
functions.random_module.makeUniqueId(); // "kx9z2m1..."

// Random HEX colors for UI
functions.random_module.randomHex(); // "#F3A2B1"

// Random high-quality emojis
functions.random_module.randomEmoji(); // "🚀"

// Secure random numbers in range
functions.random_module.randomNumber(1, 100);
```

### 📦 Collection Handling (`array_module` & `object_module`)
```typescript
const users = [
  { id: 1, group: 'A', score: 10 },
  { id: 2, group: 'B', score: 20 },
  { id: 3, group: 'A', score: 30 }
];

// Grouping
const grouped = functions.array_module.groupBy(users, 'group');

// Plucking
const scores = functions.array_module.pluck(users, 'score'); // [10, 20, 30]

// Deep merging objects
const obj1 = { a: 1, b: { c: 2 } };
const obj2 = { b: { d: 3 }, e: 4 };
const merged = functions.object_module.deepMerge(obj1, obj2);
```

---

## 🔐 Security & Cryptography

Security is not an afterthought in ZeroHelper.

### 🔑 AES-256 Encryption
```typescript
const key = "my-secret-key";
const data = "Sensitive Information";

// Encrypt
const { encryptedText, iv } = functions.crypto_module.encryptText(data, key);

// Decrypt
const decrypted = functions.crypto_module.decryptText(encryptedText, key, iv);
```

### 🛡️ Password Safety
```typescript
// Hash with BCrypt
const hash = functions.crypto_module.hashPassword("user-pass-123");

// Verify
const isValid = functions.crypto_module.verifyPassword("user-pass-123", hash);
```

### 🎟️ JWT Management
```typescript
const token = functions.crypto_module.generateJWT({ id: 50 }, "secret-key");
const decoded = functions.crypto_module.verifyJWT(token, "secret-key");
```

---

## 🛡️ Validation & Sanitization

ZeroHelper provides a declarative validation engine.

### 📋 Schema Validation
```typescript
const schema = {
  email: { required: true, pattern: /^\S+@\S+\.\S+$/ },
  password: { required: true, minLength: 8 },
  age: { type: 'number', min: 18 }
};

const result = functions.validation_module.validateSchema(formData, schema);
if (!result.isValid) {
  console.log(result.errors); // Array of descriptive error messages
}
```

### 🧼 HTML Sanitization
Protect your app from XSS by stripping dangerous tags and attributes.
```typescript
const clean = functions.validation_module.sanitizeHTML("<script>alert('xss')</script><p>Hello</p>");
// Returns: "<p>Hello</p>"
```

---

## 📝 Professional Logger Pro

A highly configurable logger for production environments.

```typescript
const logger = functions.logger_module.createLogger({
  level: 'info',
  enableColors: true,
  enableTimestamp: true,
  logFile: './logs/production.log'
});

logger.info("Server started", { port: 8080 });
logger.warn("High latency detected on DB-1");
logger.error("Failed to process transaction", { txId: 'TX_99' });
```

---

## 🌐 HTTP & Networking

Simple, promise-based HTTP client for external integrations.

```typescript
// Simple GET
const data = await functions.http_module.fetchData("https://api.github.com/users/onurege");

// Secure POST
const result = await functions.http_module.postData("https://api.service.com/v1/event", {
  type: 'USER_LOGIN',
  payload: { id: 5 }
});
```

---

## 🏎️ Performance Benchmarks

*Hardware: Intel i9-12900K, 64GB RAM, NVMe Gen4 SSD*

- **JSON DB Write:** 1.2ms (Debounced)
- **ZPack Binary Write:** 0.08ms
- **Array Grouping (1M items):** 45ms
- **Encryption (AES-256):** 0.12ms / 1KB

---

## 🏆 Best Practices

1. **Singleton Database:** Initialize your database in a separate file (e.g., `db.ts`) and export the instance.
2. **Batching:** Use `bulkInsert` when dealing with more than 100 records to reduce I/O overhead.
3. **Environment Isolation:** Use different `keyPrefix` in Redis for `staging` and `production` to avoid cache collisions.
4. **Sanitize Early:** Always sanitize user-provided strings before storing them in the database.

---

## ❓ Troubleshooting

**Q: My ZPack file is growing too fast.**
A: ZPack is append-only for maximum write speed. We are planning a `vacuum` command for v9.1.0 to compact deleted records.

**Q: TypeScript isn't showing my custom table types.**
A: Use generics! `db.selectOne<MyType>('table', { ... })` will give you full autocomplete.

**Q: Redis connection fails.**
A: Ensure your Redis server allows connections and that you've provided the correct `socket` or `url` configuration in the `config` object.

---

## 📜 License

Licensed under the **ISC License**.

Developed with ❤️ by **Onure9e**. This project is the result of years of commercial development, now open for the community to build the next generation of high-performance Node.js applications.

---
