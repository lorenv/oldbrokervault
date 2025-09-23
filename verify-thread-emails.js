#!/usr/bin/env npx tsx

import { db } from './server/db';
import { messageThreads, messages, users } from '@shared/schema';
import { eq, desc, isNull, and } from 'drizzle-orm';

console.log('\n🔍 THREAD EMAIL VERIFICATION TOOL');
console.log('=' .repeat(60));

async function checkThreadEmails() {
  try {
    // Get recent threads
    const threads = await db
      .select({
        id: messageThreads.id,
        threadEmailAddress: messageThreads.threadEmailAddress,
        userId: messageThreads.userId,
        inquirerEmail: messageThreads.inquirerEmail,
        inquirerName: messageThreads.inquirerName,
        subject: messageThreads.subject,
        status: messageThreads.status,
        createdAt: messageThreads.createdAt
      })
      .from(messageThreads)
      .orderBy(desc(messageThreads.createdAt))
      .limit(10);

    console.log(`\n📊 RECENT THREADS (${threads.length} found):`);
    console.log('-'.repeat(40));

    let missingEmails = 0;
    let validEmails = 0;

    threads.forEach((thread, index) => {
      console.log(`\n${index + 1}. Thread ID: ${thread.id}`);
      console.log(`   Subject: ${thread.subject}`);
      console.log(`   Created: ${thread.createdAt}`);
      console.log(`   Status: ${thread.status}`);
      console.log(`   Inquirer: ${thread.inquirerName} <${thread.inquirerEmail}>`);

      if (thread.threadEmailAddress) {
        console.log(`   ✅ Thread Email: ${thread.threadEmailAddress}`);

        // Validate format
        const isValid = /^thread-[a-z0-9]+@reply\.cimshare\.com$/i.test(thread.threadEmailAddress);
        if (isValid) {
          console.log('   ✅ Email format is valid');
          validEmails++;
        } else {
          console.log('   ⚠️  Email format may be invalid');
        }
      } else {
        console.log('   ❌ Thread Email: MISSING');
        missingEmails++;
      }
    });

    // Check for threads without email addresses
    const threadsWithoutEmail = await db
      .select({
        count: db.$count(messageThreads.id)
      })
      .from(messageThreads)
      .where(isNull(messageThreads.threadEmailAddress));

    console.log('\n📈 STATISTICS:');
    console.log('-'.repeat(40));
    console.log(`   Total threads checked: ${threads.length}`);
    console.log(`   Valid thread emails: ${validEmails}`);
    console.log(`   Missing thread emails: ${missingEmails}`);
    console.log(`   Total threads without emails in DB: ${threadsWithoutEmail[0]?.count || 0}`);

    // Check for duplicate email addresses
    console.log('\n🔍 CHECKING FOR DUPLICATE EMAILS:');
    const emailCounts = {};
    threads.forEach(thread => {
      if (thread.threadEmailAddress) {
        emailCounts[thread.threadEmailAddress] = (emailCounts[thread.threadEmailAddress] || 0) + 1;
      }
    });

    const duplicates = Object.entries(emailCounts).filter(([_, count]) => count > 1);
    if (duplicates.length > 0) {
      console.log('   ⚠️  Found duplicate thread emails:');
      duplicates.forEach(([email, count]) => {
        console.log(`      ${email}: ${count} occurrences`);
      });
    } else {
      console.log('   ✅ No duplicate thread emails found');
    }

    // Fix missing thread emails
    if (missingEmails > 0 || threadsWithoutEmail[0]?.count > 0) {
      console.log('\n⚙️  REPAIR OPTIONS:');
      console.log('-'.repeat(40));
      console.log('   To fix missing thread emails, run:');
      console.log('   node verify-thread-emails.js fix\n');
    }

  } catch (error) {
    console.error('❌ Error checking threads:', error);
  }
}

async function fixMissingThreadEmails() {
  try {
    console.log('\n🔧 FIXING MISSING THREAD EMAILS...');
    console.log('-'.repeat(40));

    // Import the message service to use its email generation
    const { messageService } = await import('./server/message-service');

    // Find threads without email addresses
    const threadsToFix = await db
      .select()
      .from(messageThreads)
      .where(isNull(messageThreads.threadEmailAddress));

    if (threadsToFix.length === 0) {
      console.log('✅ All threads have email addresses!');
      return;
    }

    console.log(`Found ${threadsToFix.length} threads without email addresses`);

    for (const thread of threadsToFix) {
      try {
        // Generate unique email
        const threadEmail = await messageService.generateUniqueThreadEmail();

        // Update thread
        await db
          .update(messageThreads)
          .set({ threadEmailAddress: threadEmail })
          .where(eq(messageThreads.id, thread.id));

        console.log(`✅ Fixed thread ${thread.id}: ${threadEmail}`);
      } catch (error) {
        console.error(`❌ Failed to fix thread ${thread.id}:`, error.message);
      }
    }

    console.log('\n✅ Thread email repair complete!');

  } catch (error) {
    console.error('❌ Error fixing threads:', error);
  }
}

async function testEmailGeneration() {
  console.log('\n🧪 TESTING EMAIL GENERATION:');
  console.log('-'.repeat(40));

  // Import the message service
  const { messageService } = await import('./server/message-service');

  console.log('\nGenerating 5 sample thread emails:');
  for (let i = 1; i <= 5; i++) {
    try {
      const email = await messageService.generateUniqueThreadEmail();
      console.log(`   ${i}. ${email}`);
    } catch (error) {
      console.error(`   ❌ Failed to generate email ${i}:`, error.message);
    }
  }
}

// Main execution
(async () => {
  const command = process.argv[2];

  try {
    switch (command) {
      case 'fix':
        await fixMissingThreadEmails();
        break;
      case 'test':
        await testEmailGeneration();
        break;
      default:
        await checkThreadEmails();
        if (process.argv[2] === 'full') {
          await testEmailGeneration();
        }
        break;
    }

    console.log('\n✓ Verification complete\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
})();