import { runAsyncTask } from '../../functions/worker';

describe('Worker Functions', () => {
  describe('runAsyncTask()', () => {
    
    it('should execute a simple math function in a worker', async () => {
      // Worker içinde çalışacak kodun string hali
      const taskFn = `(data) => {
        return data.a + data.b;
      }`;
      
      const data = { a: 10, b: 20 };
      const result = await runAsyncTask<number>(taskFn, data);
      
      expect(result).toBe(30);
    });

    it('should handle complex object manipulation', async () => {
      const taskFn = `(data) => {
        return data.list.map(x => x * 2);
      }`;
      
      const data = { list: [1, 2, 3] };
      const result = await runAsyncTask<number[]>(taskFn, data);
      
      expect(result).toEqual([2, 4, 6]);
    });

    it('should throw an error if the worker code fails', async () => {
      const taskFn = `(data) => {
        throw new Error("Worker Exploded");
      }`;
      
      await expect(runAsyncTask(taskFn, {})).rejects.toThrow("Worker Exploded");
    });

    it('should handle CPU intensive tasks (Fibonacci)', async () => {
      // 35. Fibonacci sayısını hesapla (Recursive, yavaştır)
      const taskFn = `(data) => {
        const fib = (n) => n < 2 ? n : fib(n - 1) + fib(n - 2);
        return fib(data.n);
      }`;
      
      const start = Date.now();
      const result = await runAsyncTask<number>(taskFn, { n: 20 }); // 20 hızlıdır, test için yeterli
      const duration = Date.now() - start;

      expect(result).toBe(6765);
    });

    it('should handle large data payloads', async () => {
      const largeString = 'x'.repeat(1024 * 1024); // 1MB data
      const taskFn = `(data) => {
        return data.str.length;
      }`;
      
      const result = await runAsyncTask<number>(taskFn, { str: largeString });
      expect(result).toBe(1024 * 1024);
    });
  });
});
