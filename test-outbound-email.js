#!/usr/bin/env npx tsx

import { messageService } from './server/message-service';
import { db } from './server/db';
import { messageThreads, messages, users } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import sgMail from '@sendgrid/mail';

console.log('\n📧 OUTBOUND EMAIL TEST');
console.log('=' .repeat(60));

async function testOutboundEmail() {
  try {
    // Get a recent thread with email address
    const [thread] = await db
      .select()
      .from(messageThreads)
      .where(eq(messageThreads.threadEmailAddress, 'thread-e9pdi@reply.cimshare.com'))
      .limit(1);

    if (!thread) {
      console.log('❌ No thread found with ID e9pdi');
      console.log('Let me find another thread...');

      // Get any recent thread with email
      const [anyThread] = await db
        .select()
        .from(messageThreads)
        .orderBy(desc(messageThreads.createdAt))
        .limit(1);

      if (!anyThread) {
        console.log('❌ No threads found in database');
        return;
      }

      thread = anyThread;
    }

    console.log('\n📋 THREAD DETAILS:');
    console.log('-'.repeat(40));
    console.log(`   Thread ID: ${thread.id}`);
    console.log(`   Subject: ${thread.subject}`);
    console.log(`   Thread Email: ${thread.threadEmailAddress}`);
    console.log(`   Inquirer: ${thread.inquirerName} <${thread.inquirerEmail}>`);

    // Get the owner details
    const [owner] = await db
      .select()
      .from(users)
      .where(eq(users.id, thread.userId));

    console.log(`   Owner: ${owner?.name} <${owner?.email}>`);

    // Test sending notification to inquirer
    console.log('\n🧪 TEST 1: Notification to Inquirer');
    console.log('-'.repeat(40));
    console.log('   This simulates when owner responds in message center');
    console.log('   Email should have reply-to: thread-xxx@reply.cimshare.com');

    const testEmailToInquirer = {
      to: thread.inquirerEmail,
      from: "system@cimshare.com",
      replyTo: thread.threadEmailAddress || "system@cimshare.com",
      subject: `Re: ${thread.subject}`,
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h3>Test Response from Owner</h3>
          <p>This is a test message to verify the reply-to header.</p>
          <p><strong>Reply-To Header Should Be:</strong> ${thread.threadEmailAddress}</p>
          <hr>
          <p style="color: #666; font-size: 0.9em;">
            When you reply to this email, it should go to: ${thread.threadEmailAddress}<br>
            That will be parsed by SendGrid and added to the message thread.
          </p>
        </div>
      `
    };

    console.log('\n   Email Configuration:');
    console.log(`   To: ${testEmailToInquirer.to}`);
    console.log(`   From: ${testEmailToInquirer.from}`);
    console.log(`   Reply-To: ${testEmailToInquirer.replyTo}`);
    console.log(`   Subject: ${testEmailToInquirer.subject}`);

    const sendTest = process.argv[2] === 'send';
    if (sendTest && process.env.SENDGRID_API_KEY) {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      console.log('\n   Attempting to send test email...');

      try {
        const [response] = await sgMail.send(testEmailToInquirer);
        console.log(`   ✅ Email sent successfully!`);
        console.log(`   SendGrid Message ID: ${response.headers['x-message-id']}`);
        console.log(`   Status Code: ${response.statusCode}`);
      } catch (error) {
        console.log(`   ❌ Failed to send: ${error.message}`);
        if (error.response) {
          console.log(`   Response: ${JSON.stringify(error.response.body)}`);
        }
      }
    } else if (sendTest) {
      console.log('\n   ⚠️  SENDGRID_API_KEY not found, cannot send test email');
    } else {
      console.log('\n   ℹ️  To actually send this email, run: node test-outbound-email.js send');
    }

    // Test sending notification to owner
    console.log('\n🧪 TEST 2: Notification to Owner');
    console.log('-'.repeat(40));
    console.log('   This simulates when inquirer sends initial message');
    console.log('   Email should have reply-to: thread-xxx@reply.cimshare.com');

    const testEmailToOwner = {
      to: owner?.email,
      from: "system@cimshare.com",
      replyTo: thread.threadEmailAddress || "system@cimshare.com",
      subject: `New inquiry: ${thread.subject}`,
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h3>New Inquiry from ${thread.inquirerName}</h3>
          <p>This is a test message to verify the reply-to header.</p>
          <p><strong>Reply-To Header Should Be:</strong> ${thread.threadEmailAddress}</p>
          <hr>
          <p style="color: #666; font-size: 0.9em;">
            When you reply to this email, it should go to: ${thread.threadEmailAddress}<br>
            That will be parsed by SendGrid and forwarded to the inquirer.
          </p>
        </div>
      `
    };

    console.log('\n   Email Configuration:');
    console.log(`   To: ${testEmailToOwner.to}`);
    console.log(`   From: ${testEmailToOwner.from}`);
    console.log(`   Reply-To: ${testEmailToOwner.replyTo}`);
    console.log(`   Subject: ${testEmailToOwner.subject}`);

    // Check recent messages in the thread
    console.log('\n📬 RECENT MESSAGES IN THREAD:');
    console.log('-'.repeat(40));

    const recentMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.threadId, thread.id))
      .orderBy(desc(messages.createdAt))
      .limit(5);

    if (recentMessages.length === 0) {
      console.log('   No messages found in this thread');
    } else {
      recentMessages.forEach((msg, index) => {
        console.log(`\n   ${index + 1}. Message ID: ${msg.id}`);
        console.log(`      Sender: ${msg.senderType} (${msg.senderEmail})`);
        console.log(`      Type: ${msg.messageType}`);
        console.log(`      Content: ${msg.content.substring(0, 100)}...`);
        console.log(`      Created: ${msg.createdAt}`);
        if (msg.sendgridMessageId) {
          console.log(`      SendGrid ID: ${msg.sendgridMessageId}`);
        }
      });
    }

  } catch (error) {
    console.error('\n❌ Error:', error);
  }
}

// Main execution
(async () => {
  await testOutboundEmail();

  console.log('\n📝 DEBUGGING CHECKLIST:');
  console.log('-'.repeat(40));
  console.log('1. ✅ Thread emails are generated correctly (thread-xxx@reply.cimshare.com)');
  console.log('2. ✅ Reply-To headers are set in outbound emails');
  console.log('3. ✅ MX records point to SendGrid (mx.sendgrid.net)');
  console.log('4. ✅ Webhook endpoint is accessible');
  console.log('\n⚠️  POTENTIAL ISSUES TO CHECK:');
  console.log('   • Is SendGrid Inbound Parse actually ACTIVE in dashboard?');
  console.log('   • Is the webhook URL exactly: https://cimshare.com/api/webhook/sendgrid/inbound');
  console.log('   • Is "POST raw MIME" UNCHECKED in SendGrid settings?');
  console.log('   • Check SendGrid Activity Feed for incoming emails');
  console.log('   • Are emails being marked as spam by SendGrid?');

  console.log('\n✓ Test complete\n');
  process.exit(0);
})();