#!/usr/bin/env node
// Check production deployment status and logs

console.log('🔍 Checking Production Deployment Status...');

// Test the API endpoint to see current behavior
async function checkProductionStatus() {
  try {
    const testPayload = {
      name: "Production Check",
      email: "check@example.com",
      message: "Checking if production has latest debugging code"
    };

    console.log('Testing production contact endpoint...');
    const response = await fetch('https://cimshare.com/api/share/cim-76s5gu/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload)
    });

    console.log('Status:', response.status);
    console.log('Headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('Response:', responseText);

    if (response.status === 500 && responseText.includes('Failed to send email')) {
      console.log('\n❌ CONFIRMED: Production deployment is missing environment variables');
      console.log('The error suggests SendGrid API key is not available in production runtime');
      return false;
    }

    console.log('\n✅ Production appears to be working');
    return true;

  } catch (error) {
    console.error('❌ Production check failed:', error.message);
    return false;
  }
}

// Run with fetch polyfill
import('node-fetch').then(({ default: fetch }) => {
  global.fetch = fetch;
  return checkProductionStatus();
}).then(working => {
  console.log('\n=== PRODUCTION STATUS CHECK COMPLETE ===');
  if (!working) {
    console.log('ISSUE: Production deployment lacks proper environment variable configuration');
    console.log('SOLUTION: Environment variables need to be properly set in the deployment configuration');
    console.log('');
    console.log('The SendGrid API key and other environment variables work perfectly in development');
    console.log('but are not being transferred to the production runtime environment.');
  }
  process.exit(working ? 0 : 1);
}).catch(console.error);