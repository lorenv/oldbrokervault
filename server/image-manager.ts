import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';

export interface ImageMetadata {
  id: string;
  originalName: string;
  fileName: string;
  filePath: string;
  publicPath: string;
  mimeType: string;
  fileSize: number;
  width?: number;
  height?: number;
  userId: number;
  createdAt: Date;
}

export class ImageManager {
  private baseDir: string;
  
  constructor() {
    this.baseDir = path.join(process.cwd(), 'public', 'user-images');
    this.ensureDirectoryExists(this.baseDir);
  }

  private ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  private getUserImageDir(userId: number): string {
    const userDir = path.join(this.baseDir, userId.toString());
    this.ensureDirectoryExists(userDir);
    return userDir;
  }

  private getImageTypeDir(userId: number, type: 'logos' | 'business-images' | 'profile-photos' | 'custom-sections'): string {
    const typeDir = path.join(this.getUserImageDir(userId), type);
    this.ensureDirectoryExists(typeDir);
    return typeDir;
  }

  private generateFileName(originalName: string, mimeType: string): string {
    const uuid = uuidv4();
    const extension = this.getExtensionFromMimeType(mimeType) || path.extname(originalName) || '.jpg';
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
   * Save an image from buffer data
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
    const typeDir = this.getImageTypeDir(userId, type);
    const filePath = path.join(typeDir, fileName);
    const publicPath = `/user-images/${userId}/${type}/${fileName}`;

    let processedBuffer = buffer;
    let finalMimeType = mimeType;
    let width: number | undefined;
    let height: number | undefined;

    // Optimize image if requested
    if (optimize && !mimeType.includes('svg')) {
      try {
        const image = sharp(buffer);
        const metadata = await image.metadata();
        
        width = metadata.width;
        height = metadata.height;
        
        // Check if image has transparency
        const hasAlpha = metadata.channels === 4 || metadata.hasAlpha;
        
        if (hasAlpha || mimeType === 'image/png') {
          // Preserve transparency for PNG images
          processedBuffer = await image
            .resize(maxWidth, maxHeight, { 
              fit: 'inside', 
              withoutEnlargement: true,
              background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .png({ quality: 85, force: true })
            .toBuffer();
          finalMimeType = 'image/png';
        } else {
          // Convert to JPEG for photos without transparency
          processedBuffer = await image
            .resize(maxWidth, maxHeight, { 
              fit: 'inside', 
              withoutEnlargement: true,
              background: { r: 255, g: 255, b: 255, alpha: 1 }
            })
            .jpeg({ quality: 85 })
            .toBuffer();
          finalMimeType = 'image/jpeg';
        }
        
        // Update metadata after processing
        const processedMetadata = await sharp(processedBuffer).metadata();
        width = processedMetadata.width;
        height = processedMetadata.height;
      } catch (error) {
        console.warn('Image optimization failed, using original:', error);
        processedBuffer = buffer;
      }
    }

    // Write file to disk
    fs.writeFileSync(filePath, processedBuffer);

    return {
      id: path.parse(fileName).name,
      originalName,
      fileName,
      filePath,
      publicPath,
      mimeType: finalMimeType,
      fileSize: processedBuffer.length,
      width,
      height,
      userId,
      createdAt: new Date()
    };
  }

  /**
   * Save an image from base64 data
   */
  async saveImageFromBase64(
    base64Data: string,
    originalName: string,
    userId: number,
    type: 'logos' | 'business-images' | 'profile-photos' | 'custom-sections' = 'business-images',
    options: { optimize?: boolean; maxWidth?: number; maxHeight?: number } = {}
  ): Promise<ImageMetadata> {
    // Extract MIME type and data from base64 string
    const matches = base64Data.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      throw new Error('Invalid base64 data format');
    }
    
    const mimeType = matches[1];
    const base64Content = matches[2];
    const buffer = Buffer.from(base64Content, 'base64');
    
    return this.saveImageFromBuffer(buffer, originalName, mimeType, userId, type, options);
  }

  /**
   * Save an image from URL
   */
  async saveImageFromUrl(
    imageUrl: string,
    userId: number,
    type: 'logos' | 'business-images' | 'profile-photos' | 'custom-sections' = 'business-images',
    options: { optimize?: boolean; maxWidth?: number; maxHeight?: number } = {}
  ): Promise<ImageMetadata> {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image from URL: ${response.statusText}`);
    }
    
    const buffer = Buffer.from(await response.arrayBuffer());
    const mimeType = response.headers.get('content-type') || 'image/jpeg';
    const originalName = path.basename(new URL(imageUrl).pathname) || 'downloaded-image';
    
    return this.saveImageFromBuffer(buffer, originalName, mimeType, userId, type, options);
  }

  /**
   * Get image metadata from file path
   */
  getImageMetadata(publicPath: string): ImageMetadata | null {
    try {
      const fullPath = path.join(process.cwd(), 'public', publicPath.replace(/^\//, ''));
      
      if (!fs.existsSync(fullPath)) {
        return null;
      }
      
      const stats = fs.statSync(fullPath);
      const fileName = path.basename(fullPath);
      const extension = path.extname(fileName);
      const id = path.parse(fileName).name;
      
      // Extract userId from path structure
      const pathParts = publicPath.split('/');
      const userId = parseInt(pathParts[2]) || 0;
      
      return {
        id,
        originalName: fileName,
        fileName,
        filePath: fullPath,
        publicPath,
        mimeType: this.getMimeTypeFromExtension(extension),
        fileSize: stats.size,
        userId,
        createdAt: stats.birthtime
      };
    } catch (error) {
      console.error('Failed to get image metadata:', error);
      return null;
    }
  }

  /**
   * Delete an image file
   */
  deleteImage(publicPath: string): boolean {
    try {
      const fullPath = path.join(process.cwd(), 'public', publicPath.replace(/^\//, ''));
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to delete image:', error);
      return false;
    }
  }

  /**
   * Check if an image exists
   */
  imageExists(publicPath: string): boolean {
    const fullPath = path.join(process.cwd(), 'public', publicPath.replace(/^\//, ''));
    return fs.existsSync(fullPath);
  }

  /**
   * Get the full file system path from public path
   */
  getFullPath(publicPath: string): string {
    return path.join(process.cwd(), 'public', publicPath.replace(/^\//, ''));
  }

  /**
   * Migrate base64 image to file system
   */
  async migrateBase64ToFile(
    base64Data: string,
    userId: number,
    type: 'logos' | 'business-images' | 'profile-photos' | 'custom-sections' = 'business-images',
    originalName: string = 'migrated-image'
  ): Promise<ImageMetadata> {
    console.log(`Migrating base64 image for user ${userId}, type: ${type}`);
    return this.saveImageFromBase64(base64Data, originalName, userId, type, { optimize: true });
  }
}

// Export singleton instance
export const imageManager = new ImageManager();