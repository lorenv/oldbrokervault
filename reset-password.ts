#!/usr/bin/env tsx
/**
 * Password Reset Script
 * Updates password for existing user
 */

import { db } from './server/db';
import { users } from './shared/schema';
import { eq } from 'drizzle-orm';
import { hashPassword } from './server/auth';

async function resetPassword() {
  try {
    const email = process.argv[2];
    const newPassword = process.argv[3];
    
    if (!email || !newPassword) {
      console.error('Usage: tsx reset-password.ts <email> <password>');
      process.exit(1);
    }
    
    console.log(`🔐 Resetting password for: ${email}`);
    
    // Hash the new password using the same algorithm as authentication
    const hashedPassword = await hashPassword(newPassword);
    
    // Update the user's password
    const [updatedUser] = await db.update(users)
      .set({
        password: hashedPassword
      })
      .where(eq(users.email, email))
      .returning();
      
    if (!updatedUser) {
      console.error('❌ User not found');
      process.exit(1);
    }
    
    console.log('✅ Password updated successfully:');
    console.log(`   📧 Email: ${updatedUser.email}`);
    console.log(`   👤 Name: ${updatedUser.name}`);
    console.log(`   🔑 Admin: ${updatedUser.isAdmin ? 'Yes' : 'No'}`);
    console.log(`   🆔 User ID: ${updatedUser.id}`);
    
  } catch (error: any) {
    console.error('❌ Failed to reset password:', error);
    throw error;
  }
}

resetPassword().then(() => {
  console.log('🎉 Password reset completed successfully');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Password reset failed:', error);
  process.exit(1);
});