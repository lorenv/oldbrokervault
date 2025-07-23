#!/usr/bin/env node
// Verify production environment variables are properly configured

async function verifyProductionEnvironment() {
  console.log('🔍 Verifying Production Environment Configuration...');
  
  // Test the production endpoint with detailed error analysis
  try {
    const response = await fetch('https://cimshare.com/api/share/cim-76s5gu/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: "Environment Test",
        email: "env-test@example.com",
        message: "Testing production environment variable configuration."
      })
    });
    
    console.log('Production API response status:', response.status);
    console.log('Production API response headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('Production API response body:', responseText);
    
    if (response.status === 500) {
      console.log('❌ Production environment error confirmed');
      console.log('This indicates SendGrid environment variables are not properly configured in production deployment');
      return false;
    } else if (response.status === 200) {
      console.log('✅ Production environment working correctly');
      return true;
    } else {
      console.log('⚠️ Unexpected response status:', response.status);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Failed to test production environment:', error);
    return false;
  }
}

// Test with fetch polyfill
import('node-fetch').then(({ default: fetch }) => {
  global.fetch = fetch;
  return verifyProductionEnvironment();
}).then(success => {
  console.log('\n=== PRODUCTION ENVIRONMENT VERIFICATION COMPLETE ===');
  console.log('Result:', success ? 'PASS' : 'FAIL');
  console.log('');
  if (!success) {
    console.log('RECOMMENDED ACTIONS:');
    console.log('1. Verify SENDGRID_API_KEY is properly set in deployment secrets');
    console.log('2. Check that environment variables are transferred to production runtime');
    console.log('3. Redeploy application after confirming environment variable configuration');
  }
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('❌ Verification script error:', error);
  process.exit(1);
});