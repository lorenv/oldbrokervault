// Debug script to test production environment issues
import fetch from 'node-fetch';

async function debugProduction() {
  const baseUrl = 'https://cimshare.com';
  
  console.log('Testing production endpoints...');
  
  // Test health endpoint
  try {
    const healthResponse = await fetch(`${baseUrl}/api/public-health`);
    console.log('Health check status:', healthResponse.status);
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log('Health data:', healthData);
    }
  } catch (error) {
    console.log('Health check failed:', error.message);
  }
  
  // Test security health
  try {
    const securityResponse = await fetch(`${baseUrl}/api/security/health`);
    console.log('Security health status:', securityResponse.status);
  } catch (error) {
    console.log('Security health failed:', error.message);
  }
  
  // Test main page
  try {
    const mainResponse = await fetch(baseUrl);
    console.log('Main page status:', mainResponse.status);
    console.log('Main page content type:', mainResponse.headers.get('content-type'));
  } catch (error) {
    console.log('Main page failed:', error.message);
  }
  
  // Test the problematic share endpoint
  try {
    console.log('\nTesting share endpoint...');
    const shareResponse = await fetch(`${baseUrl}/api/share/cim-e229m1`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Debug-Script/1.0'
      }
    });
    console.log('Share endpoint status:', shareResponse.status);
    console.log('Share endpoint headers:', Object.fromEntries(shareResponse.headers.entries()));
    
    const shareText = await shareResponse.text();
    console.log('Share response length:', shareText.length);
    
    if (shareResponse.status === 500) {
      console.log('Share 500 error body:', shareText);
    } else if (shareResponse.ok) {
      try {
        const shareData = JSON.parse(shareText);
        console.log('Share success - Document ID:', shareData.cim?.id);
        console.log('Share success - Title:', shareData.cim?.title);
      } catch (parseError) {
        console.log('Share response parse error:', parseError.message);
        console.log('First 500 chars:', shareText.substring(0, 500));
      }
    }
  } catch (error) {
    console.log('Share endpoint request failed:', error.message);
  }
}

debugProduction();