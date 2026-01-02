export interface BaseConfig {
  cache?: CacheConfig;
}

export interface NetworkConfig extends BaseConfig {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
  url?: string;
  uri?: string;
  poolSize?: number;
}

export interface FileConfig extends BaseConfig {
  path: string;
}

export interface MySQLConfig extends NetworkConfig {}
export interface PostgreSQLConfig extends NetworkConfig {}
export interface SQLiteConfig extends FileConfig {}
export interface MongoDBConfig extends NetworkConfig {}
export interface RedisConfig extends NetworkConfig {
  keyPrefix?: string;
}

export interface JsonConfig extends FileConfig {
  saveInterval?: number;
}

export interface ZPackConfig extends FileConfig {
  autoFlush?: boolean;
  indexFields?: Record<string, string[]>;
}

export interface ToonConfig extends FileConfig {
  saveInterval?: number;
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
