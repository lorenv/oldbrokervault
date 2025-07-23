import { imageManager } from './image-manager';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

/**
 * Helper functions for handling images in both base64 and file-based formats
 * during the migration period
 */

export interface ImageData {
  buffer: Buffer;
  mimeType: string;
  isBase64: boolean;
  originalPath: string;
}

/**
 * Resolve an image path/URL to actual image data
 * Handles base64, file paths, and full URLs (including object storage URLs)
 */
export async function resolveImageData(imagePath: string): Promise<ImageData | null> {
  try {
    console.log(`[resolveImageData] Processing: ${imagePath.substring(0, 100)}...`);
    
    // Check if it's base64 data
    if (imagePath.startsWith('data:')) {
      console.log(`[resolveImageData] Processing base64 data`);
      const matches = imagePath.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) {
        throw new Error('Invalid base64 data format');
      }
      
      const mimeType = matches[1];
      const base64Content = matches[2];
      const buffer = Buffer.from(base64Content, 'base64');
      
      return {
        buffer,
        mimeType,
        isBase64: true,
        originalPath: imagePath
      };
    }
    
    // Check if it's a full URL (http or https)
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      console.log(`[resolveImageData] Processing full URL: ${imagePath}`);
      try {
        const response = await fetch(imagePath, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        if (!response.ok) {
          console.error(`[resolveImageData] Failed to fetch URL: ${response.status} ${response.statusText}`);
          return null;
        }
        
        const buffer = Buffer.from(await response.arrayBuffer());
        
        // Determine MIME type from response headers or URL extension
        let mimeType = response.headers.get('content-type') || 'image/jpeg';
        if (!mimeType.startsWith('image/')) {
          // Fallback to determining from URL extension
          const extension = path.extname(new URL(imagePath).pathname).toLowerCase();
          const mimeTypes: { [key: string]: string } = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.svg': 'image/svg+xml'
          };
          mimeType = mimeTypes[extension] || 'image/jpeg';
        }
        
        console.log(`[resolveImageData] Successfully downloaded URL, buffer size: ${buffer.length}, mimeType: ${mimeType}`);
        return {
          buffer,
          mimeType,
          isBase64: false,
          originalPath: imagePath
        };
      } catch (fetchError) {
        console.error(`[resolveImageData] Failed to download URL: ${imagePath}`, fetchError);
        return null;
      }
    }
    
    // Check if it's a file path
    let fullPath: string;
    
    if (imagePath.startsWith('/user-images/')) {
      // New file-based storage path
      fullPath = path.join(process.cwd(), 'public', imagePath.replace(/^\//, ''));
    } else if (imagePath.startsWith('/')) {
      // Legacy file path
      fullPath = path.join(process.cwd(), 'public', imagePath.replace(/^\//, ''));
    } else {
      // Relative path
      fullPath = path.join(process.cwd(), 'public', imagePath);
    }
    
    console.log(`[resolveImageData] Checking file path: ${fullPath}`);
    
    if (!fs.existsSync(fullPath)) {
      console.warn(`[resolveImageData] Image file not found: ${fullPath}`);
      return null;
    }
    
    const buffer = fs.readFileSync(fullPath);
    const extension = path.extname(fullPath).toLowerCase();
    
    // Determine MIME type from extension
    const mimeTypes: { [key: string]: string } = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml'
    };
    
    const mimeType = mimeTypes[extension] || 'image/jpeg';
    
    console.log(`[resolveImageData] Successfully loaded file, buffer size: ${buffer.length}, mimeType: ${mimeType}`);
    return {
      buffer,
      mimeType,
      isBase64: false,
      originalPath: imagePath
    };
    
  } catch (error) {
    console.error(`[resolveImageData] Failed to resolve image data for: ${imagePath}`, error);
    return null;
  }
}

/**
 * Get image dimensions from buffer
 */
export async function getImageDimensions(buffer: Buffer): Promise<{ width: number; height: number } | null> {
  try {
    const sharp = require('sharp');
    const metadata = await sharp(buffer).metadata();
    return {
      width: metadata.width || 0,
      height: metadata.height || 0
    };
  } catch (error) {
    console.error('Failed to get image dimensions:', error);
    return null;
  }
}

/**
 * Create a fallback for missing images
 */
export function createImageFallback(): ImageData {
  // Create a simple 1x1 transparent PNG
  const buffer = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
    0x0D, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
    0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
  ]);
  
  return {
    buffer,
    mimeType: 'image/png',
    isBase64: false,
    originalPath: 'fallback'
  };
}

/**
 * Convert image to specific format if needed
 */
export async function convertImageFormat(
  buffer: Buffer,
  targetFormat: 'jpeg' | 'png' | 'webp',
  quality: number = 85
): Promise<Buffer> {
  try {
    const sharp = require('sharp');
    let image = sharp(buffer);
    
    switch (targetFormat) {
      case 'jpeg':
        return await image.jpeg({ quality }).toBuffer();
      case 'png':
        return await image.png({ quality }).toBuffer();
      case 'webp':
        return await image.webp({ quality }).toBuffer();
      default:
        return buffer;
    }
  } catch (error) {
    console.error('Failed to convert image format:', error);
    return buffer;
  }
}