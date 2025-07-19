#!/usr/bin/env tsx

/**
 * Migration script to move development environment filesystem images to object storage
 * This ensures all images use object storage consistently across environments
 */

import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { cimDocuments } from "./shared/schema";
import { eq } from "drizzle-orm";
import fs from 'fs';
import path from 'path';
import { objectStorageImageManager } from './server/image-manager-object-storage';

const connectionString = process.env.DATABASE_URL!;
const sql = neon(connectionString);
const db = drizzle(sql);

interface MigrationResult {
  document: number;
  field: string;
  originalPath: string;
  newPath: string;
  status: 'success' | 'failed' | 'skipped';
  error?: string;
}

async function migrateFilesystemImagesToObjectStorage() {
  console.log('🚀 Starting filesystem images to object storage migration...');
  
  const results: MigrationResult[] = [];
  
  try {
    // Get all CIM documents with images
    const documents = await db.select().from(cimDocuments);
    
    console.log(`Found ${documents.length} documents to check for filesystem images`);
    
    for (const doc of documents) {
      console.log(`\n📄 Processing document ${doc.id}...`);
      
      let hasChanges = false;
      let updatedDoc = { ...doc };
      
      // Migrate logo URL if it's a filesystem path
      if (doc.logoUrl && doc.logoUrl.startsWith('/user-images/')) {
        console.log(`  📸 Migrating logo: ${doc.logoUrl}`);
        const result = await migrateImage(doc.logoUrl, doc.userId, 'logos');
        results.push({
          document: doc.id,
          field: 'logoUrl',
          originalPath: doc.logoUrl,
          newPath: result.newPath || '',
          status: result.success ? 'success' : 'failed',
          error: result.error
        });
        
        if (result.success && result.newPath) {
          updatedDoc.logoUrl = result.newPath;
          hasChanges = true;
        }
      }
      
      // Migrate selected images if they're filesystem paths
      if (doc.selectedImages && doc.selectedImages.length > 0) {
        const updatedImages: string[] = [];
        
        for (const imagePath of doc.selectedImages) {
          if (imagePath.startsWith('/user-images/')) {
            console.log(`  🖼️ Migrating business image: ${imagePath}`);
            const result = await migrateImage(imagePath, doc.userId, 'business-images');
            results.push({
              document: doc.id,
              field: 'selectedImages',
              originalPath: imagePath,
              newPath: result.newPath || '',
              status: result.success ? 'success' : 'failed',
              error: result.error
            });
            
            if (result.success && result.newPath) {
              updatedImages.push(result.newPath);
              hasChanges = true;
            } else {
              updatedImages.push(imagePath); // Keep original on failure
            }
          } else {
            updatedImages.push(imagePath); // Already object storage or other format
          }
        }
        
        if (hasChanges) {
          updatedDoc.selectedImages = updatedImages;
        }
      }
      
      // Update database if there were changes
      if (hasChanges) {
        console.log(`  💾 Updating database for document ${doc.id}`);
        await db.update(cimDocuments)
          .set({
            logoUrl: updatedDoc.logoUrl,
            selectedImages: updatedDoc.selectedImages
          })
          .where(eq(cimDocuments.id, doc.id));
        console.log(`  ✅ Document ${doc.id} updated successfully`);
      } else {
        console.log(`  ⏭️ Document ${doc.id} - no filesystem images to migrate`);
      }
    }
    
    // Print summary
    console.log('\n📊 Migration Summary:');
    console.log('==================');
    
    const successful = results.filter(r => r.status === 'success');
    const failed = results.filter(r => r.status === 'failed');
    const skipped = results.filter(r => r.status === 'skipped');
    
    console.log(`✅ Successfully migrated: ${successful.length} images`);
    console.log(`❌ Failed migrations: ${failed.length} images`);
    console.log(`⏭️ Skipped: ${skipped.length} images`);
    
    if (failed.length > 0) {
      console.log('\n❌ Failed migrations:');
      failed.forEach(f => {
        console.log(`  Document ${f.document} ${f.field}: ${f.originalPath} - ${f.error}`);
      });
    }
    
    if (successful.length > 0) {
      console.log('\n✅ Successful migrations:');
      successful.forEach(s => {
        console.log(`  Document ${s.document} ${s.field}: ${s.originalPath} → ${s.newPath}`);
      });
    }
    
    console.log(`\n🎉 Migration complete! Processed ${documents.length} documents`);
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  }
}

async function migrateImage(
  filesystemPath: string, 
  userId: number, 
  type: 'logos' | 'business-images'
): Promise<{ success: boolean; newPath?: string; error?: string }> {
  try {
    // Construct full filesystem path
    const fullPath = path.join(process.cwd(), 'public', filesystemPath);
    
    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      return { 
        success: false, 
        error: `File not found: ${fullPath}` 
      };
    }
    
    // Read file
    const buffer = fs.readFileSync(fullPath);
    const fileName = path.basename(filesystemPath);
    
    // Determine MIME type from extension
    const ext = path.extname(fileName).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png' : 
                    ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
                    ext === '.gif' ? 'image/gif' :
                    ext === '.webp' ? 'image/webp' : 'image/jpeg';
    
    // Upload to object storage
    const metadata = await objectStorageImageManager.saveImageFromBuffer(
      buffer,
      fileName,
      mimeType,
      userId,
      type,
      { optimize: false } // Keep original quality for migration
    );
    
    console.log(`    ✅ Uploaded to object storage: ${metadata.publicPath}`);
    
    return { 
      success: true, 
      newPath: metadata.publicPath 
    };
    
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}

// Run migration
migrateFilesystemImagesToObjectStorage().catch(console.error);