#!/usr/bin/env tsx
/**
 * Add Premium User Script
 * Creates admin user with premium access until 2035
 */

import { db } from './db';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

async function addPremiumUser() {
  try {
    console.log('🔐 Creating admin user with premium access...');
    
    const email = 'robert@dealve.cc';
    const password = 'Flydccstone500!';
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Set subscription end date to 2035 
    const subscriptionEndsAt = new Date('2035-12-31T23:59:59Z');
    
    const [user] = await db.insert(users).values({
      email,
      password: hashedPassword,
      name: 'Robert Smith',
      title: 'CIM Share Administrator',
      isAdmin: true,
      subscriptionStatus: 'premium',
      subscriptionEndsAt,
      monthlyDocumentsCreated: 0,
      monthlyRegenerationsUsed: 0,
      businessName: 'CIM Share',
      phoneNumber: '(555) 123-4567'
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
          name: 'Robert Smith',
          title: 'CIM Share Administrator',
          businessName: 'CIM Share',
          phoneNumber: '(555) 123-4567'
        })
        .where(eq(users.email, 'robert@dealve.cc'))
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