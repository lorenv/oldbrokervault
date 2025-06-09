import { promises as fs } from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';

// Function to add rounded corners to images
async function addRoundedCorners(imageBuffer: Buffer, radius: number = 12): Promise<Buffer> {
  try {
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    
    if (!metadata.width || !metadata.height) {
      throw new Error('Could not determine image dimensions');
    }

    // Create rounded rectangle mask
    const roundedCorners = Buffer.from(
      `<svg width="${metadata.width}" height="${metadata.height}">
        <rect x="0" y="0" width="${metadata.width}" height="${metadata.height}" rx="${radius}" ry="${radius}" fill="white"/>
      </svg>`
    );

    // Apply the mask to create rounded corners
    const processedImage = await sharp(imageBuffer)
      .png() // Convert to PNG to support transparency for rounded corners
      .composite([
        {
          input: roundedCorners,
          blend: 'dest-in'
        }
      ])
      .toBuffer();

    return processedImage;
  } catch (error) {
    console.error('Error adding rounded corners:', error);
    return imageBuffer; // Return original if processing fails
  }
}

export interface ImageMetadata {
  id: string;
  originalName: string;
  fileName: string;
  localPath: string;
  publicPath: string;
  originalUrl?: string;
  source: 'website' | 'upload';
  dimensions: { width: number; height: number };
  fileSize: number;
  mimeType: string;
  uploadDate: Date;
}

export class ImageManager {
  private baseDir = 'public/business-images';

  constructor() {
    this.ensureDirectories();
  }

  private async ensureDirectories() {
    try {
      await fs.mkdir(this.baseDir, { recursive: true });
    } catch (error) {
      console.error('Error creating image directories:', error);
    }
  }

  private getCimImageDir(cimId: number): string {
    return path.join(this.baseDir, cimId.toString());
  }

  private getPublicPath(cimId: number, fileName: string): string {
    return `/business-images/${cimId}/${fileName}`;
  }

  async downloadImageFromUrl(url: string, cimId: number, originalName?: string): Promise<ImageMetadata> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const imageId = uuidv4();
      const fileName = `${imageId}.png`; // PNG to support rounded corners with transparency
      
      return await this.saveImageBuffer(buffer, cimId, fileName, {
        originalName: originalName || path.basename(url),
        originalUrl: url,
        source: 'website'
      });
    } catch (error) {
      console.error('Error downloading image:', error);
      throw error;
    }
  }

  async saveUploadedImage(buffer: Buffer, cimId: number, originalName: string): Promise<ImageMetadata> {
    const imageId = uuidv4();
    const fileName = `${imageId}.png`; // PNG to support rounded corners with transparency
    
    return await this.saveImageBuffer(buffer, cimId, fileName, {
      originalName,
      source: 'upload'
    });
  }

  private async saveImageBuffer(
    buffer: Buffer, 
    cimId: number, 
    fileName: string, 
    metadata: Partial<ImageMetadata>
  ): Promise<ImageMetadata> {
    const cimDir = this.getCimImageDir(cimId);
    await fs.mkdir(cimDir, { recursive: true });

    // Process image with Sharp - optimize and get metadata
    const image = sharp(buffer);
    const sharpMetadata = await image.metadata();
    
    // Optimize image: resize if too large, compress
    let optimizedBuffer = await image
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    
    // Apply rounded corners consistently to all business images
    optimizedBuffer = await addRoundedCorners(optimizedBuffer, 30);

    const localPath = path.join(cimDir, fileName);
    await fs.writeFile(localPath, optimizedBuffer);

    const imageMetadata: ImageMetadata = {
      id: uuidv4(),
      originalName: metadata.originalName || fileName,
      fileName,
      localPath,
      publicPath: this.getPublicPath(cimId, fileName),
      originalUrl: metadata.originalUrl,
      source: metadata.source || 'upload',
      dimensions: {
        width: sharpMetadata.width || 0,
        height: sharpMetadata.height || 0
      },
      fileSize: optimizedBuffer.length,
      mimeType: 'image/png', // PNG to support transparency from rounded corners
      uploadDate: new Date()
    };

    return imageMetadata;
  }

  async deleteImage(cimId: number, fileName: string): Promise<void> {
    try {
      const filePath = path.join(this.getCimImageDir(cimId), fileName);
      await fs.unlink(filePath);
    } catch (error) {
      console.error('Error deleting image:', error);
    }
  }

  async deleteCimImages(cimId: number): Promise<void> {
    try {
      const cimDir = this.getCimImageDir(cimId);
      await fs.rmdir(cimDir, { recursive: true });
    } catch (error) {
      console.error('Error deleting CIM images:', error);
    }
  }

  async getCimImages(cimId: number): Promise<string[]> {
    try {
      const cimDir = this.getCimImageDir(cimId);
      const files = await fs.readdir(cimDir);
      return files.filter(file => /\.(jpg|jpeg|png)$/i.test(file))
        .map(file => this.getPublicPath(cimId, file));
    } catch (error) {
      return [];
    }
  }
}

export const imageManager = new ImageManager();