import { Client } from '@replit/object-storage';
import { log } from './vite';

class ObjectStorageService {
  private client: Client;
  private bucketName: string;

  constructor() {
    this.client = new Client();
    this.bucketName = 'Bucket1';
  }

  /**
   * Upload image to object storage
   * @param buffer - Image buffer
   * @param key - Storage key (path)
   * @returns Public URL of uploaded image
   */
  async uploadImage(buffer: Buffer, key: string): Promise<string> {
    try {
      const result = await this.client.uploadFromBytes(key, buffer, {
        compress: false // Don't compress images as they're already optimized
      });
      
      if (!result.ok) {
        throw new Error(`Upload failed: ${result.error.message}`);
      }
      
      // Generate public URL for Replit Object Storage
      const publicUrl = `https://storage.googleapis.com/${this.bucketName}/${key}`;
      log(`✅ Image uploaded successfully: ${key}`);
      return publicUrl;
    } catch (error) {
      log(`❌ Failed to upload image ${key}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Download image from object storage
   * @param key - Storage key (path)
   * @returns Image buffer
   */
  async downloadImage(key: string): Promise<Buffer> {
    try {
      const result = await this.client.downloadAsBytes(key);
      if (!result.ok) {
        throw new Error(`Download failed: ${result.error.message}`);
      }
      return result.value[0];
    } catch (error) {
      log(`❌ Failed to download image ${key}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Delete image from object storage
   * @param key - Storage key (path)
   */
  async deleteImage(key: string): Promise<void> {
    try {
      const result = await this.client.delete(key);
      if (!result.ok) {
        throw new Error(`Delete failed: ${result.error.message}`);
      }
      log(`✅ Image deleted successfully: ${key}`);
    } catch (error) {
      log(`❌ Failed to delete image ${key}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Check if image exists in object storage
   * @param key - Storage key (path)
   * @returns Boolean indicating existence
   */
  async imageExists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result.ok ? result.value : false;
    } catch (error) {
      return false;
    }
  }

  /**
   * List all objects with given prefix
   * @param prefix - Key prefix to filter objects
   * @returns Array of object keys
   */
  async listImages(prefix: string = ''): Promise<string[]> {
    try {
      const result = await this.client.list({ prefix });
      if (!result.ok) {
        throw new Error(`List failed: ${result.error.message}`);
      }
      return result.value.map(obj => obj.name);
    } catch (error) {
      log(`❌ Failed to list images with prefix ${prefix}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Generate storage key for user image
   * @param userId - User ID
   * @param category - Image category (logos, business-images, profile-photos)
   * @param filename - Original filename
   * @returns Storage key
   */
  generateImageKey(userId: string, category: 'logos' | 'business-images' | 'profile-photos', filename: string): string {
    return `users/${userId}/${category}/${filename}`;
  }

  /**
   * Generate storage key for user file
   * @param userId - User ID
   * @param category - File category (financial-files, uploaded-cims, documents)
   * @param filename - Original filename
   * @returns Storage key
   */
  generateFileKey(userId: string, category: 'financial-files' | 'uploaded-cims' | 'documents', filename: string): string {
    return `users/${userId}/${category}/${filename}`;
  }

  /**
   * Generate public URL for image
   * @param key - Storage key
   * @returns Public URL
   */
  getPublicUrl(key: string): string {
    return `https://storage.googleapis.com/${this.bucketName}/${key}`;
  }

  /**
   * Extract storage key from public URL
   * @param url - Public URL
   * @returns Storage key or null if not a valid object storage URL
   */
  extractKeyFromUrl(url: string): string | null {
    const urlPattern = new RegExp(`https://storage\\.googleapis\\.com/${this.bucketName}/(.+)`);
    const match = url.match(urlPattern);
    return match ? match[1] : null;
  }

  /**
   * Get content type based on file extension
   * @param filename - Filename with extension
   * @returns MIME type
   */
  private getContentType(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop();
    switch (ext) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'gif':
        return 'image/gif';
      case 'webp':
        return 'image/webp';
      case 'svg':
        return 'image/svg+xml';
      default:
        return 'application/octet-stream';
    }
  }
}

// Export singleton instance
export const objectStorage = new ObjectStorageService();