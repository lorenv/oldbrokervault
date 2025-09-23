#!/usr/bin/env node

import https from 'https';
import querystring from 'querystring';

console.log('🧪 SendGrid Webhook Test Script');
console.log('=' .repeat(50));

// Test mode selection
const args = process.argv.slice(2);
const mode = args[0] || 'test';

if (mode === 'info') {
  // Display configuration info
  console.log('\n📋 SENDGRID CONFIGURATION CHECKLIST:\n');
  console.log('1. WEBHOOK URL:');
  console.log('   https://cimshare.com/api/webhook/sendgrid/inbound\n');
  console.log('2. SENDGRID SETTINGS (https://app.sendgrid.com/settings/parse):');
  console.log('   - Hostname: reply.cimshare.com');
  console.log('   - URL: https://cimshare.com/api/webhook/sendgrid/inbound');
  console.log('   - "POST raw MIME": UNCHECKED ❌');
  console.log('   - Status: ACTIVE\n');
  console.log('3. MX RECORDS (verified ✓):');
  console.log('   - 10 mx.sendgrid.net');
  console.log('   - 20 mx2.sendgrid.net');
  console.log('   - 30 mx3.sendgrid.net\n');
  process.exit(0);
}

// Get thread ID from command line or use default
const threadId = args[0] || 'e9pdi';

// Prepare test data
const testData = {
  to: `thread-${threadId}@reply.cimshare.com`,
  from: 'testuser@example.com',
  subject: 'Test Reply to Thread',
  text: 'This is a test reply message sent at ' + new Date().toISOString(),
  html: '<p>This is a <b>test reply message</b> sent at ' + new Date().toISOString() + '</p>',
  envelope: JSON.stringify({
    to: [`thread-${threadId}@reply.cimshare.com`],
    from: 'testuser@example.com'
  }),
  headers: 'Received: by mx.sendgrid.net\nDate: ' + new Date().toUTCString(),
  SPF: 'pass',
  DKIM: '{@example.com : pass}',
  charsets: '{"to":"UTF-8","subject":"UTF-8","from":"UTF-8","text":"iso-8859-1"}',
  spam_score: '0.0',
  spam_report: 'Test webhook - no spam'
};

// Convert to URL-encoded format
const postData = querystring.stringify(testData);

const options = {
  hostname: 'cimshare.com',
  path: '/api/webhook/sendgrid/inbound',
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(postData),
    'User-Agent': 'SendGrid-InboundParse-Test'
  }
};

console.log('\n🚀 Sending test webhook to:');
console.log('   ' + `https://${options.hostname}${options.path}`);
console.log('\n📦 Test payload:');
console.log('   To:', testData.to);
console.log('   From:', testData.from);
console.log('   Subject:', testData.subject);
console.log('   Text:', testData.text.substring(0, 50) + '...');
console.log('\n⏳ Sending request...\n');

const req = https.request(options, (res) => {
  console.log('📨 Response received:');
  console.log('   Status:', res.statusCode, res.statusMessage);

  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('   Body:', data);

    if (res.statusCode === 200) {
      console.log('\n✅ SUCCESS! Webhook is working properly.');
      console.log('   The server accepted the webhook.');
      console.log('   Check server logs for detailed processing info.');
    } else {
      console.log('\n⚠️  Unexpected response code:', res.statusCode);
      console.log('   This might indicate a problem with the webhook.');
    }

    console.log('\n💡 Next steps:');
    console.log('   1. Check server logs for detailed debug output');
    console.log('   2. Verify the message was processed correctly');
    console.log('   3. Test with a real email to thread-test123@reply.cimshare.com');
  });
});

req.on('error', (e) => {
  console.error('❌ Request error:', e.message);
  console.log('\n🔍 Troubleshooting:');
  console.log('   - Check if the server is running');
  console.log('   - Verify the URL is correct');
  console.log('   - Check network connectivity');
});

req.write(postData);
req.end();