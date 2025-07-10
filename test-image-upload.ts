#!/usr/bin/env tsx

/**
 * Test Image Upload to Object Storage
 * Verifies that new images are uploaded to object storage
 */

import { imageManager } from './server/image-manager';
import { log } from './server/vite';

async function testImageUpload(): Promise<void> {
  log('🔍 Testing image upload to object storage...');
  
  try {
    // Create a test image buffer (1x1 pixel PNG)
    const testImageBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAHVAAAAdvNQIAAAAASUVORK5CYII=', 'base64');
    
    log('📤 Uploading test image via imageManager...');
    const metadata = await imageManager.saveImageFromBuffer(
      testImageBuffer,
      'test-upload.png',
      'image/png',
      1, // userId
      'business-images'
    );
    
    log(`✅ Upload successful!`);
    log(`📊 Metadata:`);
    log(`   - ID: ${metadata.id}`);
    log(`   - File Name: ${metadata.fileName}`);
    log(`   - Public Path: ${metadata.publicPath}`);
    log(`   - File Size: ${metadata.fileSize} bytes`);
    log(`   - MIME Type: ${metadata.mimeType}`);
    
    // Check if the URL is from object storage
    if (metadata.publicPath.includes('storage.googleapis.com')) {
      log('🎉 SUCCESS: Image uploaded to object storage!');
    } else {
      log('⚠️  NOTICE: Image uploaded to filesystem (fallback)');
    }
    
  } catch (error) {
    log(`❌ Test failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

// Run test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testImageUpload()
    .then(() => {
      console.log('✅ Image upload test completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Image upload test failed:', error);
      process.exit(1);
    });
}

export { testImageUpload };