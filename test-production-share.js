// Test script to check production share endpoint
import fetch from 'node-fetch';

async function testProductionShare() {
  try {
    console.log('Testing production share endpoint...');
    const response = await fetch('https://cimshare.com/api/share/cim-e229m1', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CIMShare-Test/1.0)',
        'Accept': 'application/json'
      }
    });
    
    console.log('Status:', response.status);
    console.log('Headers:', Object.fromEntries(response.headers.entries()));
    
    const text = await response.text();
    console.log('Response length:', text.length);
    
    if (response.status === 500) {
      console.log('500 Error Response:', text);
    } else {
      try {
        const data = JSON.parse(text);
        console.log('Success - Document ID:', data.cim?.id);
      } catch (e) {
        console.log('Non-JSON response:', text.substring(0, 200));
      }
    }
  } catch (error) {
    console.error('Request Error:', error.message);
  }
}

testProductionShare();