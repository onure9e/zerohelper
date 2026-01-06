import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs';
import path from 'path';
import { database } from '../../index';
import { version } from '../../package.json';
import { loadConfig, getDatabase, formatBytes } from '../utils/config';
import { confirmAction } from '../utils/prompts';

export const dbCommand = new Command().name('db');

dbCommand
  .command('test')
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

dbCommand
  .command('stats')
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

dbCommand
  .command('seed')
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

dbCommand
  .command('backup')
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

dbCommand
  .command('restore')
  .description('Restore database from backup file')
  .argument('<backup-file>', 'Path to backup file')
  .option('-c, --config <path>', 'Path to config file', 'zero.config.ts')
  .action(async (backupFile, options) => {
    if (!fs.existsSync(backupFile)) {
      console.error(chalk.red(`Error: Backup file not found: ${backupFile}`));
      process.exit(1);
    }

    const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf-8'));

    const confirmed = await confirmAction(chalk.yellow(`⚠️  This will restore data from backup. Are you sure?`));

    if (!confirmed) {
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

dbCommand
  .command('export')
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

dbCommand
  .command('import')
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

    const confirmed = await confirmAction(chalk.yellow(`⚠️  This will import data to ${options.table}. Are you sure?`));

    if (!confirmed) {
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
