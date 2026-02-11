/**
 * E-Sign Template Routes
 * Manages e-signature document templates and recent recipients
 */

import { Router, Request, Response } from 'express';
import { db } from '../../db';
import {
  esignTemplates,
  esignRecentRecipients,
  insertEsignTemplateSchema
} from '@shared/schema';
import { eq, and, desc, ilike, or } from 'drizzle-orm';
import { z } from 'zod';
import { processPDFToImages, processDocumentToImages } from '../../services/pdf-processor';
import { ObjectStorageService } from '../../object-storage';
import { sanitizeFilename } from '../../utils/sanitize-filename';
import { upload, libreOfficeFormats, isLibreOfficeSupported, getDocumentType } from './esign-utils';
import { generateSecureToken } from '../../token-utils';

function generatePowerFormSlug(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  const suffix = generateSecureToken().slice(0, 8);
  return `${base}-${suffix}`;
}

const router = Router();

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

// Get recent recipients for autocomplete
router.get('/recent-recipients', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const query = (req.query.q as string || '').trim().toLowerCase();
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    let recipients;

    if (query) {
      // Search by name or email
      recipients = await db
        .select()
        .from(esignRecentRecipients)
        .where(and(
          eq(esignRecentRecipients.userId, req.user.id),
          or(
            ilike(esignRecentRecipients.name, `%${query}%`),
            ilike(esignRecentRecipients.email, `%${query}%`)
          )
        ))
        .orderBy(desc(esignRecentRecipients.lastUsedAt))
        .limit(limit);
    } else {
      // Return most recent recipients
      recipients = await db
        .select()
        .from(esignRecentRecipients)
        .where(eq(esignRecentRecipients.userId, req.user.id))
        .orderBy(desc(esignRecentRecipients.lastUsedAt))
        .limit(limit);
    }

    res.json(recipients);
  } catch (error) {
    console.error('[ESIGN] Error fetching recent recipients:', error);
    res.status(500).json({ error: 'Failed to fetch recent recipients' });
  }
});

// Delete a recent recipient
router.delete('/recent-recipients/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const recipientId = parseInt(req.params.id);
    if (isNaN(recipientId)) {
      return res.status(400).json({ error: 'Invalid recipient ID' });
    }

    await db
      .delete(esignRecentRecipients)
      .where(and(
        eq(esignRecentRecipients.id, recipientId),
        eq(esignRecentRecipients.userId, req.user.id)
      ));

    res.json({ success: true });
  } catch (error) {
    console.error('[ESIGN] Error deleting recent recipient:', error);
    res.status(500).json({ error: 'Failed to delete recent recipient' });
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
    // Sanitize filename to prevent path traversal attacks
    let originalFilename = sanitizeFilename(req.file.originalname);

    const fileExt = req.file.originalname.toLowerCase().split('.').pop() || '';
    const mimetype = req.file.mimetype;

    // Determine document type by MIME type OR file extension
    const isPdf = mimetype === 'application/pdf' || fileExt === 'pdf';
    const isLibreOffice = isLibreOfficeSupported(mimetype, fileExt);

    // Generate a unique template ID
    const tempTemplateId = Date.now();
    const objectStorage = new ObjectStorageService();
    let processedDocument;
    let documentUrl: string;

    // Process LibreOffice-supported documents (Word, Excel, PowerPoint, etc.)
    if (isLibreOffice && !isPdf) {
      const docType = getDocumentType(mimetype, fileExt);

      console.log(`[ESIGN] Detected ${docType} document, processing with LibreOffice...`);
      try {
        processedDocument = await processDocumentToImages({
          buffer: req.file.buffer,
          originalname: req.file.originalname,
        }, tempTemplateId, true);

        // Store original document in object storage
        const docStorageKey = `private/esign/templates/${tempTemplateId}/${originalFilename}`;
        const docUploadResult = await objectStorage.uploadBuffer(docStorageKey, req.file.buffer, req.file.mimetype);
        documentUrl = docUploadResult.url;
        console.log(`[ESIGN] ${docType} document processed successfully, ${processedDocument.pageCount} pages`);
      } catch (convError: any) {
        console.error(`[ESIGN] ${docType} processing failed:`, convError);
        return res.status(500).json({
          error: `Failed to process ${docType} document`,
          details: convError.message
        });
      }
    } else if (isPdf) {
      // Process PDF directly to images
      processedDocument = await processPDFToImages({
        buffer: pdfBuffer,
        originalname: originalFilename,
      }, tempTemplateId, true);

      // Store original PDF in object storage
      const pdfStorageKey = `private/esign/templates/${tempTemplateId}/${originalFilename}`;
      const pdfUploadResult = await objectStorage.uploadBuffer(pdfStorageKey, pdfBuffer, 'application/pdf');
      documentUrl = pdfUploadResult.url;
    } else {
      // Unknown file type - try processing with LibreOffice as fallback
      console.log(`[ESIGN] Unknown file type: ${mimetype} (${fileExt}), attempting with LibreOffice...`);
      try {
        processedDocument = await processDocumentToImages({
          buffer: req.file.buffer,
          originalname: req.file.originalname,
        }, tempTemplateId, true);

        const docStorageKey = `private/esign/templates/${tempTemplateId}/${originalFilename}`;
        const docUploadResult = await objectStorage.uploadBuffer(docStorageKey, req.file.buffer, req.file.mimetype);
        documentUrl = docUploadResult.url;
      } catch (convError: any) {
        console.error('[ESIGN] Conversion failed:', convError);
        return res.status(400).json({
          error: 'Unsupported file format. Please upload a PDF, Word, Excel, or PowerPoint document.',
          details: convError.message
        });
      }
    }

    console.log(`[ESIGN] Successfully processed ${processedDocument.pageCount} pages`);

    res.json({
      success: true,
      tempTemplateId,
      pageCount: processedDocument.pageCount,
      pageImages: processedDocument.imageUrls,
      pages: processedDocument.pages, // Include page dimensions
      documentUrl: documentUrl,
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

    const slug = generatePowerFormSlug(validated.name);
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
        powerFormEnabled: true,
        powerFormSlug: slug,
        powerFormSettings: { multiSignerMode: 'choice' },
        powerFormCreatedAt: new Date(),
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

    // Auto-enable PowerForm if the template doesn't have a slug yet
    const powerFormFields: Record<string, any> = {};
    if (!existing.powerFormSlug) {
      const templateName = validated.name || existing.name;
      powerFormFields.powerFormEnabled = true;
      powerFormFields.powerFormSlug = generatePowerFormSlug(templateName);
      powerFormFields.powerFormSettings = { multiSignerMode: 'choice' };
      powerFormFields.powerFormCreatedAt = new Date();
    }

    const [updated] = await db
      .update(esignTemplates)
      .set({
        ...validated,
        ...powerFormFields,
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
    const dupName = `Copy of ${original.name}`;
    const dupSlug = generatePowerFormSlug(dupName);
    const [duplicate] = await db
      .insert(esignTemplates)
      .values({
        userId: req.user.id,
        name: dupName,
        description: original.description,
        documentUrl: original.documentUrl,
        pageImages: original.pageImages,
        totalPages: original.totalPages,
        placeholderRecipients: original.placeholderRecipients,
        fields: original.fields,
        powerFormEnabled: true,
        powerFormSlug: dupSlug,
        powerFormSettings: { multiSignerMode: 'choice' },
        powerFormCreatedAt: new Date(),
      })
      .returning();

    res.json(duplicate);
  } catch (error) {
    console.error('[ESIGN] Error duplicating template:', error);
    res.status(500).json({ error: 'Failed to duplicate template' });
  }
});

export { router as esignTemplateRoutes };
