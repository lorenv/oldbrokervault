import { db, pool } from './db';

// Database retry utility for handling connection issues
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // Only retry on connection-related errors
      if (error.message?.includes('Connection terminated unexpectedly') ||
          error.message?.includes('connection timeout') ||
          error.message?.includes('ECONNRESET') ||
          error.message?.includes('connect ECONNREFUSED')) {
        
        if (attempt < maxRetries) {
          console.log(`Database operation failed (attempt ${attempt}/${maxRetries}), retrying in ${delayMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
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