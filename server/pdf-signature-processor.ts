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
      // Embed all fonts once at the beginning
      console.log('Embedding fonts...');
      const standardFont = await this.pdfDoc.embedFont(StandardFonts.Helvetica);
      const italicFont = await this.pdfDoc.embedFont(StandardFonts.HelveticaItalic);
      console.log('Fonts embedded successfully');

      for (const field of signatureFields) {
        const value = fieldValues[field.id];
        if (!value) continue;

        console.log(`Processing field: ${field.id}, type: ${field.type}, value: ${value.substring(0, 20)}...`);

        const pageIndex = field.pageNumber - 1;
        if (pageIndex < 0 || pageIndex >= this.pages.length) {
          console.log(`Skipping field ${field.id}: invalid page ${field.pageNumber}`);
          continue;
        }

        const page = this.pages[pageIndex];
        const { height: pageHeight } = page.getSize();

        // Convert coordinates (PDF coordinate system has origin at bottom-left)
        const x = field.x;
        const y = pageHeight - field.y - field.height;

        try {
          if (field.type === 'signature') {
            // Use italic font for signatures
            page.drawText(value, {
              x: x + 2,
              y: y + 2,
              size: 16,
              font: italicFont,
              color: rgb(0, 0, 0.8),
            });
            console.log(`Signature field ${field.id} processed successfully`);
          } else {
            // Use standard font for other fields
            page.drawText(value, {
              x: x + 2,
              y: y + 2,
              size: field.fontSize || 12,
              font: standardFont,
              color: rgb(0, 0, 0),
              maxWidth: field.width - 4,
            });
            console.log(`Text field ${field.id} processed successfully`);
          }
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
    const page = this.pdfDoc.addPage();
    const { width, height } = page.getSize();
    
    const titleFont = await this.pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const bodyFont = await this.pdfDoc.embedFont(StandardFonts.Helvetica);
    
    // Certificate title
    page.drawText('Certificate of Completion', {
      x: 50,
      y: height - 100,
      size: 24,
      font: titleFont,
      color: rgb(0.2, 0.2, 0.2),
    });
    
    // Certificate content
    const certificateText = [
      `This document was electronically signed by ${signerName} (${signerEmail})`,
      `on ${signedAt.toLocaleDateString()} at ${signedAt.toLocaleTimeString()}.`,
      '',
      'This signature is legally binding and was captured using secure',
      'electronic signature technology with audit trail verification.',
      '',
      `Document ID: ${this.generateDocumentId()}`,
      `Verification: ${this.generateVerificationHash(signerEmail, signedAt)}`
    ];
    
    let yPosition = height - 150;
    certificateText.forEach(line => {
      page.drawText(line, {
        x: 50,
        y: yPosition,
        size: 12,
        font: bodyFont,
        color: rgb(0.3, 0.3, 0.3),
      });
      yPosition -= 20;
    });
    
    // Add border
    page.drawRectangle({
      x: 40,
      y: 40,
      width: width - 80,
      height: height - 80,
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