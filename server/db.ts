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

// Optimize connection pool for fast authentication
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 10, // Increased for better concurrency
  min: 2, // More minimum connections for faster access
  idleTimeoutMillis: 30000, // Increased to keep connections alive longer
  connectionTimeoutMillis: 5000, // Reduced for faster failure detection
});

// Set max listeners to prevent warnings - increased for session store and other listeners
pool.setMaxListeners(150);

// Enhanced error handling for database connections
pool.on('error', (err) => {
  console.error('Database pool error:', err);
  // Don't exit process on pool errors in production
});

// Reduce connection logging noise in development
if (process.env.NODE_ENV !== 'production') {
  pool.on('connect', () => {
    // Removed verbose logging to reduce console noise
  });
}

export const db = drizzle({ client: pool, schema });