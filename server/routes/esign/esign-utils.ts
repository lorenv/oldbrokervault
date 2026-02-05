/**
 * E-Sign Shared Utilities
 * Helper functions used across esign route modules
 */

import { Request } from 'express';
import { db } from '../../db';
import { esignEnvelopes, esignAuditLog } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import multer from 'multer';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import mammoth from 'mammoth';
import { sanitizeExtension } from '../../utils/sanitize-filename';

// Configure multer for document uploads - accepts PDF, Word, Excel, PowerPoint
export const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      // PDF
      'application/pdf',
      // Word documents
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/msword', // .doc
      'application/vnd.oasis.opendocument.text', // .odt
      'application/rtf', // .rtf
      'text/rtf',
      // Excel spreadsheets
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'application/vnd.oasis.opendocument.spreadsheet', // .ods
      'text/csv', // .csv
      // PowerPoint presentations
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
      'application/vnd.ms-powerpoint', // .ppt
      'application/vnd.oasis.opendocument.presentation', // .odp
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, Word, Excel, and PowerPoint documents are allowed'));
    }
  },
});

// Configure multer for image uploads - accepts common image formats
export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for images
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, GIF, WebP, SVG) are allowed'));
    }
  },
});

// Keep 'upload' as alias for documentUpload for backwards compatibility
export const upload = documentUpload;

// Helper to get client IP
export function getClientIP(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || '';
}

// Helper to get location from IP (using cloud-based geo-ip service)
export async function getLocationFromIP(ip: string): Promise<string> {
  try {
    const { lookupIp } = await import('../../services/geo-ip-service');
    const geo = await lookupIp(ip);
    if (geo) {
      const parts = [geo.city, geo.region, geo.country].filter(Boolean);
      return parts.join(', ') || 'Unknown';
    }
  } catch (e) {
    console.error('Geoip lookup failed:', e);
  }
  return 'Unknown';
}

// Generate unique envelope ID (UUID format with prefix)
export function generateEnvelopeId(): string {
  const uuid = crypto.randomUUID().replace(/-/g, '');
  return `env_${uuid}`;
}

// Generate SHA-256 hash of document for integrity verification (E-SIGN Act compliance)
export function generateDocumentHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// Helper to find envelope by ID (supports both UUID and numeric ID)
export async function findEnvelopeById(idParam: string, userId: number) {
  if (idParam.startsWith('env_')) {
    // Lookup by envelopeId (UUID)
    const [envelope] = await db
      .select()
      .from(esignEnvelopes)
      .where(and(
        eq(esignEnvelopes.envelopeId, idParam),
        eq(esignEnvelopes.userId, userId)
      ))
      .limit(1);
    return envelope;
  } else {
    // Lookup by numeric ID (backwards compatible)
    const numericId = parseInt(idParam);
    if (isNaN(numericId)) return null;
    const [envelope] = await db
      .select()
      .from(esignEnvelopes)
      .where(and(
        eq(esignEnvelopes.id, numericId),
        eq(esignEnvelopes.userId, userId)
      ))
      .limit(1);
    return envelope;
  }
}

// Helper to log audit events
export async function logAuditEvent(
  envelopeId: number,
  action: string,
  details: Record<string, any> = {},
  req?: Request,
  recipientId?: number
) {
  try {
    await db.insert(esignAuditLog).values({
      envelopeId,
      recipientId: recipientId || null,
      action,
      details,
      ipAddress: req ? getClientIP(req) : null,
      userAgent: req?.get('User-Agent') || null,
      location: req ? await getLocationFromIP(getClientIP(req)) : null,
    });
  } catch (e) {
    console.error('Failed to log audit event:', e);
  }
}

// Parse HTML to plain text with basic formatting markers
function parseHtmlToText(html: string): string {
  // Remove scripts and styles
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Handle headings (make them bold with extra spacing)
  text = text.replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, '\n\n**$1**\n\n');

  // Handle bold/strong
  text = text.replace(/<(b|strong)[^>]*>([\s\S]*?)<\/(b|strong)>/gi, '**$2**');

  // Handle paragraphs
  text = text.replace(/<p[^>]*>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n');

  // Handle line breaks
  text = text.replace(/<br\s*\/?>/gi, '\n');

  // Handle list items
  text = text.replace(/<li[^>]*>/gi, '\n• ');
  text = text.replace(/<\/li>/gi, '');

  // Handle divs and other block elements
  text = text.replace(/<div[^>]*>/gi, '\n');
  text = text.replace(/<\/div>/gi, '\n');

  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");

  // Replace tabs with spaces (WinAnsi encoding doesn't support tabs)
  text = text.replace(/\t/g, '    ');

  // Remove other control characters that WinAnsi can't encode (except newline and carriage return)
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

  // Clean up excessive whitespace
  text = text.replace(/\n\s*\n\s*\n/g, '\n\n');
  text = text.trim();

  return text;
}

// Sanitize text for WinAnsi encoding (used by pdf-lib standard fonts)
function sanitizeForWinAnsi(text: string): string {
  // Replace tabs with spaces
  let sanitized = text.replace(/\t/g, '    ');
  // Remove control characters except newline (0x0A) and carriage return (0x0D)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  // Replace any remaining non-WinAnsi characters with a placeholder
  sanitized = sanitized.replace(/[^\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '?');
  return sanitized;
}

// Word wrap text to fit within maxWidth
function wrapText(text: string, font: any, fontSize: number, maxWidth: number): string[] {
  // Sanitize text for WinAnsi encoding before processing
  const sanitizedText = sanitizeForWinAnsi(text);
  const words = sanitizedText.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    try {
      const testWidth = font.widthOfTextAtSize(testLine, fontSize);

      if (testWidth <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          lines.push(currentLine);
        }
        currentLine = word;
      }
    } catch (e) {
      // If encoding still fails, skip this word
      console.warn(`[ESIGN] Skipping word due to encoding error: "${word.substring(0, 20)}..."`);
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = '';
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [''];
}

// Helper to convert Word to PDF using mammoth and pdf-lib
export async function convertWordToPdf(buffer: Buffer, filename: string): Promise<Buffer> {
  try {
    console.log(`[ESIGN] Converting Word document: ${filename} (${buffer.length} bytes)`);

    // Validate buffer is not empty
    if (!buffer || buffer.length === 0) {
      throw new Error('Empty file buffer received');
    }

    // Check for valid DOCX magic bytes (PK zip header)
    const isZipFile = buffer[0] === 0x50 && buffer[1] === 0x4B;
    if (!isZipFile && filename.toLowerCase().endsWith('.docx')) {
      console.warn('[ESIGN] File claims to be DOCX but does not have ZIP header');
    }

    // Check if this is an old .doc format (mammoth only supports .docx)
    if (filename.toLowerCase().endsWith('.doc') && !filename.toLowerCase().endsWith('.docx')) {
      const isOldDoc = buffer[0] === 0xD0 && buffer[1] === 0xCF && buffer[2] === 0x11 && buffer[3] === 0xE0;
      if (isOldDoc) {
        throw new Error('Old .doc format is not supported. Please save the document as .docx and try again.');
      }
    }

    console.log('[ESIGN] Extracting HTML from Word document using mammoth...');

    // Extract HTML from the Word document
    let result;
    try {
      result = await mammoth.convertToHtml({ buffer });
    } catch (mammothError: any) {
      console.error('[ESIGN] Mammoth extraction error:', mammothError);
      throw new Error(`Could not read Word document: ${mammothError.message}`);
    }

    const html = result.value;

    console.log(`[ESIGN] Mammoth extracted ${html.length} characters of HTML`);

    // Log any warnings from mammoth
    if (result.messages && result.messages.length > 0) {
      console.log('[ESIGN] Mammoth conversion messages:', result.messages);
    }

    // Create a new PDF document
    const pdfDoc = await PDFDocument.create();
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Parse HTML and convert to plain text with basic formatting
    const textContent = parseHtmlToText(html);

    // Split content into pages (approximately 50 lines per page)
    const lines = textContent.split('\n');
    const linesPerPage = 50;
    const fontSize = 11;
    const lineHeight = 14;
    const margin = 50;
    const pageWidth = 612;  // Letter size
    const pageHeight = 792;
    const maxLineWidth = pageWidth - (margin * 2);

    let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;
    let lineCount = 0;

    for (const line of lines) {
      // Check if we need a new page
      if (lineCount >= linesPerPage || y < margin + lineHeight) {
        currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
        lineCount = 0;
      }

      // Handle bold text (indicated by ** markers from our parser)
      const isBold = line.startsWith('**') && line.endsWith('**');
      const font = isBold ? helveticaBold : helvetica;
      const text = isBold ? line.slice(2, -2) : line;

      // Word wrap if line is too long
      const wrappedLines = wrapText(text, font, fontSize, maxLineWidth);

      for (const wrappedLine of wrappedLines) {
        if (y < margin + lineHeight) {
          currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
          y = pageHeight - margin;
          lineCount = 0;
        }

        currentPage.drawText(wrappedLine, {
          x: margin,
          y,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
        });

        y -= lineHeight;
        lineCount++;
      }
    }

    // If no content, add a blank page
    if (pdfDoc.getPageCount() === 0) {
      pdfDoc.addPage([pageWidth, pageHeight]);
    }

    const pdfBytes = await pdfDoc.save();
    console.log(`[ESIGN] Successfully converted Word document to PDF (${pdfDoc.getPageCount()} pages)`);

    return Buffer.from(pdfBytes);
  } catch (error: any) {
    console.error('[ESIGN] Word to PDF conversion failed:', error);
    throw new Error(`Failed to convert Word document: ${error.message}`);
  }
}

// LibreOffice-supported document formats
export const libreOfficeFormats = {
  // Word documents
  word: ['docx', 'doc', 'odt', 'rtf'],
  wordMimes: [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/vnd.oasis.opendocument.text',
    'application/rtf',
    'text/rtf'
  ],
  // Excel spreadsheets
  excel: ['xlsx', 'xls', 'ods', 'csv'],
  excelMimes: [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/vnd.oasis.opendocument.spreadsheet',
    'text/csv'
  ],
  // PowerPoint presentations
  powerpoint: ['pptx', 'ppt', 'odp'],
  powerpointMimes: [
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-powerpoint',
    'application/vnd.oasis.opendocument.presentation'
  ]
};

export function isLibreOfficeSupported(mimetype: string, fileExt: string): boolean {
  return libreOfficeFormats.word.includes(fileExt) ||
    libreOfficeFormats.wordMimes.includes(mimetype) ||
    libreOfficeFormats.excel.includes(fileExt) ||
    libreOfficeFormats.excelMimes.includes(mimetype) ||
    libreOfficeFormats.powerpoint.includes(fileExt) ||
    libreOfficeFormats.powerpointMimes.includes(mimetype);
}

export function getDocumentType(mimetype: string, fileExt: string): string {
  if (libreOfficeFormats.word.includes(fileExt) || libreOfficeFormats.wordMimes.includes(mimetype)) {
    return 'Word';
  }
  if (libreOfficeFormats.excel.includes(fileExt) || libreOfficeFormats.excelMimes.includes(mimetype)) {
    return 'Excel';
  }
  return 'PowerPoint';
}
