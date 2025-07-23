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

// Validate critical environment variables for production deployment
console.log('🔍 Validating production environment variables...');
const requiredVars = [
  'DATABASE_URL',
  'SENDGRID_API_KEY', 
  'STRIPE_SECRET_KEY',
  'STRIPE_PUBLISHABLE_KEY',
  'PERPLEXITY_API_KEY',
  'OPENAI_API_KEY'
];

const missing = requiredVars.filter(varName => !process.env[varName]);

if (missing.length > 0) {
  console.error('❌ Missing required environment variables:', missing);
  console.error('Deployment may fail without these variables');
} else {
  console.log('✅ All required environment variables are present');
}

// Specific SendGrid validation
if (process.env.SENDGRID_API_KEY && !process.env.SENDGRID_API_KEY.startsWith('SG.')) {
  console.error('❌ SENDGRID_API_KEY format appears invalid');
} else {
  console.log('✅ SENDGRID_API_KEY format is valid');
}

// Import the built server directly
import('./dist/index.js').catch(err => {
  console.error('❌ Auto-scale startup failed:', err);
  process.exit(1);
});
