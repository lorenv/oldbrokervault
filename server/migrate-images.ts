import fs from 'fs';
import path from 'path';
import { storage } from './storage';

/**
 * Migration script to convert existing file-path images to base64 format
 * This fixes the deployment persistence issue where images break on redeploy
 */

async function convertFileToBase64(filePath: string): Promise<string | null> {
  try {
    const fullPath = path.join(process.cwd(), 'public', filePath.replace(/^\/+/, ''));
    
    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      console.log(`File not found: ${fullPath}`);
      return null;
    }

    // Read file and convert to base64
    const buffer = fs.readFileSync(fullPath);
    
    // Determine MIME type based on extension
    const ext = path.extname(fullPath).toLowerCase();
    let mimeType = 'image/jpeg';
    if (ext === '.png') mimeType = 'image/png';
    else if (ext === '.gif') mimeType = 'image/gif';
    else if (ext === '.webp') mimeType = 'image/webp';

    // Create data URL
    const base64Data = buffer.toString('base64');
    return `data:${mimeType};base64,${base64Data}`;
  } catch (error) {
    console.error(`Error converting file ${filePath}:`, error);
    return null;
  }
}

export async function migrateImagesToBase64() {
  console.log('Starting image migration to base64...');
  
  try {
    // Get all CIM documents with images
    const documents = await storage.getAllCimDocuments();
    let updatedCount = 0;

    for (const doc of documents) {
      let needsUpdate = false;
      
      // Migrate logo URL
      if (doc.logoUrl && doc.logoUrl.startsWith('/')) {
        console.log(`Converting logo for CIM ${doc.id}: ${doc.logoUrl}`);
        const base64Logo = await convertFileToBase64(doc.logoUrl);
        if (base64Logo) {
          await storage.updateCimDocument(doc.id, { logoUrl: base64Logo });
          needsUpdate = true;
          console.log(`✓ Converted logo for CIM ${doc.id}`);
        }
      }

      // Migrate business images
      if (doc.selectedImages && doc.selectedImages.length > 0) {
        const convertedImages: string[] = [];
        let hasFileImages = false;

        for (const imagePath of doc.selectedImages) {
          if (imagePath.startsWith('/')) {
            hasFileImages = true;
            console.log(`Converting business image: ${imagePath}`);
            const base64Image = await convertFileToBase64(imagePath);
            if (base64Image) {
              convertedImages.push(base64Image);
              console.log(`✓ Converted business image: ${imagePath}`);
            }
          } else {
            // Already base64, keep as is
            convertedImages.push(imagePath);
          }
        }

        if (hasFileImages) {
          await storage.updateCimImages(doc.id, convertedImages);
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        updatedCount++;
      }
    }

    // Get all users with profile images
    const users = await storage.getAllUsers();
    
    for (const user of users) {
      let needsUpdate = false;
      const updates: any = {};

      // Migrate business logo
      if (user.businessLogo && user.businessLogo.startsWith('/')) {
        console.log(`Converting business logo for user ${user.id}: ${user.businessLogo}`);
        const base64Logo = await convertFileToBase64(user.businessLogo);
        if (base64Logo) {
          updates.businessLogo = base64Logo;
          needsUpdate = true;
          console.log(`✓ Converted business logo for user ${user.id}`);
        }
      }

      // Migrate profile photo
      if (user.profilePhoto && user.profilePhoto.startsWith('/')) {
        console.log(`Converting profile photo for user ${user.id}: ${user.profilePhoto}`);
        const base64Photo = await convertFileToBase64(user.profilePhoto);
        if (base64Photo) {
          updates.profilePhoto = base64Photo;
          needsUpdate = true;
          console.log(`✓ Converted profile photo for user ${user.id}`);
        }
      }

      if (needsUpdate) {
        await storage.updateUserProfile(user.id, updates);
        updatedCount++;
      }
    }

    console.log(`✅ Migration completed. Updated ${updatedCount} records.`);
    return { success: true, updatedCount };

  } catch (error) {
    console.error('Migration failed:', error);
    return { success: false, error: error.message };
  }
}

// Export the migration function for use in routes
export default migrateImagesToBase64;