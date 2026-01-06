#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { version } from '../package.json';

import { initCommand } from './commands/init';
import { dbCommand } from './commands/db';
import { cacheCommand } from './commands/cache';
import { migrateCommand, makeMigrationCommand } from './commands/migrate';
import { zpackCommand } from './commands/zpack';
import { replCommand } from './commands/repl';

const program = new Command();

program
  .name('zero')
  .description(chalk.cyan('ZeroHelper CLI - Elite Database Management Tool'))
  .version(version);

program.addCommand(initCommand);
program.addCommand(dbCommand);
program.addCommand(cacheCommand);
program.addCommand(migrateCommand);
program.addCommand(makeMigrationCommand);
program.addCommand(zpackCommand);
program.addCommand(replCommand);

program.parse();
