import { PDFDocument, rgb, StandardFonts, PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import * as fs from 'fs';
import * as path from 'path';
import { ObjectStorageService } from '../object-storage';

interface SignedField {
  id: number;
  type: string;
  x: string;
  y: string;
  width: string;
  height: string;
  page: number;
  value: string | null;
  completedAt: Date | null;
}

interface SignerInfo {
  name: string;
  email: string;
  signedAt: Date | null;
  ipAddress: string | null;
  location: string | null;
}

interface EnvelopeInfo {
  id: number;
  title: string;
  createdAt: Date;
  completedAt: Date | null;
}

/**
 * Generates a signed PDF with all signature fields overlaid on the original document
 */
export async function generateSignedPdf(
  originalPdfUrl: string,
  fields: SignedField[],
  signers: SignerInfo[],
  envelope: EnvelopeInfo
): Promise<Buffer> {
  // Fetch original PDF
  const storage = new ObjectStorageService();
  let pdfBytes: Buffer;

  if (originalPdfUrl.startsWith('http')) {
    // Full HTTP URL - fetch directly
    const response = await fetch(originalPdfUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch original PDF: ${response.statusText}`);
    }
    pdfBytes = Buffer.from(await response.arrayBuffer());
  } else if (originalPdfUrl.startsWith('/api/object-storage/')) {
    // Object storage URL - extract the key and download from storage
    // URL format: /api/object-storage/private/esign/templates/123/file.pdf
    // or: /api/object-storage/path/to/file.pdf
    const key = originalPdfUrl.replace('/api/object-storage/', '');
    console.log(`[ESIGN-PDF] Downloading PDF from object storage: ${key}`);
    pdfBytes = await storage.downloadBuffer(key);
  } else if (fs.existsSync(originalPdfUrl)) {
    // Local file path that exists
    pdfBytes = fs.readFileSync(originalPdfUrl);
  } else {
    throw new Error(`Cannot access PDF at: ${originalPdfUrl}`);
  }

  const pdfDoc = await PDFDocument.load(pdfBytes);
  pdfDoc.registerFontkit(fontkit);

  // Load fonts
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  let handwritingFont = helvetica;

  try {
    const fontPath = path.join(process.cwd(), 'public', 'fonts', 'handwritania.ttf');
    if (fs.existsSync(fontPath)) {
      const fontBytes = fs.readFileSync(fontPath);
      handwritingFont = await pdfDoc.embedFont(fontBytes);
    }
  } catch (e) {
    console.warn('[ESIGN-PDF] Could not load handwriting font, using Helvetica');
  }

  const pages = pdfDoc.getPages();

  // Overlay each field value onto the PDF
  for (const field of fields) {
    if (!field.value) continue;

    const pageIndex = field.page - 1;
    if (pageIndex < 0 || pageIndex >= pages.length) continue;

    const page = pages[pageIndex];
    const { width: pageWidth, height: pageHeight } = page.getSize();

    // Convert percentage coordinates to PDF coordinates
    const x = (parseFloat(field.x) / 100) * pageWidth;
    const y = (parseFloat(field.y) / 100) * pageHeight;
    const fieldWidth = (parseFloat(field.width) / 100) * pageWidth;
    const fieldHeight = (parseFloat(field.height) / 100) * pageHeight;

    // PDF coordinate system has origin at bottom-left
    const pdfY = pageHeight - y - fieldHeight;

    try {
      if (field.type === 'signature') {
        // Check if value is a data URL (image)
        if (field.value.startsWith('data:image')) {
          await embedSignatureImage(pdfDoc, page, field.value, x, pdfY, fieldWidth, fieldHeight);
        } else {
          // Text-based signature
          page.drawText(field.value, {
            x: x + 4,
            y: pdfY + fieldHeight / 3,
            size: Math.min(fieldHeight * 0.6, 24),
            font: handwritingFont,
            color: rgb(0.05, 0.05, 0.3),
          });
        }
      } else if (field.type === 'initials') {
        page.drawText(field.value, {
          x: x + 4,
          y: pdfY + fieldHeight / 3,
          size: Math.min(fieldHeight * 0.6, 18),
          font: handwritingFont,
          color: rgb(0.05, 0.05, 0.3),
        });
      } else {
        // Text, date, email, etc.
        page.drawText(field.value, {
          x: x + 4,
          y: pdfY + fieldHeight / 3,
          size: Math.min(fieldHeight * 0.5, 12),
          font: helvetica,
          color: rgb(0, 0, 0),
        });
      }
    } catch (drawError) {
      console.error(`[ESIGN-PDF] Error drawing field ${field.id}:`, drawError);
    }
  }

  // Save and return
  const signedPdfBytes = await pdfDoc.save();
  return Buffer.from(signedPdfBytes);
}

/**
 * Embeds a signature image into the PDF
 */
async function embedSignatureImage(
  pdfDoc: PDFDocument,
  page: PDFPage,
  dataUrl: string,
  x: number,
  y: number,
  width: number,
  height: number
): Promise<void> {
  try {
    const base64Data = dataUrl.split(',')[1];
    const imageBytes = Buffer.from(base64Data, 'base64');

    let image;
    if (dataUrl.includes('image/png')) {
      image = await pdfDoc.embedPng(imageBytes);
    } else if (dataUrl.includes('image/jpeg') || dataUrl.includes('image/jpg')) {
      image = await pdfDoc.embedJpg(imageBytes);
    } else {
      // Try PNG first, fallback to JPG
      try {
        image = await pdfDoc.embedPng(imageBytes);
      } catch {
        image = await pdfDoc.embedJpg(imageBytes);
      }
    }

    // Scale to fit while maintaining aspect ratio
    const imageAspectRatio = image.width / image.height;
    const fieldAspectRatio = width / height;

    let drawWidth = width;
    let drawHeight = height;
    let drawX = x;
    let drawY = y;

    if (imageAspectRatio > fieldAspectRatio) {
      drawHeight = width / imageAspectRatio;
      drawY += (height - drawHeight) / 2;
    } else {
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
    console.error('[ESIGN-PDF] Error embedding signature image:', error);
    throw error;
  }
}

/**
 * Generates a Certificate of Completion PDF
 */
export async function generateCertificateOfCompletion(
  envelope: EnvelopeInfo,
  signers: SignerInfo[],
  auditLog: Array<{
    action: string;
    actorName: string | null;
    actorEmail: string | null;
    createdAt: Date;
    ipAddress: string | null;
    location: string | null;
  }>
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const page = pdfDoc.addPage([612, 792]); // Letter size
  const { width, height } = page.getSize();

  let y = height - 60;

  // Header
  page.drawRectangle({
    x: 40,
    y: height - 100,
    width: width - 80,
    height: 60,
    color: rgb(0.03, 0.28, 0.5), // Dark blue
  });

  page.drawText('CERTIFICATE OF COMPLETION', {
    x: 50,
    y: height - 75,
    size: 22,
    font: helveticaBold,
    color: rgb(1, 1, 1),
  });

  y = height - 140;

  // Document Title
  page.drawText('Document:', {
    x: 50,
    y,
    size: 12,
    font: helveticaBold,
    color: rgb(0.3, 0.3, 0.3),
  });
  page.drawText(envelope.title, {
    x: 130,
    y,
    size: 12,
    font: helvetica,
    color: rgb(0, 0, 0),
  });

  y -= 20;

  // Envelope ID
  page.drawText('Envelope ID:', {
    x: 50,
    y,
    size: 12,
    font: helveticaBold,
    color: rgb(0.3, 0.3, 0.3),
  });
  page.drawText(`${envelope.id}`, {
    x: 130,
    y,
    size: 12,
    font: helvetica,
    color: rgb(0, 0, 0),
  });

  y -= 20;

  // Status
  page.drawText('Status:', {
    x: 50,
    y,
    size: 12,
    font: helveticaBold,
    color: rgb(0.3, 0.3, 0.3),
  });
  page.drawText('COMPLETED', {
    x: 130,
    y,
    size: 12,
    font: helveticaBold,
    color: rgb(0, 0.5, 0.2),
  });

  y -= 20;

  // Completed At
  if (envelope.completedAt) {
    page.drawText('Completed:', {
      x: 50,
      y,
      size: 12,
      font: helveticaBold,
      color: rgb(0.3, 0.3, 0.3),
    });
    page.drawText(new Date(envelope.completedAt).toLocaleString(), {
      x: 130,
      y,
      size: 12,
      font: helvetica,
      color: rgb(0, 0, 0),
    });
    y -= 20;
  }

  // Divider
  y -= 10;
  page.drawLine({
    start: { x: 50, y },
    end: { x: width - 50, y },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8),
  });
  y -= 20;

  // Signers section
  page.drawText('SIGNERS', {
    x: 50,
    y,
    size: 14,
    font: helveticaBold,
    color: rgb(0.2, 0.2, 0.2),
  });
  y -= 25;

  for (const signer of signers) {
    // Signer name and email
    page.drawText(signer.name, {
      x: 60,
      y,
      size: 11,
      font: helveticaBold,
      color: rgb(0, 0, 0),
    });
    page.drawText(`<${signer.email}>`, {
      x: 60 + helveticaBold.widthOfTextAtSize(signer.name, 11) + 8,
      y,
      size: 10,
      font: helvetica,
      color: rgb(0.4, 0.4, 0.4),
    });
    y -= 16;

    // Signed info
    if (signer.signedAt) {
      page.drawText(`Signed: ${new Date(signer.signedAt).toLocaleString()}`, {
        x: 70,
        y,
        size: 10,
        font: helvetica,
        color: rgb(0.4, 0.4, 0.4),
      });
      y -= 14;

      if (signer.ipAddress) {
        const locationInfo = signer.location ? ` (${signer.location})` : '';
        page.drawText(`IP: ${signer.ipAddress}${locationInfo}`, {
          x: 70,
          y,
          size: 10,
          font: helvetica,
          color: rgb(0.4, 0.4, 0.4),
        });
        y -= 14;
      }
    }
    y -= 10;
  }

  // Divider
  y -= 5;
  page.drawLine({
    start: { x: 50, y },
    end: { x: width - 50, y },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8),
  });
  y -= 20;

  // Audit Trail section
  page.drawText('AUDIT TRAIL', {
    x: 50,
    y,
    size: 14,
    font: helveticaBold,
    color: rgb(0.2, 0.2, 0.2),
  });
  y -= 25;

  // Table header
  page.drawText('Timestamp', {
    x: 60,
    y,
    size: 9,
    font: helveticaBold,
    color: rgb(0.3, 0.3, 0.3),
  });
  page.drawText('Action', {
    x: 180,
    y,
    size: 9,
    font: helveticaBold,
    color: rgb(0.3, 0.3, 0.3),
  });
  page.drawText('User', {
    x: 350,
    y,
    size: 9,
    font: helveticaBold,
    color: rgb(0.3, 0.3, 0.3),
  });
  y -= 15;

  const actionLabels: Record<string, string> = {
    envelope_created: 'Document Created',
    envelope_sent: 'Document Sent',
    recipient_sent: 'Invitation Sent',
    recipient_viewed: 'Document Viewed',
    field_completed: 'Field Completed',
    recipient_signed: 'Signature Applied',
    envelope_completed: 'Signing Completed',
    reminder_sent: 'Reminder Sent',
    recipient_declined: 'Declined',
    envelope_voided: 'Document Voided',
  };

  for (const entry of auditLog.slice(0, 15)) { // Limit to prevent overflow
    if (y < 80) break; // Stop if running out of space

    const timestamp = new Date(entry.createdAt).toLocaleString();
    const action = actionLabels[entry.action] || entry.action;
    const user = entry.actorName || entry.actorEmail || 'System';

    page.drawText(timestamp.substring(0, 20), {
      x: 60,
      y,
      size: 8,
      font: helvetica,
      color: rgb(0.4, 0.4, 0.4),
    });
    page.drawText(action.substring(0, 25), {
      x: 180,
      y,
      size: 8,
      font: helvetica,
      color: rgb(0.4, 0.4, 0.4),
    });
    page.drawText(user.substring(0, 30), {
      x: 350,
      y,
      size: 8,
      font: helvetica,
      color: rgb(0.4, 0.4, 0.4),
    });
    y -= 12;
  }

  // Footer
  page.drawText('This certificate verifies the integrity and authenticity of the electronically signed document.', {
    x: 50,
    y: 50,
    size: 8,
    font: helvetica,
    color: rgb(0.5, 0.5, 0.5),
  });
  page.drawText('Generated by CIM Share E-Signature System', {
    x: 50,
    y: 38,
    size: 8,
    font: helvetica,
    color: rgb(0.5, 0.5, 0.5),
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

/**
 * Combines the signed PDF and certificate into a single PDF
 */
export async function combineSignedPdfWithCertificate(
  signedPdf: Buffer,
  certificate: Buffer
): Promise<Buffer> {
  const signedDoc = await PDFDocument.load(signedPdf);
  const certDoc = await PDFDocument.load(certificate);

  // Copy all pages from certificate to signed document
  const certPages = await signedDoc.copyPages(certDoc, certDoc.getPageIndices());
  for (const page of certPages) {
    signedDoc.addPage(page);
  }

  const combinedBytes = await signedDoc.save();
  return Buffer.from(combinedBytes);
}
