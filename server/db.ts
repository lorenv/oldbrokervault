import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// Remove deprecated fetchConnectionCache option and optimize for production
neonConfig.pipelineConnect = false;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Enhanced connection pool configuration for deployment reliability
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 3, // Reduced for serverless efficiency
  min: 0, // No minimum connections for serverless
  idleTimeoutMillis: 20000, // Faster cleanup for serverless
  connectionTimeoutMillis: 8000, // Faster connection timeout
  allowExitOnIdle: true, // Allow pool to close when idle
  statement_timeout: 15000, // Reduced query timeout for faster failure detection
  query_timeout: 15000, // Reduced query timeout for faster failure detection
});

// Set max listeners to prevent warnings - increased for session store and other listeners
pool.setMaxListeners(500);

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