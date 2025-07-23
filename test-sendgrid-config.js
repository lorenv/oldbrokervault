#!/usr/bin/env node
// Test SendGrid configuration and email sending capability

import sgMail from '@sendgrid/mail';

async function testSendGridConfig() {
  console.log('🧪 Testing SendGrid Configuration...');
  
  // Check environment variable
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    console.error('❌ SENDGRID_API_KEY environment variable not found');
    return false;
  }
  
  console.log('✅ SENDGRID_API_KEY found');
  console.log('   Length:', apiKey.length);
  console.log('   Starts with SG.:', apiKey.startsWith('SG.'));
  console.log('   First 10 chars:', apiKey.substring(0, 10) + '...');
  
  // Initialize SendGrid
  try {
    sgMail.setApiKey(apiKey);
    console.log('✅ SendGrid initialized successfully');
  } catch (error) {
    console.error('❌ SendGrid initialization failed:', error);
    return false;
  }
  
  // Test email sending
  const testEmail = {
    to: 'system@cimshare.com', // Send to verified sender
    from: 'system@cimshare.com', // From verified sender
    subject: 'SendGrid Test - CIM Share Production Environment',
    text: 'This is a test email to verify SendGrid configuration in production.',
    html: '<p>This is a test email to verify SendGrid configuration in production.</p>'
  };
  
  try {
    console.log('📧 Attempting to send test email...');
    const result = await sgMail.send(testEmail);
    console.log('✅ Test email sent successfully!');
    console.log('   Status code:', result[0]?.statusCode);
    console.log('   Message ID:', result[0]?.headers?.['x-message-id']);
    return true;
  } catch (error) {
    console.error('❌ Test email failed:', error);
    console.error('   Error code:', error.code);
    console.error('   Error message:', error.message);
    if (error.response) {
      console.error('   Response status:', error.response.status);
      console.error('   Response body:', error.response.body);
    }
    return false;
  }
}

// Run the test
testSendGridConfig()
  .then(success => {
    console.log('\n=== SENDGRID TEST COMPLETE ===');
    console.log('Result:', success ? 'PASS' : 'FAIL');
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Test script error:', error);
    process.exit(1);
  });