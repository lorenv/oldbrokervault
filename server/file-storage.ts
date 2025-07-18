import { v4 as uuidv4 } from 'uuid';
import { objectStorage } from './object-storage';
import { log } from './vite';

export interface FileMetadata {
  id: string;
  originalName: string;
  fileName: string;
  filePath: string; // Object storage key
  publicPath: string; // Public URL
  mimeType: string;
  fileSize: number;
  userId: number;
  createdAt: Date;
}

export class FileStorageManager {
  constructor() {
    // No filesystem directories needed for object storage
  }

  private generateFileName(originalName: string): string {
    const uuid = uuidv4();
    const extension = this.getExtensionFromPath(originalName) || '.bin';
    return `${uuid}${extension}`;
  }

  private getExtensionFromPath(filename: string): string {
    const extension = filename.split('.').pop();
    return extension ? `.${extension.toLowerCase()}` : '';
  }

  /**
   * Save a file from buffer data to object storage
   */
  async saveFileFromBuffer(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    userId: number,
    type: 'financial-files' | 'uploaded-cims' | 'documents' = 'financial-files'
  ): Promise<FileMetadata> {
    const fileName = this.generateFileName(originalName);
    const storageKey = objectStorage.generateFileKey(userId.toString(), type, fileName);

    try {
      // Upload to object storage
      const publicUrl = await this.uploadFile(buffer, storageKey);

      return {
        id: uuidv4(),
        originalName,
        fileName,
        filePath: storageKey,
        publicPath: publicUrl,
        mimeType,
        fileSize: buffer.length,
        userId,
        createdAt: new Date()
      };
    } catch (error) {
      log(`❌ Failed to save file ${originalName}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Upload file to object storage
   */
  private async uploadFile(buffer: Buffer, key: string): Promise<string> {
    try {
      const client = objectStorage['client']; // Access the client directly
      const bucketName = objectStorage['bucketName'];
      
      const result = await client.uploadFromBytes(key, buffer, {
        compress: false
      });
      
      if (!result.ok) {
        throw new Error(`Upload failed: ${result.error.message}`);
      }
      
      // Generate public URL for Replit Object Storage
      const publicUrl = `https://storage.googleapis.com/${bucketName}/${key}`;
      log(`✅ File uploaded successfully: ${key}`);
      return publicUrl;
    } catch (error) {
      log(`❌ Failed to upload file ${key}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Download file from object storage
   */
  async downloadFile(storageKey: string): Promise<Buffer> {
    try {
      const client = objectStorage['client'];
      const result = await client.downloadAsBytes(storageKey);
      if (!result.ok) {
        throw new Error(`Download failed: ${result.error.message}`);
      }
      return result.value[0];
    } catch (error) {
      log(`❌ Failed to download file ${storageKey}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Delete file from object storage
   */
  async deleteFile(storageKey: string): Promise<void> {
    try {
      const client = objectStorage['client'];
      const result = await client.delete(storageKey);
      if (!result.ok) {
        throw new Error(`Delete failed: ${result.error.message}`);
      }
      log(`✅ File deleted successfully: ${storageKey}`);
    } catch (error) {
      log(`❌ Failed to delete file ${storageKey}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Check if file exists in object storage
   */
  async fileExists(storageKey: string): Promise<boolean> {
    try {
      const client = objectStorage['client'];
      const result = await client.exists(storageKey);
      return result.ok ? result.value : false;
    } catch (error) {
      return false;
    }
  }



  /**
   * Get public URL for file
   */
  getPublicUrl(storageKey: string): string {
    const bucketName = objectStorage['bucketName'];
    return `https://storage.googleapis.com/${bucketName}/${storageKey}`;
  }

  /**
   * Extract storage key from URL
   */
  extractStorageKey(url: string): string | null {
    const bucketName = objectStorage['bucketName'];
    const urlPattern = new RegExp(`https://storage\\.googleapis\\.com/${bucketName}/(.+)`);
    const match = url.match(urlPattern);
    return match ? match[1] : null;
  }

  /**
   * List all files for a user
   */
  async listUserFiles(userId: number, type?: 'financial-files' | 'uploaded-cims' | 'documents'): Promise<string[]> {
    const prefix = type ? `users/${userId}/${type}/` : `users/${userId}/`;
    try {
      const client = objectStorage['client'];
      const result = await client.list({ prefix });
      if (!result.ok) {
        throw new Error(`List failed: ${result.error.message}`);
      }
      return result.value.map(obj => obj.name);
    } catch (error) {
      log(`❌ Failed to list files with prefix ${prefix}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Migrate existing filesystem file to object storage
   */
  async migrateFromFilesystem(
    filesystemPath: string,
    userId: number,
    type: 'financial-files' | 'uploaded-cims' | 'documents',
    originalName: string,
    mimeType: string
  ): Promise<FileMetadata | null> {
    const fs = await import('fs');
    const path = await import('path');
    
    try {
      // Check if file exists
      const fullPath = path.resolve(filesystemPath);
      if (!fs.existsSync(fullPath)) {
        log(`Migration skipped - file not found: ${fullPath}`);
        return null;
      }

      // Read file
      const buffer = fs.readFileSync(fullPath);

      // Save to object storage
      const metadata = await this.saveFileFromBuffer(
        buffer,
        originalName,
        mimeType,
        userId,
        type
      );

      log(`✅ Migrated ${filesystemPath} to object storage: ${metadata.publicPath}`);
      return metadata;
    } catch (error) {
      log(`❌ Failed to migrate ${filesystemPath}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }
}

// Export singleton instance
export const fileStorageManager = new FileStorageManager();