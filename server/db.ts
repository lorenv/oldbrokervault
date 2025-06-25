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

// Simple, reliable connection pool configuration for Neon
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 3, // Minimal pool size to prevent timeouts
  min: 0, // Allow pool to scale to zero when idle
  idleTimeoutMillis: 10000, // Quick cleanup
  connectionTimeoutMillis: 5000, // Fast timeout to prevent hanging
  allowExitOnIdle: true, // Allow connections to close when idle
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