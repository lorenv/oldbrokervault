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

// Optimize connection pool for better performance and reduced warnings
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 5, // Further reduced to prevent over-allocation
  min: 0, // Start with no idle connections
  idleTimeoutMillis: 30000, // Shorter idle timeout to release connections faster
  connectionTimeoutMillis: 8000, // Reasonable timeout
  allowExitOnIdle: true, // Allow pool to exit when idle
});

// Set max listeners to prevent warnings with buffer for high traffic
pool.setMaxListeners(1000);

// Minimal error handling to reduce noise
pool.on('error', (err) => {
  // Only log critical database errors
  if (err.message && !err.message.includes('Connection terminated')) {
    console.error('Database pool error:', err.message);
  }
});

// Remove the 'connect' event listener that was causing excessive logging
// Only log connection pool startup once
let connectionLogged = false;
pool.on('connect', () => {
  if (!connectionLogged) {
    console.log('Database pool initialized');
    connectionLogged = true;
  }
});

export const db = drizzle({ client: pool, schema });