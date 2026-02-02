#!/usr/bin/env tsx
/**
 * Add Premium User Script
 * Creates admin user with premium access until 2035
 */

import { db } from './db';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { hashPassword } from './auth';

async function addPremiumUser() {
  // Validate required environment variables
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error('❌ Missing required environment variables:');
    if (!email) console.error('   - ADMIN_EMAIL is not set');
    if (!password) console.error('   - ADMIN_PASSWORD is not set');
    console.error('\nUsage: ADMIN_EMAIL=user@example.com ADMIN_PASSWORD=securepassword tsx server/add-premium-user.ts');
    process.exit(1);
  }

  try {
    console.log('🔐 Creating admin user with premium access...');

    const hashedPassword = await hashPassword(password);
    
    // Set subscription end date to 2035 
    const subscriptionEndsAt = new Date('2035-12-31T23:59:59Z');
    
    const [user] = await db.insert(users).values({
      email,
      password: hashedPassword,
      name: 'Admin User',
      title: 'Administrator',
      isAdmin: true,
      subscriptionStatus: 'premium',
      subscriptionEndsAt,
      monthlyDocumentsCreated: 0,
      monthlyRegenerationsUsed: 0,
      businessName: 'Admin',
      phoneNumber: ''
    }).returning();
    
    console.log('✅ Admin user created successfully:');
    console.log(`   📧 Email: ${user.email}`);
    console.log(`   👤 Name: ${user.name}`);
    console.log(`   🔑 Admin: ${user.isAdmin ? 'Yes' : 'No'}`);
    console.log(`   💎 Premium until: ${user.subscriptionEndsAt?.toDateString()}`);
    console.log(`   🆔 User ID: ${user.id}`);
    
  } catch (error: any) {
    if (error.message?.includes('duplicate key')) {
      console.log('👤 Admin user already exists');
      
      // Update existing user to ensure admin status
      const [updatedUser] = await db.update(users)
        .set({
          isAdmin: true,
          subscriptionStatus: 'premium',
          subscriptionEndsAt: new Date('2035-12-31T23:59:59Z'),
          name: 'Admin User',
          title: 'Administrator',
          businessName: 'Admin',
          phoneNumber: ''
        })
        .where(eq(users.email, email))
        .returning();
        
      console.log('✅ Admin user updated successfully:');
      console.log(`   📧 Email: ${updatedUser.email}`);
      console.log(`   👤 Name: ${updatedUser.name}`);
      console.log(`   🔑 Admin: ${updatedUser.isAdmin ? 'Yes' : 'No'}`);
      console.log(`   💎 Premium until: ${updatedUser.subscriptionEndsAt?.toDateString()}`);
      console.log(`   🆔 User ID: ${updatedUser.id}`);
    } else {
      console.error('❌ Failed to create admin user:', error);
      throw error;
    }
  }
}

addPremiumUser().then(() => {
  console.log('🎉 Script completed successfully');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});