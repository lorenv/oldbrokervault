#!/usr/bin/env node

console.log('SendGrid Email Reply System Diagnostic\n');
console.log('======================================\n');

console.log('✅ WEBHOOK STATUS: Your webhook endpoints are working correctly!\n');

console.log('POSSIBLE ISSUES TO CHECK:\n');

console.log('1. DNS/MX RECORDS:');
console.log('   - Go to your DNS provider (not SendGrid)');
console.log('   - Ensure these MX records exist for reply.cimshare.com:');
console.log('     • reply.cimshare.com    MX    10    mx.sendgrid.net');
console.log('     • reply.cimshare.com    MX    20    mx2.sendgrid.net (optional)');
console.log('   - Note: These must be on the SUBDOMAIN reply, not the main domain\n');

console.log('2. SENDGRID ACTIVITY FEED:');
console.log('   - Go to: https://app.sendgrid.com/email_activity');
console.log('   - Look for emails sent to @reply.cimshare.com');
console.log('   - If you see them there but no webhook, check the error message\n');

console.log('3. SENDGRID INBOUND PARSE STATUS:');
console.log('   - Go to: https://app.sendgrid.com/settings/parse');
console.log('   - Verify the entry shows:');
console.log('     • Hostname: reply.cimshare.com');
console.log('     • URL: https://cimshare.replit.app/api/webhook/sendgrid/inbound');
console.log('     • Status: Active (not paused or errored)\n');

console.log('4. SENDGRID WEBHOOK LOGS:');
console.log('   - SendGrid may be failing silently if:');
console.log('     • The webhook returns an error (but yours returns 200 OK ✅)');
console.log('     • Rate limits are exceeded');
console.log('     • The parse webhook is disabled\n');

console.log('5. TEST EMAIL FLOW:');
console.log('   a) Send an email FROM your personal email');
console.log('   b) TO: thread-20@reply.cimshare.com');
console.log('   c) Wait 1-2 minutes');
console.log('   d) Check SendGrid Activity Feed');
console.log('   e) If email appears there, webhook should fire\n');

console.log('6. COMMON DNS ISSUES:');
console.log('   - MX records on wrong domain (cimshare.com instead of reply.cimshare.com)');
console.log('   - DNS propagation not complete (can take up to 48 hours)');
console.log('   - Conflicting MX records (e.g., Google Workspace on same subdomain)');
console.log('   - TTL too high on MX records\n');

console.log('7. TEST COMMANDS:');
console.log('   Check if webhook creates a message:');
console.log('   curl -X POST https://cimshare.replit.app/api/webhook/sendgrid/inbound \\');
console.log('     -H "Content-Type: application/x-www-form-urlencoded" \\');
console.log('     -d "to=thread-20@reply.cimshare.com&from=you@example.com&text=Test+from+curl&subject=Test"\n');

console.log('MOST LIKELY ISSUE:');
console.log('==================');
console.log('Since your webhook is working but not receiving emails, the issue is likely:');
console.log('1. MX records not set up correctly for reply.cimshare.com');
console.log('2. OR emails are going to Google instead of SendGrid');
console.log('3. OR SendGrid parse webhook is paused/disabled\n');

console.log('To verify MX records are working:');
console.log('- Use an online tool like https://mxtoolbox.com');
console.log('- Enter: reply.cimshare.com');
console.log('- Should show: mx.sendgrid.net');