// functions/worker.ts
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';

/**
 * Runs a function in a separate background thread.
 * Ideal for heavy math, data processing, or large ZPack manipulations.
 */
export async function runAsyncTask<T>(taskFn: string, data: any): Promise<T> {
  return new Promise((resolve, reject) => {
    const workerCode = `
      const { parentPort, workerData } = require('worker_threads');
      try {
        const fn = ${taskFn};
        const result = fn(workerData);
        parentPort.postMessage({ result });
      } catch (error) {
        parentPort.postMessage({ error: error.message });
      }
    `;

    const worker = new Worker(workerCode, { eval: true, workerData: data });

    worker.on('message', (msg) => {
      if (msg.error) reject(new Error(msg.error));
      else resolve(msg.result);
    });

    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
    });
  });
}
