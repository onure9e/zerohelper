import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getDatabase } from '../utils/config';

export const cacheCommand = new Command().name('cache');

cacheCommand
  .command('clear')
  .description('Clear all cache')
  .option('-c, --config <path>', 'Path to config file', 'zero.config.ts')
  .action(async (options) => {
    const spinner = ora('Clearing cache...').start();

    try {
      const db = await getDatabase(options.config);
      const metrics = db.getMetrics();

      const beforeHits = metrics.cache?.hits || 0;
      const beforeMisses = metrics.cache?.misses || 0;

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

cacheCommand
  .command('stats')
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
