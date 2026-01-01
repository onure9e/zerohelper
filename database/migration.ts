import fs from 'fs';
import path from 'path';
import { IDatabase } from './IDatabase';

export interface MigrationFile {
  name: string;
  path: string;
}

export class MigrationManager {
  private db: IDatabase;
  private migrationsDir: string;
  private migrationsTable: string;

  constructor(database: IDatabase, options: any = {}) {
    this.db = database;
    this.migrationsDir = options.migrationsDir || './migrations';
    this.migrationsTable = options.migrationsTable || 'migrations';
    this.ensureMigrationsDir();
  }

  private ensureMigrationsDir(): void {
    if (!fs.existsSync(this.migrationsDir)) {
      fs.mkdirSync(this.migrationsDir, { recursive: true });
    }
  }

  async ensureMigrationsTable(): Promise<void> {
    try {
      await this.db.selectOne(this.migrationsTable, {});
    } catch (error) {
      if ((this.db as any).constructor.name === 'MySQLDatabase') {
        await (this.db as any).query(`CREATE TABLE IF NOT EXISTS ${this.migrationsTable} (id INTEGER PRIMARY KEY AUTO_INCREMENT, name VARCHAR(255) NOT NULL UNIQUE, executed_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
      } else if ((this.db as any).constructor.name === 'PostgreSQLDatabase') {
        await (this.db as any).query(`CREATE TABLE IF NOT EXISTS ${this.migrationsTable} (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL UNIQUE, executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
      } else {
        await (this.db as any).query(`CREATE TABLE IF NOT EXISTS ${this.migrationsTable} (id INTEGER PRIMARY KEY AUTOINCREMENT, name VARCHAR(255) NOT NULL UNIQUE, executed_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
      }
    }
  }

  createMigration(name: string, description: string = ''): string {
    const timestamp = Date.now();
    const filename = `${timestamp}_${name}.ts`;
    const filePath = path.join(this.migrationsDir, filename);
    const template = `import { IDatabase } from "../database/IDatabase";\n\nexport const up = async (db: IDatabase) => {\n  // Migration logic here\n};\n\nexport const down = async (db: IDatabase) => {\n  // Rollback logic here\n};\n`;
    fs.writeFileSync(filePath, template);
    return filename;
  }

  getMigrationFiles(): MigrationFile[] {
    return fs.readdirSync(this.migrationsDir)
      .filter(file => file.endsWith('.ts') || file.endsWith('.js'))
      .sort()
      .map(file => ({ name: file, path: path.join(this.migrationsDir, file) }));
  }

  async getExecutedMigrations(): Promise<string[]> {
    await this.ensureMigrationsTable();
    try {
      const executed = await this.db.select(this.migrationsTable, {});
      return executed.map((row: any) => row.name);
    } catch {
      return [];
    }
  }

  async getPendingMigrations(): Promise<MigrationFile[]> {
    const all = this.getMigrationFiles();
    const executed = await this.getExecutedMigrations();
    return all.filter(m => !executed.includes(m.name));
  }

  async runMigration(migrationFile: MigrationFile, direction: 'up' | 'down' = 'up'): Promise<boolean> {
    try {
      const migration = require(path.resolve(migrationFile.path));
      if (typeof migration[direction] !== 'function') throw new Error(`Migration ${migrationFile.name} has no ${direction} method`);
      await migration[direction](this.db);
      if (direction === 'up') await this.db.insert(this.migrationsTable, { name: migrationFile.name });
      else await this.db.delete(this.migrationsTable, { name: migrationFile.name });
      return true;
    } catch (error) {
      console.error(`Migration ${migrationFile.name} error:`, error);
      throw error;
    }
  }

  async migrate(): Promise<void> {
    const pending = await this.getPendingMigrations();
    for (const m of pending) await this.runMigration(m, 'up');
  }

  async rollback(steps: number = 1): Promise<void> {
    const executed = await this.getExecutedMigrations();
    const all = this.getMigrationFiles();
    const toRollback = executed.slice(-steps).reverse().map(name => all.find(m => m.name === name)).filter((m): m is MigrationFile => !!m);
    for (const m of toRollback) await this.runMigration(m, 'down');
  }
}

export default MigrationManager;
