#!/usr/bin/env tsx
/**
 * Database Backup Management Script
 * Usage: tsx backup-database.ts [create|list|restore] [options]
 */

import { backupManager } from './server/database-backup';
import { program } from 'commander';

program
  .name('backup-database')
  .description('Database backup management for CIM Share')
  .version('1.0.0');

program
  .command('create')
  .description('Create a new database backup')
  .option('-l, --label <label>', 'Backup label', 'manual')
  .action(async (options) => {
    try {
      const backupPath = await backupManager.createFullBackup(options.label);
      console.log(`Backup created successfully: ${backupPath}`);
      process.exit(0);
    } catch (error) {
      console.error('Backup failed:', error);
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List all available backups')
  .action(async () => {
    try {
      const backups = backupManager.listBackups();
      
      if (backups.length === 0) {
        console.log('No backups found');
        return;
      }
      
      console.log('\nAvailable backups:');
      console.log('==================');
      
      backups.forEach(({ file, metadata }, index) => {
        console.log(`${index + 1}. ${file}`);
        if (metadata) {
          console.log(`   📅 Created: ${metadata.timestamp}`);
          console.log(`   📊 Data: ${metadata.userCount} users, ${metadata.cimCount} CIMs`);
          console.log(`   💾 Size: ${metadata.backupSize}`);
        }
        console.log('');
      });
    } catch (error) {
      console.error('Failed to list backups:', error);
      process.exit(1);
    }
  });

program
  .command('restore')
  .description('Restore database from backup')
  .argument('<backup-file>', 'Backup file name to restore from')
  .action(async (backupFile) => {
    try {
      const backups = backupManager.listBackups();
      const backup = backups.find(b => b.file === backupFile);
      
      if (!backup) {
        console.error(`Backup file not found: ${backupFile}`);
        console.log('\nAvailable backups:');
        backups.forEach(b => console.log(`  - ${b.file}`));
        process.exit(1);
      }
      
      const backupPath = require('path').join(__dirname, 'database-backups', backupFile);
      await backupManager.restoreFromBackup(backupPath);
      console.log('Database restored successfully');
      process.exit(0);
    } catch (error) {
      console.error('Restore failed:', error);
      process.exit(1);
    }
  });

program
  .command('clean')
  .description('Clean old backups (keep last 10)')
  .action(() => {
    try {
      backupManager.cleanOldBackups();
      console.log('Old backups cleaned successfully');
    } catch (error) {
      console.error('Failed to clean backups:', error);
      process.exit(1);
    }
  });

program.parse();