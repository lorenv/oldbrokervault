import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import path from 'path';
import { format } from 'date-fns';

const execAsync = promisify(exec);

interface BackupOptions {
  retentionDays?: number;
  compressionLevel?: number;
}

export class DatabaseBackupService {
  private backupDir: string;
  private retentionDays: number;

  constructor(backupDir: string = './backups', options: BackupOptions = {}) {
    this.backupDir = backupDir;
    this.retentionDays = options.retentionDays || 30;
  }

  /**
   * Create a full database backup
   */
  async createBackup(): Promise<string> {
    try {
      console.log('[BACKUP] Starting database backup...');
      
      // Ensure backup directory exists
      await this.ensureBackupDirectory();
      
      // Generate backup filename with timestamp
      const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
      const backupFilename = `undersigned_backup_${timestamp}.sql`;
      const backupPath = path.join(this.backupDir, backupFilename);
      
      // Get database connection details
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        throw new Error('DATABASE_URL environment variable not set');
      }
      
      // Create PostgreSQL dump
      const pgDumpCommand = `pg_dump "${databaseUrl}" --no-owner --no-privileges --clean > "${backupPath}"`;
      
      console.log(`[BACKUP] Creating backup: ${backupFilename}`);
      await execAsync(pgDumpCommand);
      
      // Verify backup was created
      const stats = await fs.stat(backupPath);
      if (stats.size === 0) {
        throw new Error('Backup file is empty');
      }
      
      console.log(`[BACKUP] ✅ Backup created successfully: ${backupFilename} (${this.formatFileSize(stats.size)})`);
      
      // Clean up old backups
      await this.cleanupOldBackups();
      
      return backupPath;
      
    } catch (error: any) {
      console.error('[BACKUP] ❌ Failed to create backup:', error.message);
      throw error;
    }
  }
  
  /**
   * Restore database from backup file
   */
  async restoreBackup(backupPath: string): Promise<void> {
    try {
      console.log(`[BACKUP] Starting database restore from: ${backupPath}`);
      
      // Verify backup file exists
      await fs.access(backupPath);
      
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        throw new Error('DATABASE_URL environment variable not set');
      }
      
      // Restore from PostgreSQL dump
      const psqlCommand = `psql "${databaseUrl}" < "${backupPath}"`;
      
      console.log('[BACKUP] Executing restore...');
      await execAsync(psqlCommand);
      
      console.log('[BACKUP] ✅ Database restored successfully');
      
    } catch (error: any) {
      console.error('[BACKUP] ❌ Failed to restore backup:', error.message);
      throw error;
    }
  }
  
  /**
   * List all available backups
   */
  async listBackups(): Promise<Array<{ filename: string; path: string; size: number; created: Date }>> {
    try {
      await this.ensureBackupDirectory();
      
      const files = await fs.readdir(this.backupDir);
      const backupFiles = files.filter(file => file.startsWith('undersigned_backup_') && file.endsWith('.sql'));
      
      const backups = await Promise.all(
        backupFiles.map(async (filename) => {
          const filePath = path.join(this.backupDir, filename);
          const stats = await fs.stat(filePath);
          
          return {
            filename,
            path: filePath,
            size: stats.size,
            created: stats.birthtime
          };
        })
      );
      
      // Sort by creation date (newest first)
      return backups.sort((a, b) => b.created.getTime() - a.created.getTime());
      
    } catch (error: any) {
      console.error('[BACKUP] Failed to list backups:', error.message);
      return [];
    }
  }
  
  /**
   * Delete a specific backup file
   */
  async deleteBackup(backupPath: string): Promise<void> {
    try {
      await fs.unlink(backupPath);
      console.log(`[BACKUP] Deleted backup: ${path.basename(backupPath)}`);
    } catch (error: any) {
      console.error(`[BACKUP] Failed to delete backup: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Clean up old backups based on retention policy
   */
  private async cleanupOldBackups(): Promise<void> {
    try {
      const backups = await this.listBackups();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);
      
      const oldBackups = backups.filter(backup => backup.created < cutoffDate);
      
      if (oldBackups.length > 0) {
        console.log(`[BACKUP] Cleaning up ${oldBackups.length} old backups...`);
        
        for (const backup of oldBackups) {
          await this.deleteBackup(backup.path);
        }
      }
      
    } catch (error: any) {
      console.error('[BACKUP] Failed to cleanup old backups:', error.message);
    }
  }
  
  /**
   * Ensure backup directory exists
   */
  private async ensureBackupDirectory(): Promise<void> {
    try {
      await fs.access(this.backupDir);
    } catch {
      await fs.mkdir(this.backupDir, { recursive: true });
      console.log(`[BACKUP] Created backup directory: ${this.backupDir}`);
    }
  }
  
  /**
   * Format file size for display
   */
  private formatFileSize(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }
  
  /**
   * Get backup statistics
   */
  async getBackupStats(): Promise<{
    totalBackups: number;
    totalSize: number;
    oldestBackup: Date | null;
    newestBackup: Date | null;
  }> {
    const backups = await this.listBackups();
    
    return {
      totalBackups: backups.length,
      totalSize: backups.reduce((sum, backup) => sum + backup.size, 0),
      oldestBackup: backups.length > 0 ? backups[backups.length - 1].created : null,
      newestBackup: backups.length > 0 ? backups[0].created : null
    };
  }
}

// Create singleton instance
export const backupService = new DatabaseBackupService();

/**
 * Automated backup scheduler
 */
export class BackupScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  
  /**
   * Start automatic backups
   */
  start(intervalHours: number = 24): void {
    if (this.isRunning) {
      console.log('[BACKUP_SCHEDULER] Already running');
      return;
    }
    
    console.log(`[BACKUP_SCHEDULER] Starting automated backups every ${intervalHours} hours`);
    
    // Only run immediate backup if none exists for today
    this.runBackupIfNeeded();
    
    // Schedule recurring backups
    this.intervalId = setInterval(() => {
      this.runBackupIfNeeded();
    }, intervalHours * 60 * 60 * 1000);
    
    this.isRunning = true;
  }
  
  /**
   * Stop automatic backups
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('[BACKUP_SCHEDULER] Stopped automated backups');
  }
  
  /**
   * Check if scheduler is running
   */
  isSchedulerRunning(): boolean {
    return this.isRunning;
  }
  
  /**
   * Run a backup with error handling
   */
  private async runBackup(): Promise<void> {
    try {
      await backupService.createBackup();
    } catch (error: any) {
      console.error('[BACKUP_SCHEDULER] Automated backup failed:', error.message);
      // Could send alert email here in the future
    }
  }

  /**
   * Run backup only if none exists for today
   */
  private async runBackupIfNeeded(): Promise<void> {
    try {
      const backups = await backupService.listBackups();
      const today = new Date();
      const todayStr = format(today, 'yyyy-MM-dd');
      
      // Check if we already have a backup from today
      const todayBackup = backups.find(backup => {
        const backupDate = format(backup.created, 'yyyy-MM-dd');
        return backupDate === todayStr;
      });
      
      if (todayBackup) {
        console.log(`[BACKUP_SCHEDULER] Backup already exists for today: ${todayBackup.filename}`);
        return;
      }
      
      console.log('[BACKUP_SCHEDULER] No backup found for today, creating new backup...');
      await this.runBackup();
    } catch (error: any) {
      console.error('[BACKUP_SCHEDULER] Failed to check backup status:', error.message);
      // Fallback to regular backup if check fails
      await this.runBackup();
    }
  }
}

// Create singleton scheduler
export const backupScheduler = new BackupScheduler();