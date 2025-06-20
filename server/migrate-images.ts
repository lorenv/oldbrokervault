import fs from 'fs';
import path from 'path';
import { storage } from './storage';
import { imageManager } from './image-manager';

/**
 * Enhanced migration script to convert base64 images to file-based storage
 * This optimizes storage and performance by using the file system instead of database
 */

interface MigrationStats {
  totalProcessed: number;
  successfulMigrations: number;
  failedMigrations: number;
  skipped: number;
}

async function migrateBase64ImageToFile(
  base64Data: string,
  userId: number,
  type: 'logos' | 'business-images' | 'profile-photos' | 'custom-sections',
  originalName: string = 'migrated-image'
): Promise<string | null> {
  try {
    // Skip if not base64 data
    if (!base64Data.startsWith('data:')) {
      console.log(`Skipping non-base64 data: ${base64Data.substring(0, 50)}...`);
      return base64Data; // Return as-is (likely already a file path)
    }

    console.log(`Migrating base64 ${type} for user ${userId}...`);
    const metadata = await imageManager.migrateBase64ToFile(base64Data, userId, type, originalName);
    console.log(`✓ Successfully migrated to: ${metadata.publicPath}`);
    return metadata.publicPath;
  } catch (error) {
    console.error(`✗ Failed to migrate base64 ${type} for user ${userId}:`, error);
    return null;
  }
}

export async function migrateImagesToFiles() {
  console.log('Starting comprehensive image migration from base64 to files...');
  
  const stats: MigrationStats = {
    totalProcessed: 0,
    successfulMigrations: 0,
    failedMigrations: 0,
    skipped: 0
  };

  try {
    // Phase 1: Migrate CIM document images
    console.log('\n=== Phase 1: Migrating CIM Document Images ===');
    const documents = await storage.getAllCimDocuments();
    
    for (const doc of documents) {
      console.log(`\nProcessing CIM document ${doc.id} (User: ${doc.userId})...`);
      let needsUpdate = false;
      const updates: any = {};

      // Migrate logo URL
      if (doc.logoUrl) {
        stats.totalProcessed++;
        const migratedLogo = await migrateBase64ImageToFile(
          doc.logoUrl, 
          doc.userId, 
          'logos', 
          `cim-${doc.id}-logo`
        );
        
        if (migratedLogo && migratedLogo !== doc.logoUrl) {
          updates.logoUrl = migratedLogo;
          // Keep original as backup
          updates.logoUrlBackup = doc.logoUrl;
          needsUpdate = true;
          stats.successfulMigrations++;
        } else if (migratedLogo === null) {
          stats.failedMigrations++;
        } else {
          stats.skipped++;
        }
      }

      // Migrate business images
      if (doc.selectedImages && doc.selectedImages.length > 0) {
        const migratedImages: string[] = [];
        const originalImages: string[] = [];
        let hasChanges = false;

        for (let i = 0; i < doc.selectedImages.length; i++) {
          const imagePath = doc.selectedImages[i];
          stats.totalProcessed++;
          originalImages.push(imagePath);
          
          const migratedImage = await migrateBase64ImageToFile(
            imagePath,
            doc.userId,
            'business-images',
            `cim-${doc.id}-image-${i + 1}`
          );

          if (migratedImage && migratedImage !== imagePath) {
            migratedImages.push(migratedImage);
            hasChanges = true;
            stats.successfulMigrations++;
          } else if (migratedImage === null) {
            migratedImages.push(imagePath); // Keep original on failure
            stats.failedMigrations++;
          } else {
            migratedImages.push(imagePath); // No change needed
            stats.skipped++;
          }
        }

        if (hasChanges) {
          updates.selectedImages = migratedImages;
          // Keep original as backup
          updates.selectedImagesBackup = originalImages;
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        await storage.updateCimDocument(doc.id, updates);
        console.log(`✓ Updated CIM document ${doc.id}`);
      }
    }

    // Phase 2: Migrate user profile images
    console.log('\n=== Phase 2: Migrating User Profile Images ===');
    const users = await storage.getAllUsers();
    
    for (const user of users) {
      console.log(`\nProcessing User ${user.id}...`);
      let needsUpdate = false;
      const updates: any = {};

      // Migrate business logo
      if (user.businessLogo) {
        stats.totalProcessed++;
        const migratedLogo = await migrateBase64ImageToFile(
          user.businessLogo,
          user.id,
          'logos',
          `user-${user.id}-business-logo`
        );

        if (migratedLogo && migratedLogo !== user.businessLogo) {
          updates.businessLogo = migratedLogo;
          updates.businessLogoBackup = user.businessLogo;
          needsUpdate = true;
          stats.successfulMigrations++;
        } else if (migratedLogo === null) {
          stats.failedMigrations++;
        } else {
          stats.skipped++;
        }
      }

      // Migrate profile photo
      if (user.profilePhoto) {
        stats.totalProcessed++;
        const migratedPhoto = await migrateBase64ImageToFile(
          user.profilePhoto,
          user.id,
          'profile-photos',
          `user-${user.id}-profile-photo`
        );

        if (migratedPhoto && migratedPhoto !== user.profilePhoto) {
          updates.profilePhoto = migratedPhoto;
          updates.profilePhotoBackup = user.profilePhoto;
          needsUpdate = true;
          stats.successfulMigrations++;
        } else if (migratedPhoto === null) {
          stats.failedMigrations++;
        } else {
          stats.skipped++;
        }
      }

      if (needsUpdate) {
        await storage.updateUserProfile(user.id, updates);
        console.log(`✓ Updated User ${user.id}`);
      }
    }

    // Phase 3: Migrate custom section images
    console.log('\n=== Phase 3: Migrating Custom Section Images ===');
    const customSections = await storage.getAllCustomSections();
    
    for (const section of customSections) {
      if (section.type === 'image' && section.imageUrls && section.imageUrls.length > 0) {
        console.log(`\nProcessing Custom Section ${section.id}...`);
        
        // Get the document to find the user ID
        const document = await storage.getCimDocument(section.cimDocumentId);
        if (!document) continue;

        const migratedUrls: string[] = [];
        const originalUrls: string[] = [];
        let hasChanges = false;

        for (let i = 0; i < section.imageUrls.length; i++) {
          const imageUrl = section.imageUrls[i];
          stats.totalProcessed++;
          originalUrls.push(imageUrl);

          const migratedUrl = await migrateBase64ImageToFile(
            imageUrl,
            document.userId,
            'custom-sections',
            `section-${section.id}-image-${i + 1}`
          );

          if (migratedUrl && migratedUrl !== imageUrl) {
            migratedUrls.push(migratedUrl);
            hasChanges = true;
            stats.successfulMigrations++;
          } else if (migratedUrl === null) {
            migratedUrls.push(imageUrl);
            stats.failedMigrations++;
          } else {
            migratedUrls.push(imageUrl);
            stats.skipped++;
          }
        }

        if (hasChanges) {
          await storage.updateCustomSection(section.id, {
            imageUrls: migratedUrls,
            imageUrlsBackup: originalUrls
          });
          console.log(`✓ Updated Custom Section ${section.id}`);
        }
      }
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('Migration Statistics:');
    console.log(`- Total images processed: ${stats.totalProcessed}`);
    console.log(`- Successfully migrated: ${stats.successfulMigrations}`);
    console.log(`- Failed migrations: ${stats.failedMigrations}`);
    console.log(`- Skipped (already file paths): ${stats.skipped}`);

    return { 
      success: true, 
      stats,
      message: `Successfully migrated ${stats.successfulMigrations} images to file storage`
    };

  } catch (error) {
    console.error('Migration failed:', error);
    return { 
      success: false, 
      error: error.message,
      stats 
    };
  }
}

// Export the migration function for use in routes
export default migrateImagesToFiles;