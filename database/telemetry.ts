// database/telemetry.ts

export interface DatabaseMetrics {
  operation: string;
  table: string;
  duration: number; // ms
  timestamp: number;
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  keys: number;
}

class TelemetrySystem {
  private dbMetrics: DatabaseMetrics[] = [];
  private cacheStats = { hits: 0, misses: 0 };
  private maxLogs = 1000;

  recordDb(metric: DatabaseMetrics) {
    this.dbMetrics.push(metric);
    if (this.dbMetrics.length > this.maxLogs) this.dbMetrics.shift();
  }

  recordCacheHit() { this.cacheStats.hits++; }
  recordCacheMiss() { this.cacheStats.misses++; }

  getMetrics() {
    const totalOps = this.dbMetrics.length;
    const avgDuration = totalOps > 0 
      ? this.dbMetrics.reduce((s, m) => s + m.duration, 0) / totalOps 
      : 0;

    return {
      database: {
        totalOperations: totalOps,
        averageDuration: avgDuration.toFixed(2) + 'ms',
        slowestOperations: [...this.dbMetrics].sort((a, b) => b.duration - a.duration).slice(0, 5),
        recentLogs: this.dbMetrics.slice(-10)
      },
      cache: {
        ...this.cacheStats,
        ratio: (this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses || 1) * 100).toFixed(2) + '%'
      }
    };
  }

  clear() {
    this.dbMetrics = [];
    this.cacheStats = { hits: 0, misses: 0 };
  }
}

export const telemetry = new TelemetrySystem();
