import { telemetry } from './telemetry';

export type HookType = 'beforeInsert' | 'afterInsert' | 'beforeUpdate' | 'afterUpdate' | 'beforeDelete' | 'afterDelete';
export type HookFunction = (table: string, data: any) => Promise<void> | void;

/**
 * Defines the common interface that all database adapters must implement.
 */
export abstract class IDatabase {
  protected hooks: Record<HookType, HookFunction[]> = {
    beforeInsert: [],
    afterInsert: [],
    beforeUpdate: [],
    afterUpdate: [],
    beforeDelete: [],
    afterDelete: [],
  };

  /**
   * Registers a lifecycle hook.
   */
  public on(hook: HookType, fn: HookFunction): void {
    if (this.hooks[hook]) {
      this.hooks[hook].push(fn);
    }
  }

  protected async runHooks(hook: HookType, table: string, data: any): Promise<void> {
    for (const fn of this.hooks[hook]) {
      await fn(table, data);
    }
  }

  /**
   * Returns performance metrics for the database and cache.
   */
  public getMetrics() {
    return telemetry.getMetrics();
  }

  protected recordMetric(operation: string, table: string, duration: number) {
    telemetry.recordDb({
      operation,
      table,
      duration,
      timestamp: Date.now()
    });
  }

  /**
   * Selects multiple records based on the specified conditions.
   */
  abstract select<T = any>(table: string, where?: Record<string, any> | null): Promise<T[]>;

  /**
   * Selects a single record based on the specified conditions.
   */
  abstract selectOne<T = any>(table: string, where?: Record<string, any> | null): Promise<T | null>;

  /**
   * Inserts a new record.
   */
  abstract insert(table: string, data: Record<string, any>): Promise<number | string | any>;

  /**
   * Updates records matching the specified conditions.
   */
  abstract update(table: string, data: Record<string, any>, where: Record<string, any>): Promise<number>;

  /**
   * Updates a record or inserts it as a new record if it doesn't exist (Upsert).
   */
  abstract set(table: string, data: Record<string, any>, where: Record<string, any>): Promise<any>;

  /**
   * Deletes records matching the specified conditions.
   */
  abstract delete(table: string, where: Record<string, any>): Promise<number>;

  /**
   * Inserts multiple records in bulk.
   */
  abstract bulkInsert(table: string, dataArray: Record<string, any>[]): Promise<number>;

  /**
   * Increments numeric fields.
   */
  abstract increment(table: string, increments: Record<string, number>, where: Record<string, any>): Promise<number>;

  /**
   * Decrements numeric fields.
   */
  abstract decrement(table: string, decrements: Record<string, number>, where: Record<string, any>): Promise<number>;

  /**
   * Safely closes the database connection.
   */
  abstract close(): Promise<void>;
}

export default IDatabase;
