// Test contact form with real CIM document
import fetch from 'node-fetch';

async function testRealContactForm() {
  try {
    console.log('🧪 Testing contact form with real CIM document...');

    const shareSlug = 'cim-qx2mhm'; // Valid share slug from database
    const testData = {
      viewerName: "Test Investor",
      viewerEmail: "test.investor@example.com",
      viewerPhone: "+1-555-0123",
      question: "I am interested in learning more about this business opportunity. Can you provide additional financial details and market analysis?"
    };

    console.log('📧 Test data:', JSON.stringify(testData, null, 2));
    console.log(`📡 Submitting to: http://localhost:3001/api/share/${shareSlug}/contact`);

    const response = await fetch(`http://localhost:3001/api/share/${shareSlug}/contact`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });

    console.log('📊 Response status:', response.status);

    const responseText = await response.text();
    console.log('📊 Response body:', responseText);

    if (response.status === 200) {
      console.log('✅ Contact form submitted successfully!');
      console.log('📧 Check server logs for email sending details');
      console.log('📧 Check if email notification was sent to owner');

      try {
        const responseData = JSON.parse(responseText);
        if (responseData.threadId) {
          console.log(`📝 Message thread created with ID: ${responseData.threadId}`);
        }
      } catch (e) {
        // Response might not be JSON
      }
    } else if (response.status === 404) {
      console.log('❌ CIM document not found');
    } else if (response.status === 400) {
      console.log('❌ Validation error');
    } else if (response.status === 429) {
      console.log('⚠️  Rate limited');
    } else if (response.status === 500) {
      console.log('❌ Server error occurred');
    } else {
      console.log(`❌ Unexpected response: ${response.status}`);
    }

  } catch (error) {
    console.error('❌ Error testing contact form:', error.message);

    if (error.code === 'ECONNREFUSED') {
      console.error('🔌 Connection refused - make sure the server is running on port 3001');
    }
  }
}

testRealContactForm();