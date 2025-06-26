import fs from 'fs';
import path from 'path';
import { storage } from './storage';
import { imageManager } from './image-manager';

/**
 * Image Persistence System
 * 
 * Handles image storage resilience during deployments by:
 * 1. Storing base64 backups in database
 * 2. Restoring missing images on server startup
 * 3. Migrating file-based images to include database backups
 */

interface ImageRestoreResult {
  totalChecked: number;
  restored: number;
  failed: number;
  skipped: number;
}

/**
 * Database query with timeout and retry logic
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  retries: number = 3,
  timeout: number = 10000
): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Operation timeout after ${timeout}ms`)), timeout);
      });
      
      return await Promise.race([operation(), timeoutPromise]);
    } catch (error) {
      console.log(`Attempt ${attempt}/${retries} failed:`, (error as Error).message);
      
      if (attempt === retries) {
        throw error;
      }
      
      // Exponential backoff: wait 2^attempt seconds
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
  
  throw new Error('Max retries exceeded');
}

/**
 * Check if image files exist and restore from database if missing
 */
export async function restoreMissingImages(): Promise<ImageRestoreResult> {
  console.log('🔍 Checking for missing images and restoring from database...');
  
  const result: ImageRestoreResult = {
    totalChecked: 0,
    restored: 0,
    failed: 0,
    skipped: 0
  };

  try {
    // Get all CIM documents with images (with timeout and retry)
    const documents = await withRetry(() => storage.getAllCimDocuments(), 2, 8000);
    
    for (const doc of documents) {
      // Check logo
      if (doc.logoUrl && !doc.logoUrl.startsWith('data:')) {
        result.totalChecked++;
        const logoPath = path.join(process.cwd(), 'public', doc.logoUrl.replace(/^\//, ''));
        
        if (!fs.existsSync(logoPath)) {
          console.log(`Missing logo for document ${doc.id}: ${doc.logoUrl}`);
          
          // Try to restore from backup base64 data
          const backupData = (doc as any).logoUrlBackup;
          if (backupData && backupData.startsWith('data:')) {
            try {
              const metadata = await imageManager.migrateBase64ToFile(
                backupData,
                doc.userId,
                'logos',
                `restored-logo-${doc.id}`
              );
              
              await withRetry(() => storage.updateCimDocument(doc.id, { logoUrl: metadata.publicPath }), 2, 5000);
              console.log(`✅ Restored logo: ${metadata.publicPath}`);
              result.restored++;
            } catch (error) {
              console.error(`❌ Failed to restore logo for document ${doc.id}:`, error);
              result.failed++;
            }
          } else {
            // Try alternative locations for existing images
            const alternativePaths = [
              path.join(process.cwd(), 'public', 'logos', path.basename(doc.logoUrl)),
              path.join(process.cwd(), 'attached_assets', path.basename(doc.logoUrl)),
              path.join(process.cwd(), doc.logoUrl.replace(/^\//, ''))
            ];
            
            let foundAlternative = false;
            for (const altPath of alternativePaths) {
              if (fs.existsSync(altPath)) {
                try {
                  // Copy from alternative location to correct user directory
                  const fileBuffer = fs.readFileSync(altPath);
                  const metadata = await imageManager.saveImageFromBuffer(
                    fileBuffer,
                    path.basename(doc.logoUrl),
                    'image/png',
                    doc.userId,
                    'logos'
                  );
                  
                  await storage.updateCimDocument(doc.id, { logoUrl: metadata.publicPath });
                  console.log(`✅ Restored logo from alternative location: ${metadata.publicPath}`);
                  result.restored++;
                  foundAlternative = true;
                  break;
                } catch (error) {
                  console.error(`❌ Failed to copy logo from ${altPath}:`, error);
                }
              }
            }
            
            if (!foundAlternative) {
              console.log(`⚠️ No backup data or alternative location found for logo ${doc.logoUrl}`);
              result.failed++;
            }
          }
        } else {
          result.skipped++;
        }
      }

      // Check business images
      if (doc.selectedImages && doc.selectedImages.length > 0) {
        const restoredImages: string[] = [];
        let hasChanges = false;

        for (let i = 0; i < doc.selectedImages.length; i++) {
          const imagePath = doc.selectedImages[i];
          
          if (imagePath && !imagePath.startsWith('data:')) {
            result.totalChecked++;
            const fullPath = path.join(process.cwd(), 'public', imagePath.replace(/^\//, ''));
            
            if (!fs.existsSync(fullPath)) {
              console.log(`Missing business image: ${imagePath}`);
              
              // Try to restore from backup
              const backupData = (doc as any).selectedImagesBackup?.[i];
              if (backupData && backupData.startsWith('data:')) {
                try {
                  const metadata = await imageManager.migrateBase64ToFile(
                    backupData,
                    doc.userId,
                    'business-images',
                    `restored-image-${doc.id}-${i + 1}`
                  );
                  
                  restoredImages.push(metadata.publicPath);
                  console.log(`✅ Restored image: ${metadata.publicPath}`);
                  result.restored++;
                  hasChanges = true;
                } catch (error) {
                  console.error(`❌ Failed to restore image ${i + 1} for document ${doc.id}:`, error);
                  restoredImages.push(imagePath); // Keep broken path
                  result.failed++;
                }
              } else {
                console.log(`⚠️ No backup data available for image ${imagePath}`);
                restoredImages.push(imagePath); // Keep broken path
                result.failed++;
              }
            } else {
              restoredImages.push(imagePath); // File exists
              result.skipped++;
            }
          } else {
            restoredImages.push(imagePath); // Base64 or invalid
          }
        }

        if (hasChanges) {
          await storage.updateCimDocument(doc.id, { selectedImages: restoredImages });
        }
      }
    }

    console.log('📊 Image restoration summary:');
    console.log(`- Total checked: ${result.totalChecked}`);
    console.log(`- Restored: ${result.restored}`);
    console.log(`- Failed: ${result.failed}`);
    console.log(`- Skipped (found): ${result.skipped}`);

    return result;
  } catch (error) {
    console.error('❌ Error during image restoration:', error);
    throw error;
  }
}

/**
 * Create base64 backups for existing file-based images
 */
export async function createImageBackups(): Promise<void> {
  console.log('💾 Creating base64 backups for existing images...');

  try {
    const documents = await storage.getAllCimDocuments();
    
    for (const doc of documents) {
      let needsUpdate = false;
      const updates: any = {};

      // Backup logo if file exists but no backup
      if (doc.logoUrl && 
          !doc.logoUrl.startsWith('data:') && 
          !(doc as any).logoUrlBackup) {
        
        const logoPath = path.join(process.cwd(), 'public', doc.logoUrl.replace(/^\//, ''));
        if (fs.existsSync(logoPath)) {
          try {
            const fileBuffer = fs.readFileSync(logoPath);
            const mimeType = doc.logoUrl.endsWith('.png') ? 'image/png' : 'image/jpeg';
            const base64 = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
            
            updates.logoUrlBackup = base64;
            needsUpdate = true;
            console.log(`✅ Created backup for logo: ${doc.logoUrl}`);
          } catch (error) {
            console.error(`❌ Failed to backup logo ${doc.logoUrl}:`, error);
          }
        }
      }

      // Backup business images
      if (doc.selectedImages && 
          doc.selectedImages.length > 0 && 
          !(doc as any).selectedImagesBackup) {
        
        const backups: string[] = [];
        let hasBackups = false;

        for (const imagePath of doc.selectedImages) {
          if (imagePath && !imagePath.startsWith('data:')) {
            const fullPath = path.join(process.cwd(), 'public', imagePath.replace(/^\//, ''));
            
            if (fs.existsSync(fullPath)) {
              try {
                const fileBuffer = fs.readFileSync(fullPath);
                const ext = path.extname(imagePath).toLowerCase();
                const mimeType = ext === '.png' ? 'image/png' : 
                                ext === '.webp' ? 'image/webp' : 'image/jpeg';
                const base64 = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
                
                backups.push(base64);
                hasBackups = true;
              } catch (error) {
                console.error(`❌ Failed to backup image ${imagePath}:`, error);
                backups.push(imagePath); // Keep original on failure
              }
            } else {
              backups.push(imagePath); // File doesn't exist
            }
          } else {
            backups.push(imagePath); // Already base64 or invalid
          }
        }

        if (hasBackups) {
          updates.selectedImagesBackup = backups;
          needsUpdate = true;
          console.log(`✅ Created backups for ${backups.length} images in document ${doc.id}`);
        }
      }

      if (needsUpdate) {
        await storage.updateCimDocument(doc.id, updates);
      }
    }

    console.log('💾 Image backup creation completed');
  } catch (error) {
    console.error('❌ Error creating image backups:', error);
    throw error;
  }
}

/**
 * Initialize image persistence system on server startup
 */
export async function initializeImagePersistence(): Promise<void> {
  console.log('🚀 Initializing image persistence system...');
  
  // Skip image persistence during deployment to ensure fast health check response
  if (process.env.NODE_ENV === 'production' && process.env.SKIP_IMAGE_PERSISTENCE === 'true') {
    console.log('⚠️ Skipping image persistence during deployment for fast startup');
    return;
  }
  
  try {
    // Ensure user images directory exists
    const userImagesDir = path.join(process.cwd(), 'public', 'user-images');
    if (!fs.existsSync(userImagesDir)) {
      fs.mkdirSync(userImagesDir, { recursive: true });
      console.log('📁 Created user-images directory');
    }

    // Note: Backup operations removed since we're using Replit persistent storage
    // Only run basic directory check - no database operations during startup
    console.log('✅ Image persistence simplified for Replit deployment');
    
    console.log('✅ Image persistence system initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize image persistence system:', error);
    // Don't throw - server should still start even if image restoration fails
  }
}