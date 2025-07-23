#!/usr/bin/env node
// Debug production email delivery issues

import sgMail from '@sendgrid/mail';

async function debugProductionEmail() {
  console.log('🔍 Debugging Production Email Configuration...');
  
  // Check environment variable
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    console.error('❌ SENDGRID_API_KEY environment variable not found');
    return false;
  }
  
  console.log('✅ SENDGRID_API_KEY found');
  console.log('   Length:', apiKey.length);
  console.log('   Starts with SG.:', apiKey.startsWith('SG.'));
  console.log('   Format check:', /^SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}$/.test(apiKey));
  
  // Initialize SendGrid
  try {
    sgMail.setApiKey(apiKey);
    console.log('✅ SendGrid initialized successfully');
  } catch (error) {
    console.error('❌ SendGrid initialization failed:', error);
    return false;
  }
  
  // Test email to document owner (simulating contact form)
  const testEmail = {
    to: 'robert@dealve.cc', // Owner of CIM documents
    from: 'system@cimshare.com', // Verified sender
    replyTo: 'debug@example.com', // Contact form user
    subject: 'Production Email Test - Contact Form Debug',
    text: `
This is a production email test to verify contact form functionality.

From: Debug Test User
Email: debug@example.com

Question:
Testing production contact form functionality to identify email delivery issues.

---
This message was sent through your shared CIM link debugging process.
    `.trim()
  };
  
  try {
    console.log('📧 Sending production test email...');
    const result = await sgMail.send(testEmail);
    console.log('✅ Production test email sent successfully!');
    console.log('   Status code:', result[0]?.statusCode);
    console.log('   Message ID:', result[0]?.headers?.['x-message-id']);
    console.log('   Email details:', {
      to: testEmail.to,
      from: testEmail.from,
      replyTo: testEmail.replyTo,
      subject: testEmail.subject
    });
    return true;
  } catch (error) {
    console.error('❌ Production test email failed:', error);
    console.error('   Error code:', error.code);
    console.error('   Error message:', error.message);
    console.error('   Error type:', typeof error);
    console.error('   Error name:', error.name);
    
    if (error.response) {
      console.error('   Response status:', error.response.status);
      console.error('   Response body:', error.response.body);
      if (error.response.body && error.response.body.errors) {
        console.error('   SendGrid errors:', error.response.body.errors);
      }
    }
    
    // Specific error analysis
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      console.error('🔧 Network connectivity issue detected');
    }
    
    if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
      console.error('🔧 API Key authentication failed - check key validity');
    }
    
    if (error.message?.includes('403') || error.message?.includes('Forbidden')) {
      console.error('🔧 SendGrid account permissions issue - check sender verification');
    }
    
    return false;
  }
}

// Run the production debug test
debugProductionEmail()
  .then(success => {
    console.log('\n=== PRODUCTION EMAIL DEBUG COMPLETE ===');
    console.log('Result:', success ? 'PASS' : 'FAIL');
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Debug script error:', error);
    process.exit(1);
  });