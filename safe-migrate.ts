#!/usr/bin/env tsx
/**
 * Safe Database Migration Script
 * Automatically creates backup before running migrations
 */

import { backupManager } from './server/database-backup';
import { execSync } from 'child_process';

async function safeMigrate() {
  console.log('🛡️ Starting safe database migration...');
  
  try {
    // Step 1: Create pre-migration backup
    console.log('📦 Creating pre-migration backup...');
    const backupPath = await backupManager.createPreMigrationBackup();
    console.log(`✅ Backup created: ${backupPath}`);
    
    // Step 2: Run the migration
    console.log('🔄 Running database migration...');
    execSync('npm run db:push', { stdio: 'inherit' });
    console.log('✅ Migration completed successfully');
    
    // Step 3: Clean old backups
    console.log('🧹 Cleaning old backups...');
    backupManager.cleanOldBackups();
    console.log('✅ Backup cleanup completed');
    
    console.log('🎉 Safe migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.log('');
    console.log('🔧 To restore from backup:');
    console.log('  tsx backup-database.ts list');
    console.log('  tsx backup-database.ts restore <backup-file>');
    process.exit(1);
  }
}

safeMigrate();