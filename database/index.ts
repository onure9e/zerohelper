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
import ToonDatabase from './toon';
import { DataSeeder } from './seeder';

const adapters: Record<string, any> = {
  mysql: MySQLDatabase,
  sqlite: SQLiteDatabase,
  mongodb: MongoDBDatabase,
  postgres: PostgreSQLDatabase,
  json: JsonDatabase,
  redis: RedisDatabase,
  zpack: ZPackAdapter,
  toon: ToonDatabase,
};

/**
 * Belirtilen adaptör tipine göre bir veritabanı örneği oluşturur ve döndürür.
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
        if (prop in target) {
          const val = (target as any)[prop];
          return typeof val === 'function' ? val.bind(target) : val;
        }
        if (prop in (target as any).db) {
          const val = (target as any).db[prop];
          return typeof val === 'function' ? val.bind((target as any).db) : val;
        }
        return undefined;
      }
    }) as unknown as IDatabase;
  }

  return dbInstance as IDatabase;
}

export { MigrationManager, ZPackDatabase, ZPackAdapter, DataSeeder, ToonDatabase };
export default createDatabase;
