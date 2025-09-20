#!/usr/bin/env node

console.log('MX Record Configuration Check\n');
console.log('=============================\n');

console.log('The problem: Emails to @reply.cimshare.com are not reaching SendGrid.\n');

console.log('REQUIRED DNS CONFIGURATION:\n');
console.log('In your DNS provider (where cimshare.com is registered), you need:\n');

console.log('1. MX Records for the SUBDOMAIN:');
console.log('   Host/Name: reply  (or reply.cimshare.com depending on your DNS provider)');
console.log('   Type: MX');
console.log('   Priority: 10');
console.log('   Value/Points to: mx.sendgrid.net');
console.log('');
console.log('   Optional additional records:');
console.log('   Host: reply, Type: MX, Priority: 20, Value: mx2.sendgrid.net');
console.log('   Host: reply, Type: MX, Priority: 30, Value: mx3.sendgrid.net\n');

console.log('2. COMMON DNS PROVIDER FORMATS:\n');

console.log('   GoDaddy:');
console.log('   - Host: reply');
console.log('   - Points to: mx.sendgrid.net');
console.log('   - Priority: 10\n');

console.log('   Cloudflare:');
console.log('   - Name: reply  (becomes reply.cimshare.com)');
console.log('   - Mail server: mx.sendgrid.net');
console.log('   - Priority: 10\n');

console.log('   Namecheap:');
console.log('   - Host: reply');
console.log('   - Value: mx.sendgrid.net');
console.log('   - Priority: 10\n');

console.log('3. VERIFICATION STEPS:');
console.log('   a) After adding MX records, wait 5-30 minutes for DNS propagation');
console.log('   b) Use https://mxtoolbox.com to check:');
console.log('      - Enter: reply.cimshare.com');
console.log('      - Should show: mx.sendgrid.net');
console.log('   c) Send a test email to: thread-20@reply.cimshare.com');
console.log('   d) Check your server logs for "📨 INBOUND WEBHOOK HIT!"\n');

console.log('4. WHAT\'S HAPPENING NOW:');
console.log('   - Emails to @reply.cimshare.com are probably:');
console.log('     • Bouncing (sender gets an error)');
console.log('     • Going to Google (if you have catch-all on main domain)');
console.log('     • Being rejected (no MX records found)\n');

console.log('5. HOW TO CHECK IF MX RECORDS ARE WORKING:');
console.log('   - Go to: https://mxtoolbox.com');
console.log('   - Enter: reply.cimshare.com');
console.log('   - Click "MX Lookup"');
console.log('   - You should see: mx.sendgrid.net (Priority 10)');
console.log('   - If you see nothing or Google\'s servers, MX records are wrong\n');

console.log('Once MX records are fixed:');
console.log('✅ Emails to @reply.cimshare.com will go to SendGrid');
console.log('✅ SendGrid will parse them');
console.log('✅ SendGrid will call your webhook at cimshare.replit.app');
console.log('✅ Messages will appear in your app');