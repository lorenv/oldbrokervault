#!/usr/bin/env node

import https from 'https';

console.log('SendGrid Webhook Configuration Check\n');
console.log('=====================================\n');

// Get the current Replit URL
const replitUrl = process.env.REPLIT_DOMAINS
  ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
  : 'https://cimshare.com';

console.log('1. WEBHOOK URL CHECK:');
console.log('   Your webhook URL should be:');
console.log(`   ${replitUrl}/api/webhook/sendgrid/inbound`);
console.log('\n   Alternative URLs that might be configured:');
console.log('   - https://cimshare.replit.app/api/webhook/sendgrid/inbound');
console.log('   - https://cimshare.com/api/webhook/sendgrid/inbound');
console.log('\n   ⚠️  Make sure SendGrid Inbound Parse has the EXACT URL above');

console.log('\n2. SENDGRID INBOUND PARSE SETTINGS:');
console.log('   Go to: https://app.sendgrid.com/settings/parse');
console.log('   Check that you have:');
console.log('   - Hostname: reply.cimshare.com');
console.log(`   - URL: ${replitUrl}/api/webhook/sendgrid/inbound`);
console.log('   - "POST the raw, full MIME message": UNCHECKED ❌');
console.log('   - Status: ACTIVE (not paused)');

console.log('\n3. MX RECORDS CHECK:');
console.log('   Your DNS should have these MX records for reply.cimshare.com:');
console.log('   - Priority 10: mx.sendgrid.net');
console.log('   - Priority 20: mx2.sendgrid.net (optional)');
console.log('   - Priority 30: mx3.sendgrid.net (optional)');

console.log('\n4. TEST THE WEBHOOK:');
console.log('   Run this command to test the webhook directly:\n');
console.log(`   curl -X POST ${replitUrl}/api/webhook/sendgrid/test \\`);
console.log('     -H "Content-Type: application/json" \\');
console.log('     -d \'{"to":"thread-20@reply.cimshare.com","from":"test@example.com","text":"Test reply"}\'');

console.log('\n5. SIMULATE SENDGRID WEBHOOK:');
console.log('   Run this to simulate what SendGrid sends (form-encoded):\n');
console.log(`   curl -X POST ${replitUrl}/api/webhook/sendgrid/inbound \\`);
console.log('     -H "Content-Type: application/x-www-form-urlencoded" \\');
console.log('     -d "to=thread-20@reply.cimshare.com&from=test@example.com&text=Test+reply&subject=Test"');

console.log('\n6. COMMON ISSUES:');
console.log('   - SendGrid webhook URL doesn\'t match current Replit URL');
console.log('   - MX records not pointing to mx.sendgrid.net');
console.log('   - SendGrid Inbound Parse is paused/inactive');
console.log('   - Wrong hostname configured (should be reply.cimshare.com)');
console.log('   - Firewall/security blocking SendGrid IPs');
console.log('   - "POST raw MIME" is still checked (should be unchecked)');

console.log('\n7. CHECK WEBHOOK STATUS:');
console.log(`   Visit: ${replitUrl}/api/webhook/sendgrid/info`);