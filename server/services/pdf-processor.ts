import { Buffer } from 'buffer';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fromBuffer } from 'pdf2pic';
import sharp from 'sharp';
import { ObjectStorageService } from '../object-storage';

interface ProcessedDocument {
  pageCount: number;
  imageUrls: string[];
}

interface FileUpload {
  buffer: Buffer;
  originalname: string;
}

export async function processPDFToImages(file: FileUpload, id: number, isTemplate: boolean = false): Promise<ProcessedDocument> {
  const tempDir = path.join(process.cwd(), 'temp', `${isTemplate ? 'template' : 'doc'}-${id}`);
  
  try {
    console.log(`[PDF_PROC] Starting PDF processing for ${file.originalname}`);
    
    // Create temporary directory
    await fs.mkdir(tempDir, { recursive: true });
    
    // Convert PDF to images using pdf2pic with optimized settings
    const convert = fromBuffer(file.buffer, {
      density: 150,           // Reduced DPI for faster processing
      saveFilename: "page",
      savePath: tempDir,
      format: "png",
      width: 800,             // Good resolution for display
      height: 1100,           // Proportional height for A4
      quality: 85             // Good quality with reasonable file size
    });
    
    console.log(`[PDF_PROC] Converting PDF pages...`);
    
    // Convert all pages
    const results = await convert.bulk(-1); // -1 means all pages
    const pageCount = results.length;
    const imageUrls: string[] = [];
    
    console.log(`[PDF_PROC] Processing ${pageCount} pages`);
    
    // Process images in parallel batches for better performance
    const batchSize = 3; // Process 3 pages at a time
    for (let i = 0; i < results.length; i += batchSize) {
      const batch = results.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (pageResult, batchIndex) => {
        const pageIndex = i + batchIndex;
        if (pageResult.path) {
          try {
            // Read and optimize image for storage
            const imageBuffer = await fs.readFile(pageResult.path);
            
            // Optimize image with Sharp
            const optimizedBuffer = await sharp(imageBuffer)
              .png({ 
                compressionLevel: 6, 
                quality: 85,
                progressive: true 
              })
              .toBuffer();
            
            // Store image in object storage
            const objectStorageService = new ObjectStorageService();
            const storageKey = `private/${isTemplate ? 'templates' : 'documents'}/${id}/pages/page-${pageIndex + 1}.png`;
            const uploadResult = await objectStorageService.uploadBuffer(storageKey, optimizedBuffer, 'image/png');
            
            console.log(`[PDF_PROC] Processed page ${pageIndex + 1}: ${uploadResult.url}`);
            
            // Store URL in the correct order
            imageUrls[pageIndex] = uploadResult.url;
            
          } catch (error) {
            console.error(`[PDF_PROC] Failed to process page ${pageIndex + 1}:`, error);
            throw error;
          }
        }
      }));
    }
    
    // Clean up temporary directory
    fs.rm(tempDir, { recursive: true, force: true }).catch(() => {
      console.warn(`[PDF_PROC] Failed to clean up temp directory: ${tempDir}`);
    });
    
    console.log(`[PDF_PROC] ✅ Successfully processed ${pageCount} pages`);
    
    return {
      pageCount,
      imageUrls: imageUrls.filter(url => url), // Remove any undefined entries
    };

  } catch (error) {
    console.error('[PDF_PROC] PDF processing error:', error);
    // Clean up on error
    fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('gm/convert binaries')) {
        throw new Error('PDF processing system dependencies are missing. Please install ImageMagick and Ghostscript.');
      } else if (error.message.includes('GraphicsMagick')) {
        throw new Error('Graphics processing tools are not available. PDF conversion requires ImageMagick.');
      } else {
        throw new Error(`PDF processing failed: ${error.message}`);
      }
    }
    throw new Error('Failed to process PDF document: Unknown error occurred');
  }
}

export async function overlaySignatureFields(pageImageBuffer: Buffer, fields: any[]): Promise<Buffer> {
  try {
    // Get the base image dimensions
    const baseImage = sharp(pageImageBuffer);
    const { width, height } = await baseImage.metadata();
    
    if (!width || !height) {
      throw new Error('Could not determine image dimensions');
    }

    // Create overlay SVG with signature fields
    const overlays = fields.map(field => {
      const x = Math.round((field.x / 100) * width);
      const y = Math.round((field.y / 100) * height);
      const fieldWidth = Math.round((field.width / 100) * width);
      const fieldHeight = Math.round((field.height / 100) * height);

      // Create different overlays based on field type
      switch (field.type) {
        case 'signature':
          return `
            <text x="${x + 5}" y="${y + fieldHeight/2 + 6}" 
                  font-family="Brush Script MT, Dancing Script, Lucida Handwriting, cursive" 
                  font-size="20" fill="#1e40af" font-weight="normal" font-style="italic">
              ${escapeXml(field.value || '')}
            </text>
          `;
        
        case 'initials':
          return `
            <text x="${x + 5}" y="${y + fieldHeight/2 + 6}" 
                  font-family="Brush Script MT, Dancing Script, Lucida Handwriting, cursive" 
                  font-size="18" fill="#047857" font-weight="normal" font-style="italic">
              ${escapeXml(field.value || '')}
            </text>
          `;
        
        case 'date':
          return `
            <text x="${x + 5}" y="${y + fieldHeight/2 + 5}" 
                  font-family="Arial" font-size="14" fill="#6b21a8">
              ${escapeXml(field.value || '')}
            </text>
          `;
        
        default:
          return `
            <rect x="${x}" y="${y}" width="${fieldWidth}" height="${fieldHeight}" 
                  fill="rgba(255,255,255,0.9)" stroke="#6b7280" stroke-width="1" rx="4"/>
            <text x="${x + 8}" y="${y + fieldHeight/2 + 5}" 
                  font-family="Arial" font-size="12" fill="#374151">
              ${escapeXml(field.value || '')}
            </text>
          `;
      }
    }).join('');

    const overlaysvg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        ${overlays}
      </svg>
    `;

    // Composite the overlay onto the base image
    const result = await baseImage
      .composite([{
        input: Buffer.from(overlaysvg),
        top: 0,
        left: 0
      }])
      .png()
      .toBuffer();

    return result;

  } catch (error: any) {
    console.warn(`[PDF_PROC] Failed to overlay fields, using original image:`, error.message);
    return pageImageBuffer;
  }
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, function (c) {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
    }
    return c;
  });
}