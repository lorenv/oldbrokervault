import { Router } from 'express';
import { eSignatureService } from '../services/esignature-service';
import { sanitizeUser } from '../data-sanitizer';
import { insertNdaSigningSessionSchema, insertNdaRecipientSchema } from '@shared/schema';
import { z } from 'zod';
import multer from 'multer';
import { processPDFToImages } from '../services/pdf-processor';
import { ObjectStorageService } from '../object-storage';
import { sanitizeFilename } from '../utils/sanitize-filename';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

// Upload and process PDF template
router.post('/templates/upload', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'PDF file is required' });
    }

    // Sanitize filename to prevent path traversal attacks
    const safeOriginalName = sanitizeFilename(req.file.originalname);

    console.log(`[TEMPLATE_UPLOAD] Processing PDF: ${safeOriginalName}, size: ${req.file.size}`);

    // Generate a unique template ID (you might want to save this to database)
    const templateId = Date.now();

    // Process PDF to images using the proven method
    const processedDocument = await processPDFToImages({
      buffer: req.file.buffer,
      originalname: safeOriginalName,
    }, templateId, true);

    // Store original PDF file in object storage
    const objectStorageService = new ObjectStorageService();
    const pdfStorageKey = `private/templates/${templateId}/${safeOriginalName}`;
    const pdfUploadResult = await objectStorageService.uploadBuffer(pdfStorageKey, req.file.buffer, 'application/pdf');

    console.log(`[TEMPLATE_UPLOAD] Successfully processed ${processedDocument.pageCount} pages`);

    res.json({
      success: true,
      templateId,
      pageCount: processedDocument.pageCount,
      imageUrls: processedDocument.imageUrls,
      originalFileUrl: pdfUploadResult.url,
      originalFileName: safeOriginalName,
    });

  } catch (error: any) {
    console.error('[TEMPLATE_UPLOAD] Error processing PDF:', error);
    res.status(500).json({ 
      error: 'Failed to process PDF template',
      details: error.message 
    });
  }
});

// Get template page image
router.get('/templates/:templateId/image/:pageNumber', async (req, res) => {
  try {
    const templateId = parseInt(req.params.templateId);
    const pageNumber = parseInt(req.params.pageNumber);

    if (isNaN(templateId) || isNaN(pageNumber)) {
      return res.status(400).json({ error: 'Invalid template ID or page number' });
    }

    // For now, we'll use the object storage URL directly
    // In a full implementation, you'd retrieve from database
    const objectStorageService = new ObjectStorageService();
    const imageKey = `private/templates/${templateId}/pages/page-${pageNumber}.png`;

    try {
      const imageBuffer = await objectStorageService.downloadBuffer(imageKey);
      res.set('Content-Type', 'image/png');
      res.send(imageBuffer);
    } catch (error) {
      console.error(`[TEMPLATE_IMAGE] Error retrieving image: ${imageKey}`, error);
      res.status(404).json({ error: 'Template image not found' });
    }

  } catch (error) {
    console.error('[TEMPLATE_IMAGE] Error:', error);
    res.status(500).json({ error: 'Failed to retrieve template image' });
  }
});

// Create enhanced signing session with recipients and field assignments
router.post('/signing-sessions', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Validate request data
    const createSessionSchema = z.object({
      templateId: z.number(),
      title: z.string().min(1),
      message: z.string().optional(),
      recipients: z.array(z.object({
        name: z.string().min(1),
        email: z.string().email(),
        role: z.enum(['signer', 'cc', 'approver']).default('signer'),
      })),
      fieldAssignments: z.array(z.object({
        fieldId: z.string(),
        recipientEmail: z.string().email(),
        required: z.boolean().default(true),
        prefilled: z.boolean().default(false),
        prefilledValue: z.string().optional(),
      })),
      cimDocumentId: z.number().optional(),
      expiresAt: z.string().datetime().optional(),
    });

    const validatedData = createSessionSchema.parse(req.body);

    const result = await eSignatureService.createSigningSession({
      ...validatedData,
      createdBy: req.user.id,
      expiresAt: validatedData.expiresAt ? new Date(validatedData.expiresAt) : undefined,
    });

    res.json({
      success: true,
      session: result.session,
      recipients: result.recipients.map(r => ({
        ...r,
        accessToken: undefined, // Don't expose access tokens
      })),
      fieldAssignments: result.fieldAssignments,
    });
  } catch (error) {
    console.error('Error creating signing session:', error);
    res.status(500).json({ error: 'Failed to create signing session' });
  }
});

// Send document to recipients
router.post('/signing-sessions/:id/send', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const sessionId = parseInt(req.params.id);
    if (isNaN(sessionId)) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }

    // Get user branding info for email customization
    const userBranding = {
      businessName: req.user.businessName,
      logoUrl: req.user.businessLogo,
    };

    const result = await eSignatureService.sendDocument(sessionId, userBranding);
    
    res.json(result);
  } catch (error) {
    console.error('Error sending document:', error);
    res.status(500).json({ error: 'Failed to send document' });
  }
});

// Get signing session details (for owner)
router.get('/signing-sessions/:id', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const sessionId = parseInt(req.params.id);
    if (isNaN(sessionId)) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }

    const result = await eSignatureService.getSigningSession(sessionId);
    
    if (!result) {
      return res.status(404).json({ error: 'Signing session not found' });
    }

    // Verify ownership
    if (result.session.createdBy !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(result);
  } catch (error) {
    console.error('Error getting signing session:', error);
    res.status(500).json({ error: 'Failed to get signing session' });
  }
});

// Get signing session by access token (for recipients)
router.get('/sign/:accessToken', async (req, res) => {
  try {
    const { accessToken } = req.params;
    const ipAddress = req.ip || req.connection.remoteAddress || '';
    const userAgent = req.get('User-Agent') || '';

    const result = await eSignatureService.getSessionByToken(accessToken, ipAddress, userAgent);
    
    if (!result) {
      return res.status(404).json({ error: 'Document not found or access token invalid' });
    }

    // Don't expose sensitive information
    const sanitized = {
      ...result,
      recipients: result.recipients.map(r => ({
        ...r,
        accessToken: undefined,
        ipAddress: undefined,
      })),
      currentRecipient: {
        ...result.currentRecipient,
        accessToken: undefined,
        ipAddress: undefined,
      },
    };

    res.json(sanitized);
  } catch (error) {
    console.error('Error getting session by token:', error);
    res.status(500).json({ error: 'Failed to access document' });
  }
});

// Sign a specific field
router.post('/sign/:accessToken/fields/:fieldId', async (req, res) => {
  try {
    const { accessToken, fieldId } = req.params;
    const { value } = req.body;

    if (!value) {
      return res.status(400).json({ error: 'Field value is required' });
    }

    const ipAddress = req.ip || req.connection.remoteAddress || '';
    const userAgent = req.get('User-Agent') || '';

    const result = await eSignatureService.signField({
      accessToken,
      fieldId,
      value,
      ipAddress,
      userAgent,
    });

    res.json(result);
  } catch (error) {
    console.error('Error signing field:', error);
    res.status(500).json({ error: 'Failed to sign field' });
  }
});

// Get user's signing sessions (dashboard)
router.get('/my-sessions', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // This would be implemented to get all sessions created by the user
    // For now, returning empty array as placeholder
    res.json({ sessions: [] });
  } catch (error) {
    console.error('Error getting user sessions:', error);
    res.status(500).json({ error: 'Failed to get sessions' });
  }
});

// Get audit log for a signing session
router.get('/signing-sessions/:id/audit-log', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const sessionId = parseInt(req.params.id);
    if (isNaN(sessionId)) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }

    // Verify session ownership before showing audit log
    const session = await eSignatureService.getSigningSession(sessionId);
    if (!session || session.session.createdBy !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get audit log entries
    // This would be implemented to fetch audit log entries
    res.json({ auditLog: [] });
  } catch (error) {
    console.error('Error getting audit log:', error);
    res.status(500).json({ error: 'Failed to get audit log' });
  }
});

// Certificate of completion endpoint
router.get('/signing-sessions/:id/certificate', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const sessionId = parseInt(req.params.id);
    if (isNaN(sessionId)) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }

    // Verify session ownership and completion
    const session = await eSignatureService.getSigningSession(sessionId);
    if (!session || session.session.createdBy !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (session.session.status !== 'completed') {
      return res.status(400).json({ error: 'Document signing not yet complete' });
    }

    // Generate and return certificate of completion
    const certificate = {
      sessionId: session.session.id,
      documentTitle: session.session.title,
      completedAt: session.session.completedAt,
      signers: session.recipients.filter(r => r.role === 'signer' && r.status === 'signed'),
      certificateId: `CERT-${sessionId}-${Date.now()}`,
    };

    res.json(certificate);
  } catch (error) {
    console.error('Error generating certificate:', error);
    res.status(500).json({ error: 'Failed to generate certificate' });
  }
});

export { router as eSignatureRoutes };