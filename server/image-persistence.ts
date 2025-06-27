import fs from 'fs';
import path from 'path';
import { storage } from './storage';
import { imageManager } from './image-manager';

/**
 * CRITICAL IMAGE PERSISTENCE SYSTEM
 * 
 * This system ensures user images survive deployments by:
 * 1. Creating database backups of all images during development
 * 2. Restoring missing images from database during production startup
 * 3. Using deployment-resilient storage paths
 */

interface ImageBackup {
  filePath: string;
  base64Data: string;
  mimeType: string;
}

export class ImagePersistenceManager {
  private baseDir: string;
  
  constructor() {
    this.baseDir = path.join(process.cwd(), 'public');
  }

  /**
   * Creates database backups for all existing images
   * Called during development to preserve images
   */
  async createImageBackups(): Promise<void> {
    console.log('🔄 CREATING IMAGE BACKUPS FOR DEPLOYMENT PERSISTENCE...');
    
    try {
      const documents = await storage.getAllCimDocuments();
      let backupCount = 0;
      
      for (const doc of documents) {
        // Backup cover image
        if (doc.coverImageUrl && !doc.coverImageUrl.startsWith('data:')) {
          const backupData = await this.createImageBackup(doc.coverImageUrl);
          if (backupData) {
            await storage.updateCimDocument(doc.id, {
              coverImageBackup: backupData
            });
            backupCount++;
            console.log(`✅ Backed up cover image for document ${doc.id}`);
          }
        }

        // Backup logo
        if (doc.logoUrl && !doc.logoUrl.startsWith('data:')) {
          const backupData = await this.createImageBackup(doc.logoUrl);
          if (backupData) {
            await storage.updateCimDocument(doc.id, {
              logoUrlBackup: backupData
            });
            backupCount++;
            console.log(`✅ Backed up logo for document ${doc.id}`);
          }
        }

        // Backup selected images
        if (doc.selectedImages && Array.isArray(doc.selectedImages)) {
          const imageBackups: string[] = [];
          for (const imagePath of doc.selectedImages) {
            if (!imagePath.startsWith('data:')) {
              const backupData = await this.createImageBackup(imagePath);
              if (backupData) {
                imageBackups.push(backupData);
                backupCount++;
              }
            }
          }
          
          if (imageBackups.length > 0) {
            await storage.updateCimDocument(doc.id, {
              selectedImagesBackup: imageBackups
            });
            console.log(`✅ Backed up ${imageBackups.length} selected images for document ${doc.id}`);
          }
        }
      }
      
      console.log(`🎉 BACKUP COMPLETE: Created ${backupCount} image backups`);
    } catch (error) {
      console.error('❌ Error creating image backups:', error);
    }
  }

  /**
   * Restores missing images from database backups
   * Called during production startup to recover lost images
   */
  async restoreMissingImages(): Promise<void> {
    console.log('🔄 RESTORING MISSING IMAGES FROM DATABASE BACKUPS...');
    
    try {
      const documents = await storage.getAllCimDocuments();
      let restoredCount = 0;
      
      for (const doc of documents) {
        // Restore cover image
        if (doc.coverImageUrl && !doc.coverImageUrl.startsWith('data:')) {
          if (!this.fileExists(doc.coverImageUrl) && (doc as any).coverImageBackup) {
            const restored = await this.restoreImageFromBackup(
              doc.coverImageUrl, 
              (doc as any).coverImageBackup,
              doc.userId
            );
            if (restored) {
              restoredCount++;
              console.log(`✅ Restored cover image for document ${doc.id}`);
            }
          }
        }

        // Restore logo
        if (doc.logoUrl && !doc.logoUrl.startsWith('data:')) {
          if (!this.fileExists(doc.logoUrl) && (doc as any).logoUrlBackup) {
            const restored = await this.restoreImageFromBackup(
              doc.logoUrl, 
              (doc as any).logoUrlBackup,
              doc.userId
            );
            if (restored) {
              restoredCount++;
              console.log(`✅ Restored logo for document ${doc.id}`);
            }
          }
        }

        // Restore selected images
        if (doc.selectedImages && Array.isArray(doc.selectedImages) && (doc as any).selectedImagesBackup) {
          const backups = (doc as any).selectedImagesBackup;
          for (let i = 0; i < doc.selectedImages.length; i++) {
            const imagePath = doc.selectedImages[i];
            if (!imagePath.startsWith('data:') && !this.fileExists(imagePath) && backups[i]) {
              const restored = await this.restoreImageFromBackup(
                imagePath, 
                backups[i],
                doc.userId
              );
              if (restored) {
                restoredCount++;
                console.log(`✅ Restored selected image ${i + 1} for document ${doc.id}`);
              }
            }
          }
        }
      }
      
      console.log(`🎉 RESTORATION COMPLETE: Restored ${restoredCount} missing images`);
    } catch (error) {
      console.error('❌ Error restoring images:', error);
    }
  }

  /**
   * Creates a base64 backup of an image file
   */
  private async createImageBackup(imagePath: string): Promise<string | null> {
    try {
      const fullPath = this.resolveImagePath(imagePath);
      if (!fullPath || !fs.existsSync(fullPath)) {
        return null;
      }

      const buffer = fs.readFileSync(fullPath);
      const mimeType = this.getMimeTypeFromPath(fullPath);
      return `data:${mimeType};base64,${buffer.toString('base64')}`;
    } catch (error) {
      console.error(`Error creating backup for ${imagePath}:`, error);
      return null;
    }
  }

  /**
   * Restores an image from base64 backup data
   */
  private async restoreImageFromBackup(
    originalPath: string, 
    backupData: string, 
    userId: number
  ): Promise<boolean> {
    try {
      if (!backupData.startsWith('data:')) {
        return false;
      }

      const [, base64Data] = backupData.split(',');
      const buffer = Buffer.from(base64Data, 'base64');
      
      // Use image manager to save the restored image
      const filename = path.basename(originalPath);
      const imageType = this.getImageTypeFromPath(originalPath);
      
      await imageManager.saveImageFromBuffer(
        buffer,
        filename,
        'image/jpeg', // Default mime type
        userId,
        imageType
      );
      
      return true;
    } catch (error) {
      console.error(`Error restoring image ${originalPath}:`, error);
      return false;
    }
  }

  /**
   * Checks if a file exists at the given path
   */
  private fileExists(imagePath: string): boolean {
    const fullPath = this.resolveImagePath(imagePath);
    return fullPath ? fs.existsSync(fullPath) : false;
  }

  /**
   * Resolves various image path formats to absolute paths
   */
  private resolveImagePath(imagePath: string): string | null {
    const possiblePaths = [
      path.join(this.baseDir, imagePath.replace(/^\/+/, '')),
      path.join(this.baseDir, 'user-images', imagePath.replace(/^\/+/, '')),
      path.join(this.baseDir, 'images', path.basename(imagePath)),
      path.join(this.baseDir, 'logos', path.basename(imagePath)),
      path.join(this.baseDir, 'business-images', path.basename(imagePath)),
      path.join(this.baseDir, 'uploads', path.basename(imagePath))
    ];

    for (const testPath of possiblePaths) {
      if (fs.existsSync(testPath)) {
        return testPath;
      }
    }
    
    return null;
  }

  /**
   * Determines image type from file path
   */
  private getImageTypeFromPath(imagePath: string): 'logos' | 'business-images' | 'profile-photos' | 'custom-sections' {
    if (imagePath.includes('logo')) return 'logos';
    if (imagePath.includes('profile')) return 'profile-photos';
    if (imagePath.includes('custom')) return 'custom-sections';
    return 'business-images';
  }

  /**
   * Gets MIME type from file path
   */
  private getMimeTypeFromPath(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.png':
        return 'image/png';
      case '.gif':
        return 'image/gif';
      case '.webp':
        return 'image/webp';
      default:
        return 'image/jpeg';
    }
  }
}

export const imagePersistenceManager = new ImagePersistenceManager();