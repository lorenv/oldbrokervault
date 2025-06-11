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

// Optimize connection pool for production stability
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 5, // Reduced from 10 to prevent connection exhaustion
  min: 1, // Maintain minimum connections
  idleTimeoutMillis: 20000, // Reduced idle timeout
  connectionTimeoutMillis: 10000, // Increased connection timeout
});

// Set max listeners to prevent warnings - increased for session store
pool.setMaxListeners(100);

// Enhanced error handling for database connections
pool.on('error', (err) => {
  console.error('Database pool error:', err);
  // Don't exit process on pool errors in production
});

pool.on('connect', (client) => {
  console.log('Database pool connected');
});

// Remove verbose logging to reduce noise
// pool.on('acquire', (client) => {
//   console.log('Database connection acquired from pool');
// });

// pool.on('remove', (client) => {
//   console.log('Database connection removed from pool');
// });

// Set max listeners to prevent warnings
pool.setMaxListeners(100);

export const db = drizzle({ client: pool, schema });