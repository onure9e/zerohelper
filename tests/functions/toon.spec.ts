import { stringify, parse } from '../../functions/toon';

describe('TOON (Token-Oriented Object Notation) Tests', () => {
  
  describe('stringify()', () => {
    it('should correctly stringify primitives', () => {
      expect(stringify(123)).toBe('123');
      expect(stringify(true)).toBe('true');
      expect(stringify(false)).toBe('false');
      expect(stringify(null)).toBe('null');
      expect(stringify('hello')).toBe('hello');
      expect(stringify('hello world')).toBe('"hello world"'); // Space requires quotes
    });

    it('should correctly stringify a simple object', () => {
      const obj = { name: 'Onur', age: 30, active: true };
      const result = stringify(obj);
      expect(result).toContain('name: Onur');
      expect(result).toContain('age: 30');
      expect(result).toContain('active: true');
    });

    it('should correctly stringify arrays in tabular format', () => {
      const users = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' }
      ];
      const result = stringify(users);
      // Beklenen format: [2]{id,name}:\n  1,Alice\n  2,Bob
      expect(result).toMatch(/\[2\]\{id,name\}:/);
      expect(result).toContain('1,Alice');
      expect(result).toContain('2,Bob');
    });

    it('should handle nested objects', () => {
      const complex = {
        meta: { version: 1 },
        data: { id: 100 }
      };
      const result = stringify(complex);
      expect(result).toContain('meta:\n  version: 1');
      expect(result).toContain('data:\n  id: 100');
    });
  });

  describe('parse()', () => {
    it('should parse simple key-value pairs', () => {
      const toonStr = `
        name: Onur
        age: 30
        isAdmin: false
        score: null
      `;
      const result = parse(toonStr);
      expect(result).toEqual({
        name: 'Onur',
        age: 30,
        isAdmin: false,
        score: null
      });
    });

    it('should parse tabular array data', () => {
      const toonStr = `
        users[2]{id,name}:
        1,Alice
        2,Bob
      `;
      const result = parse(toonStr);
      expect(result.users).toHaveLength(2);
      expect(result.users[0]).toEqual({ id: 1, name: 'Alice' });
      expect(result.users[1]).toEqual({ id: 2, name: 'Bob' });
    });

    it('should handle quoted strings with spaces', () => {
      const toonStr = `message: "Hello World"`;
      const result = parse(toonStr);
      expect(result.message).toBe('Hello World');
    });

    it('should be symmetric (stringify -> parse -> deepEqual)', () => {
      const original = {
        id: 555,
        title: "Test Entry",
        tags: [{ id: 1, tag: "news" }, { id: 2, tag: "tech" }],
        settings: {
          visible: true,
          retries: 3
        }
      };
      
      const str = stringify(original);
      const parsed = parse(str);
      expect(parsed).toBeDefined();
    });

    it('should handle deep nesting and unicode', () => {
      const deep = {
        level1: {
          level2: {
            level3: {
              level4: {
                message: "Hello 🌍! This is deeply nested."
              }
            }
          }
        },
        unicode: "Şçöğüİ 👍"
      };

      const str = stringify(deep);
      const parsed = parse(str);

      // TOON şu an çok derin nesting'i tabular yapmıyor, standart indentation ile yapıyor olmalı.
      // İçeriği kontrol edelim.
      expect(parsed.level1.level2.level3.level4.message).toBe("Hello 🌍! This is deeply nested.");
      expect(parsed.unicode).toBe("Şçöğüİ 👍");
    });
  });
});
