#!/usr/bin/env node
/**
 * Static Deployment Start Script
 * Bypasses problematic Vite build by running development server in production mode
 */

process.env.NODE_ENV = 'production';
process.env.DEPLOYMENT_TARGET = 'static';

// Import and run the built server
import('./dist/index.js').catch(err => {
  console.error('Failed to start static deployment:', err);
  process.exit(1);
});