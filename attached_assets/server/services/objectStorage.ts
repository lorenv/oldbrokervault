import { promises as fs } from 'fs';
import path from 'path';

export interface ObjectStorageConfig {
  bucketName: string;
  region?: string;
}

export interface UploadResult {
  url: string;
  key: string;
  size: number;
}

export class ObjectStorageService {
  private bucketName: string;
  private basePath: string;

  constructor(config: ObjectStorageConfig) {
    this.bucketName = config.bucketName;
    // For Replit, we'll use a local directory structure that mimics object storage
    // This can be easily swapped for actual cloud storage later
    this.basePath = path.join(process.cwd(), 'storage', this.bucketName);
  }

  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.basePath, { recursive: true });
      console.log(`[OBJECT_STORAGE] Initialized bucket: ${this.bucketName}`);
    } catch (error) {
      console.error('[OBJECT_STORAGE] Failed to initialize:', error);
      throw error;
    }
  }

  async upload(key: string, data: Buffer, contentType?: string): Promise<UploadResult> {
    try {
      const filePath = path.join(this.basePath, key);
      const directory = path.dirname(filePath);
      
      // Ensure directory exists
      await fs.mkdir(directory, { recursive: true });
      
      // Write file
      await fs.writeFile(filePath, data);
      
      const stats = await fs.stat(filePath);
      
      console.log(`[OBJECT_STORAGE] Uploaded ${key} (${stats.size} bytes)`);
      
      return {
        url: `/storage/${this.bucketName}/${key}`,
        key,
        size: stats.size
      };
    } catch (error) {
      console.error(`[OBJECT_STORAGE] Upload failed for ${key}:`, error);
      throw error;
    }
  }

  async download(key: string): Promise<Buffer> {
    try {
      const filePath = path.join(this.basePath, key);
      const data = await fs.readFile(filePath);
      console.log(`[OBJECT_STORAGE] Downloaded ${key} (${data.length} bytes)`);
      return data;
    } catch (error) {
      console.error(`[OBJECT_STORAGE] Download failed for ${key}:`, error);
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const filePath = path.join(this.basePath, key);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const filePath = path.join(this.basePath, key);
      await fs.unlink(filePath);
      console.log(`[OBJECT_STORAGE] Deleted ${key}`);
    } catch (error) {
      console.error(`[OBJECT_STORAGE] Delete failed for ${key}:`, error);
      throw error;
    }
  }

  async list(prefix: string): Promise<string[]> {
    try {
      const searchPath = path.join(this.basePath, prefix);
      const files = await this.listRecursive(searchPath);
      return files.map(file => path.relative(this.basePath, file));
    } catch (error) {
      console.error(`[OBJECT_STORAGE] List failed for prefix ${prefix}:`, error);
      return [];
    }
  }

  private async listRecursive(dirPath: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          const subFiles = await this.listRecursive(fullPath);
          files.push(...subFiles);
        } else {
          files.push(fullPath);
        }
      }
    } catch {
      // Directory doesn't exist, return empty array
    }
    
    return files;
  }

  getPublicUrl(key: string): string {
    return `/storage/${this.bucketName}/${key}`;
  }

  generateKey(type: 'document' | 'template' | 'image' | 'certificate', id: number, filename: string): string {
    const timestamp = Date.now();
    const extension = path.extname(filename);
    const baseName = path.basename(filename, extension);
    
    switch (type) {
      case 'document':
        return `documents/${id}/${baseName}-${timestamp}${extension}`;
      case 'template':
        return `templates/${id}/${baseName}-${timestamp}${extension}`;
      case 'image':
        return `images/${type}/${id}/${baseName}-${timestamp}${extension}`;
      case 'certificate':
        return `certificates/${id}/${baseName}-${timestamp}${extension}`;
      default:
        return `misc/${baseName}-${timestamp}${extension}`;
    }
  }
}

// Global instance
export const objectStorage = new ObjectStorageService({
  bucketName: 'undersigned-storage'
});