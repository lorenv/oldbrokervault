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

// Production-scale connection pool configuration for 100+ concurrent users
const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  max: isProduction ? 30 : (isReplit ? 20 : 10), // Production: 30, Replit dev: 20, local: 10
  min: isProduction ? 2 : 0, // Minimal warm connections for faster startup
  idleTimeoutMillis: isReplit ? 30000 : 15000, // Faster connection cleanup for deployment
  connectionTimeoutMillis: isReplit ? 5000 : 3000, // Faster timeout for health checks
  allowExitOnIdle: !isProduction, // Keep connections in production, allow exit in dev
  statement_timeout: isReplit ? 10000 : 8000, // Faster statement timeout for deployment
  query_timeout: isReplit ? 10000 : 8000, // Faster query timeout for deployment
};

export const pool = new Pool(poolConfig);

// Set max listeners to prevent warnings - increased for Replit's environment
pool.setMaxListeners(isReplit ? 1000 : 500);

// Add deployment-specific logging
if (isReplit) {
  console.log('🔧 Environment-optimized database configuration loaded');
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