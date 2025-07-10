#!/usr/bin/env tsx

/**
 * Migration Script: Filesystem → Object Storage
 * Transfers all existing images from filesystem to Replit Object Storage
 */

import { objectStorageImageManager } from './server/image-manager-object-storage';
import { db } from './server/db';
import { cimDocuments, users } from './shared/schema';
import { log } from './server/vite';
import fs from 'fs';
import path from 'path';
import { eq } from 'drizzle-orm';

interface MigrationResult {
  totalImages: number;
  migratedImages: number;
  failedImages: number;
  skippedImages: number;
}

async function migrateToObjectStorage(): Promise<MigrationResult> {
  const result: MigrationResult = {
    totalImages: 0,
    migratedImages: 0,
    failedImages: 0,
    skippedImages: 0
  };

  log('🚀 Starting migration to object storage...');
  
  try {
    // Get all users
    const allUsers = await db.select().from(users);
    log(`📊 Found ${allUsers.length} users to migrate`);

    for (const user of allUsers) {
      log(`\n👤 Migrating images for user ${user.id} (${user.email})...`);
      
      // 1. Migrate profile photos
      await migrateUserProfileImages(user.id, result);
      
      // 2. Migrate business logos
      await migrateUserBusinessLogos(user.id, result);
      
      // 3. Migrate CIM document images
      await migrateUserCimImages(user.id, result);
    }

    // 4. Update database references
    await updateDatabaseReferences();

    log('\n✅ Migration completed!');
    log(`📊 Summary: ${result.migratedImages} migrated, ${result.failedImages} failed, ${result.skippedImages} skipped`);
    
    return result;

  } catch (error) {
    log(`❌ Migration failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function migrateUserProfileImages(userId: number, result: MigrationResult): Promise<void> {
  const userDir = path.join(process.cwd(), 'public', 'user-images', userId.toString());
  
  // Check profile photos directory
  const profilePhotosDir = path.join(userDir, 'profile-photos');
  if (fs.existsSync(profilePhotosDir)) {
    const files = fs.readdirSync(profilePhotosDir);
    for (const file of files) {
      result.totalImages++;
      const filesystemPath = `user-images/${userId}/profile-photos/${file}`;
      const migrated = await objectStorageImageManager.migrateFromFilesystem(
        filesystemPath,
        userId,
        'profile-photos',
        file
      );
      
      if (migrated) {
        result.migratedImages++;
        // Update user profile photo URL
        await db.update(users)
          .set({ profilePhoto: migrated.publicPath })
          .where(eq(users.id, userId));
      } else {
        result.failedImages++;
      }
    }
  }
}

async function migrateUserBusinessLogos(userId: number, result: MigrationResult): Promise<void> {
  const userDir = path.join(process.cwd(), 'public', 'user-images', userId.toString());
  
  // Check logos directory
  const logosDir = path.join(userDir, 'logos');
  if (fs.existsSync(logosDir)) {
    const files = fs.readdirSync(logosDir);
    for (const file of files) {
      result.totalImages++;
      const filesystemPath = `user-images/${userId}/logos/${file}`;
      const migrated = await objectStorageImageManager.migrateFromFilesystem(
        filesystemPath,
        userId,
        'logos',
        file
      );
      
      if (migrated) {
        result.migratedImages++;
        // Update user business logo URL
        await db.update(users)
          .set({ businessLogo: migrated.publicPath })
          .where(eq(users.id, userId));
      } else {
        result.failedImages++;
      }
    }
  }
}

async function migrateUserCimImages(userId: number, result: MigrationResult): Promise<void> {
  const userDir = path.join(process.cwd(), 'public', 'user-images', userId.toString());
  
  // Check business images directory
  const businessImagesDir = path.join(userDir, 'business-images');
  if (fs.existsSync(businessImagesDir)) {
    const files = fs.readdirSync(businessImagesDir);
    for (const file of files) {
      result.totalImages++;
      const filesystemPath = `user-images/${userId}/business-images/${file}`;
      const migrated = await objectStorageImageManager.migrateFromFilesystem(
        filesystemPath,
        userId,
        'business-images',
        file
      );
      
      if (migrated) {
        result.migratedImages++;
      } else {
        result.failedImages++;
      }
    }
  }

  // Get all CIM documents for this user
  const userCims = await db.select().from(cimDocuments).where(eq(cimDocuments.userId, userId));
  
  for (const cim of userCims) {
    // Migrate cover images
    if (cim.coverImageUrl && !cim.coverImageUrl.startsWith('https://storage.googleapis.com/')) {
      result.totalImages++;
      
      // Try to migrate from filesystem first
      let migrated = null;
      if (cim.coverImageUrl.startsWith('/user-images/')) {
        migrated = await objectStorageImageManager.migrateFromFilesystem(
          cim.coverImageUrl,
          userId,
          'business-images',
          `cover-${cim.id}.jpg`
        );
      }
      
      // If filesystem migration failed, try base64 backup
      if (!migrated && cim.coverImageBackup) {
        migrated = await objectStorageImageManager.migrateFromBase64(
          cim.coverImageBackup,
          userId,
          'business-images',
          `cover-${cim.id}.jpg`
        );
      }
      
      if (migrated) {
        result.migratedImages++;
        // Update CIM document cover image URL
        await db.update(cimDocuments)
          .set({ coverImageUrl: migrated.publicPath })
          .where(eq(cimDocuments.id, cim.id));
      } else {
        result.failedImages++;
      }
    }

    // Migrate selected images
    if (cim.selectedImages) {
      let selectedImages: string[];
      try {
        selectedImages = JSON.parse(cim.selectedImages);
      } catch {
        selectedImages = [];
      }

      const migratedImages: string[] = [];
      for (const imageUrl of selectedImages) {
        if (!imageUrl.startsWith('https://storage.googleapis.com/')) {
          result.totalImages++;
          
          let migrated = null;
          if (imageUrl.startsWith('/user-images/')) {
            const filename = path.basename(imageUrl);
            migrated = await objectStorageImageManager.migrateFromFilesystem(
              imageUrl,
              userId,
              'business-images',
              filename
            );
          } else if (imageUrl.startsWith('data:')) {
            // Base64 image
            migrated = await objectStorageImageManager.migrateFromBase64(
              imageUrl,
              userId,
              'business-images',
              `image-${Date.now()}.jpg`
            );
          }
          
          if (migrated) {
            result.migratedImages++;
            migratedImages.push(migrated.publicPath);
          } else {
            result.failedImages++;
            migratedImages.push(imageUrl); // Keep original if migration failed
          }
        } else {
          migratedImages.push(imageUrl); // Already migrated
        }
      }

      // Update selected images
      await db.update(cimDocuments)
        .set({ selectedImages: JSON.stringify(migratedImages) })
        .where(eq(cimDocuments.id, cim.id));
    }
  }
}

async function updateDatabaseReferences(): Promise<void> {
  log('\n🔄 Updating database references...');
  
  // Update any remaining filesystem references to object storage URLs
  const allCims = await db.select().from(cimDocuments);
  
  for (const cim of allCims) {
    let needsUpdate = false;
    const updates: any = {};
    
    // Check logo URL
    if (cim.logoUrl && cim.logoUrl.startsWith('/user-images/')) {
      // Convert to object storage URL pattern
      const key = cim.logoUrl.replace('/user-images/', 'users/');
      updates.logoUrl = `https://storage.googleapis.com/Bucket1/${key}`;
      needsUpdate = true;
    }
    
    if (needsUpdate) {
      await db.update(cimDocuments)
        .set(updates)
        .where(eq(cimDocuments.id, cim.id));
    }
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateToObjectStorage()
    .then(result => {
      console.log(`\n✅ Migration completed successfully!`);
      console.log(`📊 Results:`);
      console.log(`   - Total images processed: ${result.totalImages}`);
      console.log(`   - Successfully migrated: ${result.migratedImages}`);
      console.log(`   - Failed migrations: ${result.failedImages}`);
      console.log(`   - Skipped (already migrated): ${result.skippedImages}`);
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

export { migrateToObjectStorage, type MigrationResult };