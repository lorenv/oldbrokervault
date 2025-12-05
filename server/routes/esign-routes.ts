import { Router, Request, Response } from 'express';
import { db } from '../db';
import {
  userBranding,
  esignTemplates,
  esignEnvelopes,
  esignRecipients,
  esignFields,
  esignAuditLog,
  users,
  getFullName,
  insertUserBrandingSchema,
  insertEsignTemplateSchema,
  insertEsignEnvelopeSchema,
  ESIGN_RECIPIENT_COLORS,
  ESIGN_CC_COLOR
} from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { z } from 'zod';
import multer from 'multer';
import { processPDFToImages } from '../services/pdf-processor';
import { ObjectStorageService } from '../object-storage';
import { generateSecureToken } from '../token-utils';
import {
  sendEsignInvitationEmail,
  sendEsignReminderEmail,
  sendEsignCompletedEmail,
  sendEsignDeclinedEmail,
  sendEsignVoidedEmail
} from '../email';
import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import mammoth from 'mammoth';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import {
  generateSignedPdf,
  generateCertificateOfCompletion,
  combineSignedPdfWithCertificate
} from '../services/esign-pdf-generator';
import { summarizeDocumentForSigner } from '../openai';
import * as pdfParseModule from 'pdf-parse';
const pdfParse = (pdfParseModule as any).default || pdfParseModule;

const router = Router();

// Configure multer for document uploads - accepts PDF and Word documents
const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/msword', // .doc
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and Word documents are allowed'));
    }
  },
});

// Configure multer for image uploads - accepts common image formats
const imageUpload = multer({
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
const upload = documentUpload;

// Helper to get client IP
function getClientIP(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || '';
}

// Helper to get location from IP (simplified)
async function getLocationFromIP(ip: string): Promise<string> {
  try {
    // Dynamic import to avoid type issues
    // @ts-ignore - geoip-lite has no type definitions
    const geoipModule = await import('geoip-lite') as any;
    const geoip = geoipModule.default || geoipModule;
    const geo = geoip.lookup(ip);
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
function generateEnvelopeId(): string {
  const uuid = crypto.randomUUID().replace(/-/g, '');
  return `env_${uuid}`;
}

// Generate SHA-256 hash of document for integrity verification (E-SIGN Act compliance)
function generateDocumentHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// Helper to find envelope by ID (supports both UUID and numeric ID)
async function findEnvelopeById(idParam: string, userId: number) {
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
async function logAuditEvent(
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

// Helper to convert Word to PDF using mammoth and pdf-lib
async function convertWordToPdf(buffer: Buffer, filename: string): Promise<Buffer> {
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
      // Check for old .doc magic bytes (D0 CF 11 E0 - OLE compound document)
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

  // Clean up excessive whitespace
  text = text.replace(/\n\s*\n\s*\n/g, '\n\n');
  text = text.trim();

  return text;
}

// Word wrap text to fit within maxWidth
function wrapText(text: string, font: any, fontSize: number, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);

    if (testWidth <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [''];
}

// ============================================================================
// BRANDING ROUTES
// ============================================================================

// Get user branding settings
router.get('/branding', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const [branding] = await db
      .select()
      .from(userBranding)
      .where(eq(userBranding.userId, req.user.id))
      .limit(1);

    res.json(branding || {
      logoUrl: null,
      primaryColor: '#0072CE',
      companyName: req.user.businessName || '',
      emailFromName: null,
    });
  } catch (error) {
    console.error('[ESIGN] Error fetching branding:', error);
    res.status(500).json({ error: 'Failed to fetch branding settings' });
  }
});

// Update user branding settings
router.put('/branding', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validated = insertUserBrandingSchema.parse(req.body);

    // Check if branding exists
    const [existing] = await db
      .select()
      .from(userBranding)
      .where(eq(userBranding.userId, req.user.id))
      .limit(1);

    if (existing) {
      // Update
      const [updated] = await db
        .update(userBranding)
        .set({
          ...validated,
          updatedAt: new Date(),
        })
        .where(eq(userBranding.userId, req.user.id))
        .returning();
      res.json(updated);
    } else {
      // Insert
      const [created] = await db
        .insert(userBranding)
        .values({
          userId: req.user.id,
          ...validated,
        })
        .returning();
      res.json(created);
    }
  } catch (error) {
    console.error('[ESIGN] Error updating branding:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid branding data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to update branding settings' });
  }
});

// Upload branding logo
router.post('/branding/logo', imageUpload.single('logo'), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Logo file is required' });
    }

    // Upload to object storage
    const objectStorage = new ObjectStorageService();
    const ext = path.extname(req.file.originalname) || '.png';
    const storageKey = `private/branding/${req.user.id}/logo${ext}`;
    const result = await objectStorage.uploadBuffer(storageKey, req.file.buffer, req.file.mimetype);

    // Update branding record
    const [existing] = await db
      .select()
      .from(userBranding)
      .where(eq(userBranding.userId, req.user.id))
      .limit(1);

    if (existing) {
      await db
        .update(userBranding)
        .set({ logoUrl: result.url, updatedAt: new Date() })
        .where(eq(userBranding.userId, req.user.id));
    } else {
      await db.insert(userBranding).values({
        userId: req.user.id,
        logoUrl: result.url,
      });
    }

    res.json({ logoUrl: result.url });
  } catch (error) {
    console.error('[ESIGN] Error uploading logo:', error);
    res.status(500).json({ error: 'Failed to upload logo' });
  }
});

// ============================================================================
// TEMPLATE ROUTES
// ============================================================================

// List user's templates
router.get('/templates', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const templates = await db
      .select()
      .from(esignTemplates)
      .where(eq(esignTemplates.userId, req.user.id))
      .orderBy(desc(esignTemplates.updatedAt));

    res.json(templates);
  } catch (error) {
    console.error('[ESIGN] Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Get single template
router.get('/templates/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const templateId = parseInt(req.params.id);
    if (isNaN(templateId)) {
      return res.status(400).json({ error: 'Invalid template ID' });
    }

    const [template] = await db
      .select()
      .from(esignTemplates)
      .where(and(
        eq(esignTemplates.id, templateId),
        eq(esignTemplates.userId, req.user.id)
      ))
      .limit(1);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json(template);
  } catch (error) {
    console.error('[ESIGN] Error fetching template:', error);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

// Upload document for template
router.post('/templates/upload', upload.single('document'), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Document file is required' });
    }

    console.log(`[ESIGN] Processing document: ${req.file.originalname}, mimetype: ${req.file.mimetype}, size: ${req.file.buffer.length} bytes`);

    let pdfBuffer = req.file.buffer;
    let originalFilename = req.file.originalname;

    // Determine if this is a Word document by MIME type OR file extension
    const isWordDocument =
      req.file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      req.file.mimetype === 'application/msword' ||
      req.file.originalname.toLowerCase().endsWith('.docx') ||
      req.file.originalname.toLowerCase().endsWith('.doc');

    const isPdf = req.file.mimetype === 'application/pdf' ||
      req.file.originalname.toLowerCase().endsWith('.pdf');

    // Convert Word to PDF if necessary
    if (isWordDocument && !isPdf) {
      console.log('[ESIGN] Detected Word document, converting to PDF...');
      try {
        pdfBuffer = await convertWordToPdf(req.file.buffer, req.file.originalname);
        originalFilename = originalFilename.replace(/\.docx?$/i, '.pdf');
        console.log(`[ESIGN] Conversion successful, PDF size: ${pdfBuffer.length} bytes`);
      } catch (convError: any) {
        console.error('[ESIGN] Word conversion failed:', convError);
        return res.status(500).json({
          error: 'Failed to convert Word document to PDF',
          details: convError.message
        });
      }
    } else if (!isPdf) {
      console.log(`[ESIGN] Unknown file type: ${req.file.mimetype}, attempting as Word document...`);
      try {
        pdfBuffer = await convertWordToPdf(req.file.buffer, req.file.originalname);
        originalFilename = originalFilename.replace(/\.[^.]+$/, '.pdf');
        console.log(`[ESIGN] Conversion successful, PDF size: ${pdfBuffer.length} bytes`);
      } catch (convError: any) {
        console.error('[ESIGN] Conversion failed:', convError);
        return res.status(400).json({
          error: 'Unsupported file format. Please upload a PDF or Word document.',
          details: convError.message
        });
      }
    }

    // Generate a unique template ID
    const tempTemplateId = Date.now();

    // Process PDF to images
    const processedDocument = await processPDFToImages({
      buffer: pdfBuffer,
      originalname: originalFilename,
    }, tempTemplateId, true);

    // Store original PDF in object storage
    const objectStorage = new ObjectStorageService();
    const pdfStorageKey = `private/esign/templates/${tempTemplateId}/${originalFilename}`;
    const pdfUploadResult = await objectStorage.uploadBuffer(pdfStorageKey, pdfBuffer, 'application/pdf');

    console.log(`[ESIGN] Successfully processed ${processedDocument.pageCount} pages`);

    res.json({
      success: true,
      tempTemplateId,
      pageCount: processedDocument.pageCount,
      pageImages: processedDocument.imageUrls,
      pages: processedDocument.pages, // Include page dimensions
      documentUrl: pdfUploadResult.url,
      originalFileName: req.file.originalname,
    });
  } catch (error: any) {
    console.error('[ESIGN] Error processing document:', error);
    res.status(500).json({
      error: 'Failed to process document',
      details: error.message
    });
  }
});

// Create template
router.post('/templates', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    console.log('[ESIGN] Template creation request body:', JSON.stringify(req.body, null, 2));
    const validated = insertEsignTemplateSchema.parse(req.body);

    const [template] = await db
      .insert(esignTemplates)
      .values({
        userId: req.user.id,
        name: validated.name,
        description: validated.description || null,
        documentUrl: validated.documentUrl,
        pageImages: validated.pageImages || [],
        totalPages: validated.totalPages || 1,
        placeholderRecipients: validated.placeholderRecipients || [],
        fields: validated.fields || [],
      })
      .returning();

    res.json(template);
  } catch (error) {
    console.error('[ESIGN] Error creating template:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid template data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// Update template
router.put('/templates/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const templateId = parseInt(req.params.id);
    if (isNaN(templateId)) {
      return res.status(400).json({ error: 'Invalid template ID' });
    }

    // Verify ownership
    const [existing] = await db
      .select()
      .from(esignTemplates)
      .where(and(
        eq(esignTemplates.id, templateId),
        eq(esignTemplates.userId, req.user.id)
      ))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const validated = insertEsignTemplateSchema.partial().parse(req.body);

    const [updated] = await db
      .update(esignTemplates)
      .set({
        ...validated,
        updatedAt: new Date(),
      })
      .where(eq(esignTemplates.id, templateId))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('[ESIGN] Error updating template:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid template data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// Delete template
router.delete('/templates/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const templateId = parseInt(req.params.id);
    if (isNaN(templateId)) {
      return res.status(400).json({ error: 'Invalid template ID' });
    }

    // Verify ownership
    const [existing] = await db
      .select()
      .from(esignTemplates)
      .where(and(
        eq(esignTemplates.id, templateId),
        eq(esignTemplates.userId, req.user.id)
      ))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: 'Template not found' });
    }

    await db.delete(esignTemplates).where(eq(esignTemplates.id, templateId));

    res.json({ success: true });
  } catch (error) {
    console.error('[ESIGN] Error deleting template:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

// Duplicate template
router.post('/templates/:id/duplicate', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const templateId = parseInt(req.params.id);
    if (isNaN(templateId)) {
      return res.status(400).json({ error: 'Invalid template ID' });
    }

    // Get the original template
    const [original] = await db
      .select()
      .from(esignTemplates)
      .where(and(
        eq(esignTemplates.id, templateId),
        eq(esignTemplates.userId, req.user.id)
      ))
      .limit(1);

    if (!original) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Create duplicate with "Copy of" prefix
    const [duplicate] = await db
      .insert(esignTemplates)
      .values({
        userId: req.user.id,
        name: `Copy of ${original.name}`,
        description: original.description,
        documentUrl: original.documentUrl,
        pageImages: original.pageImages,
        totalPages: original.totalPages,
        placeholderRecipients: original.placeholderRecipients,
        fields: original.fields,
      })
      .returning();

    res.json(duplicate);
  } catch (error) {
    console.error('[ESIGN] Error duplicating template:', error);
    res.status(500).json({ error: 'Failed to duplicate template' });
  }
});

// ============================================================================
// ENVELOPE ROUTES
// ============================================================================

// List user's envelopes
router.get('/envelopes', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const status = req.query.status as string | undefined;

    let query = db
      .select()
      .from(esignEnvelopes)
      .where(eq(esignEnvelopes.userId, req.user.id))
      .orderBy(desc(esignEnvelopes.createdAt));

    const envelopes = await query;

    // Filter by status if provided
    const filtered = status
      ? envelopes.filter(e => e.status === status)
      : envelopes;

    // Get recipient counts for each envelope
    const enrichedEnvelopes = await Promise.all(
      filtered.map(async (envelope) => {
        const recipients = await db
          .select()
          .from(esignRecipients)
          .where(eq(esignRecipients.envelopeId, envelope.id));

        const signers = recipients.filter(r => r.role === 'signer');
        const signedCount = signers.filter(r => r.status === 'signed').length;

        return {
          ...envelope,
          recipientCount: recipients.length,
          signerCount: signers.length,
          signedCount,
        };
      })
    );

    res.json(enrichedEnvelopes);
  } catch (error) {
    console.error('[ESIGN] Error fetching envelopes:', error);
    res.status(500).json({ error: 'Failed to fetch envelopes' });
  }
});

// Get single envelope with details (supports both numeric ID and UUID)
router.get('/envelopes/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const idParam = req.params.id;
    let envelope;

    // Check if it's a UUID (starts with "env_") or numeric ID
    if (idParam.startsWith('env_')) {
      // Lookup by envelopeId (UUID)
      [envelope] = await db
        .select()
        .from(esignEnvelopes)
        .where(and(
          eq(esignEnvelopes.envelopeId, idParam),
          eq(esignEnvelopes.userId, req.user.id)
        ))
        .limit(1);
    } else {
      // Lookup by numeric ID (backwards compatible)
      const numericId = parseInt(idParam);
      if (isNaN(numericId)) {
        return res.status(400).json({ error: 'Invalid envelope ID' });
      }
      [envelope] = await db
        .select()
        .from(esignEnvelopes)
        .where(and(
          eq(esignEnvelopes.id, numericId),
          eq(esignEnvelopes.userId, req.user.id)
        ))
        .limit(1);
    }

    if (!envelope) {
      return res.status(404).json({ error: 'Envelope not found' });
    }

    // Get recipients (using internal numeric ID)
    const recipients = await db
      .select()
      .from(esignRecipients)
      .where(eq(esignRecipients.envelopeId, envelope.id))
      .orderBy(esignRecipients.signingOrder);

    // Get fields
    const fields = await db
      .select()
      .from(esignFields)
      .where(eq(esignFields.envelopeId, envelope.id));

    // Get audit log
    const auditLog = await db
      .select()
      .from(esignAuditLog)
      .where(eq(esignAuditLog.envelopeId, envelope.id))
      .orderBy(desc(esignAuditLog.timestamp));

    res.json({
      envelope,
      recipients: recipients.map(r => ({
        ...r,
        accessToken: undefined, // Don't expose tokens
      })),
      fields,
      auditLog,
    });
  } catch (error) {
    console.error('[ESIGN] Error fetching envelope:', error);
    res.status(500).json({ error: 'Failed to fetch envelope' });
  }
});

// Create envelope from template
router.post('/envelopes/from-template/:templateId', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const templateId = parseInt(req.params.templateId);
    if (isNaN(templateId)) {
      return res.status(400).json({ error: 'Invalid template ID' });
    }

    // Get template
    const [template] = await db
      .select()
      .from(esignTemplates)
      .where(and(
        eq(esignTemplates.id, templateId),
        eq(esignTemplates.userId, req.user.id)
      ))
      .limit(1);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Validate request body - map placeholders to actual recipients
    const createEnvelopeSchema = z.object({
      title: z.string().min(1),
      message: z.string().nullable().optional(),
      signingOrder: z.enum(['parallel', 'sequential']).default('parallel'),
      recipientMappings: z.array(z.object({
        placeholderId: z.string(),
        name: z.string().min(1),
        email: z.string().email(),
      })),
    });

    const validated = createEnvelopeSchema.parse(req.body);
    const placeholders = template.placeholderRecipients as any[];
    const templateFields = template.fields as any[];

    // Generate document hash for E-SIGN Act compliance
    let documentHash: string | null = null;
    try {
      const storage = new ObjectStorageService();
      const docKey = template.documentUrl.replace('/api/object-storage/', '');
      const docBuffer = await storage.downloadBuffer(docKey);
      documentHash = generateDocumentHash(docBuffer);
    } catch (e) {
      console.warn('[ESIGN] Could not generate document hash:', e);
    }

    // Create envelope with unique ID
    const [envelope] = await db
      .insert(esignEnvelopes)
      .values({
        envelopeId: generateEnvelopeId(),
        userId: req.user.id,
        title: validated.title,
        message: validated.message || null,
        signingOrder: validated.signingOrder,
        documentUrl: template.documentUrl,
        pageImages: template.pageImages,
        totalPages: template.totalPages,
        templateId: template.id,
        documentHash,
        status: 'draft',
      })
      .returning();

    // Create recipients based on mappings
    const recipientIdMap: Record<string, number> = {};

    for (const mapping of validated.recipientMappings) {
      const placeholder = placeholders.find(p => p.id === mapping.placeholderId);
      if (!placeholder) continue;

      const accessToken = generateSecureToken();

      const [recipient] = await db
        .insert(esignRecipients)
        .values({
          envelopeId: envelope.id,
          name: mapping.name,
          email: mapping.email,
          role: placeholder.role,
          placeholderLabel: placeholder.label,
          color: placeholder.color,
          signingOrder: placeholder.order,
          accessToken,
        })
        .returning();

      recipientIdMap[mapping.placeholderId] = recipient.id;
    }

    // Create fields and assign to recipients
    for (const templateField of templateFields) {
      const recipientId = recipientIdMap[templateField.assignedTo];
      if (!recipientId) continue;

      await db.insert(esignFields).values({
        envelopeId: envelope.id,
        recipientId,
        type: templateField.type,
        x: String(templateField.x),
        y: String(templateField.y),
        width: String(templateField.width),
        height: String(templateField.height),
        page: templateField.page,
        required: templateField.required ?? true,
      });
    }

    // Log audit event
    await logAuditEvent(envelope.id, 'envelope_created', {
      fromTemplate: true,
      templateId: template.id,
      templateName: template.name,
    }, req);

    res.json({ envelope, success: true });
  } catch (error) {
    console.error('[ESIGN] Error creating envelope from template:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create envelope' });
  }
});

// Create envelope from scratch (direct upload)
router.post('/envelopes', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const createEnvelopeSchema = z.object({
      title: z.string().min(1),
      message: z.string().nullable().optional(),
      signingOrder: z.enum(['parallel', 'sequential']).default('parallel'),
      documentUrl: z.string().min(1),
      pageImages: z.array(z.string()),
      totalPages: z.number(),
      templateId: z.number().nullable().optional(), // Optional template ID reference
      recipients: z.array(z.object({
        name: z.string().min(1),
        email: z.string().email(),
        role: z.enum(['signer', 'cc']),
        signingOrder: z.number().default(1),
        color: z.string().optional(), // Optional color for recipient
      })),
      fields: z.array(z.object({
        recipientIndex: z.number(), // Index in recipients array
        type: z.enum(['signature', 'name', 'email', 'date', 'text', 'initials']),
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number(),
        page: z.number(),
        required: z.boolean().default(true),
      })),
    });

    const validated = createEnvelopeSchema.parse(req.body);

    // Generate document hash for E-SIGN Act compliance
    let documentHash: string | null = null;
    try {
      const storage = new ObjectStorageService();
      const docKey = validated.documentUrl.replace('/api/object-storage/', '');
      const docBuffer = await storage.downloadBuffer(docKey);
      documentHash = generateDocumentHash(docBuffer);
    } catch (e) {
      console.warn('[ESIGN] Could not generate document hash:', e);
    }

    // Create envelope with unique ID
    const [envelope] = await db
      .insert(esignEnvelopes)
      .values({
        envelopeId: generateEnvelopeId(),
        userId: req.user.id,
        title: validated.title,
        message: validated.message || null,
        signingOrder: validated.signingOrder,
        documentUrl: validated.documentUrl,
        pageImages: validated.pageImages,
        totalPages: validated.totalPages,
        documentHash,
        status: 'draft',
      })
      .returning();

    // Create recipients
    const createdRecipients: any[] = [];
    let signerIndex = 0;

    for (let i = 0; i < validated.recipients.length; i++) {
      const recipientData = validated.recipients[i];
      const accessToken = generateSecureToken();
      const color = recipientData.role === 'cc'
        ? ESIGN_CC_COLOR
        : ESIGN_RECIPIENT_COLORS[signerIndex % ESIGN_RECIPIENT_COLORS.length];

      if (recipientData.role === 'signer') signerIndex++;

      const [recipient] = await db
        .insert(esignRecipients)
        .values({
          envelopeId: envelope.id,
          name: recipientData.name,
          email: recipientData.email,
          role: recipientData.role,
          color,
          signingOrder: recipientData.signingOrder,
          accessToken,
        })
        .returning();

      createdRecipients.push(recipient);
    }

    // Create fields
    for (const fieldData of validated.fields) {
      const recipient = createdRecipients[fieldData.recipientIndex];
      if (!recipient) continue;

      await db.insert(esignFields).values({
        envelopeId: envelope.id,
        recipientId: recipient.id,
        type: fieldData.type,
        x: String(fieldData.x),
        y: String(fieldData.y),
        width: String(fieldData.width),
        height: String(fieldData.height),
        page: fieldData.page,
        required: fieldData.required,
      });
    }

    // Log audit event
    await logAuditEvent(envelope.id, 'envelope_created', {
      fromTemplate: false,
      recipientCount: validated.recipients.length,
    }, req);

    // Return envelope directly (not nested) so frontend can access envelope.id
    res.json({ ...envelope, success: true });
  } catch (error) {
    console.error('[ESIGN] Error creating envelope:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create envelope' });
  }
});

// Send envelope
router.post('/envelopes/:id/send', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get envelope (supports both UUID and numeric ID)
    const envelope = await findEnvelopeById(req.params.id, req.user.id);
    if (!envelope) {
      return res.status(404).json({ error: 'Envelope not found' });
    }

    if (envelope.status !== 'draft') {
      return res.status(400).json({ error: 'Envelope has already been sent' });
    }

    // Get recipients
    const recipients = await db
      .select()
      .from(esignRecipients)
      .where(eq(esignRecipients.envelopeId, envelope.id))
      .orderBy(esignRecipients.signingOrder);

    if (recipients.length === 0) {
      return res.status(400).json({ error: 'Envelope has no recipients' });
    }

    // Determine which recipients to notify based on signing order
    const recipientsToNotify = envelope.signingOrder === 'sequential'
      ? recipients.filter(r => r.role === 'signer').slice(0, 1) // Only first signer
      : recipients.filter(r => r.role === 'signer'); // All signers

    // Get user branding for emails
    const [branding] = await db
      .select()
      .from(userBranding)
      .where(eq(userBranding.userId, req.user.id))
      .limit(1);

    // Get sender info
    const [sender] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.user.id))
      .limit(1);

    const senderName = sender ? getFullName(sender) || sender.email : req.user.email;
    const now = new Date();

    // Send emails to recipients
    for (const recipient of recipientsToNotify) {
      // Generate signing URL
      const signingUrl = `${process.env.APP_URL || 'https://cimshare.com'}/esign/sign/${recipient.accessToken}`;

      // Send email
      try {
        await sendEsignInvitationEmail({
          recipientEmail: recipient.email,
          recipientName: recipient.name,
          senderName,
          senderEmail: sender?.email || req.user.email,
          documentTitle: envelope.title,
          message: envelope.message || undefined,
          signingUrl,
          branding: branding ? {
            companyName: branding.companyName || undefined,
            logoUrl: branding.logoUrl || undefined,
            primaryColor: branding.primaryColor || undefined,
          } : undefined,
        });
        console.log(`[ESIGN] Sent signing invitation to ${recipient.email}`);
      } catch (emailError) {
        console.error(`[ESIGN] Failed to send email to ${recipient.email}:`, emailError);
        // Continue with other recipients even if one email fails
      }

      await db
        .update(esignRecipients)
        .set({
          status: 'sent',
          sentAt: now,
        })
        .where(eq(esignRecipients.id, recipient.id));

      await logAuditEvent(envelope.id, 'recipient_sent', {
        recipientEmail: recipient.email,
        recipientName: recipient.name,
      }, req, recipient.id);
    }

    // Update envelope status
    await db
      .update(esignEnvelopes)
      .set({
        status: 'sent',
        updatedAt: now,
      })
      .where(eq(esignEnvelopes.id, envelope.id));

    await logAuditEvent(envelope.id, 'envelope_sent', {
      recipientCount: recipientsToNotify.length,
    }, req);

    res.json({
      success: true,
      sentTo: recipientsToNotify.map(r => r.email),
    });
  } catch (error) {
    console.error('[ESIGN] Error sending envelope:', error);
    res.status(500).json({ error: 'Failed to send envelope' });
  }
});

// Void envelope
router.post('/envelopes/:id/void', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { reason } = req.body;

    // Get envelope (supports both UUID and numeric ID)
    const envelope = await findEnvelopeById(req.params.id, req.user.id);
    if (!envelope) {
      return res.status(404).json({ error: 'Envelope not found' });
    }

    if (envelope.status === 'completed' || envelope.status === 'voided') {
      return res.status(400).json({ error: 'Cannot void this envelope' });
    }

    await db
      .update(esignEnvelopes)
      .set({
        status: 'voided',
        voidedAt: new Date(),
        voidReason: reason || null,
        updatedAt: new Date(),
      })
      .where(eq(esignEnvelopes.id, envelope.id));

    await logAuditEvent(envelope.id, 'envelope_voided', { reason }, req);

    // Send void notification to recipients
    const recipients = await db
      .select()
      .from(esignRecipients)
      .where(eq(esignRecipients.envelopeId, envelope.id));

    const [sender] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.user.id))
      .limit(1);

    const [branding] = await db
      .select()
      .from(userBranding)
      .where(eq(userBranding.userId, req.user.id))
      .limit(1);

    const senderName = sender ? getFullName(sender) || sender.email : 'Document Owner';

    for (const recipient of recipients) {
      try {
        await sendEsignVoidedEmail({
          recipientEmail: recipient.email,
          recipientName: recipient.name,
          documentTitle: envelope.title,
          voidedByName: senderName,
          reason: reason || undefined,
          branding: branding ? {
            companyName: branding.companyName || undefined,
            logoUrl: branding.logoUrl || undefined,
            primaryColor: branding.primaryColor || undefined,
          } : undefined,
        });
        console.log(`[ESIGN] Sent void notification to ${recipient.email}`);
      } catch (emailError) {
        console.error(`[ESIGN] Failed to send void notification to ${recipient.email}:`, emailError);
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[ESIGN] Error voiding envelope:', error);
    res.status(500).json({ error: 'Failed to void envelope' });
  }
});

// Delete draft envelope
router.delete('/envelopes/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get envelope (supports both UUID and numeric ID)
    const envelope = await findEnvelopeById(req.params.id, req.user.id);
    if (!envelope) {
      return res.status(404).json({ error: 'Envelope not found' });
    }

    // Only allow deleting drafts
    if (envelope.status !== 'draft') {
      return res.status(400).json({ error: 'Only draft envelopes can be deleted' });
    }

    // Delete related records first (fields, recipients, audit log)
    await db.delete(esignFields).where(eq(esignFields.envelopeId, envelope.id));
    await db.delete(esignRecipients).where(eq(esignRecipients.envelopeId, envelope.id));
    await db.delete(esignAuditLog).where(eq(esignAuditLog.envelopeId, envelope.id));

    // Delete the envelope
    await db.delete(esignEnvelopes).where(eq(esignEnvelopes.id, envelope.id));

    res.json({ success: true });
  } catch (error) {
    console.error('[ESIGN] Error deleting envelope:', error);
    res.status(500).json({ error: 'Failed to delete envelope' });
  }
});

// Send reminder
router.post('/envelopes/:id/remind', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { recipientId } = req.body;

    // Get envelope (supports both UUID and numeric ID)
    const envelope = await findEnvelopeById(req.params.id, req.user.id);
    if (!envelope) {
      return res.status(404).json({ error: 'Envelope not found' });
    }

    if (envelope.status !== 'sent') {
      return res.status(400).json({ error: 'Cannot send reminders for this envelope' });
    }

    // Get recipients to remind
    let recipientsToRemind;
    if (recipientId) {
      recipientsToRemind = await db
        .select()
        .from(esignRecipients)
        .where(and(
          eq(esignRecipients.envelopeId, envelope.id),
          eq(esignRecipients.id, recipientId),
          eq(esignRecipients.role, 'signer')
        ));
    } else {
      // Remind all pending signers
      recipientsToRemind = await db
        .select()
        .from(esignRecipients)
        .where(and(
          eq(esignRecipients.envelopeId, envelope.id),
          eq(esignRecipients.role, 'signer')
        ));
      recipientsToRemind = recipientsToRemind.filter(r =>
        r.status !== 'signed' && r.status !== 'declined'
      );
    }

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const reminded: string[] = [];
    const skipped: string[] = [];

    // Get sender info and branding for emails
    const [sender] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.user.id))
      .limit(1);
    const senderName = sender ? getFullName(sender) || sender.email : req.user.email;

    const [branding] = await db
      .select()
      .from(userBranding)
      .where(eq(userBranding.userId, req.user.id))
      .limit(1);

    for (const recipient of recipientsToRemind) {
      // Check daily limit
      if (recipient.lastReminderAt && new Date(recipient.lastReminderAt) > oneDayAgo) {
        skipped.push(recipient.email);
        continue;
      }

      // Send reminder email
      const signingUrl = `${process.env.APP_URL || 'https://cimshare.com'}/esign/sign/${recipient.accessToken}`;
      try {
        await sendEsignReminderEmail({
          recipientEmail: recipient.email,
          recipientName: recipient.name,
          senderName,
          senderEmail: sender?.email || req.user.email,
          documentTitle: envelope.title,
          signingUrl,
          branding: branding ? {
            companyName: branding.companyName || undefined,
            logoUrl: branding.logoUrl || undefined,
            primaryColor: branding.primaryColor || undefined,
          } : undefined,
        });
        console.log(`[ESIGN] Sent reminder to ${recipient.email}`);
      } catch (emailError) {
        console.error(`[ESIGN] Failed to send reminder to ${recipient.email}:`, emailError);
      }

      // Update reminder tracking
      await db
        .update(esignRecipients)
        .set({
          reminderCount: (recipient.reminderCount || 0) + 1,
          lastReminderAt: now,
        })
        .where(eq(esignRecipients.id, recipient.id));

      await logAuditEvent(envelope.id, 'reminder_sent', {
        recipientEmail: recipient.email,
      }, req, recipient.id);

      reminded.push(recipient.email);
    }

    res.json({
      success: true,
      reminded,
      skipped,
      message: skipped.length > 0
        ? `Reminded ${reminded.length} recipient(s). ${skipped.length} skipped due to daily limit.`
        : `Reminded ${reminded.length} recipient(s).`
    });
  } catch (error) {
    console.error('[ESIGN] Error sending reminders:', error);
    res.status(500).json({ error: 'Failed to send reminders' });
  }
});

// Get envelope audit log
router.get('/envelopes/:id/audit', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get envelope (supports both UUID and numeric ID)
    const envelope = await findEnvelopeById(req.params.id, req.user.id);
    if (!envelope) {
      return res.status(404).json({ error: 'Envelope not found' });
    }

    const auditLog = await db
      .select()
      .from(esignAuditLog)
      .where(eq(esignAuditLog.envelopeId, envelope.id))
      .orderBy(desc(esignAuditLog.timestamp));

    res.json(auditLog);
  } catch (error) {
    console.error('[ESIGN] Error fetching audit log:', error);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

// ============================================================================
// SIGNING ROUTES (Guest access via token)
// ============================================================================

// Get signing session by token
router.get('/sign/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    // Find recipient by token
    const [recipient] = await db
      .select()
      .from(esignRecipients)
      .where(eq(esignRecipients.accessToken, token))
      .limit(1);

    if (!recipient) {
      return res.status(404).json({ error: 'Invalid or expired signing link' });
    }

    // Get envelope
    const [envelope] = await db
      .select()
      .from(esignEnvelopes)
      .where(eq(esignEnvelopes.id, recipient.envelopeId))
      .limit(1);

    if (!envelope) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check envelope status
    if (envelope.status === 'voided') {
      return res.status(400).json({ error: 'This document has been voided' });
    }

    if (envelope.status === 'declined') {
      return res.status(400).json({ error: 'This document has been declined' });
    }

    if (envelope.status === 'completed') {
      return res.status(400).json({ error: 'This document has already been completed' });
    }

    // Check if recipient has already signed or declined
    if (recipient.status === 'signed') {
      return res.status(400).json({ error: 'You have already signed this document' });
    }

    if (recipient.status === 'declined') {
      return res.status(400).json({ error: 'You have declined to sign this document' });
    }

    // Mark as viewed if first time
    if (!recipient.viewedAt) {
      const ip = getClientIP(req);
      const location = await getLocationFromIP(ip);

      await db
        .update(esignRecipients)
        .set({
          status: 'viewed',
          viewedAt: new Date(),
          ipAddress: ip,
          userAgent: req.get('User-Agent') || null,
          location,
        })
        .where(eq(esignRecipients.id, recipient.id));

      await logAuditEvent(envelope.id, 'recipient_viewed', {
        recipientEmail: recipient.email,
      }, req, recipient.id);
    }

    // Get fields for this recipient
    const fields = await db
      .select()
      .from(esignFields)
      .where(eq(esignFields.recipientId, recipient.id));

    // Get all recipients (for showing who else needs to sign)
    const allRecipients = await db
      .select({
        id: esignRecipients.id,
        name: esignRecipients.name,
        role: esignRecipients.role,
        status: esignRecipients.status,
        color: esignRecipients.color,
        signingOrder: esignRecipients.signingOrder,
      })
      .from(esignRecipients)
      .where(eq(esignRecipients.envelopeId, envelope.id))
      .orderBy(esignRecipients.signingOrder);

    // Get branding
    const [branding] = await db
      .select()
      .from(userBranding)
      .where(eq(userBranding.userId, envelope.userId))
      .limit(1);

    res.json({
      envelope: {
        id: envelope.id,
        title: envelope.title,
        message: envelope.message,
        pageImages: envelope.pageImages,
        totalPages: envelope.totalPages,
      },
      recipient: {
        id: recipient.id,
        name: recipient.name,
        email: recipient.email,
        role: recipient.role,
        color: recipient.color,
      },
      fields,
      allRecipients,
      branding: branding || null,
    });
  } catch (error) {
    console.error('[ESIGN] Error accessing signing session:', error);
    res.status(500).json({ error: 'Failed to access document' });
  }
});

// Complete a field
router.post('/sign/:token/field/:fieldId', async (req: Request, res: Response) => {
  try {
    const { token, fieldId } = req.params;
    const { value } = req.body;

    if (!value) {
      return res.status(400).json({ error: 'Field value is required' });
    }

    // Find recipient by token
    const [recipient] = await db
      .select()
      .from(esignRecipients)
      .where(eq(esignRecipients.accessToken, token))
      .limit(1);

    if (!recipient) {
      return res.status(404).json({ error: 'Invalid signing link' });
    }

    // Verify field belongs to recipient
    const fieldIdNum = parseInt(fieldId);
    const [field] = await db
      .select()
      .from(esignFields)
      .where(and(
        eq(esignFields.id, fieldIdNum),
        eq(esignFields.recipientId, recipient.id)
      ))
      .limit(1);

    if (!field) {
      return res.status(404).json({ error: 'Field not found' });
    }

    // Update field
    await db
      .update(esignFields)
      .set({
        value,
        completedAt: new Date(),
      })
      .where(eq(esignFields.id, fieldIdNum));

    await logAuditEvent(recipient.envelopeId, 'field_completed', {
      fieldId: fieldIdNum,
      fieldType: field.type,
      recipientEmail: recipient.email,
    }, req, recipient.id);

    res.json({ success: true });
  } catch (error) {
    console.error('[ESIGN] Error completing field:', error);
    res.status(500).json({ error: 'Failed to complete field' });
  }
});

// Record E-SIGN Act consent acknowledgment
router.post('/sign/:token/consent', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    // Find recipient by token
    const [recipient] = await db
      .select()
      .from(esignRecipients)
      .where(eq(esignRecipients.accessToken, token))
      .limit(1);

    if (!recipient) {
      return res.status(404).json({ error: 'Invalid signing link' });
    }

    // Don't allow consent if already signed or declined
    if (recipient.status === 'signed' || recipient.status === 'declined') {
      return res.status(400).json({ error: 'Document has already been processed' });
    }

    const ip = getClientIP(req);

    // Record consent
    await db
      .update(esignRecipients)
      .set({
        consentedAt: new Date(),
        consentIpAddress: ip,
      })
      .where(eq(esignRecipients.id, recipient.id));

    await logAuditEvent(recipient.envelopeId, 'consent_recorded', {
      recipientEmail: recipient.email,
      consentIpAddress: ip,
    }, req, recipient.id);

    res.json({ success: true, consentedAt: new Date().toISOString() });
  } catch (error) {
    console.error('[ESIGN] Error recording consent:', error);
    res.status(500).json({ error: 'Failed to record consent' });
  }
});

// Complete signing
router.post('/sign/:token/complete', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    // Find recipient by token
    const [recipient] = await db
      .select()
      .from(esignRecipients)
      .where(eq(esignRecipients.accessToken, token))
      .limit(1);

    if (!recipient) {
      return res.status(404).json({ error: 'Invalid signing link' });
    }

    // Get envelope
    const [envelope] = await db
      .select()
      .from(esignEnvelopes)
      .where(eq(esignEnvelopes.id, recipient.envelopeId))
      .limit(1);

    if (!envelope) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Verify E-SIGN Act consent was recorded
    if (!recipient.consentedAt) {
      return res.status(400).json({
        error: 'You must agree to the electronic signature disclosure before signing',
        code: 'CONSENT_REQUIRED',
      });
    }

    // Check all required fields are completed
    const fields = await db
      .select()
      .from(esignFields)
      .where(eq(esignFields.recipientId, recipient.id));

    const incompleteRequired = fields.filter(f => f.required && !f.value);
    if (incompleteRequired.length > 0) {
      return res.status(400).json({
        error: 'Please complete all required fields',
        incompleteCount: incompleteRequired.length,
      });
    }

    const ip = getClientIP(req);
    const location = await getLocationFromIP(ip);

    // Mark recipient as signed
    await db
      .update(esignRecipients)
      .set({
        status: 'signed',
        signedAt: new Date(),
        ipAddress: ip,
        location,
        userAgent: req.get('User-Agent') || null,
      })
      .where(eq(esignRecipients.id, recipient.id));

    await logAuditEvent(envelope.id, 'recipient_signed', {
      recipientEmail: recipient.email,
      fieldsCompleted: fields.length,
    }, req, recipient.id);

    // Check if all signers have signed
    const allSigners = await db
      .select()
      .from(esignRecipients)
      .where(and(
        eq(esignRecipients.envelopeId, envelope.id),
        eq(esignRecipients.role, 'signer')
      ));

    const allSigned = allSigners.every(s => s.status === 'signed' || s.id === recipient.id);

    if (allSigned) {
      // Mark envelope as completed
      await db
        .update(esignEnvelopes)
        .set({
          status: 'completed',
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(esignEnvelopes.id, envelope.id));

      await logAuditEvent(envelope.id, 'envelope_completed', {
        signerCount: allSigners.length,
      }, req);

      // Get owner info for completion emails
      const [owner] = await db
        .select()
        .from(users)
        .where(eq(users.id, envelope.userId))
        .limit(1);

      const [branding] = await db
        .select()
        .from(userBranding)
        .where(eq(userBranding.userId, envelope.userId))
        .limit(1);

      // Get all recipients (signers and CCs)
      const allRecipients = await db
        .select()
        .from(esignRecipients)
        .where(eq(esignRecipients.envelopeId, envelope.id));

      // Get all completed fields for PDF generation
      const allFields = await db
        .select()
        .from(esignFields)
        .where(eq(esignFields.envelopeId, envelope.id));

      // Get audit log for certificate
      const auditLog = await db
        .select()
        .from(esignAuditLog)
        .where(eq(esignAuditLog.envelopeId, envelope.id))
        .orderBy(esignAuditLog.timestamp);

      // Generate signed PDF and certificate
      let finalPdfBuffer: Buffer | null = null;
      try {
        const signedPdf = await generateSignedPdf(
          envelope.documentUrl,
          allFields.map(f => {
            // Find the recipient who owns this field to get their name
            const fieldRecipient = allRecipients.find(r => r.id === f.recipientId);
            return {
              id: f.id,
              type: f.type,
              x: f.x,
              y: f.y,
              width: f.width,
              height: f.height,
              page: f.page,
              value: f.value,
              completedAt: f.completedAt,
              recipientId: f.recipientId,
              signerName: fieldRecipient?.name,
              signerEmail: fieldRecipient?.email,
            };
          }),
          allSigners.map(s => ({
            name: s.name,
            email: s.email,
            signedAt: s.signedAt,
            ipAddress: s.ipAddress,
            location: s.location,
          })),
          {
            envelopeId: envelope.envelopeId,
            title: envelope.title,
            createdAt: envelope.createdAt,
            completedAt: new Date(),
          }
        );

        const certificate = await generateCertificateOfCompletion(
          {
            envelopeId: envelope.envelopeId,
            title: envelope.title,
            createdAt: envelope.createdAt,
            completedAt: new Date(),
          },
          allSigners.map(s => ({
            name: s.name,
            email: s.email,
            signedAt: s.signedAt,
            ipAddress: s.ipAddress,
            location: s.location,
          })),
          auditLog.map(a => ({
            action: a.action,
            actorName: null,
            actorEmail: null,
            createdAt: a.timestamp,
            ipAddress: a.ipAddress,
            location: a.location,
          }))
        );

        // Combine signed PDF with certificate
        finalPdfBuffer = await combineSignedPdfWithCertificate(signedPdf, certificate);

        // Generate hash of signed document for E-SIGN Act compliance
        const signedDocumentHash = generateDocumentHash(finalPdfBuffer);

        // Upload to object storage
        const storage = new ObjectStorageService();
        const signedFileName = `esign/signed/${envelope.envelopeId}_signed_${Date.now()}.pdf`;
        const uploadResult = await storage.uploadBuffer(signedFileName, finalPdfBuffer, 'application/pdf');

        // Update envelope with signed document URL and hash
        await db
          .update(esignEnvelopes)
          .set({
            signedDocumentUrl: uploadResult.url,
            signedDocumentHash,
          })
          .where(eq(esignEnvelopes.id, envelope.id));

        console.log(`[ESIGN] Generated signed PDF for envelope ${envelope.id}: ${uploadResult.url}`);
      } catch (pdfError) {
        console.error('[ESIGN] Error generating signed PDF:', pdfError);
        // Continue with completion - PDF generation failure shouldn't block the process
      }

      // Send completion emails to all parties with the signed PDF attached
      const envelopeUrl = `${process.env.APP_URL || 'https://cimshare.com'}/esign/envelope/${envelope.envelopeId}`;
      const signerNames = allSigners.map(s => s.name).join(', ');

      // Prepare PDF attachment if available
      const pdfAttachment = finalPdfBuffer ? {
        content: finalPdfBuffer.toString('base64'),
        filename: `${envelope.title.replace(/[^a-zA-Z0-9\s]/g, '').trim()}_Signed.pdf`,
      } : undefined;

      for (const r of allRecipients) {
        try {
          await sendEsignCompletedEmail({
            recipientEmail: r.email,
            recipientName: r.name,
            documentTitle: envelope.title,
            signerNames,
            completedAt: new Date(),
            envelopeUrl,
            pdfAttachment,
            branding: branding ? {
              companyName: branding.companyName || undefined,
              logoUrl: branding.logoUrl || undefined,
              primaryColor: branding.primaryColor || undefined,
            } : undefined,
          });
          console.log(`[ESIGN] Sent completion email with attachment to ${r.email}`);
        } catch (emailError) {
          console.error(`[ESIGN] Failed to send completion email to ${r.email}:`, emailError);
        }
      }

      // Also notify the owner if they're not a recipient
      if (owner && !allRecipients.some(r => r.email === owner.email)) {
        try {
          await sendEsignCompletedEmail({
            recipientEmail: owner.email,
            recipientName: getFullName(owner) || 'Document Owner',
            documentTitle: envelope.title,
            signerNames,
            completedAt: new Date(),
            envelopeUrl,
            pdfAttachment,
            branding: branding ? {
              companyName: branding.companyName || undefined,
              logoUrl: branding.logoUrl || undefined,
              primaryColor: branding.primaryColor || undefined,
            } : undefined,
          });
          console.log(`[ESIGN] Sent completion email with attachment to owner ${owner.email}`);
        } catch (emailError) {
          console.error(`[ESIGN] Failed to send completion email to owner:`, emailError);
        }
      }
    } else if (envelope.signingOrder === 'sequential') {
      // Find next signer and notify them
      const nextSigner = allSigners
        .filter(s => s.status !== 'signed' && s.id !== recipient.id)
        .sort((a, b) => a.signingOrder - b.signingOrder)[0];

      if (nextSigner) {
        await db
          .update(esignRecipients)
          .set({
            status: 'sent',
            sentAt: new Date(),
          })
          .where(eq(esignRecipients.id, nextSigner.id));

        await logAuditEvent(envelope.id, 'recipient_sent', {
          recipientEmail: nextSigner.email,
          reason: 'sequential_next',
        }, req, nextSigner.id);

        // Send email to next signer
        const [owner] = await db
          .select()
          .from(users)
          .where(eq(users.id, envelope.userId))
          .limit(1);

        const [branding] = await db
          .select()
          .from(userBranding)
          .where(eq(userBranding.userId, envelope.userId))
          .limit(1);

        const senderName = owner ? getFullName(owner) || owner.email : 'Document Owner';
        const signingUrl = `${process.env.APP_URL || 'https://cimshare.com'}/esign/sign/${nextSigner.accessToken}`;

        try {
          await sendEsignInvitationEmail({
            recipientEmail: nextSigner.email,
            recipientName: nextSigner.name,
            senderName,
            senderEmail: owner?.email || '',
            documentTitle: envelope.title,
            message: envelope.message || undefined,
            signingUrl,
            branding: branding ? {
              companyName: branding.companyName || undefined,
              logoUrl: branding.logoUrl || undefined,
              primaryColor: branding.primaryColor || undefined,
            } : undefined,
          });
          console.log(`[ESIGN] Sent sequential signing invitation to ${nextSigner.email}`);
        } catch (emailError) {
          console.error(`[ESIGN] Failed to send email to next signer:`, emailError);
        }
      }
    }

    res.json({
      success: true,
      envelopeCompleted: allSigned,
    });
  } catch (error) {
    console.error('[ESIGN] Error completing signing:', error);
    res.status(500).json({ error: 'Failed to complete signing' });
  }
});

// Decline to sign
router.post('/sign/:token/decline', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { reason } = req.body;

    // Find recipient by token
    const [recipient] = await db
      .select()
      .from(esignRecipients)
      .where(eq(esignRecipients.accessToken, token))
      .limit(1);

    if (!recipient) {
      return res.status(404).json({ error: 'Invalid signing link' });
    }

    if (recipient.role !== 'signer') {
      return res.status(400).json({ error: 'Only signers can decline' });
    }

    // Get envelope
    const [envelope] = await db
      .select()
      .from(esignEnvelopes)
      .where(eq(esignEnvelopes.id, recipient.envelopeId))
      .limit(1);

    if (!envelope) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const ip = getClientIP(req);
    const location = await getLocationFromIP(ip);

    // Mark recipient as declined
    await db
      .update(esignRecipients)
      .set({
        status: 'declined',
        declinedAt: new Date(),
        declineReason: reason || null,
        ipAddress: ip,
        location,
        userAgent: req.get('User-Agent') || null,
      })
      .where(eq(esignRecipients.id, recipient.id));

    // Mark envelope as declined (entire envelope is declined when any signer declines)
    await db
      .update(esignEnvelopes)
      .set({
        status: 'declined',
        declinedAt: new Date(),
        declinedBy: recipient.email,
        declineReason: reason || null,
        updatedAt: new Date(),
      })
      .where(eq(esignEnvelopes.id, envelope.id));

    await logAuditEvent(envelope.id, 'recipient_declined', {
      recipientEmail: recipient.email,
      reason,
    }, req, recipient.id);

    await logAuditEvent(envelope.id, 'envelope_declined', {
      declinedBy: recipient.email,
      reason,
    }, req);

    // Notify sender (document owner) about the decline
    const [owner] = await db
      .select()
      .from(users)
      .where(eq(users.id, envelope.userId))
      .limit(1);

    if (owner) {
      const [branding] = await db
        .select()
        .from(userBranding)
        .where(eq(userBranding.userId, envelope.userId))
        .limit(1);

      try {
        await sendEsignDeclinedEmail({
          ownerEmail: owner.email,
          ownerName: getFullName(owner) || 'Document Owner',
          declinedByEmail: recipient.email,
          declinedByName: recipient.name,
          documentTitle: envelope.title,
          reason: reason || undefined,
          branding: branding ? {
            companyName: branding.companyName || undefined,
            logoUrl: branding.logoUrl || undefined,
            primaryColor: branding.primaryColor || undefined,
          } : undefined,
        });
        console.log(`[ESIGN] Sent decline notification to ${owner.email}`);
      } catch (emailError) {
        console.error(`[ESIGN] Failed to send decline notification:`, emailError);
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[ESIGN] Error declining:', error);
    res.status(500).json({ error: 'Failed to decline' });
  }
});

// AI Document Summarization for signers
router.post('/sign/:token/summarize', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    // Find recipient by token
    const [recipient] = await db
      .select()
      .from(esignRecipients)
      .where(eq(esignRecipients.accessToken, token))
      .limit(1);

    if (!recipient) {
      return res.status(404).json({ error: 'Invalid signing link' });
    }

    // Get envelope
    const [envelope] = await db
      .select()
      .from(esignEnvelopes)
      .where(eq(esignEnvelopes.id, recipient.envelopeId))
      .limit(1);

    if (!envelope) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (!envelope.documentUrl) {
      return res.status(400).json({ error: 'No document available to summarize' });
    }

    console.log(`[ESIGN] Summarizing document for recipient ${recipient.id}`);

    // Fetch the PDF and extract text
    const storage = new ObjectStorageService();
    let pdfBuffer: Buffer;

    if (envelope.documentUrl.startsWith('/api/object-storage/')) {
      const key = envelope.documentUrl.replace('/api/object-storage/', '');
      pdfBuffer = await storage.downloadBuffer(key);
    } else if (envelope.documentUrl.startsWith('http')) {
      const response = await fetch(envelope.documentUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch document');
      }
      pdfBuffer = Buffer.from(await response.arrayBuffer());
    } else {
      return res.status(400).json({ error: 'Invalid document URL format' });
    }

    // Extract text from PDF
    let documentText = '';
    try {
      const pdfData = await pdfParse(pdfBuffer);
      documentText = pdfData.text;
    } catch (parseError: any) {
      console.error('[ESIGN] PDF parse error:', parseError);
      return res.status(400).json({ error: 'Could not extract text from document' });
    }

    if (!documentText || documentText.trim().length < 100) {
      return res.status(400).json({
        error: 'Document contains insufficient text for summarization. It may be an image-based PDF.'
      });
    }

    // Generate AI summary
    const summary = await summarizeDocumentForSigner(documentText);

    // Log audit event
    await logAuditEvent(envelope.id, 'document_summarized', recipient.id, getClientIP(req));

    res.json({
      success: true,
      summary: summary.summary,
      keyPoints: summary.keyPoints,
      importantTerms: summary.importantTerms,
      estimatedReadTime: summary.estimatedReadTime,
      disclaimer: 'This summary is AI-generated for informational purposes only. It is not legal advice. Please read the full document carefully before signing.',
    });
  } catch (error: any) {
    console.error('[ESIGN] Error summarizing document:', error);
    res.status(500).json({ error: error.message || 'Failed to summarize document' });
  }
});

// ============================================================================
// VERIFICATION ROUTE (Public)
// ============================================================================

router.get('/verify/:envelopeId', async (req: Request, res: Response) => {
  try {
    const idParam = req.params.envelopeId;
    let envelope;

    // Check if it's a UUID (starts with "env_") or numeric ID
    if (idParam.startsWith('env_')) {
      [envelope] = await db
        .select({
          id: esignEnvelopes.id,
          envelopeId: esignEnvelopes.envelopeId,
          title: esignEnvelopes.title,
          status: esignEnvelopes.status,
          completedAt: esignEnvelopes.completedAt,
          createdAt: esignEnvelopes.createdAt,
          documentHash: esignEnvelopes.documentHash,
          signedDocumentHash: esignEnvelopes.signedDocumentHash,
        })
        .from(esignEnvelopes)
        .where(eq(esignEnvelopes.envelopeId, idParam))
        .limit(1);
    } else {
      const numericId = parseInt(idParam);
      if (isNaN(numericId)) {
        return res.status(400).json({ error: 'Invalid envelope ID' });
      }
      [envelope] = await db
        .select({
          id: esignEnvelopes.id,
          envelopeId: esignEnvelopes.envelopeId,
          title: esignEnvelopes.title,
          status: esignEnvelopes.status,
          completedAt: esignEnvelopes.completedAt,
          createdAt: esignEnvelopes.createdAt,
          documentHash: esignEnvelopes.documentHash,
          signedDocumentHash: esignEnvelopes.signedDocumentHash,
        })
        .from(esignEnvelopes)
        .where(eq(esignEnvelopes.id, numericId))
        .limit(1);
    }

    if (!envelope) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Get signers (limited info for privacy)
    const signers = await db
      .select({
        name: esignRecipients.name,
        status: esignRecipients.status,
        signedAt: esignRecipients.signedAt,
      })
      .from(esignRecipients)
      .where(and(
        eq(esignRecipients.envelopeId, envelope.id),
        eq(esignRecipients.role, 'signer')
      ))
      .orderBy(esignRecipients.signingOrder);

    res.json({
      envelope: {
        envelopeId: envelope.envelopeId, // Return UUID instead of numeric id
        title: envelope.title,
        status: envelope.status,
        completedAt: envelope.completedAt,
        createdAt: envelope.createdAt,
        documentHash: envelope.documentHash,
        signedDocumentHash: envelope.signedDocumentHash,
      },
      signers: signers.map(s => ({
        name: s.name,
        status: s.status,
        signedAt: s.signedAt,
      })),
    });
  } catch (error) {
    console.error('[ESIGN] Error verifying envelope:', error);
    res.status(500).json({ error: 'Failed to verify document' });
  }
});

// ============================================================================
// DOWNLOAD SIGNED DOCUMENT (Authenticated)
// ============================================================================

router.get('/envelopes/:id/download', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get envelope (supports both UUID and numeric ID)
    const envelope = await findEnvelopeById(req.params.id, req.user.id);
    if (!envelope) {
      return res.status(404).json({ error: 'Envelope not found' });
    }

    if (envelope.status !== 'completed') {
      return res.status(400).json({ error: 'Document is not yet completed' });
    }

    if (!envelope.signedDocumentUrl) {
      return res.status(404).json({ error: 'Signed document not available' });
    }

    // Redirect to the signed document URL
    res.json({
      downloadUrl: envelope.signedDocumentUrl,
      fileName: `${envelope.title.replace(/[^a-zA-Z0-9]/g, '_')}_signed.pdf`
    });
  } catch (error) {
    console.error('[ESIGN] Error downloading signed document:', error);
    res.status(500).json({ error: 'Failed to download document' });
  }
});

// Download for recipients (by token)
router.get('/download/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    // Find recipient by token
    const [recipient] = await db
      .select()
      .from(esignRecipients)
      .where(eq(esignRecipients.accessToken, token))
      .limit(1);

    if (!recipient) {
      return res.status(404).json({ error: 'Invalid access token' });
    }

    // Get envelope
    const [envelope] = await db
      .select()
      .from(esignEnvelopes)
      .where(eq(esignEnvelopes.id, recipient.envelopeId))
      .limit(1);

    if (!envelope) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (envelope.status !== 'completed') {
      return res.status(400).json({ error: 'Document is not yet completed' });
    }

    if (!envelope.signedDocumentUrl) {
      return res.status(404).json({ error: 'Signed document not available' });
    }

    res.json({
      downloadUrl: envelope.signedDocumentUrl,
      fileName: `${envelope.title.replace(/[^a-zA-Z0-9]/g, '_')}_signed.pdf`
    });
  } catch (error) {
    console.error('[ESIGN] Error downloading document by token:', error);
    res.status(500).json({ error: 'Failed to download document' });
  }
});

export { router as esignRoutes };
