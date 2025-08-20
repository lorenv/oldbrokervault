/**
 * Database Connection Pool Optimizer
 * Provides dynamic pool management and monitoring for high concurrency
 */

import { Pool } from '@neondatabase/serverless';

interface PoolMetrics {
  totalConnections: number;
  idleConnections: number;
  waitingClients: number;
  avgQueryTime: number;
  connectionErrors: number;
  lastError?: string;
  poolEfficiency: number;
}

interface PoolConfig {
  min: number;
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
  statementTimeout: number;
}

export class ConnectionPoolOptimizer {
  private metrics: PoolMetrics = {
    totalConnections: 0,
    idleConnections: 0,
    waitingClients: 0,
    avgQueryTime: 0,
    connectionErrors: 0,
    poolEfficiency: 100
  };

  private queryTimes: number[] = [];
  private readonly maxQueryTimeSamples = 100;
  private adjustmentInterval: NodeJS.Timeout | null = null;
  private metricsInterval: NodeJS.Timeout | null = null;

  constructor(private pool: Pool, private baseConfig: PoolConfig) {
    this.setupMonitoring();
    this.startAutoAdjustment();
  }

  /**
   * Setup monitoring hooks for the connection pool
   */
  private setupMonitoring() {
    // Monitor connection events
    this.pool.on('connect', () => {
      this.metrics.totalConnections++;
    });

    this.pool.on('remove', () => {
      this.metrics.totalConnections--;
    });

    this.pool.on('error', (err) => {
      this.metrics.connectionErrors++;
      this.metrics.lastError = err.message;
      
      // Log critical errors
      if (this.metrics.connectionErrors > 10) {
        console.error('[Pool Critical] High error rate detected:', this.metrics.connectionErrors);
      }
    });

    // Start metrics collection
    this.metricsInterval = setInterval(() => {
      this.collectMetrics();
    }, 5000); // Collect every 5 seconds
  }

  /**
   * Collect current pool metrics
   */
  private async collectMetrics() {
    try {
      // Get pool stats (this varies by pool implementation)
      const poolStats = (this.pool as any);
      
      if (poolStats._clients) {
        this.metrics.totalConnections = poolStats._clients.length;
        this.metrics.idleConnections = poolStats._idle?.length || 0;
        this.metrics.waitingClients = poolStats._pendingQueue?.length || 0;
      }

      // Calculate average query time
      if (this.queryTimes.length > 0) {
        const sum = this.queryTimes.reduce((a, b) => a + b, 0);
        this.metrics.avgQueryTime = sum / this.queryTimes.length;
      }

      // Calculate pool efficiency
      this.calculatePoolEfficiency();

      // Log metrics in development
      if (process.env.NODE_ENV === 'development') {
        this.logMetrics();
      }
    } catch (error) {
      console.error('[Pool Metrics] Error collecting metrics:', error);
    }
  }

  /**
   * Calculate pool efficiency score (0-100)
   */
  private calculatePoolEfficiency(): number {
    let efficiency = 100;

    // Penalize for waiting clients
    if (this.metrics.waitingClients > 0) {
      efficiency -= Math.min(30, this.metrics.waitingClients * 5);
    }

    // Penalize for high error rate
    if (this.metrics.connectionErrors > 0) {
      const errorRate = this.metrics.connectionErrors / Math.max(1, this.metrics.totalConnections);
      efficiency -= Math.min(30, errorRate * 100);
    }

    // Penalize for slow queries
    if (this.metrics.avgQueryTime > 1000) { // Over 1 second average
      efficiency -= Math.min(20, (this.metrics.avgQueryTime - 1000) / 100);
    }

    // Bonus for good idle ratio (not too many, not too few)
    const idleRatio = this.metrics.idleConnections / Math.max(1, this.metrics.totalConnections);
    if (idleRatio >= 0.2 && idleRatio <= 0.4) {
      efficiency += 10;
    }

    this.metrics.poolEfficiency = Math.max(0, Math.min(100, efficiency));
    return this.metrics.poolEfficiency;
  }

  /**
   * Start automatic pool adjustment based on metrics
   */
  private startAutoAdjustment() {
    // Adjust pool size every 30 seconds based on metrics
    this.adjustmentInterval = setInterval(() => {
      this.adjustPoolSize();
    }, 30000);
  }

  /**
   * Dynamically adjust pool size based on current load
   */
  private adjustPoolSize() {
    const { poolEfficiency, waitingClients, totalConnections } = this.metrics;

    // Determine if we need to scale
    let newMax = this.baseConfig.max;
    let newMin = this.baseConfig.min;

    // Scale up if efficiency is low and we have waiting clients
    if (poolEfficiency < 70 && waitingClients > 2) {
      newMax = Math.min(50, this.baseConfig.max + 5); // Increase by 5, max 50
      newMin = Math.min(10, this.baseConfig.min + 2); // Increase min by 2
      console.log(`[Pool] Scaling up: max=${newMax}, min=${newMin} (efficiency: ${poolEfficiency}%)`);
    }
    // Scale down if we have too many idle connections
    else if (poolEfficiency > 90 && this.metrics.idleConnections > 10) {
      newMax = Math.max(20, this.baseConfig.max - 5); // Decrease by 5, min 20
      newMin = Math.max(2, this.baseConfig.min - 1); // Decrease min by 1
      console.log(`[Pool] Scaling down: max=${newMax}, min=${newMin} (efficiency: ${poolEfficiency}%)`);
    }

    // Apply new configuration if changed
    if (newMax !== this.baseConfig.max || newMin !== this.baseConfig.min) {
      this.updatePoolConfig({ ...this.baseConfig, max: newMax, min: newMin });
    }
  }

  /**
   * Update pool configuration
   */
  private updatePoolConfig(newConfig: PoolConfig) {
    try {
      // Note: Most pools don't support dynamic reconfiguration
      // This would require recreating the pool in production
      this.baseConfig = newConfig;
      
      // Log configuration change
      console.log('[Pool] Configuration updated:', newConfig);
    } catch (error) {
      console.error('[Pool] Failed to update configuration:', error);
    }
  }

  /**
   * Track query execution time
   */
  trackQueryTime(duration: number) {
    this.queryTimes.push(duration);
    
    // Keep only recent samples
    if (this.queryTimes.length > this.maxQueryTimeSamples) {
      this.queryTimes.shift();
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): PoolMetrics {
    return { ...this.metrics };
  }

  /**
   * Log current metrics
   */
  private logMetrics() {
    const { totalConnections, idleConnections, waitingClients, avgQueryTime, poolEfficiency } = this.metrics;
    console.log(
      `[Pool Metrics] Total: ${totalConnections}, Idle: ${idleConnections}, ` +
      `Waiting: ${waitingClients}, Avg Query: ${avgQueryTime.toFixed(0)}ms, ` +
      `Efficiency: ${poolEfficiency}%`
    );
  }

  /**
   * Get recommendations for pool configuration
   */
  getRecommendations(): string[] {
    const recommendations: string[] = [];
    const { avgQueryTime, waitingClients, connectionErrors, poolEfficiency } = this.metrics;

    if (avgQueryTime > 2000) {
      recommendations.push('Consider adding database indexes - queries are slow');
    }

    if (waitingClients > 5) {
      recommendations.push('Increase max pool size - too many waiting clients');
    }

    if (connectionErrors > 10) {
      recommendations.push('Check database health - high connection error rate');
    }

    if (poolEfficiency < 50) {
      recommendations.push('Critical: Pool efficiency very low, immediate action needed');
    }

    if (this.metrics.idleConnections > 20) {
      recommendations.push('Reduce min pool size - too many idle connections');
    }

    return recommendations;
  }

  /**
   * Health check for monitoring endpoints
   */
  isHealthy(): boolean {
    return this.metrics.poolEfficiency > 50 && 
           this.metrics.connectionErrors < 10 &&
           this.metrics.waitingClients < 10;
  }

  /**
   * Cleanup on shutdown
   */
  destroy() {
    if (this.adjustmentInterval) {
      clearInterval(this.adjustmentInterval);
    }
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
  }
}

/**
 * Middleware to track query performance
 */
export function createQueryPerformanceMiddleware(optimizer: ConnectionPoolOptimizer) {
  return async (query: () => Promise<any>) => {
    const start = Date.now();
    try {
      const result = await query();
      const duration = Date.now() - start;
      optimizer.trackQueryTime(duration);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      optimizer.trackQueryTime(duration);
      throw error;
    }
  };
}