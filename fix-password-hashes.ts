#!/usr/bin/env tsx
/**
 * Password Hash Migration Script
 * Identifies and optionally fixes users with bcrypt hashes instead of scrypt
 */

import { db } from './server/db';
import { users } from './shared/schema';
import { hashPassword } from './server/auth';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

async function analyzePasswordHashes() {
  try {
    console.log('🔍 Analyzing password hashes in database...');
    
    // Get all users
    const allUsers = await db.select({
      id: users.id,
      email: users.email,
      password: users.password,
      name: users.name,
      isAdmin: users.isAdmin
    }).from(users);
    
    if (allUsers.length === 0) {
      console.log('ℹ️  No users found in database');
      return;
    }
    
    console.log(`📊 Found ${allUsers.length} users in database`);
    
    const bcryptUsers: any[] = [];
    const scryptUsers: any[] = [];
    const unknownUsers: any[] = [];
    
    // Analyze each user's password hash
    allUsers.forEach(user => {
      if (user.password.startsWith('$2b$') || user.password.startsWith('$2a$') || user.password.startsWith('$2y$')) {
        // This is a bcrypt hash
        bcryptUsers.push(user);
      } else if (user.password.includes('.') && user.password.split('.').length === 2) {
        // This looks like our scrypt format (hex.salt)
        scryptUsers.push(user);
      } else {
        // Unknown format
        unknownUsers.push(user);
      }
    });
    
    console.log('\n📈 Password Hash Analysis Results:');
    console.log('=====================================');
    console.log(`✅ scrypt hashes (correct): ${scryptUsers.length}`);
    console.log(`❌ bcrypt hashes (problematic): ${bcryptUsers.length}`);
    console.log(`❓ unknown format: ${unknownUsers.length}`);
    
    if (bcryptUsers.length > 0) {
      console.log('\n🚨 PROBLEMATIC USERS (bcrypt hashes):');
      console.log('=====================================');
      bcryptUsers.forEach((user, index) => {
        console.log(`${index + 1}. ${user.email} (ID: ${user.id}) ${user.isAdmin ? '[ADMIN]' : ''}`);
        console.log(`   Name: ${user.name || 'N/A'}`);
        console.log(`   Hash format: bcrypt (incompatible with login)`);
        console.log('');
      });
      
      console.log('⚠️  These users cannot log in because their passwords are hashed with bcrypt,');
      console.log('   but the authentication system expects scrypt hashes.');
      console.log('');
      console.log('🔧 SOLUTIONS:');
      console.log('   1. Run password reset for these users: tsx reset-password.ts <email> <newpassword>');
      console.log('   2. Ask users to use "Forgot Password" feature');
      console.log('   3. Manually fix specific users with known passwords');
    }
    
    if (scryptUsers.length > 0) {
      console.log('\n✅ WORKING USERS (scrypt hashes):');
      console.log('==================================');
      scryptUsers.forEach((user, index) => {
        console.log(`${index + 1}. ${user.email} (ID: ${user.id}) ${user.isAdmin ? '[ADMIN]' : ''}`);
      });
    }
    
    if (unknownUsers.length > 0) {
      console.log('\n❓ UNKNOWN FORMAT USERS:');
      console.log('=========================');
      unknownUsers.forEach((user, index) => {
        console.log(`${index + 1}. ${user.email} (ID: ${user.id})`);
        console.log(`   Hash: ${user.password.substring(0, 20)}...`);
      });
    }
    
    console.log('\n📋 SUMMARY:');
    console.log('============');
    if (bcryptUsers.length === 0) {
      console.log('🎉 All user passwords are compatible with the authentication system!');
    } else {
      console.log(`❌ ${bcryptUsers.length} user(s) have incompatible password hashes`);
      console.log('   These users cannot log in until their passwords are reset');
    }
    
  } catch (error: any) {
    console.error('❌ Failed to analyze password hashes:', error);
    throw error;
  }
}

// If run with "fix" argument, attempt to fix known admin accounts
async function fixKnownAccounts() {
  const knownAccounts = [
    { email: 'robert@dealve.cc', password: 'Flydccstone500!' },
    { email: 'bchaiprasit@tworld.com', password: 'ChangeMe123!' }
  ];
  
  console.log('🔧 Attempting to fix known admin accounts...');
  
  for (const account of knownAccounts) {
    try {
      // Check if user exists and has bcrypt hash
      const [user] = await db.select().from(users).where(eq(users.email, account.email));
      
      if (!user) {
        console.log(`ℹ️  User ${account.email} not found, skipping`);
        continue;
      }
      
      if (user.password.startsWith('$2b$') || user.password.startsWith('$2a$') || user.password.startsWith('$2y$')) {
        console.log(`🔄 Fixing ${account.email}...`);
        
        // Re-hash with scrypt
        const newHash = await hashPassword(account.password);
        
        await db.update(users)
          .set({ password: newHash })
          .where(eq(users.email, account.email));
          
        console.log(`✅ Fixed ${account.email} - converted bcrypt to scrypt hash`);
      } else {
        console.log(`ℹ️  ${account.email} already has compatible hash format`);
      }
    } catch (error) {
      console.error(`❌ Failed to fix ${account.email}:`, error);
    }
  }
}

// Main execution
const command = process.argv[2];

if (command === 'fix') {
  console.log('🚀 Running password hash fix for known accounts...\n');
  
  analyzePasswordHashes()
    .then(() => fixKnownAccounts())
    .then(() => {
      console.log('\n🎉 Password hash analysis and fix completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
} else {
  console.log('🚀 Running password hash analysis...\n');
  
  analyzePasswordHashes()
    .then(() => {
      console.log('\n🎉 Password hash analysis completed');
      console.log('\n💡 To fix known admin accounts, run: tsx fix-password-hashes.ts fix');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Analysis failed:', error);
      process.exit(1);
    });
}