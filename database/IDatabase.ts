import { telemetry } from './telemetry';

export type HookType = 'beforeInsert' | 'afterInsert' | 'beforeUpdate' | 'afterUpdate' | 'beforeDelete' | 'afterDelete';
export type HookFunction = (table: string, data: any) => Promise<void> | void;

/**
 * Tüm veritabanı adaptörlerinin uyması gereken ortak arayüzü tanımlar.
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
   * Bir lifecycle hook kaydeder.
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
   * Belirtilen koşullara göre birden çok kayıt seçer.
   */
  abstract select<T = any>(table: string, where?: Record<string, any> | null): Promise<T[]>;

  /**
   * Belirtilen koşullara göre tek bir kayıt seçer.
   */
  abstract selectOne<T = any>(table: string, where?: Record<string, any> | null): Promise<T | null>;

  /**
   * Yeni bir kayıt ekler.
   */
  abstract insert(table: string, data: Record<string, any>): Promise<number | string | any>;

  /**
   * Belirtilen koşullara uyan kayıtları günceller.
   */
  abstract update(table: string, data: Record<string, any>, where: Record<string, any>): Promise<number>;

  /**
   * Bir kaydı günceller veya yoksa yeni bir kayıt olarak ekler (Upsert).
   */
  abstract set(table: string, data: Record<string, any>, where: Record<string, any>): Promise<any>;

  /**
   * Belirtilen koşullara uyan kayıtları siler.
   */
  abstract delete(table: string, where: Record<string, any>): Promise<number>;

  /**
   * Birden çok kaydı toplu olarak ekler.
   */
  abstract bulkInsert(table: string, dataArray: Record<string, any>[]): Promise<number>;

  /**
   * Numerik alanları artırır (increment).
   */
  abstract increment(table: string, increments: Record<string, number>, where: Record<string, any>): Promise<number>;

  /**
   * Numerik alanları azaltır (decrement).
   */
  abstract decrement(table: string, decrements: Record<string, number>, where: Record<string, any>): Promise<number>;

  /**
   * Veritabanı bağlantısını güvenli bir şekilde sonlandırır.
   */
  abstract close(): Promise<void>;
}

export default IDatabase;
