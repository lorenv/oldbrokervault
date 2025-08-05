import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import { objectStorage } from './object-storage';
import { log } from './vite';

export interface ImageMetadata {
  id: string;
  originalName: string;
  fileName: string;
  filePath: string; // Object storage key
  publicPath: string; // Public URL
  mimeType: string;
  fileSize: number;
  width?: number;
  height?: number;
  userId: number;
  createdAt: Date;
}

export class ObjectStorageImageManager {
  constructor() {
    // No filesystem directories needed
  }

  private generateFileName(originalName: string, mimeType: string): string {
    const uuid = uuidv4();
    const extension = this.getExtensionFromMimeType(mimeType) || this.getExtensionFromPath(originalName) || '.jpg';
    return `${uuid}${extension}`;
  }

  private getExtensionFromMimeType(mimeType: string): string {
    const extensions: { [key: string]: string } = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/svg+xml': '.svg'
    };
    return extensions[mimeType] || '.jpg';
  }

  private getExtensionFromPath(filename: string): string {
    return filename.split('.').pop()?.toLowerCase() || '';
  }

  private getMimeTypeFromExtension(extension: string): string {
    const mimeTypes: { [key: string]: string } = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml'
    };
    return mimeTypes[extension.toLowerCase()] || 'image/jpeg';
  }

  /**
   * Save an image from buffer data to object storage
   */
  async saveImageFromBuffer(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    userId: number,
    type: 'logos' | 'business-images' | 'profile-photos' | 'custom-sections' = 'business-images',
    options: { optimize?: boolean; maxWidth?: number; maxHeight?: number } = {}
  ): Promise<ImageMetadata> {
    const { optimize = true, maxWidth = 1200, maxHeight = 800 } = options;
    
    const fileName = this.generateFileName(originalName, mimeType);
    const storageKey = objectStorage.generateImageKey(userId.toString(), type, fileName);

    let processedBuffer = buffer;
    let finalMimeType = mimeType;
    let width: number | undefined;
    let height: number | undefined;

    // Optimize image if requested
    if (optimize && !mimeType.includes('svg')) {
      try {
        const sharpInstance = sharp(buffer);
        const metadata = await sharpInstance.metadata();
        
        width = metadata.width;
        height = metadata.height;

        // Resize if needed
        if (width && height && (width > maxWidth || height > maxHeight)) {
          sharpInstance.resize(maxWidth, maxHeight, {
            fit: 'inside',
            withoutEnlargement: true
          });
        }

        // Convert to optimal format and compress
        if (mimeType === 'image/png') {
          processedBuffer = await sharpInstance.png({ quality: 90 }).toBuffer();
        } else {
          processedBuffer = await sharpInstance.jpeg({ quality: 85 }).toBuffer();
          finalMimeType = 'image/jpeg';
        }
      } catch (error) {
        log(`Warning: Image optimization failed for ${originalName}: ${error instanceof Error ? error.message : String(error)}`);
        processedBuffer = buffer;
      }
    }

    // Upload to object storage
    const publicUrl = await objectStorage.uploadImage(processedBuffer, storageKey);

    return {
      id: uuidv4(),
      originalName,
      fileName,
      filePath: storageKey,
      publicPath: publicUrl,
      mimeType: finalMimeType,
      fileSize: processedBuffer.length,
      width,
      height,
      userId,
      createdAt: new Date()
    };
  }

  /**
   * Save image from base64 string to object storage
   */
  async saveImageFromBase64(
    base64Data: string,
    originalName: string,
    userId: number,
    type: 'logos' | 'business-images' | 'profile-photos' | 'custom-sections' = 'business-images',
    options: { optimize?: boolean; maxWidth?: number; maxHeight?: number } = {}
  ): Promise<ImageMetadata> {
    // Extract mime type and data from base64 string
    const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      throw new Error('Invalid base64 data URL format');
    }

    const mimeType = matches[1];
    const base64Content = matches[2];
    const buffer = Buffer.from(base64Content, 'base64');

    return this.saveImageFromBuffer(buffer, originalName, mimeType, userId, type, options);
  }

  /**
   * Save business image/logo from buffer to object storage
   */
  async saveBusinessImage(
    buffer: Buffer,
    fileName: string,
    userId: string
  ): Promise<string> {
    const userIdNumber = parseInt(userId);
    if (isNaN(userIdNumber)) {
      throw new Error('Invalid user ID');
    }

    // Determine mime type from buffer or filename
    let mimeType = 'image/jpeg';
    if (fileName.toLowerCase().endsWith('.png')) {
      mimeType = 'image/png';
    } else if (fileName.toLowerCase().endsWith('.gif')) {
      mimeType = 'image/gif';
    } else if (fileName.toLowerCase().endsWith('.webp')) {
      mimeType = 'image/webp';
    }

    const imageMetadata = await this.saveImageFromBuffer(
      buffer,
      fileName,
      mimeType,
      userIdNumber,
      'logos',
      { optimize: true, maxWidth: 500, maxHeight: 500 }
    );

    return imageMetadata.publicPath;
  }

  /**
   * Get image buffer from object storage
   */
  async getImageBuffer(storageKey: string): Promise<Buffer> {
    return await objectStorage.downloadImage(storageKey);
  }

  /**
   * Get image metadata from object storage key
   */
  async getImageMetadata(storageKey: string): Promise<Partial<ImageMetadata>> {
    try {
      const buffer = await objectStorage.downloadImage(storageKey);
      const metadata = await sharp(buffer).metadata();
      
      return {
        width: metadata.width,
        height: metadata.height,
        fileSize: buffer.length,
        mimeType: `image/${metadata.format || 'jpeg'}`
      };
    } catch (error) {
      log(`Failed to get image metadata for ${storageKey}: ${error instanceof Error ? error.message : String(error)}`);
      return {};
    }
  }

  /**
   * Delete image from object storage
   */
  async deleteImage(storageKey: string): Promise<void> {
    await objectStorage.deleteImage(storageKey);
  }

  /**
   * Check if image exists in object storage
   */
  async imageExists(storageKey: string): Promise<boolean> {
    return await objectStorage.imageExists(storageKey);
  }

  /**
   * Get public URL for image
   */
  getPublicUrl(storageKey: string): string {
    return objectStorage.getPublicUrl(storageKey);
  }

  /**
   * Extract storage key from URL
   */
  extractStorageKey(url: string): string | null {
    return objectStorage.extractKeyFromUrl(url);
  }

  /**
   * Migrate existing filesystem image to object storage
   */
  async migrateFromFilesystem(
    filesystemPath: string,
    userId: number,
    type: 'logos' | 'business-images' | 'profile-photos' | 'custom-sections',
    originalName: string
  ): Promise<ImageMetadata | null> {
    const fs = await import('fs');
    const path = await import('path');
    
    try {
      // Check if file exists
      const fullPath = path.join(process.cwd(), 'public', filesystemPath);
      if (!fs.existsSync(fullPath)) {
        log(`Migration skipped - file not found: ${fullPath}`);
        return null;
      }

      // Read file
      const buffer = fs.readFileSync(fullPath);
      const extension = path.extname(originalName);
      const mimeType = this.getMimeTypeFromExtension(extension);

      // Save to object storage
      const metadata = await this.saveImageFromBuffer(
        buffer,
        originalName,
        mimeType,
        userId,
        type,
        { optimize: true }
      );

      log(`✅ Migrated ${filesystemPath} to object storage: ${metadata.publicPath}`);
      return metadata;
    } catch (error) {
      log(`❌ Failed to migrate ${filesystemPath}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Migrate from base64 backup to object storage
   */
  async migrateFromBase64(
    base64Data: string,
    userId: number,
    type: 'logos' | 'business-images' | 'profile-photos' | 'custom-sections',
    originalName: string
  ): Promise<ImageMetadata | null> {
    try {
      if (!base64Data || !base64Data.startsWith('data:')) {
        return null;
      }

      const metadata = await this.saveImageFromBase64(
        base64Data,
        originalName,
        userId,
        type,
        { optimize: true }
      );

      log(`✅ Migrated base64 data to object storage: ${metadata.publicPath}`);
      return metadata;
    } catch (error) {
      log(`❌ Failed to migrate base64 data: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * List all images for a user
   */
  async listUserImages(userId: number, type?: 'logos' | 'business-images' | 'profile-photos' | 'custom-sections'): Promise<string[]> {
    const prefix = type ? `users/${userId}/${type}/` : `users/${userId}/`;
    return await objectStorage.listImages(prefix);
  }
}

// Export singleton instance
export const objectStorageImageManager = new ObjectStorageImageManager();