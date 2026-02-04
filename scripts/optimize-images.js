#!/usr/bin/env node
/**
 * Image Optimization Script
 *
 * This script compresses PNG/JPEG images and creates WebP versions.
 *
 * Usage:
 *   node scripts/optimize-images.js [options]
 *
 * Options:
 *   --dry-run       Show what would be done without making changes
 *   --webp-only     Only create WebP versions, don't compress originals
 *   --responsive    Create responsive image sizes (640, 1024, 1920)
 *   --quality=N     Set quality (1-100, default: 80)
 *   --min-size=N    Only process files larger than N KB (default: 50)
 *
 * Examples:
 *   node scripts/optimize-images.js --dry-run
 *   node scripts/optimize-images.js --quality=75
 *   node scripts/optimize-images.js --webp-only --responsive
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const PUBLIC_DIR = path.join(__dirname, '../client/public');
const DEFAULT_QUALITY = 80;
const MIN_SIZE_KB = 50;
const RESPONSIVE_SIZES = [640, 1024, 1920];

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  webpOnly: args.includes('--webp-only'),
  responsive: args.includes('--responsive'),
  quality: parseInt(args.find(a => a.startsWith('--quality='))?.split('=')[1] || DEFAULT_QUALITY),
  minSize: parseInt(args.find(a => a.startsWith('--min-size='))?.split('=')[1] || MIN_SIZE_KB),
};

console.log('Image Optimization Script');
console.log('=========================');
console.log(`Options: ${JSON.stringify(options, null, 2)}`);
console.log('');

// Find all image files
function findImages(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findImages(fullPath));
    } else if (/\.(png|jpg|jpeg)$/i.test(entry.name)) {
      // Skip already optimized files
      if (entry.name.includes('-optimized') || entry.name.includes('-640') ||
          entry.name.includes('-1024') || entry.name.includes('-1920')) {
        continue;
      }
      const stats = fs.statSync(fullPath);
      const sizeKB = stats.size / 1024;
      if (sizeKB >= options.minSize) {
        files.push({ path: fullPath, sizeKB });
      }
    }
  }
  return files;
}

// Compress a single image
async function compressImage(imagePath) {
  const ext = path.extname(imagePath).toLowerCase();
  const dir = path.dirname(imagePath);
  const basename = path.basename(imagePath, ext);
  const originalSize = fs.statSync(imagePath).size;

  const results = [];

  try {
    const image = sharp(imagePath);
    const metadata = await image.metadata();

    // Compress original format
    if (!options.webpOnly) {
      let compressed;
      if (ext === '.png') {
        compressed = await image
          .png({ quality: options.quality, compressionLevel: 9, palette: true })
          .toBuffer();
      } else {
        compressed = await image
          .jpeg({ quality: options.quality, mozjpeg: true })
          .toBuffer();
      }

      const savings = ((originalSize - compressed.length) / originalSize * 100).toFixed(1);

      if (compressed.length < originalSize) {
        if (!options.dryRun) {
          fs.writeFileSync(imagePath, compressed);
        }
        results.push({
          type: 'compress',
          path: imagePath,
          originalSize,
          newSize: compressed.length,
          savings: `${savings}%`
        });
      }
    }

    // Create WebP version
    const webpPath = path.join(dir, `${basename}.webp`);
    if (!fs.existsSync(webpPath)) {
      const webpBuffer = await sharp(imagePath)
        .webp({ quality: options.quality })
        .toBuffer();

      if (!options.dryRun) {
        fs.writeFileSync(webpPath, webpBuffer);
      }

      const webpSavings = ((originalSize - webpBuffer.length) / originalSize * 100).toFixed(1);
      results.push({
        type: 'webp',
        path: webpPath,
        originalSize,
        newSize: webpBuffer.length,
        savings: `${webpSavings}%`
      });
    }

    // Create responsive sizes
    if (options.responsive && metadata.width) {
      for (const targetWidth of RESPONSIVE_SIZES) {
        if (metadata.width > targetWidth) {
          const responsivePath = path.join(dir, `${basename}-${targetWidth}${ext}`);
          const responsiveWebpPath = path.join(dir, `${basename}-${targetWidth}.webp`);

          if (!fs.existsSync(responsivePath) || !fs.existsSync(responsiveWebpPath)) {
            const resized = sharp(imagePath).resize(targetWidth, null, {
              withoutEnlargement: true,
              fit: 'inside'
            });

            // Original format resized
            if (!fs.existsSync(responsivePath)) {
              let resizedBuffer;
              if (ext === '.png') {
                resizedBuffer = await resized.clone()
                  .png({ quality: options.quality, compressionLevel: 9 })
                  .toBuffer();
              } else {
                resizedBuffer = await resized.clone()
                  .jpeg({ quality: options.quality, mozjpeg: true })
                  .toBuffer();
              }

              if (!options.dryRun) {
                fs.writeFileSync(responsivePath, resizedBuffer);
              }
              results.push({
                type: `responsive-${targetWidth}`,
                path: responsivePath,
                newSize: resizedBuffer.length
              });
            }

            // WebP resized
            if (!fs.existsSync(responsiveWebpPath)) {
              const webpResizedBuffer = await resized.clone()
                .webp({ quality: options.quality })
                .toBuffer();

              if (!options.dryRun) {
                fs.writeFileSync(responsiveWebpPath, webpResizedBuffer);
              }
              results.push({
                type: `responsive-webp-${targetWidth}`,
                path: responsiveWebpPath,
                newSize: webpResizedBuffer.length
              });
            }
          }
        }
      }
    }
  } catch (error) {
    console.error(`Error processing ${imagePath}: ${error.message}`);
  }

  return results;
}

// Format bytes to human readable
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Main function
async function main() {
  console.log(`Scanning ${PUBLIC_DIR} for images >= ${options.minSize}KB...`);
  console.log('');

  const images = findImages(PUBLIC_DIR);

  if (images.length === 0) {
    console.log('No images found that need optimization.');
    return;
  }

  console.log(`Found ${images.length} images to process:`);
  images.forEach(img => {
    console.log(`  - ${path.relative(PUBLIC_DIR, img.path)} (${formatBytes(img.sizeKB * 1024)})`);
  });
  console.log('');

  if (options.dryRun) {
    console.log('DRY RUN - No changes will be made');
    console.log('');
  }

  let totalOriginalSize = 0;
  let totalNewSize = 0;
  let allResults = [];

  for (const image of images) {
    console.log(`Processing: ${path.basename(image.path)}...`);
    const results = await compressImage(image.path);
    allResults.push(...results);

    for (const result of results) {
      if (result.originalSize) {
        totalOriginalSize += result.originalSize;
      }
      if (result.newSize) {
        totalNewSize += result.newSize;
      }

      if (result.type === 'compress') {
        console.log(`  Compressed: ${formatBytes(result.originalSize)} -> ${formatBytes(result.newSize)} (${result.savings} saved)`);
      } else if (result.type === 'webp') {
        console.log(`  WebP: ${formatBytes(result.newSize)} (${result.savings} smaller than original)`);
      } else {
        console.log(`  ${result.type}: ${formatBytes(result.newSize)}`);
      }
    }
  }

  console.log('');
  console.log('Summary');
  console.log('=======');
  console.log(`Images processed: ${images.length}`);
  console.log(`Operations performed: ${allResults.length}`);

  if (totalOriginalSize > 0) {
    const totalSavings = ((totalOriginalSize - totalNewSize) / totalOriginalSize * 100).toFixed(1);
    console.log(`Total size reduction: ${formatBytes(totalOriginalSize)} -> ${formatBytes(totalNewSize)} (${totalSavings}% saved)`);
  }

  if (options.dryRun) {
    console.log('');
    console.log('This was a dry run. Run without --dry-run to apply changes.');
  }
}

main().catch(console.error);
