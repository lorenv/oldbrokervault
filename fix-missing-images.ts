#!/usr/bin/env tsx
/**
 * Fix Missing Images Script
 * Identifies and fixes missing image files referenced in the database
 */

import { pool, db } from './server/db.js';
import { cimDocuments, users } from './shared/schema.js';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

function base64ToBuffer(base64String: string): Buffer {
  // Remove data URL prefix if present
  const base64Data = base64String.replace(/^data:image\/[a-z]+;base64,/, '');
  return Buffer.from(base64Data, 'base64');
}

function getFileExtensionFromBase64(base64String: string): string {
  if (base64String.startsWith('data:image/jpeg')) return '.jpg';
  if (base64String.startsWith('data:image/png')) return '.png';
  if (base64String.startsWith('data:image/webp')) return '.webp';
  if (base64String.startsWith('data:image/gif')) return '.gif';
  return '.jpg'; // default
}

async function fixMissingImages() {
  console.log("🔧 Starting missing images fix...");
  
  try {
    // Get all CIM documents with logo URLs and backups
    const docs = await db.select().from(cimDocuments);
    console.log(`Found ${docs.length} CIM documents to check`);
    
    let fixedCount = 0;
    
    for (const doc of docs) {
      // Fix missing logo files
      if (doc.logoUrl && doc.logoUrl.startsWith('/user-images/')) {
        const filePath = `public${doc.logoUrl}`;
        
        if (!fs.existsSync(filePath)) {
          console.log(`❌ Missing logo file: ${filePath}`);
          
          // Create directory if needed
          const dir = path.dirname(filePath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`📁 Created directory: ${dir}`);
          }
          
          // Try to restore from backup first
          if (doc.logoUrlBackup && doc.logoUrlBackup.startsWith('data:image/')) {
            try {
              const buffer = base64ToBuffer(doc.logoUrlBackup);
              fs.writeFileSync(filePath, buffer);
              console.log(`✅ Restored logo from backup: ${filePath}`);
              fixedCount++;
            } catch (error) {
              console.log(`⚠️ Failed to restore logo from backup: ${error}`);
              
              // Fallback to copying an existing logo
              const fallbackLogo = 'public/logos/logo_f0dbccb6.png';
              if (fs.existsSync(fallbackLogo)) {
                fs.copyFileSync(fallbackLogo, filePath);
                console.log(`✅ Fixed missing logo with fallback: ${filePath}`);
                fixedCount++;
              }
            }
          } else {
            // No backup available, use fallback
            const fallbackLogo = 'public/logos/logo_f0dbccb6.png';
            if (fs.existsSync(fallbackLogo)) {
              fs.copyFileSync(fallbackLogo, filePath);
              console.log(`✅ Fixed missing logo with fallback: ${filePath}`);
              fixedCount++;
            } else {
              console.log(`⚠️ No logo backup or fallback available for: ${filePath}`);
            }
          }
        } else {
          console.log(`✅ Logo exists: ${filePath}`);
        }
      }
      
      // Fix missing selected images
      if (doc.selectedImages && Array.isArray(doc.selectedImages)) {
        let backupImages: string[] = [];
        
        // Parse backup images safely
        if (doc.selectedImagesBackup) {
          try {
            if (typeof doc.selectedImagesBackup === 'string') {
              // Try to parse as JSON first
              try {
                backupImages = JSON.parse(doc.selectedImagesBackup);
              } catch (jsonError) {
                // If JSON parse fails, check if it's a raw data URL string
                if (doc.selectedImagesBackup.startsWith('data:image/')) {
                  backupImages = [doc.selectedImagesBackup];
                } else {
                  // Try to extract data URLs from the string
                  const dataUrlMatches = doc.selectedImagesBackup.match(/data:image\/[^"]+/g);
                  backupImages = dataUrlMatches || [];
                }
              }
            } else if (Array.isArray(doc.selectedImagesBackup)) {
              backupImages = doc.selectedImagesBackup;
            }
          } catch (error) {
            console.log(`⚠️ Error parsing backup images for document ${doc.id}: ${error}`);
            backupImages = [];
          }
        }
        
        for (let i = 0; i < doc.selectedImages.length; i++) {
          const imageUrl = doc.selectedImages[i];
          if (typeof imageUrl === 'string' && imageUrl.startsWith('/user-images/')) {
            const filePath = `public${imageUrl}`;
            
            if (!fs.existsSync(filePath)) {
              console.log(`❌ Missing business image: ${filePath}`);
              
              // Create directory if needed
              const dir = path.dirname(filePath);
              if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                console.log(`📁 Created directory: ${dir}`);
              }
              
              // Try to restore from backup
              if (backupImages[i] && backupImages[i].startsWith('data:image/')) {
                try {
                  const buffer = base64ToBuffer(backupImages[i]);
                  fs.writeFileSync(filePath, buffer);
                  console.log(`✅ Restored business image from backup: ${filePath}`);
                  fixedCount++;
                } catch (error) {
                  console.log(`⚠️ Failed to restore business image from backup: ${error}`);
                }
              } else {
                console.log(`⚠️ No backup available for business image: ${filePath}`);
              }
            }
          }
        }
      }
    }
    
    // Check user profile photos and business logos
    const users_data = await db.select().from(users);
    console.log(`Checking ${users_data.length} user profiles...`);
    
    for (const user of users_data) {
      // Check profile photo
      if (user.profilePhoto && user.profilePhoto.startsWith('/user-images/')) {
        const filePath = `public${user.profilePhoto}`;
        if (!fs.existsSync(filePath)) {
          console.log(`❌ Missing profile photo: ${filePath}`);
          
          // Create directory if needed
          const dir = path.dirname(filePath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`📁 Created directory: ${dir}`);
          }
          
          // Try to restore from backup if available
          if (user.profilePhotoBackup && user.profilePhotoBackup.startsWith('data:image/')) {
            try {
              const buffer = base64ToBuffer(user.profilePhotoBackup);
              fs.writeFileSync(filePath, buffer);
              console.log(`✅ Restored profile photo from backup: ${filePath}`);
              fixedCount++;
            } catch (error) {
              console.log(`⚠️ Failed to restore profile photo from backup: ${error}`);
            }
          } else {
            console.log(`⚠️ No backup available for profile photo: ${filePath}`);
          }
        }
      }
      
      // Check business logo
      if (user.businessLogo && user.businessLogo.startsWith('/user-images/')) {
        const filePath = `public${user.businessLogo}`;
        if (!fs.existsSync(filePath)) {
          console.log(`❌ Missing business logo: ${filePath}`);
          
          // Create directory if needed
          const dir = path.dirname(filePath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`📁 Created directory: ${dir}`);
          }
          
          // Try to restore from backup if available
          if (user.businessLogoBackup && user.businessLogoBackup.startsWith('data:image/')) {
            try {
              const buffer = base64ToBuffer(user.businessLogoBackup);
              fs.writeFileSync(filePath, buffer);
              console.log(`✅ Restored business logo from backup: ${filePath}`);
              fixedCount++;
            } catch (error) {
              console.log(`⚠️ Failed to restore business logo from backup: ${error}`);
            }
          } else {
            console.log(`⚠️ No backup available for business logo: ${filePath}`);
          }
        }
      }
    }
    
    console.log(`\n🎉 Fixed ${fixedCount} missing image files`);
    
  } catch (error) {
    console.error('❌ Error fixing missing images:', error);
  } finally {
    await pool.end();
  }
}

// Run the script
fixMissingImages();