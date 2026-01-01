import { IDatabase } from './IDatabase';
import { DatabaseOptions } from './types';
import MySQLDatabase from './mysql';
import SQLiteDatabase from './sqlite';
import MongoDBDatabase from './mongodb';
import JsonDatabase from './json';
import PostgreSQLDatabase from './pg';
import RedisDatabase from './redis';
import CacheWrapper from './cacheWrapper';
import MigrationManager from './migration';
import ZPackAdapter, { ZPackDatabase } from './zpack';

const adapters: Record<string, any> = {
  mysql: MySQLDatabase,
  sqlite: SQLiteDatabase,
  mongodb: MongoDBDatabase,
  postgres: PostgreSQLDatabase,
  json: JsonDatabase,
  redis: RedisDatabase,
  zpack: ZPackAdapter,
};

/**
 * Belirtilen adaptör tipine göre bir veritabanı örneği oluşturur ve döndürür.
 * Bu bir "Fabrika Fonksiyonu"dur.
 */
export function createDatabase(options: DatabaseOptions): IDatabase {
  const { adapter, config } = options;

  if (!adapter || !adapters[adapter]) {
    throw new Error(`Geçersiz veya desteklenmeyen adaptör: ${adapter}. Desteklenenler: ${Object.keys(adapters).join(', ')}`);
  }

  if (!config) {
    throw new Error(`'${adapter}' adaptörü için yapılandırma (config) gereklidir.`);
  }

  const DatabaseClass = adapters[adapter];
  const dbInstance = new DatabaseClass(config);

  if ((config as any).cache) {
    const wrapper = new CacheWrapper(dbInstance, (config as any).cache);
    return new Proxy(wrapper, {
      get: (target, prop) => {
        if (typeof (target as any)[prop] !== 'undefined') {
          return (target as any)[prop];
        } else if (typeof (target as any).db[prop] === 'function') {
          return (target as any).db[prop].bind((target as any).db);
        } else {
          return (target as any).db[prop];
        }
      }
    }) as unknown as IDatabase;
  }

  return dbInstance as IDatabase;
}

export { MigrationManager, ZPackDatabase, ZPackAdapter };
export default createDatabase;