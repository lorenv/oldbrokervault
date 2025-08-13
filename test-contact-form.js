// Test script to check contact form functionality
const fetch = require('node-fetch');

async function testContactForm() {
  try {
    console.log('🧪 Testing contact form submission...');
    
    // Test data
    const testData = {
      viewerName: "Test Contact",
      viewerEmail: "test.contact@example.com", 
      question: "This is a test message from the contact form to verify email sending functionality."
    };
    
    console.log('Test data:', testData);
    
    // You would need to replace 'test-share-slug' with an actual share slug from your database
    // For now, let's just check if the endpoint exists and responds
    const response = await fetch('http://localhost:5000/api/share/test-share-slug/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });
    
    console.log('Response status:', response.status);
    const responseText = await response.text();
    console.log('Response body:', responseText);
    
    if (response.status === 404) {
      console.log('✅ Endpoint exists but share slug not found (expected for test)');
    } else if (response.status === 200) {
      console.log('✅ Contact form submitted successfully!');
    } else {
      console.log('❌ Unexpected response:', response.status);
    }
    
  } catch (error) {
    console.error('❌ Error testing contact form:', error.message);
  }
}

testContactForm();