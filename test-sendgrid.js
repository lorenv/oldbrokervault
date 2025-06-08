import { MailService } from '@sendgrid/mail';

const mailService = new MailService();
mailService.setApiKey(process.env.SENDGRID_API_KEY);

async function testSendGrid() {
  try {
    console.log('Testing SendGrid API connection...');
    console.log('API Key exists:', !!process.env.SENDGRID_API_KEY);
    console.log('API Key starts with:', process.env.SENDGRID_API_KEY?.substring(0, 10) + '...');
    
    const msg = {
      to: 'test@example.com',
      from: 'test@example.com', // Must be verified sender
      subject: 'SendGrid Test',
      text: 'This is a test email to verify SendGrid configuration.',
      html: '<p>This is a test email to verify SendGrid configuration.</p>'
    };
    
    const response = await mailService.send(msg);
    console.log('SendGrid test successful:', response[0].statusCode);
    return true;
  } catch (error) {
    console.error('SendGrid test failed:', error);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response body:', error.response.body);
    }
    return false;
  }
}

testSendGrid();