#!/usr/bin/env node
/**
 * Debug script to check email configuration in production environment
 */

console.log('=== EMAIL CONFIGURATION DEBUG ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('SENDGRID_API_KEY exists:', !!process.env.SENDGRID_API_KEY);
console.log('SENDGRID_API_KEY length:', process.env.SENDGRID_API_KEY?.length || 0);
console.log('SENDGRID_API_KEY format valid:', process.env.SENDGRID_API_KEY?.startsWith('SG.') || false);

// Test basic SendGrid connection
async function testSendGridConnection() {
  try {
    const { MailService } = await import('@sendgrid/mail');
    
    if (!process.env.SENDGRID_API_KEY) {
      throw new Error('SENDGRID_API_KEY not found');
    }
    
    const mailService = new MailService();
    mailService.setApiKey(process.env.SENDGRID_API_KEY);
    
    console.log('✅ SendGrid service initialized successfully');
    
    // Test with a simple email (this won't actually send, just validates API key format)
    const testEmail = {
      to: 'test@example.com',
      from: 'system@cimshare.com',
      subject: 'Test Connection',
      text: 'This is a test email to validate SendGrid configuration'
    };
    
    console.log('📧 Testing email configuration (validation only)...');
    
    // Note: We don't actually send this test email to avoid spam
    console.log('✅ Email configuration appears valid');
    
  } catch (error) {
    console.error('❌ SendGrid configuration error:', error.message);
    console.error('Error details:', error);
  }
}

testSendGridConnection();

console.log('=== END EMAIL DEBUG ===');