import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { version } from '../../package.json';
import { getInitAnswers, getFilePathPrompts, confirmAction } from '../utils/prompts';

export const initCommand = new Command().name('init');

initCommand
  .description('Initialize ZeroHelper in your project (Interactive)')
  .action(async () => {
    console.log(chalk.bold.blue(`\n🚀 Welcome to ZeroHelper v${version} Setup\n`));

    try {
      const answers = await getInitAnswers();
      const extraPrompts = await getFilePathPrompts(answers.adapter, answers.enableCache, answers.cacheType);
      const extraAnswers = await inquirer.prompt(extraPrompts);
      const finalAnswers = { ...answers, ...extraAnswers };

      const configObject = buildConfig(finalAnswers);
      const configTemplate = formatConfigTemplate(finalAnswers, configObject);

      fs.writeFileSync(path.join(process.cwd(), 'zero.config.ts'), configTemplate);
      
      console.log(chalk.green('\n✅ zero.config.ts created successfully!'));
      
      console.log(chalk.gray('\n📝 Usage example:'));
      console.log(chalk.yellow(`import { database } from '@onurege3467/zerohelper';`));
      console.log(chalk.yellow(`import { zeroConfig } from './zero.config';`));
      console.log(chalk.yellow(`const db = database.createDatabase(zeroConfig);`));
    } catch (error: any) {
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

import inquirer from 'inquirer';
