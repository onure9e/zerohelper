export interface MySQLConfig {
  host: string;
  user: string;
  password?: string;
  database: string;
  port?: number;
  connectionLimit?: number;
  cache?: CacheConfig;
}

export interface SQLiteConfig {
  filename: string;
  cache?: CacheConfig;
}

export interface MongoDBConfig {
  uri: string;
  dbName: string;
  cache?: CacheConfig;
}

export interface PostgreSQLConfig {
  host: string;
  user: string;
  password?: string;
  database: string;
  port?: number;
  connectionLimit?: number;
  cache?: CacheConfig;
}

export interface RedisConfig {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  cache?: CacheConfig;
}

export interface JsonConfig {
  filePath: string;
  saveInterval?: number;
  cache?: CacheConfig;
}

export interface ZPackConfig {
  filePath: string;
  autoFlush?: boolean;
  cache?: CacheConfig;
  indexFields?: Record<string, string[]>;
}

export interface ToonConfig {
  filePath: string;
  saveInterval?: number;
  cache?: CacheConfig;
}

export interface CacheConfig {
  type: 'memory' | 'redis';
  ttl?: number;
  max?: number;
  host?: string;
  port?: number;
  password?: string;
}

export type DatabaseOptions =
  | { adapter: 'mysql'; config: MySQLConfig }
  | { adapter: 'sqlite'; config: SQLiteConfig }
  | { adapter: 'mongodb'; config: MongoDBConfig }
  | { adapter: 'postgres'; config: PostgreSQLConfig }
  | { adapter: 'json'; config: JsonConfig }
  | { adapter: 'redis'; config: RedisConfig }
  | { adapter: 'zpack'; config: ZPackConfig }
  | { adapter: 'toon'; config: ToonConfig };

export type AdapterType = DatabaseOptions['adapter'];