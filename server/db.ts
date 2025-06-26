import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// Optimize Neon configuration for Replit's native deployment
neonConfig.pipelineConnect = false;
neonConfig.useSecureWebSocket = true;

// Detect Replit environment for deployment optimization
const isReplit = process.env.REPL_ID || process.env.REPLIT_DB_URL || process.env.REPL_SLUG;
const isProduction = process.env.NODE_ENV === 'production';

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Environment-aware connection pool configuration
const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  max: isReplit ? 8 : 5, // More connections for Replit's environment
  min: 0, // No minimum connections for efficient resource usage
  idleTimeoutMillis: isReplit ? 60000 : 30000, // Longer idle timeout for Replit
  connectionTimeoutMillis: isReplit ? 12000 : 8000, // More generous timeout for Replit
  allowExitOnIdle: true, // Allow pool to close when idle for efficiency
  statement_timeout: isReplit ? 20000 : 15000, // Longer statement timeout for Replit
  query_timeout: isReplit ? 20000 : 15000, // Longer query timeout for Replit
};

export const pool = new Pool(poolConfig);

// Set max listeners to prevent warnings - increased for Replit's environment
pool.setMaxListeners(isReplit ? 1000 : 500);

// Add deployment-specific logging
if (isReplit) {
  console.log('🚀 Replit environment detected - Using optimized database configuration');
  console.log(`📊 Pool config: max=${poolConfig.max}, timeout=${poolConfig.connectionTimeoutMillis}ms`);
}

// Enhanced error handling for database connections
pool.on('error', (err) => {
  console.error('Database pool error:', err);
  // Don't exit process on pool errors - let the application continue
});

pool.on('connect', (client) => {
  // Add connection timeout handling
  client.on('error', (err) => {
    console.error('Database client error:', err);
  });
});

// Add graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('Closing database pool...');
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Closing database pool...');
  await pool.end();
  process.exit(0);
});

// Reduce connection logging noise in development
if (process.env.NODE_ENV !== 'production') {
  pool.on('connect', () => {
    // Removed verbose logging to reduce console noise
  });
}

export const db = drizzle({ client: pool, schema });