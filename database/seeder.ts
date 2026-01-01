// database/seeder.ts
import { IDatabase } from './IDatabase';
import { randomText, randomNumber, randomArray } from '../functions/index';

export interface SeederField {
  type: 'string' | 'number' | 'email' | 'id' | 'date' | 'boolean' | 'pick';
  values?: any[]; // For 'pick' type
  min?: number;
  max?: number;
  length?: number;
}

export interface SeederSchema {
  [key: string]: SeederField;
}

export class DataSeeder {
  private db: IDatabase;

  constructor(database: IDatabase) {
    this.db = database;
  }

  private generateValue(field: SeederField): any {
    switch (field.type) {
      case 'id': return Date.now().toString(36) + Math.random().toString(36).substr(2);
      case 'email': return `${randomText(5)}@${randomArray(['gmail.com', 'outlook.com', 'zero.io'])}`;
      case 'number': return randomNumber(field.min ?? 0, field.max ?? 1000);
      case 'string': return randomText(field.length ?? 8);
      case 'boolean': return Math.random() > 0.5;
      case 'date': return new Date(Date.now() - Math.random() * 10000000000);
      case 'pick': return randomArray(field.values ?? []);
      default: return null;
    }
  }

  /**
   * Seeds a table with mock data based on a schema.
   */
  async seed(table: string, count: number, schema: SeederSchema): Promise<number> {
    const dataArray = [];
    for (let i = 0; i < count; i++) {
      const row: any = {};
      for (const [key, field] of Object.entries(schema)) {
        row[key] = this.generateValue(field);
      }
      dataArray.push(row);
    }

    await this.db.bulkInsert(table, dataArray);
    return count;
  }
}
