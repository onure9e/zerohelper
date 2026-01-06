import inquirer from 'inquirer';

export async function confirmAction(message: string): Promise<boolean> {
  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message,
      default: false
    }
  ]);
  return confirm;
}

export async function getInitAnswers() {
  return inquirer.prompt([
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
}

export async function getFilePathPrompts(adapter: string, enableCache: boolean, cacheType: string) {
  const prompts: any[] = [];

  if (['json', 'zpack', 'sqlite', 'toon'].includes(adapter)) {
    prompts.push({
      type: 'input',
      name: 'filePath',
      message: 'Enter database file path:',
      default: () => {
        const ext = adapter === 'json' ? '.json' : 
                     adapter === 'zpack' ? '.zpack' :
                     adapter === 'toon' ? '.toon' : '.db';
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

  if (enableCache) {
    prompts.push({
      type: 'list',
      name: 'cacheType',
      message: 'Cache type:',
      choices: ['memory', 'redis'],
      default: 'memory',
      when: () => !cacheType
    });

    if (!cacheType || cacheType === 'memory') {
      prompts.push({
        type: 'number',
        name: 'cacheTtl',
        message: 'Cache TTL (seconds):',
        default: 300,
        when: (ans: any) => !cacheType || ans.cacheType === 'memory'
      });
    }
  }

  return prompts;
}
