#!/usr/bin/env node
// Check deployment environment configuration

console.log('🔍 Deployment Environment Configuration Check');
console.log('==============================================');

// List all required environment variables
const requiredVars = [
  'DATABASE_URL',
  'SENDGRID_API_KEY',
  'STRIPE_SECRET_KEY', 
  'STRIPE_PUBLISHABLE_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_ID_STANDARD',
  'PERPLEXITY_API_KEY',
  'OPENAI_API_KEY'
];

console.log('\nRequired Environment Variables:');
let missingVars = [];

requiredVars.forEach(varName => {
  const value = process.env[varName];
  const status = value ? '✅' : '❌';
  const length = value ? `(${value.length} chars)` : '(missing)';
  console.log(`${status} ${varName} ${length}`);
  
  if (!value) {
    missingVars.push(varName);
  }
});

// Special checks for key formats
if (process.env.SENDGRID_API_KEY && !process.env.SENDGRID_API_KEY.startsWith('SG.')) {
  console.log('⚠️  SENDGRID_API_KEY format warning: should start with "SG."');
}

if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('postgres')) {
  console.log('⚠️  DATABASE_URL format warning: should start with "postgres"');
}

console.log('\n==============================================');
if (missingVars.length === 0) {
  console.log('✅ All required environment variables are configured');
  console.log('Contact form email delivery should work in production');
} else {
  console.log(`❌ Missing ${missingVars.length} required environment variables:`);
  missingVars.forEach(varName => console.log(`   - ${varName}`));
  console.log('\nThese must be configured in deployment secrets for production to work');
}

console.log('\nCurrent Environment:', process.env.NODE_ENV || 'development');
console.log('Platform:', process.platform);
console.log('Node Version:', process.version);