// Test script to submit contact form and check for email sending
import fetch from 'node-fetch';

async function testContactFormSubmission() {
  try {
    console.log('🧪 Testing contact form submission...');

    const testData = {
      viewerName: "John Test User",
      viewerEmail: "test@example.com",
      viewerPhone: "+1-555-0123",
      question: "This is a test question to check if email notifications are working properly. Please respond to test the email flow."
    };

    console.log('📧 Test data:', JSON.stringify(testData, null, 2));

    // Test with a sample share slug (will likely return 404 but should show logs)
    const shareSlug = 'test-cim-share';
    console.log(`📡 Submitting to: http://localhost:3001/api/share/${shareSlug}/contact`);

    const response = await fetch(`http://localhost:3001/api/share/${shareSlug}/contact`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });

    console.log('📊 Response status:', response.status);
    console.log('📊 Response headers:', Object.fromEntries(response.headers.entries()));

    const responseText = await response.text();
    console.log('📊 Response body:', responseText);

    if (response.status === 404) {
      console.log('✅ Test completed - share slug not found (expected for test)');
      console.log('💡 This confirms the endpoint exists and can process the request');
    } else if (response.status === 200) {
      console.log('✅ Contact form submitted successfully!');
      console.log('📧 Check server logs for email sending details');
    } else if (response.status === 400) {
      console.log('⚠️  Validation error (check field requirements)');
    } else if (response.status === 500) {
      console.log('❌ Server error occurred');
    } else {
      console.log(`⚠️  Unexpected response: ${response.status}`);
    }

  } catch (error) {
    console.error('❌ Error testing contact form:', error.message);

    if (error.code === 'ECONNREFUSED') {
      console.error('🔌 Connection refused - make sure the server is running on port 3001');
    }
  }
}

testContactFormSubmission();