import { Buffer } from 'buffer';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fromBuffer } from 'pdf2pic';
import sharp from 'sharp';
import docx2pdf from 'docx2pdf';
import { db } from '../db';
import { documentImages, templateImages, type InsertDocumentImage, type InsertTemplateImage } from '@shared/schema';
import { ObjectStorageService } from '../objectStorage';

interface ProcessedDocument {
  pageCount: number;
  imageUrls: string[];
}

interface FileUpload {
  buffer: Buffer;
  originalname: string;
}

export async function processDocument(file: FileUpload, id: number, isTemplate: boolean = false): Promise<ProcessedDocument & { fileContent?: string; fileStorageUrl: string }> {
  const fileExtension = file.originalname.split('.').pop()?.toLowerCase();
  
  try {
    // Store original file in object storage
    const objectStorageService = new ObjectStorageService();
    const privateDir = objectStorageService.getPrivateObjectDir();
    const fileStorageKey = `${privateDir}/${isTemplate ? 'templates' : 'documents'}/${id}/${file.originalname}`;
    const fileUploadResult = await objectStorageService.uploadFile(fileStorageKey, file.buffer, `application/${fileExtension}`);
    
    // For new uploads, prioritize object storage over base64
    // Only generate base64 for legacy support if needed
    const fileContent = undefined; // No longer storing base64 for new uploads
    
    let processedDoc: ProcessedDocument;
    if (fileExtension === 'pdf') {
      processedDoc = await processPDF(file, id, isTemplate);
    } else if (['doc', 'docx'].includes(fileExtension || '')) {
      processedDoc = await processWordDocument(file, id, isTemplate);
    } else {
      throw new Error(`Unsupported file type: ${fileExtension}`);
    }
    
    return {
      ...processedDoc,
      fileContent, // undefined for new uploads
      fileStorageUrl: fileUploadResult.url
    };
  } catch (error) {
    console.error('Document processing error:', error);
    throw new Error('Failed to process document');
  }
}

async function processPDF(file: FileUpload, id: number, isTemplate: boolean = false): Promise<ProcessedDocument> {
  const tempDir = path.join(process.cwd(), 'temp', `${isTemplate ? 'template' : 'doc'}-${id}`);
  
  try {
    // Create temporary directory
    await fs.mkdir(tempDir, { recursive: true });
    
    // Convert PDF to images using pdf2pic with optimized settings for speed
    const convert = fromBuffer(file.buffer, {
      density: 150,           // Reduced DPI for faster processing
      saveFilename: "page",
      savePath: tempDir,
      format: "png",
      width: 600,             // Reduced resolution for faster processing
      height: 825             // Proportional height
    });
    
    // Convert all pages
    const results = await convert.bulk(-1); // -1 means all pages
    const pageCount = results.length;
    const imageUrls: string[] = [];
    
    // Process images in parallel batches for better performance
    const batchSize = 2; // Process 2 pages at a time for faster response
    for (let i = 0; i < results.length; i += batchSize) {
      const batch = results.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (pageResult, batchIndex) => {
        const pageIndex = i + batchIndex;
        if (pageResult.path) {
          try {
            // Read and compress image for storage
            const imageBuffer = await fs.readFile(pageResult.path);
            
            // Optimize image with Sharp for faster processing
            const optimizedBuffer = await sharp(imageBuffer)
              .png({ compressionLevel: 6, quality: 85 }) // Faster compression for quicker processing
              .toBuffer();
            
            // Store image in object storage
            const objectStorageService = new ObjectStorageService();
            const privateDir = objectStorageService.getPrivateObjectDir();
            const storageKey = `${privateDir}/${isTemplate ? 'templates' : 'documents'}/${id}/pages/page-${pageIndex + 1}.png`;
            const uploadResult = await objectStorageService.uploadFile(storageKey, optimizedBuffer, 'image/png');
            
            // Store in database with object storage URL
            if (isTemplate) {
              await db.insert(templateImages).values({
                templateId: id,
                pageNumber: pageIndex + 1,
                imageStorageUrl: uploadResult.url,
                imageData: undefined // New uploads use object storage only
              });
              // Use object storage URL
              imageUrls[pageIndex] = uploadResult.url;
            } else {
              await db.insert(documentImages).values({
                documentId: id,
                pageNumber: pageIndex + 1,
                imageStorageUrl: uploadResult.url,
                imageData: undefined // New uploads use object storage only
              });
              // Use object storage URL
              imageUrls[pageIndex] = uploadResult.url;
            }
          } catch (error) {
            console.error(`Failed to process page ${pageIndex + 1}:`, error);
            throw error;
          }
        }
      }));
    }
    
    // Clean up temporary directory asynchronously (don't block response)
    fs.rm(tempDir, { recursive: true, force: true }).catch(() => {
      // Silent cleanup failure - not critical for user experience
    });
    
    return {
      pageCount,
      imageUrls,
    };

  } catch (error) {
    console.error('PDF processing error:', error);
    // Clean up on error (async)
    fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    throw new Error('Failed to process PDF document');
  }
}

async function processWordDocument(file: FileUpload, id: number, isTemplate: boolean = false): Promise<ProcessedDocument> {
  const tempDir = path.join(process.cwd(), 'temp', `${isTemplate ? 'template' : 'doc'}-${id}`);
  const cacheDir = path.join(process.cwd(), 'cache', 'pdfs');
  
  try {
    // Create directories
    await fs.mkdir(tempDir, { recursive: true });
    await fs.mkdir(cacheDir, { recursive: true });
    
    // Save Word document to temporary file (reduced logging for performance)
    const wordPath = path.join(tempDir, file.originalname);
    await fs.writeFile(wordPath, file.buffer);
    
    // Convert Word to PDF
    const pdfFilename = `${path.parse(file.originalname).name}.pdf`;
    const pdfPath = path.join(tempDir, pdfFilename);
    const cachedPdfPath = path.join(cacheDir, `${isTemplate ? 'template' : 'doc'}-${id}-${pdfFilename}`);
    
    // Set Chromium path as environment variable for docx2pdf
    // Use the confirmed working path for Replit environment
    const chromiumPath = '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium';
    process.env.PUPPETEER_EXECUTABLE_PATH = chromiumPath;
    
    // Use docx2pdf to convert with detailed logging
    console.log(`[WORD_PROC] Starting PDF conversion for: ${file.originalname}`);
    console.log(`[WORD_PROC] Word file path: ${wordPath}`);
    console.log(`[WORD_PROC] Chromium path: ${chromiumPath}`);
    
    // Add additional Puppeteer environment variables for better compatibility
    process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = 'true';
    process.env.PUPPETEER_DISABLE_SANDBOXING = 'true';
    
    // Skip docx2pdf entirely since it consistently times out - go straight to mammoth
    console.log(`[WORD_PROC] Using mammoth + puppeteer conversion (optimized path)...`);
    
    try {
      // Kill any existing chromium processes first
      try {
        await new Promise((resolve) => {
          require('child_process').exec('pkill -f chromium', () => resolve(null));
        });
      } catch {}
      
      // Direct fallback to mammoth + puppeteer approach
      const mammoth = await import('mammoth');
      const result = await mammoth.convertToHtml({ path: wordPath });
      const html = result.value;
        
        // Use puppeteer to convert HTML to PDF with timeout
        const puppeteer = await import('puppeteer');
        
        const browserPromise = puppeteer.launch({
          executablePath: chromiumPath,
          args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-web-security',
            '--single-process',
            '--no-first-run'
          ],
          headless: true,
          timeout: 30000
        });
        
        const browser = await Promise.race([
          browserPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Browser launch timeout')), 30000))
        ]) as any;
        
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 15000 });
        
        const convertedPdfPath = wordPath.replace(/\.(docx?|DOCX?)$/, '.pdf');
        
        const pdfPromise = page.pdf({ 
          path: convertedPdfPath, 
          format: 'A4',
          printBackground: true,
          margin: {
            top: '1in',
            right: '1in', 
            bottom: '1in',
            left: '1in'
          }
        });
        
        await Promise.race([
          pdfPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('PDF generation timeout')), 20000))
        ]);
        
      await browser.close();
      console.log(`[WORD_PROC] ✅ Conversion successful using mammoth + puppeteer`);
      
    } catch (conversionError: any) {
      console.log(`[WORD_PROC] ❌ Conversion failed: ${conversionError.message}`);
      
      // List files in temp directory for debugging
      try {
        const files = await fs.readdir(tempDir);
        console.log(`[WORD_PROC] Files in temp directory after conversion attempt:`, files);
      } catch {
        console.log(`[WORD_PROC] Could not list temp directory after conversion`);
      }
      
      throw new Error(`PDF conversion failed: ${conversionError.message}`);
    }
    
    // The converted PDF will be in the same directory with .pdf extension
    const convertedPdfPath = wordPath.replace(/\.(docx?|DOCX?)$/, '.pdf');
    console.log(`[WORD_PROC] Expected PDF output: ${convertedPdfPath}`);
    
    // Check if PDF was created and read it
    let pdfBuffer: Buffer;
    try {
      // Check if file exists first
      await fs.access(convertedPdfPath);
      pdfBuffer = await fs.readFile(convertedPdfPath);
      console.log(`[WORD_PROC] ✅ PDF file found, size: ${pdfBuffer.length} bytes`);
    } catch (statError: any) {
      console.log(`[WORD_PROC] ❌ PDF file not found: ${statError.message}`);
      
      // List files in directory to debug
      try {
        const files = await fs.readdir(tempDir);
        console.log(`[WORD_PROC] Files in temp directory:`, files);
      } catch {
        console.log(`[WORD_PROC] Could not list temp directory`);
      }
      
      throw new Error(`PDF conversion failed - output file not found at ${convertedPdfPath}`);
    }
    
    // Cache the PDF for future use (async, don't wait)
    fs.copyFile(convertedPdfPath, cachedPdfPath).catch(() => {
      // Silent failure for caching - not critical for main flow
    });
    
    // Now process the PDF using our existing PDF processing function
    const pdfFileUpload = {
      buffer: pdfBuffer,
      originalname: pdfFilename
    };
    
    // Now process the PDF using optimized PDF processing
    const result = await processPDF(pdfFileUpload, id, isTemplate);
    
    return result;
    
  } catch (error: any) {
    throw new Error(`Failed to process Word document: ${error.message}`);
  } finally {
    // Clean up temporary files asynchronously (don't block response)
    fs.rm(tempDir, { recursive: true, force: true }).catch(() => {
      // Silent cleanup failure - not critical for user experience
    });
  }
}

export async function getDocumentImage(documentId: number, pageNumber: number): Promise<Buffer | null> {
  try {
    const result = await db.query.documentImages.findFirst({
      where: (images, { and, eq }) => and(
        eq(images.documentId, documentId),
        eq(images.pageNumber, pageNumber)
      )
    });
    
    if (!result) {
      throw new Error(`Document image not found: Document ID ${documentId}, Page ${pageNumber}. This image may not have been uploaded or processed correctly.`);
    }
    
    // Only use object storage - no fallback to base64
    if (!result.imageStorageUrl) {
      throw new Error(`Object storage URL missing for document image: Document ID ${documentId}, Page ${pageNumber}. The image may not have been migrated to object storage yet. Please contact support or run the migration process.`);
    }

    try {
      // Use ObjectStorageService to download the image
      const objectStorageService = new ObjectStorageService();
      const imageBuffer = await objectStorageService.downloadFile(result.imageStorageUrl);
      
      if (!imageBuffer || imageBuffer.length === 0) {
        throw new Error(`Empty or corrupted image retrieved from object storage: Document ID ${documentId}, Page ${pageNumber}. The file may be corrupted or missing from storage.`);
      }
      
      return imageBuffer;
    } catch (storageError: any) {
      throw new Error(`Failed to download image from object storage: Document ID ${documentId}, Page ${pageNumber}, Storage URL: ${result.imageStorageUrl}. Error: ${storageError.message}. Please verify object storage connectivity and file integrity.`);
    }
  } catch (error: any) {
    console.error('Error retrieving document image:', error);
    throw error; // Re-throw to provide detailed error to caller
  }
}

export async function getTemplateImage(templateId: number, pageNumber: number): Promise<Buffer | null> {
  try {
    const result = await db.query.templateImages.findFirst({
      where: (images, { and, eq }) => and(
        eq(images.templateId, templateId),
        eq(images.pageNumber, pageNumber)
      )
    });
    
    if (!result) {
      throw new Error(`Template image not found: Template ID ${templateId}, Page ${pageNumber}. This image may not have been uploaded or processed correctly.`);
    }
    
    // Only use object storage - no fallback to base64
    if (!result.imageStorageUrl) {
      throw new Error(`Object storage URL missing for template image: Template ID ${templateId}, Page ${pageNumber}. The image may not have been migrated to object storage yet. Please contact support or run the migration process.`);
    }

    try {
      // Use ObjectStorageService to download the image
      const objectStorageService = new ObjectStorageService();
      const imageBuffer = await objectStorageService.downloadFile(result.imageStorageUrl);
      
      if (!imageBuffer || imageBuffer.length === 0) {
        throw new Error(`Empty or corrupted image retrieved from object storage: Template ID ${templateId}, Page ${pageNumber}. The file may be corrupted or missing from storage.`);
      }
      
      return imageBuffer;
    } catch (storageError: any) {
      throw new Error(`Failed to download image from object storage: Template ID ${templateId}, Page ${pageNumber}, Storage URL: ${result.imageStorageUrl}. Error: ${storageError.message}. Please verify object storage connectivity and file integrity.`);
    }
  } catch (error: any) {
    console.error('Error retrieving template image:', error);
    throw error; // Re-throw to provide detailed error to caller
  }
}

export async function getDocumentFile(documentId: number): Promise<Buffer | null> {
  try {
    const result = await db.query.documents.findFirst({
      where: (docs, { eq }) => eq(docs.id, documentId)
    });
    
    if (!result) {
      throw new Error(`Document not found: Document ID ${documentId}. This document may not exist or may have been deleted.`);
    }
    
    // Only use object storage - no fallback to base64
    if (!result.fileStorageUrl) {
      throw new Error(`Object storage URL missing for document file: Document ID ${documentId}. The file may not have been migrated to object storage yet. Please contact support or run the migration process.`);
    }

    try {
      // Use ObjectStorageService to download the file
      const objectStorageService = new ObjectStorageService();
      const fileBuffer = await objectStorageService.downloadFile(result.fileStorageUrl);
      
      if (!fileBuffer || fileBuffer.length === 0) {
        throw new Error(`Empty or corrupted file retrieved from object storage: Document ID ${documentId}. The file may be corrupted or missing from storage.`);
      }
      
      return fileBuffer;
    } catch (storageError: any) {
      throw new Error(`Failed to download file from object storage: Document ID ${documentId}, Storage URL: ${result.fileStorageUrl}. Error: ${storageError.message}. Please verify object storage connectivity and file integrity.`);
    }
  } catch (error: any) {
    console.error('Error retrieving document file:', error);
    throw error; // Re-throw to provide detailed error to caller
  }
}

export async function getTemplateFile(templateId: number): Promise<Buffer | null> {
  try {
    const result = await db.query.templates.findFirst({
      where: (templates, { eq }) => eq(templates.id, templateId)
    });
    
    if (!result) {
      throw new Error(`Template not found: Template ID ${templateId}. This template may not exist or may have been deleted.`);
    }
    
    // Only use object storage - no fallback to base64
    if (!result.fileStorageUrl) {
      throw new Error(`Object storage URL missing for template file: Template ID ${templateId}. The file may not have been migrated to object storage yet. Please contact support or run the migration process.`);
    }

    try {
      // Extract storage key from URL
      const url = new URL(result.fileStorageUrl, 'http://localhost');
      const storageKey = url.pathname.replace('/storage/undersigned-storage/', '');
      const objectStorageService = new ObjectStorageService();
      const fileBuffer = await objectStorageService.downloadFile(result.fileStorageUrl);
      
      if (!fileBuffer || fileBuffer.length === 0) {
        throw new Error(`Empty or corrupted file retrieved from object storage: Template ID ${templateId}, Storage Key: ${storageKey}. The file may be corrupted or missing from storage.`);
      }
      
      return fileBuffer;
    } catch (storageError: any) {
      throw new Error(`Failed to download file from object storage: Template ID ${templateId}, Storage URL: ${result.fileStorageUrl}. Error: ${storageError.message}. Please verify object storage connectivity and file integrity.`);
    }
  } catch (error: any) {
    console.error('Error retrieving template file:', error);
    throw error; // Re-throw to provide detailed error to caller
  }
}