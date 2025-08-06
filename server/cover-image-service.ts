import { v4 as uuidv4 } from 'uuid';
import { objectStorage } from './object-storage';
import { log } from './vite';

interface DownloadedImageResult {
  publicUrl: string;
  storageKey: string;
  originalUrl: string;
}

export class CoverImageService {
  /**
   * Download an image from Unsplash (or any external URL) and store it in object storage
   * @param imageUrl - The external image URL (e.g., Unsplash)
   * @param userId - User ID for folder organization
   * @returns Object with public URL and storage key
   */
  async downloadAndStoreImage(imageUrl: string, userId: number): Promise<DownloadedImageResult> {
    try {
      log(`📥 Downloading cover image from: ${imageUrl}`);
      
      // Download the image from the external URL
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
      }

      // Get the image buffer
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Determine file extension from URL or content type
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      const extension = this.getExtensionFromContentType(contentType);
      
      // Generate unique filename
      const fileName = `${uuidv4()}${extension}`;
      
      // Create storage key using existing pattern: users/{userId}/cover-images/{fileName}
      const storageKey = objectStorage.generateFileKey(userId.toString(), 'cover-images', fileName);

      // Upload to object storage
      const publicUrl = await objectStorage.uploadImage(buffer, storageKey);

      log(`✅ Cover image stored successfully: ${storageKey}`);

      return {
        publicUrl,
        storageKey,
        originalUrl: imageUrl
      };

    } catch (error) {
      log(`❌ Failed to download and store cover image: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Get file extension from content type
   */
  private getExtensionFromContentType(contentType: string): string {
    const contentTypeMap: { [key: string]: string } = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg', 
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/svg+xml': '.svg'
    };

    return contentTypeMap[contentType.toLowerCase()] || '.jpg';
  }

  /**
   * Check if a URL is an external image URL (not already stored in our object storage)
   */
  isExternalImageUrl(url: string): boolean {
    if (!url) return false;
    
    // Check if it's already our object storage URL
    if (url.startsWith('/api/object-storage/')) return false;
    
    // Check if it's a data URL
    if (url.startsWith('data:')) return false;
    
    // Check if it's an external URL (http/https)
    return url.startsWith('http://') || url.startsWith('https://');
  }

  /**
   * Migrate existing external cover images to object storage
   * This can be called to update existing CIMs that have external URLs
   */
  async migrateExternalCoverImage(currentUrl: string, userId: number): Promise<string | null> {
    if (!this.isExternalImageUrl(currentUrl)) {
      return null; // Already stored locally or not a valid external URL
    }

    try {
      const result = await this.downloadAndStoreImage(currentUrl, userId);
      log(`🔄 Migrated external cover image: ${currentUrl} -> ${result.publicUrl}`);
      return result.publicUrl;
    } catch (error) {
      log(`❌ Failed to migrate cover image ${currentUrl}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }
}

// Export singleton instance
export const coverImageService = new CoverImageService();