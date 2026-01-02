import dotenv from 'dotenv'
import path from 'path';
import fs from 'fs';
import createDatabase, { IDatabase } from '../../database';
import { DatabaseOptions } from '../../database/types';
dotenv.config()
// Test edilecek adaptörlerin listesini hazırla
const adaptersToTest: { name: string; options: DatabaseOptions; setup?: () => Promise<void>; teardown?: () => Promise<void> }[] = [];

// Helper to cast config safely for tests
const createOption = (adapter: any, config: any): DatabaseOptions => ({ adapter, config } as any);

// 1. MySQL Configuration
if (process.env.TEST_MYSQL_ENABLED === 'true') {
  if (process.env.MYSQL_USER) {
    adaptersToTest.push({
      name: 'MySQL',
      options: createOption('mysql', {
        host: process.env.MYSQL_HOST,
        port: Number(process.env.MYSQL_PORT),
        username: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DB,
        poolSize: 5,
      })
    });
  } else {
    console.warn('⚠ MySQL enabled but MYSQL_USER is missing. Skipping MySQL tests.');
  }
}

// 2. PostgreSQL Configuration
if (process.env.TEST_POSTGRES_ENABLED === 'true') {
  if (process.env.PG_USER) {
    adaptersToTest.push({
      name: 'PostgreSQL',
      options: createOption('postgres', {
        host: process.env.PG_HOST,
        port: Number(process.env.PG_PORT),
        username: process.env.PG_USER,
        password: process.env.PG_PASSWORD,
        database: process.env.PG_DB,
        poolSize: 50, // Increased for concurrent tests
      })
    });
  } else {
    console.warn('⚠ PostgreSQL enabled but PG_USER is missing. Skipping PostgreSQL tests.');
  }
}

// 3. MongoDB Configuration
if (process.env.TEST_MONGODB_ENABLED === 'true') {
  if (process.env.MONGO_URI) {
    adaptersToTest.push({
      name: 'MongoDB',
      options: createOption('mongodb', {
        uri: process.env.MONGO_URI,
        collection: 'test_collection'
      })
    });
  } else {
    console.warn('⚠ MongoDB enabled but MONGO_URI is missing. Skipping MongoDB tests.');
  }
}

// 4. Redis Configuration
if (process.env.TEST_REDIS_ENABLED === 'true') {
  if (process.env.REDIS_URI) {
    adaptersToTest.push({
      name: 'Redis',
      options: createOption('redis', {
        url: process.env.REDIS_URI
      })
    });
  } else {
    console.warn('⚠ Redis enabled but REDIS_URI is missing. Skipping Redis tests.');
  }
}

// 5. SQLite Configuration
if (process.env.TEST_SQLITE_ENABLED === 'true') {
  const sqlitePath = process.env.SQLITE_FILE || './test.sqlite';
  adaptersToTest.push({
    name: 'SQLite',
    options: createOption('sqlite', {
      path: sqlitePath
    }),
    teardown: async () => {
      if (fs.existsSync(sqlitePath)) fs.unlinkSync(sqlitePath);
    }
  });
}

// 6. JSON Database Configuration
if (process.env.TEST_JSON_ENABLED === 'true') {
  const jsonPath = process.env.JSON_DB_FILE || './test_db.json';
  adaptersToTest.push({
    name: 'JSON Database',
    options: createOption('json', {
      path: jsonPath
    }),
    teardown: async () => {
      if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath);
    }
  });
}

// 7. ZPack Configuration
if (process.env.TEST_ZPACK_ENABLED === 'true') {
  const zpackPath = process.env.ZPACK_FILE || './test_db.zpack';
  adaptersToTest.push({
    name: 'ZPack',
    options: createOption('zpack', {
      path: zpackPath
    }),
    teardown: async () => {
      if (fs.existsSync(zpackPath)) fs.unlinkSync(zpackPath);
    }
  });
}

// --- MASTER TEST SUITE ---
describe('Database Adapters Integration Tests', () => {
  jest.setTimeout(120000); // 120s global timeout for DB tests

  if (adaptersToTest.length === 0) {
    console.warn('⚠ No database adapters enabled in .env. Skipping DB tests.');
    it('should skip if no adapters enabled', () => {
      expect(true).toBe(true);
    });
    return;
  }

  adaptersToTest.forEach(({ name, options, setup, teardown }) => {
    describe(`Adapter: ${name}`, () => {
      let db: IDatabase;
      const testTable = 'users_test_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

      beforeAll(async () => {
        if (setup) await setup();

        // Veritabanı bağlantısını oluştur
        try {
          db = createDatabase(options);
          // Bağlantı testi için (bazı adaptörler lazy connect olabilir, bu yüzden explicit connect yoksa bir işlem yaparız)
        } catch (error) {
          console.error(`Failed to init ${name}:`, error);
          throw error;
        }
      });

      afterAll(async () => {
        try {
          if (db) await db.close();
          if (teardown) await teardown();
        } catch (error: any) {
          console.warn(`[${name}] Teardown warning:`, error.message);
        }
      });

      beforeEach(async () => {
        // Her testten önce tabloyu temizle
        try {
          await db.delete(testTable, {});
        } catch (e) {
          // Tablo yoksa veya bağlantı gittiyse hata verebilir
        }
      }, 20000); // Increased setup timeout

      it('should insert a new record', async () => {
        const user = { name: 'Onur', age: 25, email: 'onur@example.com' };
        await db.insert(testTable, user);

        const result = await db.selectOne(testTable, { name: 'Onur' });
        expect(result).toBeDefined();
        expect(result).toMatchObject({ name: 'Onur', age: 25 });
      });

      it('should select multiple records', async () => {
        await db.bulkInsert(testTable, [
          { name: 'A', age: 20 },
          { name: 'B', age: 30 },
          { name: 'A', age: 40 }
        ]);

        const results = await db.select(testTable, { name: 'A' });
        expect(results).toHaveLength(2);
        const ages = results.map((r: any) => r.age).sort();
        expect(ages).toEqual([20, 40]); // JSON DB sayıları string tutabilir mi? Kontrol et
      });

      it('should update a record', async () => {
        await db.insert(testTable, { name: 'OldName', age: 50 });

        const updateCount = await db.update(testTable, { name: 'NewName' }, { name: 'OldName' });

        // Not: Bazı NoSQL/JSON adaptörleri count dönmeyebilir, implementation detayına göre değişir.
        // Ama veri değişmeli.

        const updated = await db.selectOne(testTable, { name: 'NewName' });
        expect(updated).toBeDefined();
        expect(updated?.age).toBe(50);

        const old = await db.selectOne(testTable, { name: 'OldName' });
        expect(old).toBeNull();
      });

      it('should delete a record', async () => {
        await db.insert(testTable, { name: 'ToDelete' });
        await db.delete(testTable, { name: 'ToDelete' });

        const check = await db.selectOne(testTable, { name: 'ToDelete' });
        expect(check).toBeNull();
      });

      it('should increment a value', async () => {
        await db.insert(testTable, { name: 'Gamer', score: 10 });
        await db.increment(testTable, { score: 5 }, { name: 'Gamer' });

        const result = await db.selectOne(testTable, { name: 'Gamer' });
        expect(Number(result?.score)).toBe(15);
      });

      it('should decrement a value', async () => {
        await db.insert(testTable, { name: 'Gamer2', score: 10 });
        await db.decrement(testTable, { score: 3 }, { name: 'Gamer2' });

        const result = await db.selectOne(testTable, { name: 'Gamer2' });
        expect(Number(result?.score)).toBe(7);
      });

      it('should handle set (upsert) operation', async () => {
        // Case 1: Insert because not exists
        await db.set(testTable, { id: 999, val: 'created' }, { id: 999 });
        const created = await db.selectOne(testTable, { id: 999 });
        expect(created?.val).toBe('created');

        // Case 2: Update because exists
        await db.set(testTable, { val: 'updated' }, { id: 999 });
        const updated = await db.selectOne(testTable, { id: 999 });
        expect(updated?.val).toBe('updated');
      });

      // ZPack gibi bazı adaptörler bulk insert desteklemeyebilir, ama interface'de var.
      it('should support bulk insert', async () => {
        const users = [];
        for (let i = 0; i < 10; i++) users.push({ id: i, type: 'bot' });

        await db.bulkInsert(testTable, users);

        const all = await db.select(testTable, { type: 'bot' });
        expect(all.length).toBeGreaterThanOrEqual(10);
      });

      describe('🔥 Advanced & Stress Tests', () => {

        it('should handle atomic concurrent increments (Race Condition Check)', async () => {
          // Bu test, veritabanının aynı anda gelen isteklere karşı kilitleme/sıralama yeteneğini ölçer.
          const raceKey = 'racer';
          await db.insert(testTable, { name: raceKey, count: 0 });

          // 20 tane paralel istek oluştur
          const promises = [];
          for (let i = 0; i < 20; i++) {
            promises.push(db.increment(testTable, { count: 1 }, { name: raceKey }));
          }

          await Promise.all(promises);

          const result = await db.selectOne(testTable, { name: raceKey });
          // Eğer locking mekanizması çalışmazsa sayı 20'den az çıkar.
          expect(Number(result.count)).toBe(20);
        });

        it('should handle complex data types correctly', async () => {
          const complexData = {
            name: "Complex Guy",
            isActive: true,
            emptyVal: null,
            metadata: { role: "admin", level: 99 }, // Nested JSON
            tags: ["a", "b", "c"], // Array
            notes: "Line 1\nLine 2 with \"quotes\" and 'single' and emoji 🚀",
            createdAt: new Date()
          };

          await db.insert(testTable, complexData);
          const result = await db.selectOne(testTable, { name: "Complex Guy" });

          expect(result).toBeDefined();
          // SQLite/MySQL 1/0 dönebilir
          expect(!!result.isActive).toBe(true);
          expect(result.emptyVal).toBeNull();

          // JSON/Array bazen string olarak dönebilir, parse etmek gerekebilir
          // (Adaptörlerin çoğu bunu otomatik yapmalı ama yapmıyorsa kontrol edelim)
          let metadata = result.metadata;
          if (typeof metadata === 'string') metadata = JSON.parse(metadata);
          expect(metadata).toEqual({ role: "admin", level: 99 });

          // Tarih kontrolü (Timezone farkı olabileceği için gün/ay/yıl kontrolü daha güvenli)
          const resultDate = new Date(result.createdAt);
          expect(resultDate.getFullYear()).toBe(complexData.createdAt.getFullYear());
          expect(resultDate.getDate()).toBe(complexData.createdAt.getDate());

          // Özel karakterler
          expect(result.notes).toContain("emoji 🚀");
          expect(result.notes).toContain('"quotes"');
        });

        it('should handle gracefully when operating on non-existent records', async () => {
          // ... (no change needed here, logic is fine)
          const nonExistent = { _id: 9999999, name: "Ghost" };
          const s = await db.selectOne(testTable, { name: "Ghost" });
          expect(s).toBeNull();
          const u = await db.update(testTable, { age: 100 }, { name: "Ghost" });
          expect(u).toBe(0);
          const d = await db.delete(testTable, { name: "Ghost" });
          expect(d).toBe(0);
          const i = await db.increment(testTable, { age: 1 }, { name: "Ghost" });
          expect(i).toBe(0);
        });

        it('should handle large batch operations (Stress Test)', async () => {
          const batchSize = 100;
          const dataset = [];
          for (let i = 0; i < batchSize; i++) {
            dataset.push({
              batch_id: 'stress_test',
              idx: i, // 'index' was reserved word
              data: 'x'.repeat(50)
            });
          }

          const start = Date.now();
          await db.bulkInsert(testTable, dataset);
          const duration = Date.now() - start;

          console.log(`[${name}] Inserted ${batchSize} records in ${duration}ms`);

          const results = await db.select(testTable, { batch_id: 'stress_test' });
          expect(results.length).toBe(batchSize);
        }, 60000); // 60s timeout

        it('should handle atomic concurrent increments (Race Condition Check)', async () => {
          const raceKey = 'racer';
          await db.insert(testTable, { name: raceKey, count: 0 });

          const promises = [];
          const concurrency = name === 'MySQL' ? 5 : 10; // MySQL is sensitive to connection limits

          for (let i = 0; i < concurrency; i++) {
            promises.push(db.increment(testTable, { count: 1 }, { name: raceKey }));
          }

          await Promise.all(promises);

          const result = await db.selectOne(testTable, { name: raceKey });
          expect(Number(result.count)).toBe(concurrency);
        }, 60000); // 60s timeout
      });
    });
  });
});
