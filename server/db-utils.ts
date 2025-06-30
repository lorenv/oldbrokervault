import { db, pool } from './db';

/**
 * Timeout-protected database operation for deployment health checks
 * Prevents database operations from blocking server startup
 */
export async function withTimeout<T>(
  operation: Promise<T>, 
  timeoutMs: number = 3000,
  timeoutMessage: string = 'Database operation timed out'
): Promise<T> {
  return Promise.race([
    operation,
    new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
    )
  ]);
}

/**
 * Test database connection with timeout for health checks
 */
export async function testConnection(): Promise<boolean> {
  try {
    await withTimeout(
      pool.query('SELECT 1'), 
      2000, 
      'Database connection test timed out'
    );
    return true;
  } catch (error) {
    console.warn('Database connection test failed:', error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

// Enhanced database retry utility with timeout protection
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 2, // Reduced retries for faster response
  delayMs: number = 500, // Faster retry
  timeoutMs: number = 15000 // 15 second total timeout
): Promise<T> {
  let lastError: any;
  const startTime = Date.now();
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Check if we've exceeded total timeout
      if (Date.now() - startTime > timeoutMs) {
        throw new Error('Database operation timeout - service temporarily unavailable');
      }
      
      // Wrap operation in timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Operation timeout')), 8000);
      });
      
      const result = await Promise.race([operation(), timeoutPromise]);
      return result;
    } catch (error: any) {
      lastError = error;
      
      // Always retry on connection-related errors or timeouts
      if (error.message?.includes('Connection terminated') ||
          error.message?.includes('timeout') ||
          error.message?.includes('ECONNRESET') ||
          error.message?.includes('ENOTFOUND') ||
          error.message?.includes('connect ECONNREFUSED')) {
        
        if (attempt < maxRetries && (Date.now() - startTime) < timeoutMs) {
          console.log(`Database retry ${attempt}/${maxRetries}: ${error.message}`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          continue;
        }
      }
      
      // Don't retry for other types of errors
      throw error;
    }
  }
  
  throw lastError;
}

// Health check for database connection
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await withRetry(async () => {
      const result = await db.execute('SELECT 1 as health');
      return result;
    }, 2, 500);
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

// Graceful connection management
export async function ensureConnection(): Promise<void> {
  try {
    await withRetry(async () => {
      // Test the connection
      await db.execute('SELECT NOW()');
    }, 2, 500);
  } catch (error) {
    console.error('Failed to ensure database connection:', error);
    throw new Error('Database connection unavailable');
  }
}