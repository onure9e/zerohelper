import fs from 'fs';
import path from 'path';
import * as database from '../../database';

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

export function loadConfig(configPath: string): any {
  const absolutePath = path.resolve(process.cwd(), configPath);
  
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Configuration file not found: ${configPath}`);
  }

  try {
    const modulePath = require.resolve(absolutePath);
    delete require.cache[modulePath];
    const config = require(absolutePath);
    
    if (!config.zeroConfig) {
      throw new Error('Configuration file must export "zeroConfig"');
    }
    
    return config.zeroConfig;
  } catch (error: any) {
    if (error.code === 'MODULE_NOT_FOUND') {
      throw new Error(`Cannot load config. Make sure TypeScript is compiled: ${error.message}`);
    }
    throw error;
  }
}

export async function getDatabase(configPath: string): Promise<any> {
  const config = loadConfig(configPath);
  const db = database.createDatabase(config);
  return db;
}
