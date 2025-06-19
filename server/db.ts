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

// Optimize connection pool for fast authentication and session management
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 15, // Increased for session store and concurrent requests
  min: 3, // More minimum connections for faster access
  idleTimeoutMillis: 60000, // Keep connections alive longer to prevent termination
  connectionTimeoutMillis: 10000, // Increased timeout for better reliability
  allowExitOnIdle: false, // Prevent pool from closing on idle
});

// Set max listeners to prevent warnings - increased for session store and other listeners
pool.setMaxListeners(200);

// Enhanced error handling for database connections
pool.on('error', (err) => {
  // Only log actual errors, not connection recovery messages
  if (!err.message.includes('Connection terminated unexpectedly')) {
    console.error('Database pool error:', err);
  }
  // Graceful recovery - don't exit process
});

// Handle connection events gracefully
pool.on('connect', (client) => {
  // Set connection-level error handling
  client.on('error', (err) => {
    if (!err.message.includes('Connection terminated unexpectedly')) {
      console.warn('Client connection error (recoverable):', err.message);
    }
  });
});

// Reduce connection logging noise in development
if (process.env.NODE_ENV !== 'production') {
  pool.on('connect', () => {
    // Removed verbose logging to reduce console noise
  });
}

export const db = drizzle({ client: pool, schema });