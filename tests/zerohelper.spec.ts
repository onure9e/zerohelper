import { database, functions } from '../index';
import fs from 'fs';
import path from 'path';

describe('ZeroHelper Elite Framework Test Suite', () => {
  const ZPACK_FILE = './test_suite.zpack';

  // Cleanup after all tests
  afterAll(async () => {
    if (fs.existsSync(ZPACK_FILE)) fs.unlinkSync(ZPACK_FILE);
    if (fs.existsSync(ZPACK_FILE + '.tmp')) fs.unlinkSync(ZPACK_FILE + '.tmp');
  });

  describe('🛠️  Helper Functions', () => {
    test('should generate a unique ID', () => {
      const id1 = functions.random_module.makeUniqueId();
      const id2 = functions.random_module.makeUniqueId();
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
    });

    test('should correctly title case a sentence', () => {
      expect(functions.string_module.titleCase('hello zero world')).toBe('Hello Zero World');
    });

    test('should generate a URL-friendly slug', () => {
      const slug = functions.string_module.generateSlug('ZeroHelper v9.1 Is Awesome!');
      expect(slug).toBe('zerohelper-v9-1-is-awesome');
    });

    test('should calculate correct mean and median', () => {
      const nums = [10, 20, 30, 40, 50];
      expect(functions.math_module.mean(nums)).toBe(30);
      expect(functions.math_module.median(nums)).toBe(30);
    });
  });

  describe('🔐 Security & Cryptography', () => {
    test('should hash and verify passwords correctly', () => {
      const pass = 'ultra-secret-123';
      const hash = functions.crypto_module.hashPassword(pass);
      expect(functions.crypto_module.verifyPassword(pass, hash)).toBe(true);
      expect(functions.crypto_module.verifyPassword('wrong-pass', hash)).toBe(false);
    });

    test('should encrypt and decrypt text (AES-256)', () => {
      const secret = 'master-key';
      const text = 'Sensitive Data';
      const { encryptedText, iv } = functions.crypto_module.encryptText(text, secret);
      const decrypted = functions.crypto_module.decryptText(encryptedText, secret, iv);
      expect(decrypted).toBe(text);
    });

    test('should rate limit requests', async () => {
      const key = 'test_user';
      const opts = { limit: 2, window: 10 };
      
      const req1 = await functions.security_module.checkRateLimit(key, opts);
      const req2 = await functions.security_module.checkRateLimit(key, opts);
      const req3 = await functions.security_module.checkRateLimit(key, opts);

      expect(req1.allowed).toBe(true);
      expect(req2.allowed).toBe(true);
      expect(req3.allowed).toBe(false);
    });
  });

  describe('📊 TOON (Token-Oriented Object Notation)', () => {
    test('should serialize object to TOON format', () => {
      const data = { name: "Alice", age: 30 };
      const serialized = functions.toon_module.stringify(data);
      expect(serialized).toContain('name: Alice');
      expect(serialized).toContain('age: 30');
    });

    test('should use tabular format for uniform arrays', () => {
      const data = [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" }
      ];
      const serialized = functions.toon_module.stringify(data);
      expect(serialized).toContain('[2]{id,name}:');
      expect(serialized).toContain('1,Alice');
      expect(serialized).toContain('2,Bob');
    });
  });

  describe('💾 Database: ZPack Adapter', () => {
    let db: any;

    beforeAll(async () => {
      db = database.createDatabase({
        adapter: 'zpack',
        config: { 
          filePath: ZPACK_FILE,
          autoFlush: true,
          cache: { type: 'memory' }
        }
      });
    });

    test('should insert and select data with hooks', async () => {
      let hookTriggered = false;
      db.on('beforeInsert', (table: string, data: any) => {
        data.hooked = "true";
        hookTriggered = true;
      });

      const id = await db.insert('users', { name: 'Onur', age: "25" });
      const user = await db.selectOne('users', { _id: id });

      expect(id).toBeDefined();
      expect(user.name).toBe('Onur');
      expect(user.hooked).toBe("true");
      expect(hookTriggered).toBe(true);
    });

    test('should handle secondary indexing correctly', async () => {
      const indexedDb = database.createDatabase({
        adapter: 'zpack',
        config: { 
          filePath: './indexed.zpack',
          indexFields: { 'products': ['sku'] }
        }
      });

      await indexedDb.insert('products', { name: 'Keyboard', sku: 'KBD-001' });
      const found = await indexedDb.selectOne('products', { sku: 'KBD-001' });
      
      expect(found.name).toBe('Keyboard');
      await indexedDb.close();
      if (fs.existsSync('./indexed.zpack')) fs.unlinkSync('./indexed.zpack');
    });

    test('should perform atomic increment', async () => {
      const id = await db.insert('stats', { views: 10 });
      await db.increment('stats', { views: 5 }, { _id: id });
      const updated = await db.selectOne('stats', { _id: id });
      expect(Number(updated.views)).toBe(15);
    });

    test('should record telemetry metrics', () => {
      const metrics = db.getMetrics();
      expect(metrics.database.totalOperations).toBeGreaterThan(0);
      expect(metrics.cache.misses).toBeGreaterThan(0);
    });

    test('should vacuum the database', async () => {
      const ids = [];
      for(let i=0; i<10; i++) ids.push(await db.insert('tmp', { d: 'x'.repeat(100) }));
      for(const id of ids) await db.delete('tmp', { _id: id });
      
      const sizeBefore = fs.statSync(ZPACK_FILE).size;
      await db.vacuum();
      const sizeAfter = fs.statSync(ZPACK_FILE).size;
      
      expect(sizeAfter).toBeLessThan(sizeBefore);
    });

    afterAll(async () => {
      await db.close();
    });
  });

  describe('💾 Database: TOON Native Adapter', () => {
    const TOON_FILE = './test_suite.toon';
    let tdb: any;

    beforeAll(() => {
      tdb = database.createDatabase({
        adapter: 'toon',
        config: { filePath: TOON_FILE }
      });
    });

    test('should insert and select data in TOON format', async () => {
      const id = await tdb.insert('orders', { product: 'Elite Laptop', price: 2500 });
      await tdb.insert('orders', { product: 'Mechanical Keyboard', price: 150 });
      
      const order = await tdb.selectOne('orders', { _id: id });
      
      expect(id).toBeDefined();
      expect(order.product).toBe('Elite Laptop');
      
      // Wait for async flush
      await new Promise(r => setTimeout(r, 600));
      
      const content = fs.readFileSync(TOON_FILE, 'utf-8');
      // With 2 items, it should trigger tabular format with key separator
      expect(content).toContain('orders: [2]{_id,product,price}:');
    });

    afterAll(async () => {
      await tdb.close();
      if (fs.existsSync(TOON_FILE)) fs.unlinkSync(TOON_FILE);
    });
  });

  describe('🧪 Data Seeder', () => {
    test('should seed mock data based on schema', async () => {
      const seederDb = database.createDatabase({
        adapter: 'json',
        config: { filePath: './seed_test.json' }
      });
      
      const seeder = new database.DataSeeder(seederDb);
      const count = await seeder.seed('test_table', 5, {
        email: { type: 'email' },
        age: { type: 'number', min: 18, max: 60 },
        active: { type: 'boolean' }
      });

      const rows = await seederDb.select('test_table');
      expect(count).toBe(5);
      expect(rows.length).toBe(5);
      expect(rows[0].email).toContain('@');
      
      await seederDb.close();
      if (fs.existsSync('./seed_test.json')) fs.unlinkSync('./seed_test.json');
    });
  });
});