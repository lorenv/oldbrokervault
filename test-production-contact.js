#!/usr/bin/env node
// Test production contact form functionality

async function testProductionContact() {
  console.log('🧪 Testing Production Contact Form...');
  
  const testData = {
    name: "Production Test User",
    email: "production-test@example.com",
    message: "Testing production contact form functionality after deployment fixes."
  };
  
  try {
    console.log('📧 Sending test contact form submission...');
    console.log('Data:', testData);
    
    const response = await fetch('https://cimshare.com/api/share/cim-76s5gu/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const responseData = await response.text();
    console.log('Response body:', responseData);
    
    if (response.status === 200) {
      console.log('✅ Production contact form test PASSED');
      return true;
    } else {
      console.log('❌ Production contact form test FAILED');
      console.log('Status:', response.status);
      console.log('Body:', responseData);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Production contact form test ERROR:', error);
    return false;
  }
}

// Run the test with proper import
import('node-fetch').then(({ default: fetch }) => {
  global.fetch = fetch;
  return testProductionContact();
}).then(success => {
  console.log('\n=== PRODUCTION CONTACT FORM TEST COMPLETE ===');
  console.log('Result:', success ? 'PASS' : 'FAIL');
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('❌ Test script error:', error);
  process.exit(1);
});