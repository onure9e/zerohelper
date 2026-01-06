import { Command } from 'commander';
import chalk from 'chalk';
import { getDatabase } from '../utils/config';

export const replCommand = new Command().name('repl');

replCommand
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
