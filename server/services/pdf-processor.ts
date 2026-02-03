import { Buffer } from 'buffer';
import * as fs from 'fs/promises';
import * as path from 'path';
import sharp from 'sharp';
import { ObjectStorageService } from '../object-storage';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fromBuffer } from 'pdf2pic';

const execAsync = promisify(exec);

interface PageInfo {
  url: string;
  width: number;
  height: number;
}

interface ProcessedDocument {
  pageCount: number;
  imageUrls: string[];
  pages: PageInfo[];
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

    // Convert PDF to images using pdf2pic with optimized settings - preserve original proportions
    const convert = fromBuffer(file.buffer, {
      density: 150,           // DPI for conversion quality
      saveFilename: "page",
      savePath: tempDir,
      format: "png",
      width: 1200,            // Set width, let height auto-scale to preserve aspect ratio
      preserveAspectRatio: true,
      quality: 85             // Good quality with reasonable file size
    });
    
    console.log(`[PDF_PROC] Converting PDF pages...`);
    
    // Convert all pages
    const results = await convert.bulk(-1); // -1 means all pages
    const pageCount = results.length;
    const imageUrls: string[] = [];
    const pages: PageInfo[] = [];

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

            // Get image metadata for orientation detection and dimensions
            const metadata = await sharp(optimizedBuffer).metadata();
            const imageWidth = metadata.width || 612;
            const imageHeight = metadata.height || 792;
            const isLandscape = imageWidth > imageHeight;

            // Store image in object storage
            const objectStorageService = new ObjectStorageService();
            const storageKey = `private/${isTemplate ? 'templates' : 'documents'}/${id}/pages/page-${pageIndex + 1}.png`;
            const uploadResult = await objectStorageService.uploadBuffer(storageKey, optimizedBuffer, 'image/png');

            console.log(`[PDF_PROC] Processed page ${pageIndex + 1}: ${uploadResult.url} (${imageWidth}x${imageHeight}, ${isLandscape ? 'landscape' : 'portrait'})`);

            // Store URL and dimensions in the correct order
            imageUrls[pageIndex] = uploadResult.url;
            pages[pageIndex] = {
              url: uploadResult.url,
              width: imageWidth,
              height: imageHeight
            };

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
      pages: pages.filter(p => p), // Remove any undefined entries
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

/**
 * Process any LibreOffice-supported document format to images.
 * Supports: Word (.docx, .doc), Excel (.xlsx, .xls), PowerPoint (.pptx, .ppt),
 * OpenDocument (.odt, .ods, .odp), RTF, and more.
 */
export async function processDocumentToImages(file: FileUpload, id: number, isTemplate: boolean = false): Promise<ProcessedDocument> {
  const tempDir = path.join(process.cwd(), 'temp', `${isTemplate ? 'template' : 'doc'}-convert-${id}`);

  try {
    console.log(`[DOC_PROC] Starting document processing for ${file.originalname}`);

    // Create temporary directory
    await fs.mkdir(tempDir, { recursive: true });

    // Write the document to a temp file
    const inputPath = path.join(tempDir, file.originalname);
    await fs.writeFile(inputPath, file.buffer);
    console.log(`[DOC_PROC] Written input file: ${inputPath}`);

    // Use LibreOffice to convert document to PDF (preserves all formatting)
    const pdfOutputDir = path.join(tempDir, 'pdf');
    await fs.mkdir(pdfOutputDir, { recursive: true });

    console.log(`[DOC_PROC] Converting document to PDF using LibreOffice...`);
    try {
      await execAsync(
        `libreoffice --headless --convert-to pdf --outdir "${pdfOutputDir}" "${inputPath}"`,
        { timeout: 120000 } // 120 second timeout for large spreadsheets/presentations
      );
    } catch (loError: any) {
      console.error('[DOC_PROC] LibreOffice conversion failed:', loError);
      throw new Error(`LibreOffice conversion failed: ${loError.message}`);
    }

    // Find the generated PDF
    const pdfFiles = await fs.readdir(pdfOutputDir);
    const pdfFile = pdfFiles.find(f => f.toLowerCase().endsWith('.pdf'));

    if (!pdfFile) {
      throw new Error('LibreOffice did not generate a PDF file');
    }

    const pdfPath = path.join(pdfOutputDir, pdfFile);
    const pdfBuffer = await fs.readFile(pdfPath);
    console.log(`[DOC_PROC] PDF generated: ${pdfPath} (${pdfBuffer.length} bytes)`);

    // Now convert the PDF to images using the existing method
    const imagesDir = path.join(tempDir, 'images');
    await fs.mkdir(imagesDir, { recursive: true });

    const convert = fromBuffer(pdfBuffer, {
      density: 150,
      saveFilename: "page",
      savePath: imagesDir,
      format: "png",
      width: 1200,
      preserveAspectRatio: true,
      quality: 85
    });

    console.log(`[DOC_PROC] Converting PDF pages to images...`);
    const results = await convert.bulk(-1);
    const pageCount = results.length;
    const imageUrls: string[] = [];
    const pages: PageInfo[] = [];

    console.log(`[DOC_PROC] Processing ${pageCount} pages`);

    // Process images in parallel batches
    const batchSize = 3;
    for (let i = 0; i < results.length; i += batchSize) {
      const batch = results.slice(i, i + batchSize);

      await Promise.all(batch.map(async (pageResult, batchIndex) => {
        const pageIndex = i + batchIndex;
        if (pageResult.path) {
          try {
            const imageBuffer = await fs.readFile(pageResult.path);

            const optimizedBuffer = await sharp(imageBuffer)
              .png({
                compressionLevel: 6,
                quality: 85,
                progressive: true
              })
              .toBuffer();

            const metadata = await sharp(optimizedBuffer).metadata();
            const imageWidth = metadata.width || 612;
            const imageHeight = metadata.height || 792;
            const isLandscape = imageWidth > imageHeight;

            const objectStorageService = new ObjectStorageService();
            const storageKey = `private/${isTemplate ? 'templates' : 'documents'}/${id}/pages/page-${pageIndex + 1}.png`;
            const uploadResult = await objectStorageService.uploadBuffer(storageKey, optimizedBuffer, 'image/png');

            console.log(`[DOC_PROC] Processed page ${pageIndex + 1}: ${uploadResult.url} (${imageWidth}x${imageHeight}, ${isLandscape ? 'landscape' : 'portrait'})`);

            imageUrls[pageIndex] = uploadResult.url;
            pages[pageIndex] = {
              url: uploadResult.url,
              width: imageWidth,
              height: imageHeight
            };

          } catch (error) {
            console.error(`[DOC_PROC] Failed to process page ${pageIndex + 1}:`, error);
            throw error;
          }
        }
      }));
    }

    // Clean up temporary directory
    fs.rm(tempDir, { recursive: true, force: true }).catch(() => {
      console.warn(`[DOC_PROC] Failed to clean up temp directory: ${tempDir}`);
    });

    console.log(`[DOC_PROC] Successfully processed ${pageCount} pages from document`);

    return {
      pageCount,
      imageUrls: imageUrls.filter(url => url),
      pages: pages.filter(p => p),
    };

  } catch (error) {
    console.error('[DOC_PROC] Document processing error:', error);
    fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});

    if (error instanceof Error) {
      throw new Error(`Document processing failed: ${error.message}`);
    }
    throw new Error('Failed to process document: Unknown error occurred');
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