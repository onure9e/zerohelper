#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import fs from 'fs';
import path from 'path';
import { database } from '../index';
import { version } from '../package.json';

const program = new Command();

program
  .name('zero')
  .description(chalk.cyan('ZeroHelper CLI - Elite Database Management Tool'))
  .version(version);

function loadConfig(configPath: string): any {
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

async function getDatabase(configPath: string): Promise<any> {
  const config = loadConfig(configPath);
  const db = database.createDatabase(config);
  return db;
}

program.command('init')
  .description('Initialize ZeroHelper in your project (Interactive)')
  .action(async () => {
    console.log(chalk.bold.blue(`\n🚀 Welcome to ZeroHelper v${version} Setup\n`));

    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'adapter',
        message: 'Select database adapter:',
        choices: [
          { name: '📄 JSON (Simple file-based)', value: 'json' },
          { name: '📦 ZPack (High-performance binary)', value: 'zpack' },
          { name: '💾 SQLite (Embedded SQL)', value: 'sqlite' },
          { name: '🐬 MySQL (Network SQL)', value: 'mysql' },
          { name: '🐘 PostgreSQL (Network SQL)', value: 'postgres' },
          { name: '🍃 MongoDB (Document NoSQL)', value: 'mongodb' },
          { name: '⚡ Redis (In-memory cache)', value: 'redis' },
          { name: '📊 TOON (Native TOON DB)', value: 'toon' }
        ]
      },
      {
        type: 'confirm',
        name: 'enableCache',
        message: 'Enable caching layer?',
        default: true
      }
    ]);

    const prompts: any[] = [];

    if (['json', 'zpack', 'sqlite', 'toon'].includes(answers.adapter)) {
      prompts.push({
        type: 'input',
        name: 'filePath',
        message: 'Enter database file path:',
        default: (ans: any) => {
          const ext = ans.adapter === 'json' ? '.json' : 
                       ans.adapter === 'zpack' ? '.zpack' :
                       ans.adapter === 'toon' ? '.toon' : '.db';
          return `./data/storage${ext}`;
        },
        validate: (input: string) => input.length > 0 || 'Path is required'
      });
    } else {
      prompts.push(
        {
          type: 'input',
          name: 'host',
          message: 'Database host:',
          default: 'localhost',
          validate: (input: string) => input.length > 0 || 'Host is required'
        },
        {
          type: 'number',
          name: 'port',
          message: 'Database port:',
          default: (ans: any) => {
            const ports: any = { mysql: 3306, postgres: 5432, mongodb: 27017, redis: 6379 };
            return ports[ans.adapter] || 3306;
          }
        },
        {
          type: 'input',
          name: 'username',
          message: 'Username:',
          default: 'root',
          when: (ans: any) => ans.adapter !== 'mongodb'
        },
        {
          type: 'password',
          name: 'password',
          message: 'Password (leave empty if none):'
        },
        {
          type: 'input',
          name: 'database',
          message: 'Database name:',
          default: 'zero_db',
          validate: (input: string) => input.length > 0 || 'Database name is required'
        }
      );
    }

    if (answers.enableCache) {
      prompts.push({
        type: 'list',
        name: 'cacheType',
        message: 'Cache type:',
        choices: ['memory', 'redis'],
        default: 'memory'
      });

      prompts.push({
        type: 'number',
        name: 'cacheTtl',
        message: 'Cache TTL (seconds):',
        default: 300,
        when: (ans: any) => ans.cacheType === 'memory'
      });
    }

    const extraAnswers = await inquirer.prompt(prompts);
    const finalAnswers = { ...answers, ...extraAnswers };

    const spinner = ora('Creating configuration...').start();

    try {
      const configObject = buildConfig(finalAnswers);
      const configTemplate = formatConfigTemplate(finalAnswers, configObject);

      fs.writeFileSync(path.join(process.cwd(), 'zero.config.ts'), configTemplate);
      
      spinner.succeed(chalk.green('✅ zero.config.ts created successfully!'));
      
      console.log(chalk.gray('\n📝 Usage example:'));
      console.log(chalk.yellow(`import { database } from '@onurege3467/zerohelper';`));
      console.log(chalk.yellow(`import { zeroConfig } from './zero.config';`));
      console.log(chalk.yellow(`const db = database.createDatabase(zeroConfig);`));
    } catch (error: any) {
      spinner.fail(chalk.red('Configuration creation failed'));
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

function buildConfig(answers: any): string {
  if (['json', 'zpack', 'sqlite', 'toon'].includes(answers.adapter)) {
    return JSON.stringify({
      adapter: answers.adapter,
      config: {
        path: answers.filePath,
        ...(answers.enableCache && {
          cache: {
            type: answers.cacheType || 'memory',
            ...(answers.cacheType === 'memory' && answers.cacheTtl && { ttl: answers.cacheTtl * 1000 })
          }
        })
      }
    }, null, 2);
  }

  const config: any = {
    adapter: answers.adapter,
    config: {
      host: answers.host,
      port: answers.port,
      ...(answers.username && { username: answers.username }),
      ...(answers.password && { password: answers.password }),
      database: answers.database,
      ...(answers.adapter === 'mongodb' && { url: `mongodb://${answers.host}:${answers.port}/${answers.database}` })
    }
  };

  if (answers.enableCache && answers.cacheType) {
    config.config.cache = {
      type: answers.cacheType
    };
    if (answers.cacheType === 'redis') {
      config.config.cache.host = answers.host;
      config.config.cache.port = 6379;
    } else if (answers.cacheTtl) {
      config.config.cache.ttl = answers.cacheTtl * 1000;
    }
  }

  return JSON.stringify(config, null, 2);
}

function formatConfigTemplate(answers: any, configObject: string): string {
  return `/**
 * ZeroHelper Configuration
 * Generated on ${new Date().toLocaleDateString()}
 */
export const zeroConfig = ${configObject};
`;
}

program.command('db:test')
  .description('Test database connection and show basic stats')
  .option('-c, --config <path>', 'Path to config file', 'zero.config.ts')
  .action(async (options) => {
    const spinner = ora('Testing database connection...').start();

    try {
      const db = await getDatabase(options.config);
      
      spinner.succeed(chalk.green('✅ Database connection successful'));
      
      console.log(chalk.bold('\n📊 Database Stats:'));
      console.log(chalk.cyan('  Adapter:'), chalk.white((db as any).constructor.name));
      console.log(chalk.cyan('  Status:'), chalk.green('Connected'));
      
      try {
        const metrics = db.getMetrics();
        console.log(chalk.cyan('  Operations:'), chalk.white(metrics.database.count));
        console.log(chalk.cyan('  Avg Latency:'), chalk.white(`${metrics.database.averageDuration.toFixed(2)}ms`));
      } catch (err) {
        console.log(chalk.yellow('  Note: Metrics not available for this adapter'));
      }
      
      await db.close();
    } catch (error: any) {
      spinner.fail(chalk.red('❌ Connection failed'));
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

program.command('db:stats')
  .description('Show detailed database performance metrics')
  .option('-c, --config <path>', 'Path to config file', 'zero.config.ts')
  .action(async (options) => {
    try {
      const db = await getDatabase(options.config);
      const metrics = db.getMetrics();

      console.log(chalk.bold('\n📊 Database Performance Dashboard'));
      console.log(chalk.gray('─'.repeat(50)));

      console.log(chalk.bold('\n🔹 Database Operations:'));
      if (metrics.database) {
        const count = metrics.database.count ?? 0;
        const totalDuration = metrics.database.totalDuration ?? 0;
        const avgLatency = metrics.database.averageDuration ?? 0;
        const minDuration = metrics.database.minDuration ?? 0;
        const maxDuration = metrics.database.maxDuration ?? 0;

        const formatNum = (n: any) => typeof n === 'number' ? n.toFixed(2) : n;

        console.log(`  Total Operations:  ${chalk.cyan(count)}`);
        console.log(`  Total Duration:   ${chalk.cyan(`${formatNum(totalDuration)} ms`)}`);
        console.log(`  Avg Latency:      ${chalk.green(`${formatNum(avgLatency)} ms`)}`);
        console.log(`  Min Duration:     ${chalk.yellow(`${formatNum(minDuration)} ms`)}`);
        console.log(`  Max Duration:     ${chalk.yellow(`${formatNum(maxDuration)} ms`)}`);
      } else {
        console.log(chalk.gray('  No metrics available for this adapter'));
      }

      if (metrics.cache) {
        console.log(chalk.bold('\n🔹 Cache Performance:'));
        console.log(`  Total Requests:   ${chalk.cyan((metrics.cache.hits || 0) + (metrics.cache.misses || 0))}`);
        console.log(`  Cache Hits:       ${chalk.green(metrics.cache.hits || 0)}`);
        console.log(`  Cache Misses:     ${chalk.red(metrics.cache.misses || 0)}`);
        const hits = metrics.cache.hits || 0;
        const misses = metrics.cache.misses || 0;
        const total = hits + misses;
        if (total > 0) {
          const ratio = (hits / total) * 100;
          console.log(`  Hit Ratio:        ${ratio.toFixed(1)}% ${ratio > 80 ? '✅' : ratio > 50 ? '⚠️' : '❌'}`);
        }
      }

      console.log(chalk.gray('\n' + '─'.repeat(50)));
      
      await db.close();
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

program.command('db:seed')
  .description('Seed table with mock data')
  .option('-c, --config <path>', 'Path to config file', 'zero.config.ts')
  .option('-t, --table <name>', 'Table name')
  .option('-n, --count <number>', 'Number of records', '10')
  .action(async (options) => {
    if (!options.table) {
      console.error(chalk.red('Error: --table option is required'));
      process.exit(1);
    }

    const spinner = ora(`Seeding ${options.table}...`).start();

    try {
      const db = await getDatabase(options.config);
      const seeder = new (database as any).DataSeeder(db);

      const schema: any = {};
      const fieldTypes = ['string', 'number', 'email', 'boolean', 'date'];

      for (let i = 0; i < 3; i++) {
        const fieldType = fieldTypes[Math.floor(Math.random() * fieldTypes.length)];
        schema[`field_${i + 1}`] = { type: fieldType };
      }

      const count = await seeder.seed(options.table, parseInt(options.count), schema);
      
      spinner.succeed(chalk.green(`✅ Seeded ${count} records into ${options.table}`));
      
      await db.close();
    } catch (error: any) {
      spinner.fail(chalk.red('❌ Seeding failed'));
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

program.command('migrate')
  .description('Run pending migrations')
  .option('-c, --config <path>', 'Path to config file', 'zero.config.ts')
  .option('-d, --migrations-dir <path>', 'Migrations directory path', './migrations')
  .action(async (options) => {
    const spinner = ora('Loading migrations...').start();

    try {
      const db = await getDatabase(options.config);
      const migration = new database.MigrationManager(db, {
        migrationsDir: options.migrationsDir
      });

      const pending = await migration.getPendingMigrations();

      if (pending.length === 0) {
        spinner.succeed(chalk.green('✅ No pending migrations'));
        await db.close();
        return;
      }

      spinner.text = `Running ${pending.length} migration(s)...`;

      for (const m of pending) {
        await migration.runMigration(m, 'up');
        spinner.text = `✅ ${m.name}`;
      }

      spinner.succeed(chalk.green(`✅ ${pending.length} migration(s) executed successfully`));
      
      await db.close();
    } catch (error: any) {
      spinner.fail(chalk.red('❌ Migration failed'));
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

program.command('migration:rollback')
  .description('Rollback the last migration(s)')
  .option('-c, --config <path>', 'Path to config file', 'zero.config.ts')
  .option('-d, --migrations-dir <path>', 'Migrations directory path', './migrations')
  .option('-s, --steps <number>', 'Number of migrations to rollback', '1')
  .action(async (options) => {
    const steps = parseInt(options.steps);
    
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: chalk.yellow(`⚠️  Are you sure you want to rollback ${steps} migration(s)?`),
        default: false
      }
    ]);

    if (!confirm) {
      console.log(chalk.yellow('Rollback cancelled'));
      return;
    }

    const spinner = ora(`Rolling back ${steps} migration(s)...`).start();

    try {
      const db = await getDatabase(options.config);
      const migration = new database.MigrationManager(db, {
        migrationsDir: options.migrationsDir
      });

      await migration.rollback(steps);

      spinner.succeed(chalk.green(`✅ Rolled back ${steps} migration(s)`));
      
      await db.close();
    } catch (error: any) {
      spinner.fail(chalk.red('❌ Rollback failed'));
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

program.command('migration:status')
  .description('Show migration status')
  .option('-c, --config <path>', 'Path to config file', 'zero.config.ts')
  .option('-d, --migrations-dir <path>', 'Migrations directory path', './migrations')
  .action(async (options) => {
    try {
      const db = await getDatabase(options.config);
      const migration = new database.MigrationManager(db, {
        migrationsDir: options.migrationsDir
      });

      const all = migration.getMigrationFiles();
      const executed = await migration.getExecutedMigrations();

      console.log(chalk.bold('\n📋 Migration Status'));
      console.log(chalk.gray('─'.repeat(50)));

      if (all.length === 0) {
        console.log(chalk.yellow('No migrations found'));
      } else {
        all.forEach(m => {
          const isExecuted = executed.includes(m.name);
          const status = isExecuted ? chalk.green('✅ Done') : chalk.yellow('⏳ Pending');
          console.log(`  ${status}  ${chalk.white(m.name)}`);
        });

        console.log(chalk.gray('\n' + '─'.repeat(50)));
        console.log(`  Total: ${all.length} | Executed: ${chalk.green(executed.length)} | Pending: ${chalk.yellow(all.length - executed.length)}`);
      }
      
      await db.close();
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

program.command('make:migration')
  .description('Generate a new migration template')
  .argument('<name>', 'Name of the migration')
  .option('-d, --migrations-dir <path>', 'Migrations directory path', './migrations')
  .action((name, options) => {
    const timestamp = Date.now();
    const fileName = `${timestamp}_${name}.ts`;
    const migrationsDir = path.join(process.cwd(), options.migrationsDir);

    if (!fs.existsSync(migrationsDir)) {
      fs.mkdirSync(migrationsDir, { recursive: true });
    }

    const template = `export const up = async (db: any) => {
  // Write your migration logic here
};

export const down = async (db: any) => {
  // Write your rollback logic here
};
`;
    fs.writeFileSync(path.join(migrationsDir, fileName), template);
    console.log(chalk.green(`\n✅ Migration created: ./${options.migrationsDir}/${fileName}`));
  });

program.command('zpack:vacuum')
  .description('Compact a ZPack binary file to save disk space')
  .argument('<file>', 'ZPack file path')
  .action(async (file) => {
    const spinner = ora(`Vacuuming ${file}...`).start();
    const startSize = fs.existsSync(file) ? fs.statSync(file).size : 0;

    try {
      const db = database.createDatabase({
        adapter: 'zpack',
        config: { path: file }
      });
      
      await (db as any).vacuum();
      await db.close();

      const endSize = fs.statSync(file).size;
      const reduction = startSize > 0 ? ((1 - endSize / startSize) * 100) : 0;
      
      spinner.succeed(chalk.green(`✅ Vacuum complete for ${file}`));
      console.log(chalk.gray(`  Original Size: ${formatBytes(startSize)}`));
      console.log(chalk.gray(`  New Size:      ${formatBytes(endSize)}`));
      console.log(chalk.bold.blue(`  Efficiency:    ${reduction.toFixed(1)}% reduction`));
    } catch (error: any) {
      spinner.fail(chalk.red(`❌ Vacuum failed: ${error.message}`));
      process.exit(1);
    }
  });

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

program.command('db:backup')
  .description('Backup database to timestamped file')
  .option('-c, --config <path>', 'Path to config file', 'zero.config.ts')
  .option('-o, --output <dir>', 'Output directory for backups', './backups')
  .action(async (options) => {
    const spinner = ora('Creating backup...').start();

    try {
      const db = await getDatabase(options.config);
      const config = loadConfig(options.config);
      const backupDir = path.resolve(process.cwd(), options.output);

      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const backupFile = path.join(backupDir, `backup_${timestamp}.zerohelper.json`);

      let tables: string[] = [];

      if (config.adapter === 'json' && config.config.path) {
        const dbPath = path.resolve(process.cwd(), config.config.path);
        if (fs.existsSync(dbPath)) {
          const dbContent = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
          tables = Object.keys(dbContent);
        }
      } else if (config.adapter === 'sqlite' && config.config.path) {
        tables = await (db as any).tables?.() || [];
      } else if (config.adapter === 'zpack' && config.config.path) {
        tables = await (db as any).tables?.() || [];
      } else {
        tables = ['users', 'products', 'orders', 'migrations', 'migration_test', 'test_backup'];
      }

      const backupData: any = {
        version: version,
        timestamp: new Date().toISOString(),
        config: config,
        data: {} as Record<string, any[]>
      };

      for (const table of tables) {
        try {
          const records = await db.select(table);
          if (records.length > 0) {
            backupData.data[table] = records;
          }
        } catch (err) {
          // Table doesn't exist or can't be accessed
        }
      }

      fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));

      const fileSize = fs.statSync(backupFile).size;
      spinner.succeed(chalk.green(`✅ Backup created: ${backupFile}`));
      console.log(chalk.gray(`  Size: ${formatBytes(fileSize)}`));
      console.log(chalk.gray(`  Tables: ${Object.keys(backupData.data).join(', ') || 'none'}`));

      await db.close();
    } catch (error: any) {
      spinner.fail(chalk.red('❌ Backup failed'));
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

program.command('db:restore')
  .description('Restore database from backup file')
  .argument('<backup-file>', 'Path to backup file')
  .option('-c, --config <path>', 'Path to config file', 'zero.config.ts')
  .action(async (backupFile, options) => {
    if (!fs.existsSync(backupFile)) {
      console.error(chalk.red(`Error: Backup file not found: ${backupFile}`));
      process.exit(1);
    }

    const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf-8'));

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: chalk.yellow(`⚠️  This will restore data from backup. Are you sure?`),
        default: false
      }
    ]);

    if (!confirm) {
      console.log(chalk.yellow('Restore cancelled'));
      return;
    }

    const spinner = ora('Restoring database...').start();

    try {
      const db = await getDatabase(options.config);

      for (const [table, records] of Object.entries(backupData.data)) {
        const rows = records as any[];
        if (Array.isArray(rows) && rows.length > 0) {
          try {
            await db.bulkInsert(table, rows);
            spinner.text = `✅ ${table}: ${rows.length} records`;
          } catch (err) {
            spinner.text = `⚠️  ${table}: failed`;
          }
        }
      }

      spinner.succeed(chalk.green(`✅ Database restored from ${backupFile}`));
      await db.close();
    } catch (error: any) {
      spinner.fail(chalk.red('❌ Restore failed'));
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

program.command('cache:clear')
  .description('Clear all cache')
  .option('-c, --config <path>', 'Path to config file', 'zero.config.ts')
  .action(async (options) => {
    const spinner = ora('Clearing cache...').start();

    try {
      const db = await getDatabase(options.config);
      const metrics = db.getMetrics();

      const beforeHits = metrics.cache?.hits || 0;
      const beforeMisses = metrics.cache?.misses || 0;

      // Clear cache by triggering cache invalidation
      await db.insert('_cache_clear', { timestamp: Date.now() });
      await db.delete('_cache_clear', { timestamp: Date.now() });

      const afterMetrics = db.getMetrics();
      const afterHits = afterMetrics.cache?.hits || 0;
      const afterMisses = afterMetrics.cache?.misses || 0;

      spinner.succeed(chalk.green('✅ Cache cleared'));
      console.log(chalk.gray(`  Previous hits: ${beforeHits}`));
      console.log(chalk.gray(`  Previous misses: ${beforeMisses}`));

      await db.close();
    } catch (error: any) {
      spinner.fail(chalk.red('❌ Cache clear failed'));
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

program.command('cache:stats')
  .description('Show detailed cache statistics')
  .option('-c, --config <path>', 'Path to config file', 'zero.config.ts')
  .action(async (options) => {
    try {
      const db = await getDatabase(options.config);
      const metrics = db.getMetrics();

      console.log(chalk.bold('\n📊 Cache Statistics'));
      console.log(chalk.gray('─'.repeat(50)));

      if (!metrics.cache) {
        console.log(chalk.yellow('  No cache statistics available'));
        console.log(chalk.gray('  Cache may not be enabled for this adapter'));
      } else {
        const hits = metrics.cache.hits || 0;
        const misses = metrics.cache.misses || 0;
        const total = hits + misses;
        const hitRate = total > 0 ? (hits / total) * 100 : 0;

        console.log(chalk.cyan('  Cache Hits:'), chalk.green(hits.toLocaleString()));
        console.log(chalk.cyan('  Cache Misses:'), chalk.red(misses.toLocaleString()));
        console.log(chalk.cyan('  Total Requests:'), chalk.white(total.toLocaleString()));
        console.log(chalk.cyan('  Hit Rate:'), chalk.white(`${hitRate.toFixed(2)}%`));

        let healthStatus = '❌';
        let healthColor = chalk.red;
        if (hitRate >= 90) {
          healthStatus = '✅ Excellent';
          healthColor = chalk.green;
        } else if (hitRate >= 70) {
          healthStatus = '⚠️  Good';
          healthColor = chalk.yellow;
        } else if (hitRate >= 50) {
          healthStatus = '⚠️  Fair';
          healthColor = chalk.yellow;
        } else {
          healthStatus = '❌ Poor';
          healthColor = chalk.red;
        }

        console.log(chalk.cyan('  Health:'), healthColor(healthStatus));

        if (hitRate < 70) {
          console.log(chalk.gray('\n  💡 Tip: Consider increasing cache TTL for better hit rate'));
        }
      }

      console.log(chalk.gray('\n' + '─'.repeat(50)));

      await db.close();
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

program.command('repl')
  .description('Interactive ZeroHelper REPL mode')
  .option('-c, --config <path>', 'Path to config file', 'zero.config.ts')
  .action(async (options) => {
    console.log(chalk.bold.cyan('\n🔧 ZeroHelper REPL Mode\n'));
    console.log(chalk.gray('Type .exit to quit, .help for commands\n'));

    try {
      const db = await getDatabase(options.config);

      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: chalk.blue('zero> ')
      });

      rl.prompt();

      rl.on('line', async (line: string) => {
        const cmd = line.trim();

        if (cmd === '.exit') {
          await db.close();
          rl.close();
          console.log(chalk.green('\n👋 Goodbye!\n'));
          process.exit(0);
        } else if (cmd === '.help') {
          console.log(chalk.bold('\nAvailable REPL Commands:'));
          console.log('  .exit              Exit REPL');
          console.log('  .help              Show this help');
          console.log('  .stats              Show database stats');
          console.log('  .metrics            Show performance metrics');
          console.log('  select <table>      Select all from table');
          console.log('  count <table>       Count records in table');
          console.log('  clear               Clear screen\n');
        } else if (cmd === '.stats') {
          const metrics = db.getMetrics();
          console.log(chalk.bold('\n📊 Database Stats:'));
          console.log(`  Operations: ${metrics.database.count || 0}`);
          console.log(`  Avg Latency: ${(metrics.database.averageDuration || 0).toFixed(2)}ms\n`);
        } else if (cmd === '.metrics') {
          const metrics = db.getMetrics();
          console.log(chalk.bold('\n📊 Full Metrics:'));
          console.log(JSON.stringify(metrics, null, 2));
          console.log('');
        } else if (cmd === '.clear') {
          console.clear();
        } else if (cmd.startsWith('select ')) {
          const table = cmd.replace('select ', '').trim();
          try {
            const records = await db.select(table);
            console.log(chalk.bold(`\nFound ${records.length} records in ${table}:`));
            console.log(JSON.stringify(records, null, 2));
            console.log('');
          } catch (err: any) {
            console.error(chalk.red(`Error: ${err.message}\n`));
          }
        } else if (cmd.startsWith('count ')) {
          const table = cmd.replace('count ', '').trim();
          try {
            const records = await db.select(table);
            console.log(chalk.bold(`\n${table}: ${records.length} records\n`));
          } catch (err: any) {
            console.error(chalk.red(`Error: ${err.message}\n`));
          }
        } else if (cmd.length > 0) {
          console.log(chalk.yellow('Unknown command. Type .help for available commands\n'));
        }

        rl.prompt();
      });

      rl.on('close', () => {
        db.close();
        console.log(chalk.green('\n👋 Goodbye!\n'));
        process.exit(0);
      });

    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

program.command('db:export')
  .description('Export table data to file')
  .option('-c, --config <path>', 'Path to config file', 'zero.config.ts')
  .option('-t, --table <name>', 'Table name to export')
  .option('-f, --format <format>', 'Output format (json|csv)', 'json')
  .option('-o, --output <file>', 'Output file path')
  .action(async (options) => {
    if (!options.table) {
      console.error(chalk.red('Error: --table option is required'));
      process.exit(1);
    }

    const spinner = ora(`Exporting ${options.table}...`).start();

    try {
      const db = await getDatabase(options.config);
      const records = await db.select(options.table);

      if (records.length === 0) {
        spinner.warn(chalk.yellow(`⚠️  No records found in ${options.table}`));
        await db.close();
        return;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const ext = options.format === 'csv' ? 'csv' : 'json';
      const defaultFile = `${options.table}_export_${timestamp}.${ext}`;
      const outputFile = options.output || path.join(process.cwd(), 'exports', defaultFile);

      const outputDir = path.dirname(outputFile);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      let content = '';

      if (options.format === 'csv') {
        const headers = Object.keys(records[0]);
        const csvRows = [
          headers.join(','),
          ...records.map((row: any) => headers.map(h => {
            const val = row[h];
            return typeof val === 'string' && val.includes(',') ? `"${val}"` : val;
          }).join(','))
        ];
        content = csvRows.join('\n');
      } else {
        content = JSON.stringify(records, null, 2);
      }

      fs.writeFileSync(outputFile, content);

      const fileSize = fs.statSync(outputFile).size;
      spinner.succeed(chalk.green(`✅ Exported ${records.length} records to ${outputFile}`));
      console.log(chalk.gray(`  Size: ${formatBytes(fileSize)}`));
      console.log(chalk.gray(`  Format: ${options.format.toUpperCase()}`));

      await db.close();
    } catch (error: any) {
      spinner.fail(chalk.red('❌ Export failed'));
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

program.command('db:import')
  .description('Import data from file to table')
  .argument('<file>', 'Input file path')
  .option('-c, --config <path>', 'Path to config file', 'zero.config.ts')
  .option('-t, --table <name>', 'Table name')
  .option('-f, --format <format>', 'Input format (json|csv)', 'json')
  .action(async (inputFile, options) => {
    if (!options.table) {
      console.error(chalk.red('Error: --table option is required'));
      process.exit(1);
    }

    if (!fs.existsSync(inputFile)) {
      console.error(chalk.red(`Error: File not found: ${inputFile}`));
      process.exit(1);
    }

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: chalk.yellow(`⚠️  This will import data to ${options.table}. Are you sure?`),
        default: false
      }
    ]);

    if (!confirm) {
      console.log(chalk.yellow('Import cancelled'));
      return;
    }

    const spinner = ora(`Importing to ${options.table}...`).start();

    try {
      const db = await getDatabase(options.config);
      const content = fs.readFileSync(inputFile, 'utf-8');
      let data: any[] = [];

      if (options.format === 'csv') {
        const lines = content.trim().split('\n');
        const headers = lines[0].split(',');
        data = lines.slice(1).map((line: string) => {
          const values = line.split(',');
          const row: any = {};
          headers.forEach((h, i) => {
            row[h] = values[i]?.replace(/"/g, '').trim();
          });
          return row;
        });
      } else {
        data = JSON.parse(content);
      }

      const count = await db.bulkInsert(options.table, data);
      spinner.succeed(chalk.green(`✅ Imported ${count} records to ${options.table}`));

      await db.close();
    } catch (error: any) {
      spinner.fail(chalk.red('❌ Import failed'));
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

program.parse();
