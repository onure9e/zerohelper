import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs';
import path from 'path';
import * as database from '../../database';
import { getDatabase } from '../utils/config';
import { confirmAction } from '../utils/prompts';

export const migrateCommand = new Command().name('migration');

migrateCommand
  .command('migrate')
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
        await migration.runMigration(m as any, 'up');
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

migrateCommand
  .command('rollback')
  .description('Rollback the last migration(s)')
  .option('-c, --config <path>', 'Path to config file', 'zero.config.ts')
  .option('-d, --migrations-dir <path>', 'Migrations directory path', './migrations')
  .option('-s, --steps <number>', 'Number of migrations to rollback', '1')
  .action(async (options) => {
    const steps = parseInt(options.steps);
    
    const confirmed = await confirmAction(chalk.yellow(`⚠️  Are you sure you want to rollback ${steps} migration(s)?`));

    if (!confirmed) {
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

migrateCommand
  .command('status')
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

export const makeMigrationCommand = new Command().name('make');

makeMigrationCommand
  .command('migration')
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
