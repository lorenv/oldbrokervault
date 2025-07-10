#!/usr/bin/env tsx

/**
 * Test Object Storage Connection
 * Verifies Replit Object Storage connection before full migration
 */

import { objectStorage } from './server/object-storage';
import { log } from './server/vite';

async function testObjectStorage(): Promise<void> {
  log('🔍 Testing Replit Object Storage connection...');
  
  try {
    // Test 1: Create a test image buffer
    const testImageBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAHVAAAAdvNQIAAAAASUVORK5CYII=', 'base64');
    const testKey = 'test/connection-test.png';
    
    log('📤 Testing upload...');
    const publicUrl = await objectStorage.uploadImage(testImageBuffer, testKey);
    log(`✅ Upload successful! URL: ${publicUrl}`);
    
    // Test 2: Check if image exists
    log('🔍 Testing existence check...');
    const exists = await objectStorage.imageExists(testKey);
    log(`✅ Existence check: ${exists}`);
    
    // Test 3: Download the image
    log('📥 Testing download...');
    const downloadedBuffer = await objectStorage.downloadImage(testKey);
    log(`✅ Download successful! Size: ${downloadedBuffer.length} bytes`);
    
    // Test 4: List objects
    log('📋 Testing list operation...');
    const objects = await objectStorage.listImages('test/');
    log(`✅ List successful! Found ${objects.length} objects with prefix 'test/'`);
    
    // Test 5: Clean up test file
    log('🗑️ Cleaning up test file...');
    await objectStorage.deleteImage(testKey);
    log('✅ Cleanup successful!');
    
    log('\n🎉 All object storage tests passed! Ready for migration.');
    
  } catch (error) {
    log(`❌ Object storage test failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

// Run test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testObjectStorage()
    .then(() => {
      console.log('✅ Object storage connection test completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Object storage test failed:', error);
      process.exit(1);
    });
}

export { testObjectStorage };