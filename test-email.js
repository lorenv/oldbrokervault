// Test email functionality
import { sendEmail, sendNdaSignedEmail } from './server/email.js';

async function testEmail() {
  try {
    console.log('Testing basic SendGrid functionality...');
    console.log('SENDGRID_API_KEY exists:', !!process.env.SENDGRID_API_KEY);
    
    const testResult = await sendEmail({
      to: 'bobby@example.com',
      from: 'system@cimshare.com',
      subject: 'Test Email',
      text: 'This is a test email',
      html: '<p>This is a test email</p>'
    });
    
    console.log('Basic email test result:', testResult);
    
    // Test NDA email function
    console.log('\nTesting NDA email function...');
    const ndaTestResult = await sendNdaSignedEmail(
      'test@example.com',
      'owner@example.com', 
      'Test Owner',
      'Test CIM Document',
      'https://example.com/share/test',
      'base64content',
      'Test Signer',
      { name: 'Test Owner', email: 'owner@example.com' }
    );
    
    console.log('NDA email test result:', ndaTestResult);
    
  } catch (error) {
    console.error('Email test error:', error);
    console.error('Error details:', error.message);
    if (error.response) {
      console.error('SendGrid response:', error.response.body);
    }
  }
}

testEmail();