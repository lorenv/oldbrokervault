import { db } from "./db";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

interface BackupMetadata {
  timestamp: string;
  tables: string[];
  userCount: number;
  cimCount: number;
  backupSize: string;
}

export class DatabaseBackupManager {
  private backupDir = path.join(process.cwd(), 'database-backups');
  
  constructor() {
    this.ensureBackupDirectory();
  }

  private ensureBackupDirectory() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  /**
   * Create a full database backup using pg_dump
   */
  async createFullBackup(label?: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `backup-${label || 'auto'}-${timestamp}.sql`;
    const filePath = path.join(this.backupDir, fileName);
    
    try {
      console.log('🔄 Creating database backup...');
      
      // Get database stats before backup
      const userCount = await this.getTableCount('users');
      const cimCount = await this.getTableCount('cim_documents');
      
      // Create pg_dump backup
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        throw new Error('DATABASE_URL not found');
      }
      
      execSync(`pg_dump "${databaseUrl}" > "${filePath}"`, { stdio: 'inherit' });
      
      // Get file size
      const stats = fs.statSync(filePath);
      const backupSize = (stats.size / 1024 / 1024).toFixed(2) + 'MB';
      
      // Create metadata file
      const metadata: BackupMetadata = {
        timestamp,
        tables: await this.getTableNames(),
        userCount,
        cimCount,
        backupSize
      };
      
      fs.writeFileSync(
        path.join(this.backupDir, `${fileName}.meta`),
        JSON.stringify(metadata, null, 2)
      );
      
      console.log(`✅ Backup created: ${fileName} (${backupSize})`);
      console.log(`📊 Backed up: ${userCount} users, ${cimCount} CIMs`);
      
      return filePath;
    } catch (error) {
      console.error('❌ Backup failed:', error);
      throw error;
    }
  }

  /**
   * Create automated backup before schema migrations
   */
  async createPreMigrationBackup(): Promise<string> {
    console.log('🛡️ Creating pre-migration backup...');
    return this.createFullBackup('pre-migration');
  }

  /**
   * Restore database from backup
   */
  async restoreFromBackup(backupPath: string): Promise<void> {
    try {
      console.log('🔄 Restoring database from backup...');
      
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        throw new Error('DATABASE_URL not found');
      }
      
      // Drop all tables and recreate from backup
      execSync(`psql "${databaseUrl}" < "${backupPath}"`, { stdio: 'inherit' });
      
      console.log('✅ Database restored successfully');
    } catch (error) {
      console.error('❌ Restore failed:', error);
      throw error;
    }
  }

  /**
   * List available backups
   */
  listBackups(): Array<{ file: string; metadata?: BackupMetadata }> {
    const backups = fs.readdirSync(this.backupDir)
      .filter(file => file.endsWith('.sql'))
      .map(file => {
        const metaPath = path.join(this.backupDir, `${file}.meta`);
        let metadata: BackupMetadata | undefined;
        
        if (fs.existsSync(metaPath)) {
          try {
            metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
          } catch (e) {
            console.warn(`Failed to read metadata for ${file}`);
          }
        }
        
        return { file, metadata };
      })
      .sort((a, b) => b.file.localeCompare(a.file)); // Most recent first
    
    return backups;
  }

  /**
   * Clean old backups (keep last 10)
   */
  cleanOldBackups(): void {
    const backups = this.listBackups();
    const toDelete = backups.slice(10); // Keep only 10 most recent
    
    toDelete.forEach(({ file }) => {
      const sqlPath = path.join(this.backupDir, file);
      const metaPath = path.join(this.backupDir, `${file}.meta`);
      
      try {
        fs.unlinkSync(sqlPath);
        if (fs.existsSync(metaPath)) {
          fs.unlinkSync(metaPath);
        }
        console.log(`🗑️ Deleted old backup: ${file}`);
      } catch (error) {
        console.warn(`Failed to delete backup ${file}:`, error);
      }
    });
  }

  private async getTableCount(tableName: string): Promise<number> {
    try {
      const result = await db.execute(`SELECT COUNT(*) as count FROM ${tableName}`);
      return parseInt((result as any)[0]?.count || '0');
    } catch (error) {
      console.warn(`Failed to get count for table ${tableName}:`, error);
      return 0;
    }
  }

  private async getTableNames(): Promise<string[]> {
    try {
      const result = await db.execute(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      `);
      return Array.isArray(result) ? result.map((row: any) => row.table_name) : [];
    } catch (error) {
      console.warn('Failed to get table names:', error);
      return [];
    }
  }
}

export const backupManager = new DatabaseBackupManager();