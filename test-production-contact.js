#!/usr/bin/env node
// Comprehensive production contact form test

async function testProductionContact() {
  console.log('🚀 Production Contact Form Comprehensive Test');
  console.log('==============================================');

  // Test 1: Environment check endpoint
  console.log('\n1. Testing production environment configuration...');
  try {
    const envResponse = await fetch('https://cimshare.com/api/health', {
      method: 'GET'
    });
    console.log('Health check status:', envResponse.status);
    if (envResponse.ok) {
      const healthData = await envResponse.text();
      console.log('Health response:', healthData);
    }
  } catch (error) {
    console.error('Health check error:', error.message);
  }

  // Test 2: Contact form with detailed debugging
  console.log('\n2. Testing contact form submission...');
  try {
    const contactResponse = await fetch('https://cimshare.com/api/share/cim-2axr79/contact', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'Production-Test-Bot'
      },
      body: JSON.stringify({
        viewerName: "Production Environment Test",
        viewerEmail: "test@example.com",
        question: "Testing if SENDGRID_API_KEY is available in production deployment"
      })
    });

    console.log('Contact form status:', contactResponse.status);
    console.log('Response headers:', Object.fromEntries(contactResponse.headers.entries()));
    
    const responseText = await contactResponse.text();
    console.log('Response body:', responseText);

    // Try to parse as JSON for error details
    try {
      const responseJson = JSON.parse(responseText);
      if (responseJson.debug) {
        console.log('Debug info:', responseJson.debug);
      }
    } catch (e) {
      console.log('Response is not JSON format');
    }

  } catch (error) {
    console.error('Contact form error:', error.message);
  }

  // Test 3: Alternative share slug test
  console.log('\n3. Testing with different share slug...');
  try {
    const altResponse = await fetch('https://cimshare.com/api/share/cim-76s5gu/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        viewerName: "Alt Share Test",
        viewerEmail: "alt@example.com", 
        question: "Testing alternative share slug"
      })
    });

    console.log('Alt share status:', altResponse.status);
    const altText = await altResponse.text();
    console.log('Alt response:', altText);

  } catch (error) {
    console.error('Alt share error:', error.message);
  }

  console.log('\n==============================================');
  console.log('If all tests show 500 errors, the production deployment');
  console.log('likely needs to be redeployed to pick up the new SENDGRID_API_KEY.');
  console.log('Environment variables are only loaded at deployment time.');
}

// Run with node-fetch
import('node-fetch').then(({ default: fetch }) => {
  global.fetch = fetch;
  return testProductionContact();
}).catch(console.error);