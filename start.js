#!/usr/bin/env node
// Root start.js - delegates to dist/start.js for static deployment
process.env.NODE_ENV = 'production';
process.env.DEPLOYMENT_TARGET = 'static';
process.env.PORT = '3000';

console.log('🚀 CIM Share - Static Deployment Launcher');
console.log('📍 Root directory:', process.cwd());
console.log('🔗 Delegating to dist/start.js...');

// Import the main start script from dist
import('./dist/start.js').catch(err => {
  console.error('❌ Failed to start from root:', err);
  console.error('❌ Trying direct dist/index.js import...');
  
  // Fallback: try importing the built server directly
  import('./dist/index.js').catch(fallbackErr => {
    console.error('❌ All startup methods failed:', fallbackErr);
    process.exit(1);
  });
});
