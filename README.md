# 🚀 ZeroHelper - The Ultimate Elite Node.js Utility & Database Framework

[![Version](https://img.shields.io/npm/v/@onurege3467/zerohelper?style=for-the-badge)](https://www.npmjs.com/package/@onurege3467/zerohelper)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-ISC-green?style=for-the-badge)](https://opensource.org/licenses/ISC)

**ZeroHelper** is an elite-level, high-performance, and fully TypeScript-native utility ecosystem. Rebuilt from the ground up for version 10.2.6, it offers a unified abstraction layer over multiple database engines, advanced caching strategies, and a massive collection of "battle-tested" utility functions.

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
    - [ZPack (High Performance Binary)](#zpack-binary)
    - [TOON (Native Object Notation DB)](#toon-db)
    - [SQL Adapters (MySQL, PostgreSQL, SQLite)](#sql-adapters)
    - [NoSQL Adapters (MongoDB, Redis)](#nosql-adapters)
    - [JSON Adapter](#json-adapter)
4. [Advanced Caching (Memory & Redis)](#-advanced-caching)
5. [Database Lifecycle Hooks](#-database-lifecycle-hooks)
6. [Telemetry & Performance Tracking](#-telemetry--performance-tracking)
7. [Database Migration System](#-database-migration-system)
8. [ZeroWorker (Worker Threads)](#-zeroworker-worker-threads)
9. [Zero-CLI Management Tool](#-zero-cli)
    - [Project Initialization](#project-initialization)
    - [Database Management](#database-management)
    - [Migration Management](#migration-management)
    - [Cache Management](#cache-management)
    - [Data Export/Import](#data-exportimport)
    - [Interactive REPL](#interactive-repl)
10. [Data Seeder](#-data-seeder)
11. [Function Modules in Depth](#-function-modules-in-depth)
    - [TOON Module](#toon-module)
    - [Math & Statistics](#math-module)
    - [String & Slug Module](#string-module)
    - [Array & Collection Module](#array-module)
    - [AI Module](#ai-module)
    - [Security & Cryptography](#security-cryptography)
12. [Validation & Sanitization Engine](#-validation--sanitization-engine)
13. [Professional Logger Pro](#-professional-logger-pro)
14. [HTTP & Networking](#-http--networking)
15. [Real-World Use Cases](#-real-world-use-cases)
16. [Frequently Asked Questions](#-frequently-asked-questions)
17. [Architecture & Performance Benchmarks](#-architecture--performance)
18. [Best Practices](#-best-practices)
19. [Troubleshooting](#-troubleshooting)
20. [License](#-license)

---

## 📦 Installation

```bash
npm install @onurege3467/zerohelper
```

---

## 🛡️ TypeScript Excellence

ZeroHelper 10.2.6 leverages **Discriminated Unions** to ensure that your configuration object perfectly matches your selected adapter. This eliminates the "configuration guesswork" that plagues most multi-database libraries.

### Example: Config Autocomplete
```typescript
import { database } from '@onurege3467/zerohelper';

const db = database.createDatabase({
  adapter: 'zpack',
  config: {
    path: './data.zpack',
    indexFields: { 'users': ['email'] },
    autoFlush: true
  }
});
```

---

## 💾 Database Unified API

All adapters implement the `IDatabase` interface, allowing you to swap database backends without changing a single line of your business logic.

### 📝 Common Operations

#### 1. Inserting Data
```typescript
const newId = await db.insert('users', {
  username: 'onurege',
  email: 'contact@onurege.com',
  created_at: new Date()
});

const count = await db.bulkInsert('logs', [
  { message: 'System Start', level: 'info' },
  { message: 'Database Connected', level: 'info' }
]);
```

#### 2. Advanced Selection
```typescript
interface User { _id: number; username: string; email: string; }
const user = await db.selectOne<User>('users', { username: 'onurege' });
```

#### 3. Atomic Counters
```typescript
await db.increment('wallets', { balance: 100 }, { user_id: 1 });
await db.decrement('inventory', { stock: 1 }, { sku: 'PRO-123' });
```

#### 4. Upsert Operations
```typescript
await db.set('settings', { value: 'dark' }, { key: 'theme' });
```

---

## 🚀 Specialized Database Adapters

### 🏎️ ZPack (The Binary Powerhouse)

ZPack is ZeroHelper's proprietary binary format engineered for **maximum write performance** and **minimum storage footprint**.

#### Key Features
- **Ultra-Fast Writes**: 0.08ms average write latency
- **zlib Compression**: 40-60% smaller file sizes
- **Vacuum Operation**: Eliminate fragmentation from deleted records
- **Secondary Indexing**: Instant lookups on indexed fields
- **Auto-Flush**: Configurable write-through behavior

#### When to Use ZPack
- High-volume event logging
- Audit trail storage
- Data archival and backup
- Time-series data (with vacuum maintenance)

#### Example
```typescript
const zpack = database.createDatabase({
  adapter: 'zpack',
  config: {
    path: './storage/events.zpack',
    indexFields: { 'events': ['event_type', 'user_id'] },
    autoFlush: true
  }
});

await zpack.insert('logs', { timestamp: new Date(), level: 'info', message: 'Event' });

await zpack.vacuum();
```

### 📊 TOON (World's First Native TOON Database)

ZeroHelper introduces the **world's first native TOON (Token-Oriented Object Notation) database** - a revolutionary format optimized for both humans and AI.

#### Why TOON?

| Feature | JSON | YAML | TOON |
|---------|------|------|------|
| Human Readable | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Parse Speed | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| Token Efficiency | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| AI-Optimized | ❌ | ❌ | ⭐⭐⭐⭐⭐ |
| File Size | Medium | Large | Small |

#### TOON Syntax Example
```toon
users:
  name: John
  age: 25
  active: true

products:
  [3]{name,price,stock}:
    Laptop,1500,10
    Mouse,25,100
    Keyboard,75,50
```

#### LLM Token Savings
```
JSON:  {"users":[{"name":"John","age":25,"active":true}]} = 47 tokens
TOON:  users: name: John age: 25 active: true         = 12 tokens

Savings: ~75% reduction in token usage!
```

#### Use Cases
- AI/LLM application data storage
- Configuration files
- Prompt engineering templates
- Agent memory and context

#### Example
```typescript
const toonDb = database.createDatabase({
  adapter: 'toon',
  config: {
    path: './ai-data.toon',
    saveInterval: 1000
  }
});

await toonDb.insert('prompts', { system: 'You are helpful...', temperature: 0.7 });
```

### 🐘 PostgreSQL & 🐬 MySQL

Enterprise-grade SQL adapters with automatic schema evolution.
- **Auto-Table/Column Creation**: ZeroHelper creates missing tables and performs `ALTER TABLE` automatically when new keys are detected in your data.

### 🍃 MongoDB & 💚 Redis

Flexible NoSQL adapters for document storage and caching.

---

## ⚡ Advanced Caching Layer

Supports **Local LRU Memory** and **Remote Redis**. It automatically invalidates cache on writes.

```typescript
const db = database.createDatabase({
  adapter: 'mysql',
  config: {
    host: 'localhost',
    cache: {
      type: 'redis',
      host: '127.0.0.1',
      ttl: 300000
    }
  }
});
```

---

## 🪝 Database Lifecycle Hooks

Register global hooks to monitor or modify data flow.
```typescript
db.on('beforeInsert', (table, data) => {
  console.log(`Inserting into ${table}...`);
  data.updated_at = Date.now();
});

db.on('afterUpdate', (table, result) => {
  console.log(`Table ${table} updated. Rows affected: ${result.affected}`);
});
```

---

## 📊 Telemetry & Performance Tracking

Monitor your system health and operation latencies in real-time.
```typescript
const metrics = db.getMetrics();
console.log(`Avg Database Latency: ${metrics.database.averageDuration}`);
console.log(`Cache Hit Ratio: ${metrics.cache.ratio}`);
```

---

## 📂 Database Migration System

A professional workflow for schema changes.
```typescript
const migration = new database.MigrationManager(db);
migration.createMigration('add_profile_pictures');
await migration.migrate();
```

---

## 🧵 ZeroWorker (Worker Threads)

Run heavy CPU-bound tasks in the background without blocking the event loop.
```typescript
import { functions } from '@onurege3467/zerohelper';

const result = await functions.worker_module.runAsyncTask(
  "(data) => { return data.map(x => x * 2); }",
  [1, 2, 3]
);
```

---

## 🛠️ Zero-CLI

A professional command-line interface to manage your database and ZeroHelper framework.

### 📋 Available Commands

#### **Project Initialization**
```bash
npx zero init
```

#### **Database Management**
```bash
npx zero db:test
npx zero db:stats
npx zero db:seed --table users --count 100
npx zero db:backup
npx zero db:backup --output ./custom-backups
npx zero db:restore ./backups/backup_2024-01-01.zerohelper.json
```

#### **Migration Management**
```bash
npx zero migrate
npx zero migration:rollback --steps 1
npx zero migration:status
npx zero make:migration create_users_table
```

#### **Cache Management**
```bash
npx zero cache:clear
npx zero cache:stats
```

#### **Data Export/Import**
```bash
npx zero db:export --table users --format json
npx zero db:export --table users --format csv --output ./exports/users.csv
npx zero db:import ./exports/users.csv --table users --format csv
npx zero db:import ./exports/users.json --table users --format json
```

#### **ZPack Maintenance**
```bash
npx zero zpack:vacuum ./data.zpack
```

#### **Interactive REPL**
```bash
npx zero repl
```
**Available REPL commands:**
- `.exit` - Exit REPL
- `.help` - Show available commands
- `.stats` - Show database stats
- `.metrics` - Show performance metrics
- `.clear` - Clear screen
- `select <table>` - Select all from table
- `count <table>` - Count records in table

#### **Global Options**
- `-c, --config <path>` - Path to config file (default: `zero.config.ts`)
- `-h, --help` - Show help for command
- `-V, --version` - Output version number

---

## 📥 Data Seeder

Populate your database with realistic mock data in seconds.

### Programmatic Usage
```typescript
const seeder = new database.DataSeeder(db);
await seeder.seed('users', 100, {
  email: { type: 'email' },
  age: { type: 'number', min: 18, max: 65 },
  isActive: { type: 'boolean' }
});
```

### CLI Usage
```bash
npx zero db:seed --table users --count 100
```

### Supported Field Types
- `string` - Random string with configurable length
- `number` - Random number within min/max range
- `email` - Random email address with various domains
- `boolean` - Random true/false value
- `date` - Random date within the last decade
- `id` - Unique ID string
- `pick` - Random value from provided array

---

## 🛠️ Function Modules in Depth

### 📄 TOON Module
Standard API matching the native `JSON` object for zero learning curve.
```typescript
import { functions } from '@onurege3467/zerohelper';

const str = functions.toon_module.stringify({ a: 1, b: 2 });
const obj = functions.toon_module.parse(str);
```

### 🔢 Math & Statistics (`math_module`)
```typescript
const data = [10, 2, 38, 23, 21];
functions.math_module.mean(data);
functions.math_module.standardDeviation(data);
functions.math_module.isPrime(13);
```

### 🔤 String & Slug Module (`string_module`)
```typescript
functions.string_module.generateSlug("ZeroHelper: The Best!");
functions.string_module.titleCase("hello world");
```

### 🎲 Random Module (`random_module`)
```typescript
functions.random_module.makeUniqueId();
functions.random_module.randomHex();
functions.random_module.randomEmoji();
```

### 🌐 HTTP Module (`http_module`)
```typescript
const data = await functions.http_module.fetchData('https://api.example.com/data');
const response = await functions.http_module.postData('https://api.example.com/post', { key: 'value' });
```

### 📅 Date Module (`date_module`)
```typescript
functions.date_module.formatDate(new Date(), 'YYYY-MM-DD');
functions.date_module.addDays(new Date(), 5);
functions.date_module.dateDifference(date1, date2);
```

### 🛠️ Array Module (`array_module`)
```typescript
functions.array_module.shuffleArray([1, 2, 3, 4, 5]);
functions.array_module.groupBy(users, 'role');
functions.array_module.pluck(users, 'email');
functions.array_module.sortBy(users, 'name');
```

### 🔧 Object Module (`object_module`)
```typescript
functions.object_module.deepMerge(obj1, obj2);
functions.object_module.filterObjectByKey(obj, ['name', 'email']);
```

### 🤖 AI Module (`ai_module`)

LLM/AI çalışmaları için yardımcı utility fonksiyonları. Token hesaplama, prompt yönetimi, maliyet tahmini ve context optimizasyonu.

#### Token İşlemleri
```typescript
// Yaklaşık token sayısı hesaplama
const tokens = functions.ai_module.estimateTokens("Hello world this is a test");

// Metni token limitine göre kırpma
const truncated = functions.ai_module.truncateToTokenLimit(longText, 1000);

// Metni parçalara bölme
const chunks = functions.ai_module.splitByTokenLimit(longText, 4000);
```

#### Prompt Yönetimi
```typescript
// Chat mesajı formatlama
const message = functions.ai_module.formatChatMessage('user', 'Hello');

// Few-shot prompt oluşturma
const prompt = functions.ai_module.createFewShotPrompt([
  { input: '2+2?', output: '4' },
  { input: '3+3?', output: '6' }
], '4+4?');

// Sistem ve kullanıcı mesajlarını birleştirme
const messages = functions.ai_module.mergeSystemAndUser(
  'You are a helpful assistant',
  'What is the weather?'
);
```

#### Context & Conversation Yönetimi
```typescript
// Mesajları context penceresine sığdırma
const fitted = functions.ai_module.fitMessagesToContext(messages, 8000);

// Konuşma geçmişini sıkıştırma
const compressed = functions.ai_module.compressConversationHistory(messages, 4);
```

#### Maliyet Hesaplama
```typescript
// Konuşma maliyetini tahmin etme
const cost = functions.ai_module.estimateConversationCost(messages, 'gpt-4');
console.log(cost.totalCost); // USD cinsinden toplam maliyet

// Model bilgileri
const limit = functions.ai_module.getModelTokenLimit('gpt-4o'); // 128000
const pricing = functions.ai_module.getModelPricing('claude-3-sonnet');
```

#### Output İşlemleri
```typescript
// Markdown'dan JSON çıkarma
const json = functions.ai_module.extractJSONFromMarkdown('```json\n{"key": "value"}\n```');

// Streaming response parse etme
const chunk = functions.ai_module.parseStreamingChunk('data: {"choices": [{"delta": {"content": "Hello"}}]}');
```

#### Utility Fonksiyonlar
```typescript
// Token limit kontrolü
if (functions.ai_module.isTokenLimitExceeded(prompt, 4000)) {
  // Prompt çok uzun
}

// Yüzdeye göre kısaltma
const shorter = functions.ai_module.truncatePromptByPercentage(prompt, 50); // %50 kısalt
```

---

## 🔐 Security & Cryptography

### Password Handling
```typescript
const hash = functions.crypto_module.hashPassword('securePassword123');
const isValid = functions.crypto_module.verifyPassword('securePassword123', hash);
```

### Text Encryption (AES-256-CBC)
```typescript
const { encryptedText, iv } = functions.crypto_module.encryptText('secret', 'mySecretKey');
const original = functions.crypto_module.decryptText(encryptedText, 'mySecretKey', iv);
```

### JWT Tokens
```typescript
const token = functions.crypto_module.generateJWT({ userId: 1 }, 'jwtSecret');
const payload = functions.crypto_module.verifyJWT(token, 'jwtSecret');
```

### Rate Limiting

#### Memory-based (Single Instance)
```typescript
const result = await functions.security_module.checkRateLimit('user:1', {
  limit: 10,
  window: 60,
  storage: 'memory'
});
console.log(result.allowed); // true or false
```

#### Redis-based (Distributed Systems)
```typescript
const result = await functions.security_module.checkRateLimit('api:192.168.1.1', {
  limit: 100,
  window: 60,
  storage: 'redis',
  redisClient: redisDb
});
```

### Additional Security Functions
```typescript
functions.crypto_module.isPasswordStrong('MySecureP@ss123');
functions.crypto_module.validateUUID('550e8400-e29b-41d4-a716-446655440000');
functions.crypto_module.generateSalt();
```

---

## 🛡️ Validation & Sanitization Engine

### Schema Validation
```typescript
const schema = {
  email: { required: true, type: 'string', pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  age: { required: false, type: 'number', min: 18, max: 120 },
  password: { required: true, type: 'string', minLength: 8 }
};

const result = functions.validation_module.validateSchema(data, schema);
console.log(result.isValid);
console.log(result.errors);
```

### Input Sanitization
```typescript
const clean = functions.validation_module.sanitizeInput(userInput, {
  trim: true,
  removeHTML: true,
  escape: true
});
```

### Utilities
```typescript
functions.validation_module.isEmail('test@example.com');
functions.validation_module.isPhone('+1234567890');
functions.validation_module.isURL('https://example.com');
functions.validation_module.sanitizeHTML('<script>alert("xss")</script>');
functions.validation_module.validateCreditCard('4111111111111111');
```

---

## 📝 Professional Logger Pro

```typescript
import { functions } from '@onurege3467/zerohelper';

const logger = functions.logger_module.createLogger({
  level: 'info',
  enableColors: true,
  enableTimestamp: true,
  logFile: './app.log'
});

logger.info('User logged in', { userId: 123 });
logger.warn('Rate limit approaching', { remaining: 10 });
logger.error('Database connection failed', { error: err.message });
logger.debug('Cache hit', { key: 'user:123' });
```

### Quick Logging Functions
```typescript
functions.logger_module.info('Message');
functions.logger_module.warn('Message');
functions.logger_module.error('Message');
functions.logger_module.debug('Message');
```

---

## 🏎️ Performance Benchmarks
*Hardware: Intel i9-12900K, 64GB RAM*
- **ZPack Binary Write:** 0.08ms
- **TOON Serialization:** 0.15ms / 1KB
- **Array Grouping (1M items):** 45ms

---

## 🎯 Real-World Use Cases

### E-Commerce Application
```typescript
const db = database.createDatabase({
  adapter: 'postgres',
  config: {
    host: 'localhost',
    user: 'admin',
    password: 'secure',
    database: 'shop',
    cache: { type: 'redis', host: '127.0.0.1', ttl: 300000 }
  }
});

await db.insert('products', { name: 'Laptop', price: 1500, stock: 10 });
await db.decrement('products', { stock: 1 }, { sku: 'PROD-001' });
await db.increment('orders', { total: 1500 }, { orderId: 1001 });

const hash = functions.crypto_module.hashPassword(userPassword);
await db.insert('users', { email, password: hash });
```

### AI/LLM Applications with TOON
```typescript
const toonDb = database.createDatabase({
  adapter: 'toon',
  config: { path: './ai-data.toon' }
});

await toonDb.insert('prompts', {
  system: 'You are a helpful assistant designed for customer support.',
  examples: [...],
  temperature: 0.7,
  maxTokens: 1000
});

const prompts = toonDb.select('prompts', { category: 'support' });
```

### High-Performance Logging with ZPack
```typescript
const zpack = database.createDatabase({
  adapter: 'zpack',
  config: { path: './logs.zpack', autoFlush: true }
});

await zpack.insert('events', {
  timestamp: new Date(),
  level: 'info',
  message: 'User action recorded',
  userId: 123,
  action: 'purchase',
  amount: 99.99
});

await zpack.vacuum();
```

### Distributed API Protection
```typescript
import { database } from '@onurege3467/zerohelper';

const redisDb = database.createDatabase({
  adapter: 'redis',
  config: { host: '127.0.0.1', port: 6379 }
});

async function handleApiRequest(ip: string) {
  const rateLimit = await functions.security_module.checkRateLimit(`api:${ip}`, {
    limit: 1000,
    window: 3600,
    storage: 'redis',
    redisClient: redisDb
  });

  if (!rateLimit.allowed) {
    throw new Error('Rate limit exceeded');
  }

  return processRequest();
}
```

---

## ❓ Frequently Asked Questions

### Q: Which adapter should I choose?

**A:**
- **ZPack**: High-volume logging, archival, audit trails
- **TOON**: AI/LLM applications, configs, human-readable needs
- **JSON**: Development, small projects, prototyping
- **SQLite**: Desktop apps, single-user applications
- **PostgreSQL/MySQL**: Web applications, enterprise systems
- **MongoDB**: Flexible document schemas, content management
- **Redis**: Caching, sessions, real-time features

### Q: How does TOON save tokens for LLMs?

**A:** TOON uses compact syntax like `[3]{name,age}: John,25 Jane,30 Bob,28` instead of verbose JSON arrays. This reduces token count by 30-60% while maintaining full data fidelity and human readability.

### Q: Is ZPack suitable for concurrent access?

**A:** ZPack is optimized for single-writer scenarios. For multi-threaded logging, consider using SQLite or a dedicated logging service with ZPack for archival.

### Q: Can I migrate between adapters?

**A:** Yes! All adapters implement the IDatabase interface. Export data using `db:export` CLI command and import to any other adapter.

### Q: What's the difference between memory and Redis rate limiting?

**A:** Memory storage is fast and suitable for single-instance applications. Redis storage enables distributed rate limiting across multiple server instances.

### Q: Does ZeroHelper support transactions?

**A:** SQL adapters (PostgreSQL, MySQL, SQLite) support transactions. NoSQL and file-based adapters have atomic operations but not full ACID transactions.

---

## 🏁 Final Words

**ZeroHelper** is the result of years of private commercial development, now open for the community to build the next generation of high-performance Node.js applications.

Developed with ❤️ by **Onure9e**. Built for excellence.

---

## 📜 License

Licensed under the [ISC License](LICENSE).
