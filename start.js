#!/usr/bin/env node
// Root start.js for auto-scale deployment
process.env.NODE_ENV = 'production';
process.env.DEPLOYMENT_TARGET = 'autoscale';

// Auto-scale deployment port configuration
const PORT = process.env.PORT || 3000;
process.env.PORT = PORT;

console.log('🚀 CIM Share - Auto-scale Deployment');
console.log('📍 Port:', PORT);
console.log('🔗 Starting from dist/index.js...');

// Import the built server directly
import('./dist/index.js').catch(err => {
  console.error('❌ Auto-scale startup failed:', err);
  process.exit(1);
});
