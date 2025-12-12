/**
 * Database Query Logger
 *
 * Monitors and logs slow queries to help identify performance bottlenecks.
 * Only active in development or when DEBUG_QUERIES=true.
 */

interface QueryLog {
  query: string;
  duration: number;
  timestamp: Date;
  params?: unknown[];
}

class QueryLogger {
  private enabled: boolean;
  private slowQueryThreshold: number; // ms
  private queryLogs: QueryLog[] = [];
  private maxLogs: number = 100;

  constructor() {
    this.enabled = process.env.NODE_ENV === 'development' || process.env.DEBUG_QUERIES === 'true';
    this.slowQueryThreshold = parseInt(process.env.SLOW_QUERY_MS || '100', 10);
  }

  /**
   * Wrap a query execution to measure and log timing
   */
  async measureQuery<T>(
    queryName: string,
    queryFn: () => Promise<T>,
    params?: unknown[]
  ): Promise<T> {
    if (!this.enabled) {
      return queryFn();
    }

    const start = performance.now();
    try {
      const result = await queryFn();
      const duration = performance.now() - start;

      this.logQuery(queryName, duration, params);

      return result;
    } catch (error) {
      const duration = performance.now() - start;
      console.error(`❌ Query failed [${duration.toFixed(2)}ms]: ${queryName}`);
      throw error;
    }
  }

  private logQuery(query: string, duration: number, params?: unknown[]): void {
    const log: QueryLog = {
      query,
      duration,
      timestamp: new Date(),
      params
    };

    // Store log
    this.queryLogs.push(log);
    if (this.queryLogs.length > this.maxLogs) {
      this.queryLogs.shift();
    }

    // Log slow queries
    if (duration >= this.slowQueryThreshold) {
      console.warn(
        `🐢 Slow query [${duration.toFixed(2)}ms]: ${query}`,
        params ? `params: ${JSON.stringify(params).slice(0, 100)}` : ''
      );
    } else if (process.env.DEBUG_QUERIES === 'verbose') {
      console.log(`📊 Query [${duration.toFixed(2)}ms]: ${query}`);
    }
  }

  /**
   * Get statistics about recent queries
   */
  getStats(): {
    totalQueries: number;
    slowQueries: number;
    averageTime: number;
    maxTime: number;
    slowestQueries: QueryLog[];
  } {
    if (this.queryLogs.length === 0) {
      return {
        totalQueries: 0,
        slowQueries: 0,
        averageTime: 0,
        maxTime: 0,
        slowestQueries: []
      };
    }

    const totalTime = this.queryLogs.reduce((sum, log) => sum + log.duration, 0);
    const slowQueries = this.queryLogs.filter(log => log.duration >= this.slowQueryThreshold);

    return {
      totalQueries: this.queryLogs.length,
      slowQueries: slowQueries.length,
      averageTime: totalTime / this.queryLogs.length,
      maxTime: Math.max(...this.queryLogs.map(log => log.duration)),
      slowestQueries: [...this.queryLogs]
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 10)
    };
  }

  /**
   * Clear all stored logs
   */
  clearLogs(): void {
    this.queryLogs = [];
  }

  /**
   * Log N+1 detection warning
   */
  detectNPlusOne(queryPattern: string, count: number, windowMs: number = 1000): void {
    if (!this.enabled) return;

    const recentLogs = this.queryLogs.filter(
      log =>
        log.query.includes(queryPattern) &&
        Date.now() - log.timestamp.getTime() < windowMs
    );

    if (recentLogs.length >= count) {
      console.warn(
        `⚠️ Potential N+1 detected: "${queryPattern}" called ${recentLogs.length} times in ${windowMs}ms`
      );
    }
  }
}

export const queryLogger = new QueryLogger();

/**
 * Helper to create a measured query wrapper for Drizzle
 *
 * Usage:
 * const users = await measureDbQuery('getUsers', () => db.select().from(usersTable));
 */
export async function measureDbQuery<T>(
  name: string,
  queryFn: () => Promise<T>,
  params?: unknown[]
): Promise<T> {
  return queryLogger.measureQuery(name, queryFn, params);
}

/**
 * Express middleware to add query stats endpoint (dev only)
 */
export function queryStatsMiddleware(app: any): void {
  if (process.env.NODE_ENV !== 'production') {
    app.get('/api/debug/query-stats', (req: any, res: any) => {
      res.json(queryLogger.getStats());
    });
  }
}
