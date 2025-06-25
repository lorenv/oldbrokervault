import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import { storage } from './storage';

export interface DatabaseImageMetadata {
  id: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  width?: number;
  height?: number;
  userId: number;
  imageData: string; // base64 encoded image data
  createdAt: Date;
}

export class DatabaseImageManager {
  
  async saveImage(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    userId: number,
    type: 'logos' | 'business-images' | 'profile-photos' | 'custom-sections'
  ): Promise<DatabaseImageMetadata> {
    // Optimize image using sharp
    const optimizedBuffer = await this.optimizeImage(buffer, mimeType);
    
    // Get image dimensions
    const metadata = await sharp(optimizedBuffer).metadata();
    
    // Convert to base64
    const base64Data = optimizedBuffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64Data}`;
    
    const imageMetadata: DatabaseImageMetadata = {
      id: uuidv4(),
      originalName,
      mimeType,
      fileSize: optimizedBuffer.length,
      width: metadata.width,
      height: metadata.height,
      userId,
      imageData: dataUrl,
      createdAt: new Date()
    };
    
    return imageMetadata;
  }

  async optimizeImage(buffer: Buffer, mimeType: string): Promise<Buffer> {
    const isJpeg = mimeType === 'image/jpeg' || mimeType === 'image/jpg';
    const isPng = mimeType === 'image/png';
    const isWebp = mimeType === 'image/webp';
    
    let sharpInstance = sharp(buffer);
    
    // Resize if too large (max 1200px width/height)
    const metadata = await sharpInstance.metadata();
    if (metadata.width && metadata.width > 1200) {
      sharpInstance = sharpInstance.resize(1200, null, {
        withoutEnlargement: true,
        fit: 'inside'
      });
    }
    if (metadata.height && metadata.height > 1200) {
      sharpInstance = sharpInstance.resize(null, 1200, {
        withoutEnlargement: true,
        fit: 'inside'
      });
    }
    
    // Optimize based on format
    if (isJpeg) {
      return await sharpInstance.jpeg({ quality: 85, progressive: true }).toBuffer();
    } else if (isPng) {
      return await sharpInstance.png({ compressionLevel: 9, progressive: true }).toBuffer();
    } else if (isWebp) {
      return await sharpInstance.webp({ quality: 85 }).toBuffer();
    } else {
      // Convert other formats to JPEG
      return await sharpInstance.jpeg({ quality: 85, progressive: true }).toBuffer();
    }
  }

  async createThumbnail(buffer: Buffer, mimeType: string, size: number = 200): Promise<string> {
    const thumbnailBuffer = await sharp(buffer)
      .resize(size, size, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 80 })
      .toBuffer();
    
    return `data:image/jpeg;base64,${thumbnailBuffer.toString('base64')}`;
  }

  validateImage(buffer: Buffer, mimeType: string, maxSizeBytes: number = 10 * 1024 * 1024): void {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    
    if (!allowedTypes.includes(mimeType)) {
      throw new Error(`Unsupported image type: ${mimeType}`);
    }
    
    if (buffer.length > maxSizeBytes) {
      throw new Error(`Image too large: ${buffer.length} bytes (max: ${maxSizeBytes})`);
    }
  }

  async processBusinessImage(buffer: Buffer, originalName: string, mimeType: string, userId: number): Promise<string> {
    this.validateImage(buffer, mimeType);
    const imageMetadata = await this.saveImage(buffer, originalName, mimeType, userId, 'business-images');
    return imageMetadata.imageData;
  }

  async processLogo(buffer: Buffer, originalName: string, mimeType: string, userId: number): Promise<string> {
    this.validateImage(buffer, mimeType, 5 * 1024 * 1024); // 5MB limit for logos
    const imageMetadata = await this.saveImage(buffer, originalName, mimeType, userId, 'logos');
    return imageMetadata.imageData;
  }

  async processProfilePhoto(buffer: Buffer, originalName: string, mimeType: string, userId: number): Promise<string> {
    this.validateImage(buffer, mimeType, 5 * 1024 * 1024); // 5MB limit for profile photos
    const imageMetadata = await this.saveImage(buffer, originalName, mimeType, userId, 'profile-photos');
    return imageMetadata.imageData;
  }

  async processCoverImage(buffer: Buffer, originalName: string, mimeType: string, userId: number): Promise<string> {
    this.validateImage(buffer, mimeType, 15 * 1024 * 1024); // 15MB limit for cover images
    const imageMetadata = await this.saveImage(buffer, originalName, mimeType, userId, 'business-images');
    return imageMetadata.imageData;
  }
}

export const databaseImageManager = new DatabaseImageManager();