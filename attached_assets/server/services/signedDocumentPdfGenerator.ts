import { Document, Recipient, SignatureField, AuditTrail } from "@shared/schema";
import { storage } from "../storage";
import sharp from 'sharp';
import PDFDocument from 'pdfkit';
import fs from 'fs/promises';
import path from 'path';

interface SignedDocumentData {
  document: Document;
  recipients: Recipient[];
  auditTrail: AuditTrail[];
  completedAt: Date;
}

/**
 * Generate a complete PDF with the original document pages showing signature overlays
 */
export async function generateSignedDocumentPDF(data: SignedDocumentData): Promise<{ filename: string; content: string; type: string }> {
  try {
    console.log('[PDF_GEN] 📄 Starting signed document PDF generation...');
    console.log(`[PDF_GEN] Document: ${data.document.title} (ID: ${data.document.id})`);
    
    // Get all signature fields for this document
    const allFields = await storage.getFieldsByDocument(data.document.id);
    const fieldsWithValues = allFields.filter(field => field.value && field.value.trim() !== '');
    
    console.log(`[PDF_GEN] Found ${allFields.length} signature fields`);
    fieldsWithValues.forEach((field, index) => {
      console.log(`[PDF_GEN] Field ${index + 1}: type="${field.type}", page=${field.pageNumber}, value="${field.value}", hasValue=${!!field.value}`);
    });
    
    // Create PDF document
    const pdfDoc = new PDFDocument({ margin: 0, size: 'A4' });
    const chunks: Buffer[] = [];
    
    pdfDoc.on('data', chunk => chunks.push(chunk));
    
    const pdfPromise = new Promise<Buffer>((resolve) => {
      pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    // Process each page of the document
    const pageCount = data.document.pageCount || 1;
    
    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      console.log(`[PDF_GEN] Processing page ${pageNum}/${pageCount}`);
      
      // Get the page image from object storage - will throw if not found
      const imageBuffer = await getDocumentPageImage(data.document.id, pageNum);
      
      // Get fields for this specific page
      const pageFields = fieldsWithValues.filter(field => field.pageNumber === pageNum);
      console.log(`[PDF_GEN] Page ${pageNum}: found ${allFields.filter(f => f.pageNumber === pageNum).length} total fields`);
      
      if (pageFields.length > 0) {
        console.log(`[PDF_GEN] Page ${pageNum} Field ${pageFields.length > 0 ? 1 : 0}: "${pageFields[0]?.type}" = "${pageFields[0]?.value}" at (${pageFields[0]?.x}, ${pageFields[0]?.y})`);
        console.log(`[PDF_GEN] Page ${pageNum}: overlaying ${pageFields.length} fields with values`);
      } else {
        console.log(`[PDF_GEN] Page ${pageNum}: no fields with values to overlay`);
      }
      
      // Overlay signature fields onto the page image
      let processedImageBuffer = imageBuffer;
      if (pageFields.length > 0) {
        processedImageBuffer = await overlaySignatureFields(imageBuffer, pageFields);
      }
      
      // Add page to PDF
      if (pageNum > 1) {
        pdfDoc.addPage({ margin: 0, size: 'A4' });
      }
      
      // Scale image to fit A4 page (595x842 points)
      const { width: imgWidth, height: imgHeight } = await sharp(processedImageBuffer).metadata();
      const scaleX = 595 / (imgWidth || 595);
      const scaleY = 842 / (imgHeight || 842);
      const scale = Math.min(scaleX, scaleY);
      
      const finalWidth = (imgWidth || 595) * scale;
      const finalHeight = (imgHeight || 842) * scale;
      const x = (595 - finalWidth) / 2;
      const y = (842 - finalHeight) / 2;
      
      pdfDoc.image(processedImageBuffer, x, y, { width: finalWidth, height: finalHeight });
    }
    
    // Add certificate of completion as final page
    console.log('[PDF_GEN] Adding certificate of completion...');
    const certificateBuffer = await generateCertificatePage(data);
    
    pdfDoc.addPage({ margin: 0, size: 'A4' });
    pdfDoc.image(certificateBuffer, 0, 0, { width: 595, height: 842 });
    console.log(`[PDF_GEN] ✅ Certificate page generated: ${certificateBuffer.length} bytes`);
    
    // Finalize PDF
    pdfDoc.end();
    const pdfBuffer = await pdfPromise;
    
    console.log(`[PDF_GEN] ✅ PDF generated: ${pdfBuffer.length} bytes`);
    
    const filename = `${sanitizeFilename(data.document.title)}_completed.pdf`;
    
    return {
      filename,
      content: pdfBuffer.toString('base64'),
      type: 'application/pdf'
    };

  } catch (error: any) {
    console.error(`[PDF_GEN] ❌ Failed to generate PDF:`, error);
    throw new Error(`Failed to generate signed document PDF: ${error.message}`);
  }
}

/**
 * Get document page image from object storage - no fallbacks
 */
async function getDocumentPageImage(documentId: number, pageNumber: number): Promise<Buffer> {
  try {
    // Use the documentProcessor service which properly handles object storage
    const { getDocumentImage } = await import('./documentProcessor');
    const imageBuffer = await getDocumentImage(documentId, pageNumber);
    
    if (!imageBuffer) {
      throw new Error(`No image found for document ${documentId}, page ${pageNumber} in object storage`);
    }
    
    console.log(`[PDF_GEN] ✅ Loaded page ${pageNumber} image: ${imageBuffer.length} bytes`);
    return imageBuffer;
  } catch (error) {
    const errorMsg = `Failed to load page image for document ${documentId}, page ${pageNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    console.error(`[PDF_GEN] ❌ ${errorMsg}`);
    throw new Error(errorMsg);
  }
}

/**
 * Overlay signature field values onto a document page image
 */
async function overlaySignatureFields(pageImageBuffer: Buffer, fields: SignatureField[]): Promise<Buffer> {
  try {
    console.log(`[PDF_GEN] Starting overlay for ${fields.length} fields on ${(await sharp(pageImageBuffer).metadata()).width}x${(await sharp(pageImageBuffer).metadata()).height} image`);
    
    // Get the base image dimensions
    const baseImage = sharp(pageImageBuffer);
    const { width, height } = await baseImage.metadata();
    
    if (!width || !height) {
      throw new Error('Could not determine image dimensions');
    }

    // Create SVG overlay with all signature fields
    const overlayElements = fields.map(field => {
      // Coordinates are already in pixels, just use them directly
      const x = Math.round(field.x);
      const y = Math.round(field.y);
      const fieldWidth = Math.round(field.width) || 150;
      const fieldHeight = Math.round(field.height) || 40;

      console.log(`[PDF_GEN] Creating overlay for "${field.value}" at (${x}, ${y}) on ${width}x${height} image`);

      // Use saved font size or calculate from height as fallback
      const fontSize = field.fontSize || Math.max(12, Math.min(24, Math.floor(fieldHeight * 0.5)));
      
      // Create overlay based on field type
      switch (field.type) {
        case 'signature':
          return `
            <text x="${x + 5}" y="${y + fieldHeight/2 + 7}" 
                  font-family="Brush Script MT, Dancing Script, Lucida Handwriting, cursive" font-size="${fontSize + 4}" fill="#1e40af" font-weight="normal" font-style="italic">
              ${escapeXml(field.value || '')}
            </text>
          `;
        
        case 'initials':
          return `
            <text x="${x + fieldWidth/2}" y="${y + fieldHeight/2 + 6}" 
                  font-family="Brush Script MT, Dancing Script, Lucida Handwriting, cursive" font-size="${fontSize + 2}" fill="#047857" font-weight="normal" font-style="italic" text-anchor="middle">
              ${escapeXml((field.value || '').substring(0, 3))}
            </text>
          `;
          
        case 'date':
          return `
            <text x="${x + 5}" y="${y + fieldHeight/2 + 6}" 
                  font-family="Arial, sans-serif" font-size="${fontSize}" fill="#991b1b" font-weight="600">
              ${escapeXml(field.value || '')}
            </text>
          `;
          
        case 'text':
        case 'name':
        case 'email':
          return `
            <text x="${x + 10}" y="${y + fieldHeight/2 + 6}" 
                  font-family="Arial, sans-serif" font-size="${fontSize}" fill="#5b21b6" font-weight="500">
              ${escapeXml(field.value || '')}
            </text>
          `;
          
        case 'checkbox':
          const isChecked = field.value === 'true' || field.value === 'checked';
          return `
            ${isChecked ? `
              <path d="M${x + 5} ${y + Math.min(fieldWidth, fieldHeight)/2} l${Math.min(fieldWidth, fieldHeight)/4} ${Math.min(fieldWidth, fieldHeight)/4} l${Math.min(fieldWidth, fieldHeight)/2} -${Math.min(fieldWidth, fieldHeight)/2}" 
                    stroke="#047857" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
            ` : ''}
          `;
          
        default:
          return `
            <text x="${x + 10}" y="${y + fieldHeight/2 + 6}" 
                  font-family="Arial, sans-serif" font-size="${fontSize}" fill="#374151">
              ${escapeXml(field.value || '')}
            </text>
          `;
      }
    }).join('');

    // Create complete SVG
    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        ${overlayElements}
      </svg>
    `;

    // Convert SVG to buffer and composite with base image
    const svgBuffer = Buffer.from(svg);
    
    const result = await baseImage
      .composite([{ 
        input: svgBuffer, 
        top: 0, 
        left: 0 
      }])
      .png({ 
        quality: 95,
        compressionLevel: 4,
        force: true 
      })
      .toBuffer();
      
    console.log(`[PDF_GEN] ✅ Overlay completed successfully`);
    return result;

  } catch (error: any) {
    console.error(`[PDF_GEN] ❌ Failed to overlay fields:`, error);
    // Return original image if overlay fails
    return pageImageBuffer;
  }
}

/**
 * Generate certificate of completion page
 */
async function generateCertificatePage(data: SignedDocumentData): Promise<Buffer> {
  try {
    // Import the new PDF certificate generator
    const { generateCertificateOfCompletion } = await import('./certificateGenerator');
    
    // Generate the high-quality PDF certificate and get the image path
    const certificatePath = await generateCertificateOfCompletion({
      document: data.document,
      recipients: data.recipients,
      auditTrail: data.auditTrail,
      completedAt: data.completedAt
    });
    
    // Read the generated certificate image from disk
    const { promises: fs } = await import('fs');
    const path = await import('path');
    
    const fullImagePath = path.join(process.cwd(), 'uploads', 'images', certificatePath);
    
    try {
      const certificateBuffer = await fs.readFile(fullImagePath);
      console.log(`[PDF_GEN] ✅ High-quality certificate loaded from: ${fullImagePath}`);
      return certificateBuffer;
    } catch (error) {
      console.error(`[PDF_GEN] ❌ Failed to load certificate from ${fullImagePath}:`, error);
      throw error;
    }
  } catch (error) {
    console.error(`[PDF_GEN] ❌ Failed to generate PDF certificate, falling back to simple version:`, error);
    
    // Fallback: create a simple certificate page
    const fallbackSvg = `
      <svg width="612" height="792" xmlns="http://www.w3.org/2000/svg">
        <rect width="612" height="792" fill="#ffffff"/>
        <rect x="50" y="50" width="512" height="120" fill="#2563eb" rx="8"/>
        <text x="306" y="100" font-family="Arial, sans-serif" font-size="24" fill="white" font-weight="bold" text-anchor="middle">
          Certificate of Completion
        </text>
        <text x="306" y="130" font-family="Arial, sans-serif" font-size="14" fill="white" text-anchor="middle">
          Digital Signature Verification
        </text>
        <text x="100" y="220" font-family="Arial, sans-serif" font-size="16" fill="#1f2937" font-weight="bold">
          Document: ${escapeXml(data.document.title)}
        </text>
        <text x="100" y="250" font-family="Arial, sans-serif" font-size="14" fill="#6b7280">
          Completed: ${data.completedAt.toLocaleDateString()}
        </text>
        <text x="100" y="280" font-family="Arial, sans-serif" font-size="14" fill="#6b7280">
          Total Signatures: ${data.recipients.filter(r => r.status === 'signed').length}
        </text>
        <text x="100" y="320" font-family="Arial, sans-serif" font-size="12" fill="#9ca3af">
          High-quality PDF certificate generation failed - using fallback
        </text>
      </svg>
    `;
    
    return sharp(Buffer.from(fallbackSvg))
      .png({ quality: 95, compressionLevel: 4 })
      .toBuffer();
  }
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-z0-9\-_\s]/gi, '').replace(/\s+/g, '_');
}