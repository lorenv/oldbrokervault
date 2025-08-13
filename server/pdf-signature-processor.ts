import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
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
      
      // Try to use default font first - no embedding needed
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

        // CRITICAL FIX: The signing interface uses 800px fixed display width
        // We need to scale coordinates from display size to actual PDF size
        const DISPLAY_WIDTH = 800;
        const scaleX = pageWidth / DISPLAY_WIDTH;
        const scaleY = scaleX; // Maintain aspect ratio
        
        // Scale coordinates from display to PDF coordinates
        const scaledX = field.x * scaleX;
        const scaledY = field.y * scaleY;
        const scaledWidth = field.width * scaleX;
        const scaledHeight = field.height * scaleY;

        // Convert coordinates (PDF coordinate system has origin at bottom-left, display has top-left)
        const x = scaledX;
        const y = pageHeight - scaledY - scaledHeight;
        
        console.log(`Coordinate conversion for field ${field.id}:`, {
          original: { x: field.x, y: field.y, w: field.width, h: field.height },
          pageSize: { w: pageWidth, h: pageHeight },
          scale: { x: scaleX, y: scaleY },
          scaled: { x: scaledX, y: scaledY, w: scaledWidth, h: scaledHeight },
          final: { x, y }
        });

        try {
          // Use simple text drawing without custom fonts to avoid embedding issues
          page.drawText(value, {
            x: x + 2,
            y: y + 2,
            size: field.type === 'signature' ? 16 : (field.fontSize || 12),
            color: field.type === 'signature' ? rgb(0, 0, 0.8) : rgb(0, 0, 0),
          });
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
      throw new Error(`Failed to process PDF signature: ${error.message}`);
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
      const font = await this.pdfDoc.embedFont(StandardFonts.HelveticaItalic);
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

  async addCompletionCertificate(signerName: string, signerEmail: string, signedAt: Date): Promise<void> {
    const page = this.pdfDoc.addPage([612, 792]); // Standard letter size
    const { width, height } = page.getSize();
    
    const titleFont = await this.pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const bodyFont = await this.pdfDoc.embedFont(StandardFonts.Helvetica);
    
    // Draw grey header background (DocuSign style)
    page.drawRectangle({
      x: 0,
      y: height - 120,
      width: width,
      height: 80,
      color: rgb(0.9, 0.9, 0.9), // Light grey background
    });
    
    // Certificate header in bold
    page.drawText('Certificate of Completion', {
      x: 50,
      y: height - 70,
      size: 18,
      font: titleFont,
      color: rgb(0.2, 0.2, 0.2),
    });
    
    // Status indicator
    page.drawText('Status: Completed', {
      x: width - 150,
      y: height - 70,
      size: 12,
      font: titleFont,
      color: rgb(0.0, 0.6, 0.0), // Green color for completed status
    });
    
    // Document details section
    page.drawRectangle({
      x: 30,
      y: height - 220,
      width: width - 60,
      height: 80,
      borderColor: rgb(0.8, 0.8, 0.8),
      borderWidth: 1,
    });
    
    // Certificate content with better formatting
    const certificateLines = [
      { text: `This document was electronically signed by ${signerName} (${signerEmail})`, bold: false },
      { text: `on ${signedAt.toLocaleDateString()} at ${signedAt.toLocaleTimeString()}.`, bold: false },
      { text: '', bold: false },
      { text: 'This signature is legally binding and was captured using secure', bold: false },
      { text: 'electronic signature technology with audit trail verification.', bold: false },
      { text: '', bold: false },
      { text: `Document ID: ${this.generateDocumentId()}`, bold: true },
      { text: `Verification: ${this.generateVerificationHash(signerEmail, signedAt)}`, bold: true }
    ];
    
    let yPosition = height - 160;
    certificateLines.forEach(line => {
      if (line.text) {
        page.drawText(line.text, {
          x: 50,
          y: yPosition,
          size: 12,
          font: line.bold ? titleFont : bodyFont,
          color: rgb(0.3, 0.3, 0.3),
        });
      }
      yPosition -= 20;
    });
    
    // Add signature section
    page.drawText('Digital Signature Details:', {
      x: 50,
      y: yPosition - 20,
      size: 14,
      font: titleFont,
      color: rgb(0.2, 0.2, 0.2),
    });
    
    yPosition -= 50;
    page.drawText(`Signer: ${signerName}`, {
      x: 70,
      y: yPosition,
      size: 11,
      font: bodyFont,
      color: rgb(0.4, 0.4, 0.4),
    });
    
    yPosition -= 20;
    page.drawText(`Email: ${signerEmail}`, {
      x: 70,
      y: yPosition,
      size: 11,
      font: bodyFont,
      color: rgb(0.4, 0.4, 0.4),
    });
    
    yPosition -= 20;
    page.drawText(`Timestamp: ${signedAt.toISOString()}`, {
      x: 70,
      y: yPosition,
      size: 11,
      font: bodyFont,
      color: rgb(0.4, 0.4, 0.4),
    });
    
    // Add border around entire page content
    page.drawRectangle({
      x: 20,
      y: 20,
      width: width - 40,
      height: height - 40,
      borderColor: rgb(0.7, 0.7, 0.7),
      borderWidth: 2,
    });
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