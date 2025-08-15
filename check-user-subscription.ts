#!/usr/bin/env tsx
/**
 * Check User Subscription Status
 * Quick script to verify subscription status in database
 */

import { db } from './server/db';
import { users } from './shared/schema';
import { eq } from 'drizzle-orm';

async function checkUserSubscription() {
  try {
    const email = process.argv[2];
    
    if (!email) {
      console.error('Usage: tsx check-user-subscription.ts <email>');
      process.exit(1);
    }
    
    console.log(`🔍 Checking subscription status for: ${email}`);
    
    const [user] = await db.select().from(users).where(eq(users.email, email));
    
    if (!user) {
      console.error('❌ User not found');
      process.exit(1);
    }
    
    console.log('📊 User Details:');
    console.log('================');
    console.log(`👤 Name: ${user.name || 'N/A'}`);
    console.log(`📧 Email: ${user.email}`);
    console.log(`🆔 User ID: ${user.id}`);
    console.log(`💳 Subscription Status: ${user.subscriptionStatus || 'free'}`);
    console.log(`📅 Subscription Ends: ${user.subscriptionEndsAt ? new Date(user.subscriptionEndsAt).toLocaleDateString() : 'N/A'}`);
    console.log(`🎫 Subscription ID: ${user.subscriptionId || 'N/A'}`);
    console.log(`🏪 Stripe Customer ID: ${user.stripeCustomerId || 'N/A'}`);
    console.log(`📊 Monthly Documents: ${user.monthlyDocumentsCreated || 0}`);
    console.log(`🔄 Monthly Regenerations: ${user.monthlyRegenerationsUsed || 0}`);
    console.log(`👑 Admin: ${user.isAdmin ? 'Yes' : 'No'}`);
    
    if (user.subscriptionStatus === 'standard') {
      console.log('\n✅ User has active Standard subscription');
    } else if (user.subscriptionStatus === 'premium') {
      console.log('\n🌟 User has active Premium subscription');
    } else {
      console.log('\n🆓 User is on Free plan');
    }
    
  } catch (error: any) {
    console.error('❌ Failed to check subscription:', error);
    throw error;
  }
}

checkUserSubscription().then(() => {
  console.log('\n🎉 Check completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Check failed:', error);
  process.exit(1);
});