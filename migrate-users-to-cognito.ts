import { storage } from "./server/storage";
import { cognitoAuth } from "./server/cognito-auth";
import { logger } from "./server/logger";
import { randomBytes } from 'crypto';

interface MigrationStats {
  totalUsers: number;
  successCount: number;
  errorCount: number;
  errors: { email: string; error: string }[];
}

/**
 * Migration script to create Cognito users for existing local users
 * This will create users with temporary passwords that require reset on first login
 */
async function migrateUserseToCognito(): Promise<MigrationStats> {
  const stats: MigrationStats = {
    totalUsers: 0,
    successCount: 0,
    errorCount: 0,
    errors: []
  };

  try {
    console.log('🚀 Starting user migration to Cognito...');
    
    // Get all existing users that don't have Cognito IDs
    const allUsers = await storage.getAllUsers();
    const usersToMigrate = allUsers.filter(user => !user.cognitoUserId);
    
    stats.totalUsers = usersToMigrate.length;
    
    console.log(`📊 Found ${stats.totalUsers} users to migrate`);
    
    if (stats.totalUsers === 0) {
      console.log('✅ No users need migration');
      return stats;
    }

    // Process each user
    for (const user of usersToMigrate) {
      try {
        console.log(`🔄 Migrating user: ${user.email}`);
        
        // Generate a secure temporary password
        const tempPassword = `TempPass${randomBytes(8).toString('hex')}!`;
        
        // Prepare user attributes
        const attributes: Record<string, string> = {};
        if (user.name) {
          attributes.name = user.name;
        }
        
        // Create user in Cognito
        const cognitoUserId = await cognitoAuth.createUser(
          user.email,
          tempPassword,
          attributes
        );
        
        // Update local user with Cognito ID
        await storage.updateUser(user.id, {
          cognitoUserId: cognitoUserId
        });
        
        console.log(`✅ Successfully migrated ${user.email} (Cognito ID: ${cognitoUserId})`);
        stats.successCount++;
        
        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error: any) {
        console.error(`❌ Failed to migrate ${user.email}:`, error.message);
        stats.errorCount++;
        stats.errors.push({
          email: user.email,
          error: error.message
        });
        
        // Continue with next user even if one fails
        continue;
      }
    }
    
    console.log('\n📈 Migration Summary:');
    console.log(`Total users: ${stats.totalUsers}`);
    console.log(`Successfully migrated: ${stats.successCount}`);
    console.log(`Failed: ${stats.errorCount}`);
    
    if (stats.errors.length > 0) {
      console.log('\n❌ Errors:');
      stats.errors.forEach(err => {
        console.log(`  - ${err.email}: ${err.error}`);
      });
    }
    
    if (stats.successCount > 0) {
      console.log('\n📧 Next Steps:');
      console.log('1. All migrated users will need to reset their passwords');
      console.log('2. They will receive password reset emails from Cognito');
      console.log('3. Consider sending a notification email about the migration');
    }
    
    return stats;
    
  } catch (error: any) {
    console.error('💥 Migration failed:', error);
    throw error;
  }
}

/**
 * Send password reset emails to all migrated users
 */
async function sendPasswordResetToMigratedUsers(): Promise<void> {
  try {
    console.log('📧 Sending password reset emails to migrated users...');
    
    const allUsers = await storage.getAllUsers();
    const migratedUsers = allUsers.filter(user => user.cognitoUserId);
    
    console.log(`📊 Found ${migratedUsers.length} migrated users`);
    
    for (const user of migratedUsers) {
      try {
        await cognitoAuth.forgotPassword(user.email);
        console.log(`✅ Sent password reset email to ${user.email}`);
        
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error: any) {
        console.error(`❌ Failed to send reset email to ${user.email}:`, error.message);
      }
    }
    
    console.log('✅ Password reset emails sent to all migrated users');
    
  } catch (error: any) {
    console.error('💥 Failed to send password reset emails:', error);
    throw error;
  }
}

// Main execution
async function main() {
  try {
    const action = process.argv[2];
    
    if (action === 'reset-passwords') {
      await sendPasswordResetToMigratedUsers();
    } else {
      const stats = await migrateUserseToCognito();
      
      if (stats.successCount > 0) {
        console.log('\n🤔 Would you like to send password reset emails now? (Run with "reset-passwords" argument)');
        console.log('Example: npm run migrate-cognito reset-passwords');
      }
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('💥 Migration script failed:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { migrateUserseToCognito, sendPasswordResetToMigratedUsers };