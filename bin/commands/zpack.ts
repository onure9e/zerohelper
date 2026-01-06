import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs';
import { getDatabase } from '../utils/config';
import { formatBytes } from '../utils/config';

export const zpackCommand = new Command().name('zpack');

zpackCommand
  .command('vacuum')
  .description('Compact a ZPack binary file to save disk space')
  .argument('<file>', 'ZPack file path')
  .action(async (file) => {
    const spinner = ora(`Vacuuming ${file}...`).start();
    const startSize = fs.existsSync(file) ? fs.statSync(file).size : 0;

    try {
      const db = await getDatabase('zero.config.ts');
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
