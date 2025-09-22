#!/usr/bin/env npx tsx

import { db } from './server/db';
import { messageThreads, messages } from '@shared/schema';
import { eq, desc, and, gte, sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

console.log('\n🔍 SENDGRID WEBHOOK MONITOR');
console.log('=' .repeat(60));

const logFile = path.join(process.cwd(), 'webhook-monitor.log');

async function monitorWebhooks() {
  console.log('📊 Monitoring webhook activity...\n');

  // Note: Email sync logs table not available yet
  console.log('📧 EMAIL SYNC LOGS:');
  console.log('-'.repeat(40));
  console.log('   ℹ️  Email sync logging not yet implemented in database');

  // Check recent messages received via webhook
  console.log('\n📬 RECENT WEBHOOK MESSAGES:');
  console.log('-'.repeat(40));

  const webhookMessages = await db
    .select({
      id: messages.id,
      threadId: messages.threadId,
      senderType: messages.senderType,
      senderEmail: messages.senderEmail,
      messageType: messages.messageType,
      content: messages.content,
      createdAt: messages.createdAt,
      threadEmail: sql`(SELECT thread_email_address FROM message_threads WHERE id = messages.thread_id)`
    })
    .from(messages)
    .where(eq(messages.messageType, 'email_reply'))
    .orderBy(desc(messages.createdAt))
    .limit(10);

  if (webhookMessages.length === 0) {
    console.log('   No email reply messages found');
  } else {
    webhookMessages.forEach(msg => {
      console.log(`\n   Message ID: ${msg.id} (Thread: ${msg.threadId})`);
      console.log(`   Received: ${msg.createdAt.toISOString()}`);
      console.log(`   From: ${msg.senderEmail} (${msg.senderType})`);
      console.log(`   Thread Email: ${msg.threadEmail}`);
      console.log(`   Content preview: ${msg.content.substring(0, 50)}...`);
    });
  }

  // Check threads created in last 24 hours
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentThreads = await db
    .select({
      id: messageThreads.id,
      threadEmailAddress: messageThreads.threadEmailAddress,
      createdAt: messageThreads.createdAt,
      messageCount: sql`(SELECT COUNT(*) FROM messages WHERE thread_id = message_threads.id)`
    })
    .from(messageThreads)
    .where(gte(messageThreads.createdAt, oneDayAgo))
    .orderBy(desc(messageThreads.createdAt));

  console.log('\n📊 THREADS CREATED IN LAST 24 HOURS:');
  console.log('-'.repeat(40));

  if (recentThreads.length === 0) {
    console.log('   No threads created in last 24 hours');
  } else {
    console.log(`   Total: ${recentThreads.length} threads`);
    console.log(`\n   Threads with messages:`);
    recentThreads.forEach(thread => {
      if (thread.messageCount > 0) {
        console.log(`     Thread ${thread.id}: ${thread.messageCount} messages`);
        console.log(`       Email: ${thread.threadEmailAddress}`);
      }
    });
  }

  // Real-time monitoring mode
  if (process.argv[2] === 'live') {
    console.log('\n🔴 LIVE MONITORING MODE');
    console.log('-'.repeat(40));
    console.log('Watching for new webhook hits...');
    console.log('(Press Ctrl+C to stop)\n');

    let lastCheckTime = new Date();

    setInterval(async () => {
      try {
        // Check for new messages since last check
        const newMessages = await db
          .select()
          .from(messages)
          .where(
            and(
              eq(messages.messageType, 'email_reply'),
              gte(messages.createdAt, lastCheckTime)
            )
          );

        if (newMessages.length > 0) {
          console.log(`\n🆕 NEW WEBHOOK MESSAGE RECEIVED!`);
          newMessages.forEach(msg => {
            console.log(`   Time: ${msg.createdAt.toISOString()}`);
            console.log(`   From: ${msg.senderEmail}`);
            console.log(`   Thread: ${msg.threadId}`);
            console.log(`   Content: ${msg.content.substring(0, 100)}...`);

            // Log to file
            const logEntry = `${new Date().toISOString()} - New webhook message: Thread ${msg.threadId}, From: ${msg.senderEmail}\n`;
            fs.appendFileSync(logFile, logEntry);
          });
        }

        lastCheckTime = new Date();
      } catch (error) {
        console.error('Monitor error:', error.message);
      }
    }, 5000); // Check every 5 seconds
  }
}

async function testWebhookDirectly() {
  console.log('\n🧪 DIRECT WEBHOOK TEST');
  console.log('-'.repeat(40));

  // Test if SendGrid servers can reach our webhook
  console.log('\n1. Testing webhook accessibility from external sources...');

  const testUrl = 'https://cimshare.com/api/webhook/sendgrid/info';

  try {
    const response = await fetch(testUrl);
    const data = await response.json();
    console.log('   ✅ Webhook is accessible externally');
    console.log('   Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.log('   ❌ Webhook not accessible:', error.message);
  }

  console.log('\n2. SendGrid Inbound Parse Configuration:');
  console.log('   • Login to SendGrid Dashboard');
  console.log('   • Go to: Settings → Inbound Parse');
  console.log('   • Verify these settings:');
  console.log('     - Host: reply.cimshare.com');
  console.log('     - URL: https://cimshare.com/api/webhook/sendgrid/inbound');
  console.log('     - POST raw MIME: ❌ UNCHECKED');
  console.log('     - Status: ✅ ACTIVE');

  console.log('\n3. Test Email Instructions:');
  console.log('   • Send email to: thread-test123@reply.cimshare.com');
  console.log('   • Check SendGrid Activity Feed after 1-2 minutes');
  console.log('   • Look for "Inbound Parse Webhook" events');
  console.log('   • Check if webhook was triggered');
}

// Main execution
(async () => {
  const command = process.argv[2];

  try {
    switch (command) {
      case 'test':
        await testWebhookDirectly();
        break;
      case 'live':
        await monitorWebhooks();
        break;
      default:
        await monitorWebhooks();
        console.log('\n💡 TIP: Run with "live" parameter for real-time monitoring');
        console.log('   Example: node monitor-sendgrid-webhook.js live');
        break;
    }

    if (command !== 'live') {
      console.log('\n✓ Monitoring complete\n');
      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
})();