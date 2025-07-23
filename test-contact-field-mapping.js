#!/usr/bin/env node
// Test both field name formats to identify the exact issue

async function testContactFieldMapping() {
  console.log('🧪 Testing Contact Form Field Mapping...');

  // Test with correct field names (viewerName, viewerEmail, question)
  console.log('\n1. Testing with CORRECT field names (viewerName, viewerEmail, question):');
  try {
    const correctResponse = await fetch('https://cimshare.com/api/share/cim-2axr79/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        viewerName: "Correct Field Test",
        viewerEmail: "correct@example.com",
        question: "Testing with viewerName, viewerEmail, question fields"
      })
    });

    console.log('Status:', correctResponse.status);
    const correctData = await correctResponse.text();
    console.log('Response:', correctData);

  } catch (error) {
    console.error('Error with correct fields:', error.message);
  }

  // Test with incorrect field names (name, email, message) 
  console.log('\n2. Testing with INCORRECT field names (name, email, message):');
  try {
    const incorrectResponse = await fetch('https://cimshare.com/api/share/cim-2axr79/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: "Incorrect Field Test",
        email: "incorrect@example.com", 
        message: "Testing with name, email, message fields"
      })
    });

    console.log('Status:', incorrectResponse.status);
    const incorrectData = await incorrectResponse.text();
    console.log('Response:', incorrectData);

  } catch (error) {
    console.error('Error with incorrect fields:', error.message);
  }

  // Test if shareSlug exists
  console.log('\n3. Testing if share slug exists:');
  try {
    const shareResponse = await fetch('https://cimshare.com/api/share/cim-2axr79', {
      method: 'GET'
    });
    console.log('Share document status:', shareResponse.status);
    if (shareResponse.status === 404) {
      console.log('❌ Share document not found - this could be the issue!');
    } else {
      console.log('✅ Share document exists');
    }
  } catch (error) {
    console.error('Error checking share document:', error.message);
  }
}

// Run with fetch polyfill
import('node-fetch').then(({ default: fetch }) => {
  global.fetch = fetch;
  return testContactFieldMapping();
}).then(() => {
  console.log('\n=== CONTACT FIELD MAPPING TEST COMPLETE ===');
}).catch(console.error);