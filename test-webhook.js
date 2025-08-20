#!/usr/bin/env node

// Test script for SendGrid webhook debugging
// Usage: node test-webhook.js

const testWebhookData = {
  to: "thread-22@reply.cimshare.com",
  from: "test@example.com",
  subject: "Test reply",
  text: "This is a test email reply",
  envelope: JSON.stringify({
    to: ["thread-22@reply.cimshare.com"],
    from: "test@example.com"
  })
};

console.log("🧪 Testing SendGrid webhook parsing");
console.log("=====================================");
console.log("Test data:", testWebhookData);
console.log("");

// Test email extraction
const extractEmail = (emailStr) => {
  if (!emailStr) return '';
  const match = emailStr.match(/<([^>]+)>/);
  return match ? match[1] : emailStr.trim();
};

const toEmail = extractEmail(testWebhookData.to);
const fromEmail = extractEmail(testWebhookData.from);

console.log("Extracted emails:");
console.log("  To:", toEmail);
console.log("  From:", fromEmail);
console.log("");

// Test thread ID extraction
let threadMatch = toEmail.match(/thread-(\d+)@(?:reply\.)?cimshare\.com/i);
console.log("Thread ID extraction:");
console.log("  Pattern: /thread-(\\d+)@(?:reply\\.)?cimshare\\.com/i");
console.log("  Match:", threadMatch);

if (threadMatch) {
  console.log("  ✅ Thread ID found:", threadMatch[1]);
} else {
  console.log("  ❌ No thread ID found in main 'to' field");
  
  // Check envelope
  const envelope = JSON.parse(testWebhookData.envelope);
  if (envelope?.to) {
    console.log("  Checking envelope.to:", envelope.to);
    for (const recipient of envelope.to) {
      const cleanRecipient = extractEmail(recipient);
      threadMatch = cleanRecipient.match(/thread-(\d+)@(?:reply\.)?cimshare\.com/i);
      if (threadMatch) {
        console.log("  ✅ Found thread ID in envelope.to:", threadMatch[1]);
        break;
      }
    }
  }
}

console.log("");
console.log("Next steps:");
console.log("1. Check SendGrid Inbound Parse settings at: https://app.sendgrid.com/settings/parse");
console.log("2. Verify MX records for reply.cimshare.com point to: mx.sendgrid.net");
console.log("3. Ensure webhook URL is set to: https://YOUR_DOMAIN/api/webhook/sendgrid/inbound");
console.log("4. Test by sending an email to a valid thread address like thread-22@reply.cimshare.com");
console.log("");
console.log("To check MX records, run: dig MX reply.cimshare.com");