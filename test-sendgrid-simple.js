// Simple SendGrid test to verify email configuration
const { sendEmail } = require('./server/email.ts');

async function testSendGrid() {
  try {
    console.log('🧪 Testing SendGrid email sending...');
    
    const success = await sendEmail({
      to: 'test@example.com',
      from: 'system@cimshare.com', 
      subject: 'SendGrid Test Email',
      html: '<p>This is a test email to verify SendGrid configuration.</p>',
      text: 'This is a test email to verify SendGrid configuration.'
    });
    
    console.log('Email send result:', success);
    
  } catch (error) {
    console.error('❌ SendGrid test failed:', error.message);
  }
}

testSendGrid();