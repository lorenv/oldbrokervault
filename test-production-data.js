// Test if the document exists in production database
import fetch from 'node-fetch';

async function testProductionData() {
  const baseUrl = 'https://cimshare.com';
  
  // Test different share slugs to see if any work
  const testSlugs = [
    'cim-e229m1',
    'cim-test',
    'cim-demo',
    'cim-sample'
  ];
  
  for (const slug of testSlugs) {
    try {
      console.log(`\nTesting slug: ${slug}`);
      const response = await fetch(`${baseUrl}/api/share/${slug}`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Production-Test/1.0'
        }
      });
      
      console.log(`Status: ${response.status}`);
      const text = await response.text();
      console.log(`Response length: ${text.length}`);
      
      if (response.status === 404) {
        console.log('Document not found (expected for non-existent documents)');
      } else if (response.status === 500 && text.length === 0) {
        console.log('Empty 500 error - server crash');
      } else if (response.ok) {
        console.log('Success! Document found');
        const data = JSON.parse(text);
        console.log(`Document ID: ${data.cim?.id}, Title: ${data.cim?.title}`);
        break;
      } else {
        console.log(`Response: ${text.substring(0, 200)}`);
      }
      
    } catch (error) {
      console.log(`Error testing ${slug}:`, error.message);
    }
  }
  
  // Test a simple database endpoint to verify connection
  try {
    console.log('\nTesting database connection via health endpoint...');
    const dbTest = await fetch(`${baseUrl}/api/public-health`);
    if (dbTest.ok) {
      const data = await dbTest.json();
      console.log('Database connection appears to be working');
      console.log('Server timestamp:', data.timestamp);
    }
  } catch (error) {
    console.log('Health endpoint failed:', error.message);
  }
}

testProductionData();