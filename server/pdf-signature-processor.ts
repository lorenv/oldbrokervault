import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import * as fs from 'fs';
import * as path from 'path';

interface SignatureField {
  id: string;
  type: 'signature' | 'name' | 'date' | 'email' | 'text';
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pageNumber: number;
  required: boolean;
  fontSize: number;
  placeholder?: string;
}

interface FieldValue {
  [fieldId: string]: string;
}

export class PdfSignatureProcessor {
  private pdfDoc: PDFDocument;
  private pages: any[];

  constructor(pdfDoc: PDFDocument) {
    this.pdfDoc = pdfDoc;
    this.pages = this.pdfDoc.getPages();
  }

  static async fromBase64(base64Content: string): Promise<PdfSignatureProcessor> {
    const pdfBytes = Buffer.from(base64Content, 'base64');
    const pdfDoc = await PDFDocument.load(pdfBytes);
    return new PdfSignatureProcessor(pdfDoc);
  }

  async embedFields(signatureFields: SignatureField[], fieldValues: FieldValue): Promise<string> {
    try {
      console.log('Starting PDF field embedding...');

      // Register fontkit to enable custom font embedding
      this.pdfDoc.registerFontkit(fontkit);

      // Load handwriting font for signature fields
      const fontPath = path.join(process.cwd(), 'public', 'fonts', 'handwritania.ttf');
      const fontBytes = fs.readFileSync(fontPath);
      const handwritingFont = await this.pdfDoc.embedFont(fontBytes);

      const pages = this.pdfDoc.getPages();
      console.log(`PDF has ${pages.length} pages, processing ${signatureFields.length} fields`);

      for (const field of signatureFields) {
        const value = fieldValues[field.id];
        if (!value) continue;

        console.log(`Processing field: ${field.id}, type: ${field.type}, page: ${field.pageNumber}`);

        const pageIndex = field.pageNumber - 1;
        if (pageIndex < 0 || pageIndex >= pages.length) {
          console.log(`Skipping field ${field.id}: invalid page ${field.pageNumber}`);
          continue;
        }

        const page = pages[pageIndex];
        const { width: pageWidth, height: pageHeight } = page.getSize();

        // CRITICAL FIX: Signature fields are stored as PERCENTAGE coordinates (0-100%)
        // Convert percentage coordinates to actual PDF coordinates
        
        // Convert percentage to pixel coordinates on PDF page
        const pixelX = (field.x / 100) * pageWidth;
        const pixelY = (field.y / 100) * pageHeight;
        const pixelWidth = (field.width / 100) * pageWidth;
        const pixelHeight = (field.height / 100) * pageHeight;

        // Convert coordinates (PDF coordinate system has origin at bottom-left, display has top-left)
        const x = pixelX;
        const y = pageHeight - pixelY - pixelHeight;
        
        console.log(`Coordinate conversion for field ${field.id}:`, {
          originalPercent: { x: field.x, y: field.y, w: field.width, h: field.height },
          pageSize: { w: pageWidth, h: pageHeight },
          pixelCoords: { x: pixelX, y: pixelY, w: pixelWidth, h: pixelHeight },
          final: { x, y }
        });

        try {
          // Use handwriting font for signature fields, standard for others
          const drawOptions: any = {
            x: x + 2,
            y: y + 2,
            size: field.type === 'signature' ? 20 : (field.fontSize || 12),
            color: field.type === 'signature' ? rgb(0.1, 0.1, 0.4) : rgb(0, 0, 0),
          };

          // Apply handwriting font only to signature fields
          if (field.type === 'signature') {
            drawOptions.font = handwritingFont;
          }

          page.drawText(value, drawOptions);
          console.log(`Field ${field.id} processed successfully`);
        } catch (drawError) {
          console.error(`Error drawing field ${field.id}:`, drawError);
          // Continue processing other fields
        }
      }

      console.log('Saving PDF...');
      const pdfBytes = await this.pdfDoc.save();
      const base64Result = Buffer.from(pdfBytes).toString('base64');
      console.log('PDF saved successfully, size:', base64Result.length);
      return base64Result;

    } catch (error) {
      console.error('Error in embedFields:', error);
      throw new Error(`Failed to process PDF signature: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async embedSignatureImage(page: any, signatureDataUrl: string, x: number, y: number, width: number, height: number) {
    try {
      // Extract base64 data from data URL
      const base64Data = signatureDataUrl.split(',')[1];
      const imageBytes = Buffer.from(base64Data, 'base64');
      
      // Embed PNG image
      const image = await this.pdfDoc.embedPng(imageBytes);
      
      // Calculate scaling to fit within the field while maintaining aspect ratio
      const imageAspectRatio = image.width / image.height;
      const fieldAspectRatio = width / height;
      
      let drawWidth = width;
      let drawHeight = height;
      let drawX = x;
      let drawY = y;
      
      if (imageAspectRatio > fieldAspectRatio) {
        // Image is wider, scale by width
        drawHeight = width / imageAspectRatio;
        drawY += (height - drawHeight) / 2;
      } else {
        // Image is taller, scale by height
        drawWidth = height * imageAspectRatio;
        drawX += (width - drawWidth) / 2;
      }
      
      page.drawImage(image, {
        x: drawX,
        y: drawY,
        width: drawWidth,
        height: drawHeight,
      });
    } catch (error) {
      console.error('Error embedding signature image:', error);
      // Fallback to text if image embedding fails
      const font = await this.pdfDoc.embedFont(StandardFonts.Helvetica);
      page.drawText('[Signature]', {
        x: x + 5,
        y: y + height / 2,
        size: 12,
        font,
        color: rgb(0.5, 0.5, 0.5),
      });
    }
  }

  private async embedTextField(
    page: any, 
    text: string, 
    x: number, 
    y: number, 
    width: number, 
    height: number, 
    fontSize: number,
    font: any
  ) {
    // Calculate text position (center vertically within field)
    const textY = y + (height - fontSize) / 2;
    
    // Truncate text if it's too long for the field
    let displayText = text;
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    
    if (textWidth > width - 10) {
      // Truncate text to fit with some padding
      const availableWidth = width - 20; // 10px padding on each side
      let truncatedText = text;
      
      while (font.widthOfTextAtSize(truncatedText + '...', fontSize) > availableWidth && truncatedText.length > 0) {
        truncatedText = truncatedText.slice(0, -1);
      }
      
      displayText = truncatedText + (truncatedText.length < text.length ? '...' : '');
    }
    
    page.drawText(displayText, {
      x: x + 5, // 5px left padding
      y: textY,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    });
  }

  async addCompletionCertificate(signerName: string, signerEmail: string, signedAt: Date, signerIpAddress?: string): Promise<void> {
    try {
      const page = this.pdfDoc.addPage([612, 792]); // Standard letter size
      const { width, height } = page.getSize();

      const titleFont = await this.pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const bodyFont = await this.pdfDoc.embedFont(StandardFonts.Helvetica);

      // Clean page border
      page.drawRectangle({
        x: 30,
        y: 30,
        width: width - 60,
        height: height - 60,
        borderColor: rgb(0.7, 0.7, 0.7),
        borderWidth: 2,
      });

      // Header section with clean grey background
      page.drawRectangle({
        x: 40,
        y: height - 120,
        width: width - 80,
        height: 70,
        color: rgb(0.94, 0.94, 0.94), // Very light grey background
      });

      // Certificate title
      page.drawText('Certificate of Completion', {
        x: 60,
        y: height - 80,
        size: 18,
        font: titleFont,
        color: rgb(0.2, 0.2, 0.2),
      });

      // Status indicator (right aligned)
      const statusText = 'Status: Completed';
      page.drawText(statusText, {
        x: width - 175,
        y: height - 80,
        size: 12,
        font: titleFont,
        color: rgb(0.0, 0.6, 0.0), // Green color for completed status
      });

      // Certificate content with better spacing
      let yPosition = height - 160;

      const maxLineWidth = width - 120; // Leave margin for text overflow prevention
      const signatureText = `This document was electronically signed by ${signerName} (${signerEmail})`;

      // Split long text if needed
      if (bodyFont.widthOfTextAtSize(signatureText, 12) > maxLineWidth) {
        page.drawText(`This document was electronically signed by ${signerName}`, {
          x: 60,
          y: yPosition,
          size: 12,
          font: bodyFont,
          color: rgb(0.3, 0.3, 0.3),
        });
        yPosition -= 18;
        page.drawText(`(${signerEmail})`, {
          x: 60,
          y: yPosition,
          size: 12,
          font: bodyFont,
          color: rgb(0.3, 0.3, 0.3),
        });
      } else {
        page.drawText(signatureText, {
          x: 60,
          y: yPosition,
          size: 12,
          font: bodyFont,
          color: rgb(0.3, 0.3, 0.3),
        });
      }

      yPosition -= 25;
      page.drawText(`on ${signedAt.toLocaleDateString()} at ${signedAt.toLocaleTimeString()}.`, {
        x: 60,
        y: yPosition,
        size: 12,
        font: bodyFont,
        color: rgb(0.3, 0.3, 0.3),
      });

      // Add space before the legal text
      yPosition -= 25;
      page.drawText('This signature is legally binding and was captured using secure', {
        x: 60,
        y: yPosition,
        size: 11,
        font: bodyFont,
        color: rgb(0.4, 0.4, 0.4),
      });

      yPosition -= 16;
      page.drawText('electronic signature technology with audit trail verification.', {
        x: 60,
        y: yPosition,
        size: 11,
        font: bodyFont,
        color: rgb(0.4, 0.4, 0.4),
      });

      // Document IDs section
      yPosition -= 40;
      page.drawText(`Document ID: ${this.generateDocumentId()}`, {
        x: 60,
        y: yPosition,
        size: 10,
        font: titleFont,
        color: rgb(0.2, 0.2, 0.2),
      });

      yPosition -= 20;
      page.drawText(`Verification: ${this.generateVerificationHash(signerEmail, signedAt)}`, {
        x: 60,
        y: yPosition,
        size: 10,
        font: titleFont,
        color: rgb(0.2, 0.2, 0.2),
      });

      // Digital signature details section
      yPosition -= 40;
      page.drawText('Digital Signature Details:', {
        x: 60,
        y: yPosition,
        size: 14,
        font: titleFont,
        color: rgb(0.2, 0.2, 0.2),
      });

      // Details with proper indentation
      yPosition -= 30;
      page.drawText(`Signer: ${signerName}`, {
        x: 80,
        y: yPosition,
        size: 11,
        font: bodyFont,
        color: rgb(0.4, 0.4, 0.4),
      });

      yPosition -= 20;
      page.drawText(`Email: ${signerEmail}`, {
        x: 80,
        y: yPosition,
        size: 11,
        font: bodyFont,
        color: rgb(0.4, 0.4, 0.4),
      });

      yPosition -= 20;
      page.drawText(`Timestamp: ${signedAt.toISOString()}`, {
        x: 80,
        y: yPosition,
        size: 11,
        font: bodyFont,
        color: rgb(0.4, 0.4, 0.4),
      });

      // Add IP address if provided
      if (signerIpAddress) {
        yPosition -= 20;
        page.drawText(`IP Address: ${signerIpAddress}`, {
          x: 80,
          y: yPosition,
          size: 11,
          font: bodyFont,
          color: rgb(0.4, 0.4, 0.4),
        });
      }
    } catch (error) {
      console.error('❌ Error creating completion certificate:', error);
      throw new Error(`Failed to create certificate: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private generateDocumentId(): string {
    return `DOC-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  }

  private generateVerificationHash(email: string, signedAt: Date): string {
    const data = `${email}-${signedAt.getTime()}`;
    return Buffer.from(data).toString('base64').substr(0, 16).toUpperCase();
  }

  async save(): Promise<Buffer> {
    const pdfBytes = await this.pdfDoc.save();
    return Buffer.from(pdfBytes);
  }

  async saveAsBase64(): Promise<string> {
    const buffer = await this.save();
    return buffer.toString('base64');
  }
}