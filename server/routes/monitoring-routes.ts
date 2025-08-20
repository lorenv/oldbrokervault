/**
 * Monitoring Routes for Database and Application Performance
 * Provides health checks and metrics endpoints for monitoring
 */

import { Express } from 'express';
import { poolOptimizer } from '../db';
import { shareCache } from '../cache';
import { db } from '../db';
import { sql } from 'drizzle-orm';

export function registerMonitoringRoutes(app: Express) {
  /**
   * Health check endpoint
   * Returns 200 if healthy, 503 if unhealthy
   */
  app.get('/api/health', async (req, res) => {
    try {
      // Check database connectivity
      const dbHealthy = await checkDatabaseHealth();
      
      // Check pool health
      const poolHealthy = poolOptimizer.isHealthy();
      
      // Get metrics
      const poolMetrics = poolOptimizer.getMetrics();
      const cacheStats = shareCache.getStats();
      
      const isHealthy = dbHealthy && poolHealthy;
      
      const health = {
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        checks: {
          database: dbHealthy ? 'ok' : 'failed',
          connectionPool: poolHealthy ? 'ok' : 'degraded',
          cache: cacheStats.autoCleanupActive ? 'ok' : 'inactive'
        },
        metrics: {
          pool: {
            totalConnections: poolMetrics.totalConnections,
            waitingClients: poolMetrics.waitingClients,
            efficiency: poolMetrics.poolEfficiency
          },
          cache: {
            entries: cacheStats.totalEntries,
            utilization: cacheStats.utilizationPercent + '%',
            memoryMB: cacheStats.memoryUsageMB
          }
        }
      };
      
      res.status(isHealthy ? 200 : 503).json(health);
    } catch (error) {
      res.status(503).json({
        status: 'error',
        message: 'Health check failed',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  });

  /**
   * Detailed metrics endpoint (protected)
   */
  app.get('/api/metrics', async (req, res) => {
    // Only allow authenticated admins or monitoring systems
    if (!req.isAuthenticated() || !req.user?.isAdmin) {
      // Also allow with monitoring token
      const monitoringToken = req.headers['x-monitoring-token'];
      if (monitoringToken !== process.env.MONITORING_TOKEN) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }

    try {
      // Get all metrics
      const poolMetrics = poolOptimizer.getMetrics();
      const cacheStats = shareCache.getStats();
      const recommendations = poolOptimizer.getRecommendations();
      
      // Get database statistics
      const dbStats = await getDatabaseStatistics();
      
      const metrics = {
        timestamp: new Date().toISOString(),
        database: {
          ...dbStats,
          pool: {
            ...poolMetrics,
            recommendations
          }
        },
        cache: cacheStats,
        system: {
          uptime: process.uptime(),
          memory: {
            heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
            rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
            external: Math.round(process.memoryUsage().external / 1024 / 1024)
          },
          nodeVersion: process.version,
          platform: process.platform,
          environment: process.env.NODE_ENV
        }
      };
      
      res.json(metrics);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to collect metrics',
        message: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  });

  /**
   * Database performance endpoint
   */
  app.get('/api/metrics/database', async (req, res) => {
    // Admin only
    if (!req.isAuthenticated() || !req.user?.isAdmin) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      // Get slow queries (requires pg_stat_statements extension)
      const slowQueries = await getSlowQueries();
      
      // Get table sizes
      const tableSizes = await getTableSizes();
      
      // Get index usage
      const indexUsage = await getIndexUsage();
      
      res.json({
        timestamp: new Date().toISOString(),
        slowQueries,
        tableSizes,
        indexUsage,
        poolMetrics: poolOptimizer.getMetrics(),
        recommendations: poolOptimizer.getRecommendations()
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to collect database metrics',
        message: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  });

  /**
   * Cache statistics endpoint
   */
  app.get('/api/metrics/cache', (req, res) => {
    const stats = shareCache.getStats();
    res.json({
      timestamp: new Date().toISOString(),
      ...stats,
      recommendations: getCacheRecommendations(stats)
    });
  });

  /**
   * Readiness probe (for container orchestration)
   */
  app.get('/api/ready', async (req, res) => {
    try {
      // Check if database is accessible
      await db.execute(sql`SELECT 1`);
      res.json({ ready: true });
    } catch (error) {
      res.status(503).json({ ready: false });
    }
  });

  /**
   * Liveness probe (for container orchestration)
   */
  app.get('/api/alive', (req, res) => {
    res.json({ alive: true, uptime: process.uptime() });
  });
}

/**
 * Check database health
 */
async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const result = await db.execute(sql`SELECT 1 as health`);
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

/**
 * Get database statistics
 */
async function getDatabaseStatistics() {
  try {
    const stats = await db.execute(sql`
      SELECT 
        (SELECT count(*) FROM users) as total_users,
        (SELECT count(*) FROM cim_documents) as total_documents,
        (SELECT count(*) FROM session) as active_sessions,
        (SELECT pg_database_size(current_database())) as database_size
    `);
    
    return stats.rows[0] || {};
  } catch (error) {
    console.error('Failed to get database statistics:', error);
    return {};
  }
}

/**
 * Get slow queries (requires pg_stat_statements)
 */
async function getSlowQueries() {
  try {
    const queries = await db.execute(sql`
      SELECT 
        calls,
        mean_exec_time as avg_ms,
        max_exec_time as max_ms,
        query
      FROM pg_stat_statements
      WHERE mean_exec_time > 100
      ORDER BY mean_exec_time DESC
      LIMIT 10
    `);
    
    return queries.rows;
  } catch (error) {
    // pg_stat_statements might not be available
    return [];
  }
}

/**
 * Get table sizes
 */
async function getTableSizes() {
  try {
    const sizes = await db.execute(sql`
      SELECT 
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
        n_live_tup as row_count
      FROM pg_stat_user_tables
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
      LIMIT 10
    `);
    
    return sizes.rows;
  } catch (error) {
    return [];
  }
}

/**
 * Get index usage statistics
 */
async function getIndexUsage() {
  try {
    const usage = await db.execute(sql`
      SELECT 
        schemaname,
        tablename,
        indexname,
        idx_scan as index_scans,
        pg_size_pretty(pg_relation_size(indexrelid)) as index_size
      FROM pg_stat_user_indexes
      ORDER BY idx_scan DESC
      LIMIT 10
    `);
    
    return usage.rows;
  } catch (error) {
    return [];
  }
}

/**
 * Get cache recommendations based on statistics
 */
function getCacheRecommendations(stats: any): string[] {
  const recommendations: string[] = [];
  
  const utilizationPercent = parseFloat(stats.utilizationPercent);
  const memoryUsageMB = parseFloat(stats.memoryUsageMB);
  
  if (utilizationPercent > 80) {
    recommendations.push('Cache is near capacity - consider increasing max size');
  }
  
  if (stats.expiredEntries > stats.validEntries) {
    recommendations.push('Many expired entries - TTL might be too short');
  }
  
  if (memoryUsageMB > 100) {
    recommendations.push('High memory usage - consider reducing cache size or TTL');
  }
  
  if (!stats.autoCleanupActive) {
    recommendations.push('Auto cleanup is not active - enable for better memory management');
  }
  
  return recommendations;
}