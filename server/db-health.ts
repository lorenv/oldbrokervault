import { pool } from './db';

// Simple database health check and recovery
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (error) {
    console.error('Database health check failed:', error.message);
    return false;
  }
}

// Force connection pool restart if unhealthy
export async function restartConnectionPool(): Promise<void> {
  try {
    console.log('Restarting database connection pool...');
    await pool.end();
    // Pool will automatically recreate connections on next query
    console.log('Database pool restarted');
  } catch (error) {
    console.error('Error restarting pool:', error.message);
  }
}

// Background health monitor
let healthCheckInterval: NodeJS.Timeout | null = null;

export function startHealthMonitor(): void {
  if (healthCheckInterval) return;
  
  healthCheckInterval = setInterval(async () => {
    const isHealthy = await checkDatabaseHealth();
    if (!isHealthy) {
      console.log('Database unhealthy, attempting recovery...');
      await restartConnectionPool();
    }
  }, 30000); // Check every 30 seconds
}

export function stopHealthMonitor(): void {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }
}