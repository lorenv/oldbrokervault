/**
 * E-Sign Envelope Routes
 * Manages e-signature envelopes, signing workflow, and document completion
 */

import { Router, Request, Response } from 'express';
import { db } from '../../db';
import {
  esignEnvelopes,
  esignRecipients,
  esignFields,
  esignAuditLog,
  esignTemplates,
  esignRecentRecipients,
  userBranding,
  users,
  getFullName,
  ESIGN_RECIPIENT_COLORS,
  ESIGN_CC_COLOR
} from '@shared/schema';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { ObjectStorageService } from '../../object-storage';
import { generateSecureToken } from '../../token-utils';
import {
  sendEsignInvitationEmail,
  sendEsignReminderEmail,
  sendEsignCompletedEmail,
  sendEsignDeclinedEmail,
  sendEsignVoidedEmail
} from '../../email';
import {
  generateEnvelopeId,
  generateDocumentHash,
  findEnvelopeById,
  logAuditEvent,
  getClientIP,
  getLocationFromIP
} from './esign-utils';
import {
  generateSignedPdf,
  generateCertificateOfCompletion,
  combineSignedPdfWithCertificate
} from '../../services/esign-pdf-generator';
import { summarizeDocumentForSigner } from '../../openai';
import { summarizeDocumentWithVision } from '../../services/anthropic-vision';
import { dispatchIntegrationEvent } from '../../integrations';
import { dispatchWebhookEvent } from '../../webhook-dispatcher';

const router = Router();

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

        // Get pending signers (not yet signed) for "waiting on" display
        const pendingSigners = signers
          .filter(r => r.status !== 'signed')
          .map(r => r.name);

        // Debug logging
        console.log(`[ESIGN DEBUG] Envelope ${envelope.id} (${envelope.title}):`, {
          recipientCount: recipients.length,
          signerCount: signers.length,
          signedCount,
          signerNames: signers.map(s => ({ name: s.name, email: s.email, status: s.status })),
          pendingSigners
        });

        return {
          ...envelope,
          recipientCount: recipients.length,
          signerCount: signers.length,
          signedCount,
          pendingSigners,
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
    const emailResults: { email: string; success: boolean; error?: string }[] = [];

    for (const recipient of recipientsToNotify) {
      // Generate signing URL
      const signingUrl = `${process.env.APP_URL || 'https://brokervault.ai'}/esign/sign/${recipient.accessToken}`;

      // Send email and check result
      let emailSent = false;
      try {
        emailSent = await sendEsignInvitationEmail({
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
          userId: req.user.id, // Send from user's OAuth email if connected
        });

        if (emailSent) {
          console.log(`[ESIGN] ✅ Sent signing invitation to ${recipient.email}`);
          emailResults.push({ email: recipient.email, success: true });
        } else {
          console.error(`[ESIGN] ❌ Failed to send email to ${recipient.email} (sendEmail returned false)`);
          emailResults.push({ email: recipient.email, success: false, error: 'Email service returned false' });
        }
      } catch (emailError) {
        console.error(`[ESIGN] ❌ Exception sending email to ${recipient.email}:`, emailError);
        emailResults.push({ email: recipient.email, success: false, error: String(emailError) });
        // Continue with other recipients even if one email fails
      }

      // Only mark as sent if email was actually sent
      if (emailSent) {
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
      } else {
        // Log the failure
        await logAuditEvent(envelope.id, 'recipient_email_failed', {
          recipientEmail: recipient.email,
          recipientName: recipient.name,
          error: emailResults[emailResults.length - 1]?.error || 'Unknown error',
        }, req, recipient.id);
      }
    }

    // Log summary of email results
    const successCount = emailResults.filter(r => r.success).length;
    const failCount = emailResults.filter(r => !r.success).length;
    console.log(`[ESIGN] Email send summary: ${successCount} succeeded, ${failCount} failed`);
    if (failCount > 0) {
      console.log(`[ESIGN] Failed emails:`, emailResults.filter(r => !r.success));
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

    // Save recipients to recent recipients for future autocomplete
    // (upsert: update if exists, insert if not)
    for (const recipient of recipients) {
      try {
        // Check if this recipient already exists
        const [existing] = await db
          .select()
          .from(esignRecentRecipients)
          .where(and(
            eq(esignRecentRecipients.userId, req.user!.id),
            eq(esignRecentRecipients.email, recipient.email.toLowerCase())
          ))
          .limit(1);

        if (existing) {
          // Update existing: increment use count and update name if different
          await db
            .update(esignRecentRecipients)
            .set({
              name: recipient.name, // Use most recent name
              useCount: existing.useCount + 1,
              lastUsedAt: now,
            })
            .where(eq(esignRecentRecipients.id, existing.id));
        } else {
          // Insert new
          await db
            .insert(esignRecentRecipients)
            .values({
              userId: req.user!.id,
              email: recipient.email.toLowerCase(),
              name: recipient.name,
              useCount: 1,
              lastUsedAt: now,
            });
        }
      } catch (recentError) {
        // Don't fail the send if recent recipients save fails
        console.error('[ESIGN] Error saving recent recipient:', recentError);
      }
    }

    // Include email results in response
    const successfulEmails = emailResults.filter(r => r.success).map(r => r.email);
    const failedEmails = emailResults.filter(r => !r.success);

    res.json({
      success: successfulEmails.length > 0,
      sentTo: successfulEmails,
      failedEmails: failedEmails.length > 0 ? failedEmails : undefined,
      warning: failedEmails.length > 0
        ? `${failedEmails.length} of ${recipientsToNotify.length} emails failed to send. You may need to send reminders to: ${failedEmails.map(f => f.email).join(', ')}`
        : undefined,
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

// Check if envelope can be corrected
router.get('/envelopes/:id/can-correct', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const envelope = await findEnvelopeById(req.params.id, req.user.id);
    if (!envelope) {
      return res.status(404).json({ error: 'Envelope not found' });
    }

    // Can only correct envelopes that are draft or sent but no signatures yet
    if (envelope.status === 'completed' || envelope.status === 'voided' || envelope.status === 'declined') {
      return res.json({
        canCorrect: false,
        reason: `Cannot correct ${envelope.status} envelopes`,
      });
    }

    // Check if any signatures have been collected
    const signedFields = await db
      .select()
      .from(esignFields)
      .where(and(
        eq(esignFields.envelopeId, envelope.id),
        sql`${esignFields.value} IS NOT NULL`
      ));

    if (signedFields.length > 0) {
      return res.json({
        canCorrect: false,
        reason: 'Cannot correct after signatures have been collected',
      });
    }

    // Check if any recipient has signed
    const signedRecipients = await db
      .select()
      .from(esignRecipients)
      .where(and(
        eq(esignRecipients.envelopeId, envelope.id),
        eq(esignRecipients.status, 'signed')
      ));

    if (signedRecipients.length > 0) {
      return res.json({
        canCorrect: false,
        reason: 'Cannot correct after a recipient has signed',
      });
    }

    res.json({
      canCorrect: true,
      envelope: {
        id: envelope.id,
        envelopeId: envelope.envelopeId,
        title: envelope.title,
        status: envelope.status,
      },
    });
  } catch (error) {
    console.error('[ESIGN] Error checking if envelope can be corrected:', error);
    res.status(500).json({ error: 'Failed to check correction eligibility' });
  }
});

// Get envelope data for correction (includes all details needed for editing)
router.get('/envelopes/:id/correct', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const envelope = await findEnvelopeById(req.params.id, req.user.id);
    if (!envelope) {
      return res.status(404).json({ error: 'Envelope not found' });
    }

    // Verify envelope can be corrected
    if (envelope.status === 'completed' || envelope.status === 'voided' || envelope.status === 'declined') {
      return res.status(400).json({ error: `Cannot correct ${envelope.status} envelopes` });
    }

    // Check for any signatures
    const signedFields = await db
      .select()
      .from(esignFields)
      .where(and(
        eq(esignFields.envelopeId, envelope.id),
        sql`${esignFields.value} IS NOT NULL`
      ));

    if (signedFields.length > 0) {
      return res.status(400).json({ error: 'Cannot correct after signatures have been collected' });
    }

    // Get recipients
    const recipients = await db
      .select()
      .from(esignRecipients)
      .where(eq(esignRecipients.envelopeId, envelope.id))
      .orderBy(esignRecipients.signingOrder);

    // Check if any has signed
    if (recipients.some(r => r.status === 'signed')) {
      return res.status(400).json({ error: 'Cannot correct after a recipient has signed' });
    }

    // Get fields
    const fields = await db
      .select()
      .from(esignFields)
      .where(eq(esignFields.envelopeId, envelope.id));

    res.json({
      envelope: {
        id: envelope.id,
        envelopeId: envelope.envelopeId,
        title: envelope.title,
        message: envelope.message,
        status: envelope.status,
        signingOrder: envelope.signingOrder,
        documentUrl: envelope.documentUrl,
        pageImages: envelope.pageImages,
        totalPages: envelope.totalPages,
      },
      recipients: recipients.map(r => ({
        id: r.id,
        name: r.name,
        email: r.email,
        role: r.role,
        color: r.color,
        signingOrder: r.signingOrder,
        status: r.status,
      })),
      fields: fields.map(f => ({
        id: f.id,
        recipientId: f.recipientId,
        type: f.type,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
        page: f.page,
        required: f.required,
      })),
    });
  } catch (error) {
    console.error('[ESIGN] Error fetching envelope for correction:', error);
    res.status(500).json({ error: 'Failed to fetch envelope data' });
  }
});

// Update envelope (correction)
router.put('/envelopes/:id/correct', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const envelope = await findEnvelopeById(req.params.id, req.user.id);
    if (!envelope) {
      return res.status(404).json({ error: 'Envelope not found' });
    }

    // Verify envelope can be corrected
    if (envelope.status === 'completed' || envelope.status === 'voided' || envelope.status === 'declined') {
      return res.status(400).json({ error: `Cannot correct ${envelope.status} envelopes` });
    }

    // Check for any signatures
    const signedFields = await db
      .select()
      .from(esignFields)
      .where(and(
        eq(esignFields.envelopeId, envelope.id),
        sql`${esignFields.value} IS NOT NULL`
      ));

    if (signedFields.length > 0) {
      return res.status(400).json({ error: 'Cannot correct after signatures have been collected' });
    }

    // Check if any recipient has signed
    const existingRecipients = await db
      .select()
      .from(esignRecipients)
      .where(eq(esignRecipients.envelopeId, envelope.id));

    if (existingRecipients.some(r => r.status === 'signed')) {
      return res.status(400).json({ error: 'Cannot correct after a recipient has signed' });
    }

    const { title, message, signingOrder, recipients, fields } = req.body;

    // Start transaction-like operations
    const wasSent = envelope.status === 'sent';

    // Update envelope metadata
    await db
      .update(esignEnvelopes)
      .set({
        title: title || envelope.title,
        message: message !== undefined ? message : envelope.message,
        signingOrder: signingOrder || envelope.signingOrder,
        updatedAt: new Date(),
      })
      .where(eq(esignEnvelopes.id, envelope.id));

    // Track changes for audit log
    const changes: string[] = [];

    // Update recipients if provided
    if (recipients && Array.isArray(recipients)) {
      // Get existing recipient IDs
      const existingRecipientIds = new Set(existingRecipients.map(r => r.id));
      const newRecipientIds = new Set(recipients.filter((r: any) => r.id).map((r: any) => r.id));

      // Delete removed recipients (and their fields)
      const removedRecipientIds = [...existingRecipientIds].filter(id => !newRecipientIds.has(id));
      if (removedRecipientIds.length > 0) {
        // Delete fields for removed recipients
        for (const recipientId of removedRecipientIds) {
          await db.delete(esignFields).where(and(
            eq(esignFields.envelopeId, envelope.id),
            eq(esignFields.recipientId, recipientId)
          ));
        }
        // Delete the recipients
        for (const recipientId of removedRecipientIds) {
          await db.delete(esignRecipients).where(eq(esignRecipients.id, recipientId));
        }
        changes.push(`Removed ${removedRecipientIds.length} recipient(s)`);
      }

      // Update existing and add new recipients
      let colorIndex = 0;
      for (let i = 0; i < recipients.length; i++) {
        const r = recipients[i];
        const recipientColor = r.role === 'cc' ? ESIGN_CC_COLOR : ESIGN_RECIPIENT_COLORS[colorIndex % ESIGN_RECIPIENT_COLORS.length];
        if (r.role !== 'cc') colorIndex++;

        if (r.id && existingRecipientIds.has(r.id)) {
          // Update existing recipient
          await db
            .update(esignRecipients)
            .set({
              name: r.name,
              email: r.email,
              role: r.role || 'signer',
              color: recipientColor,
              signingOrder: i + 1,
            })
            .where(eq(esignRecipients.id, r.id));
        } else {
          // Add new recipient
          const accessToken = generateSecureToken();
          await db.insert(esignRecipients).values({
            envelopeId: envelope.id,
            name: r.name,
            email: r.email,
            role: r.role || 'signer',
            color: recipientColor,
            signingOrder: i + 1,
            status: 'pending',
            accessToken,
          });
          changes.push(`Added new recipient: ${r.name} (${r.email})`);
        }
      }
    }

    // Update fields if provided
    if (fields && Array.isArray(fields)) {
      // Get current recipients for mapping
      const currentRecipients = await db
        .select()
        .from(esignRecipients)
        .where(eq(esignRecipients.envelopeId, envelope.id))
        .orderBy(esignRecipients.signingOrder);

      // Delete all existing fields and recreate
      await db.delete(esignFields).where(eq(esignFields.envelopeId, envelope.id));

      // Insert new fields
      for (const field of fields) {
        // Map recipientIndex to actual recipient ID
        const recipientIndex = field.recipientIndex ?? 0;
        const recipient = currentRecipients[recipientIndex];

        if (recipient) {
          await db.insert(esignFields).values({
            envelopeId: envelope.id,
            recipientId: recipient.id,
            type: field.type,
            x: String(field.x),
            y: String(field.y),
            width: String(field.width),
            height: String(field.height),
            page: field.page,
            required: field.required !== false,
          });
        }
      }
      changes.push(`Updated ${fields.length} field(s)`);
    }

    // Log the correction
    await logAuditEvent(envelope.id, 'envelope_corrected', {
      changes,
      wasSent,
    }, req);

    // If envelope was already sent, we may need to notify recipients of the correction
    if (wasSent) {
      // Get updated recipients to potentially resend
      const updatedRecipients = await db
        .select()
        .from(esignRecipients)
        .where(eq(esignRecipients.envelopeId, envelope.id));

      // For now, we'll reset their status to pending and they'll need to be resent
      // Or optionally auto-resend (configurable)
      const { resendToRecipients } = req.body;

      if (resendToRecipients) {
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
        const senderEmail = sender?.email || '';
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const host = req.headers['host'] || '';
        const baseUrl = `${protocol}://${host}`;

        for (const recipient of updatedRecipients.filter(r => r.role === 'signer')) {
          try {
            const signingUrl = `${baseUrl}/esign/sign/${recipient.accessToken}`;
            await sendEsignInvitationEmail({
              recipientEmail: recipient.email,
              recipientName: recipient.name,
              senderName,
              senderEmail,
              documentTitle: title || envelope.title,
              message: `This document has been corrected. ${message || envelope.message || ''}`,
              signingUrl,
              branding: branding ? {
                companyName: branding.companyName || undefined,
                logoUrl: branding.logoUrl || undefined,
                primaryColor: branding.primaryColor || undefined,
              } : undefined,
              userId: req.user.id, // Send from user's OAuth email if connected
            });
            console.log(`[ESIGN] Sent correction notification to ${recipient.email}`);
          } catch (emailError) {
            console.error(`[ESIGN] Failed to send correction notification to ${recipient.email}:`, emailError);
          }
        }
      }
    }

    res.json({
      success: true,
      envelopeId: envelope.envelopeId,
      changes,
    });
  } catch (error: any) {
    console.error('[ESIGN] Error correcting envelope:', error);
    console.error('[ESIGN] Error stack:', error?.stack);
    console.error('[ESIGN] Request body:', JSON.stringify(req.body, null, 2));
    res.status(500).json({ error: 'Failed to correct envelope', details: error?.message || String(error) });
  }
});

// Send reminder (with recipientId in URL)
router.post('/envelopes/:id/remind/:recipientId', async (req: Request, res: Response) => {
  // Forward to main remind handler with recipientId in body
  req.body.recipientId = parseInt(req.params.recipientId);
  return reminderHandler(req, res);
});

// Send reminder (with recipientId in body or no recipientId to remind all)
router.post('/envelopes/:id/remind', async (req: Request, res: Response) => {
  return reminderHandler(req, res);
});

// Shared reminder handler
async function reminderHandler(req: Request, res: Response) {
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
      const signingUrl = `${process.env.APP_URL || 'https://brokervault.ai'}/esign/sign/${recipient.accessToken}`;
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
          userId: req.user.id, // Send from user's OAuth email if connected
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
}

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

      // If this envelope was created from a PowerForm, increment the completions counter
      if (envelope.powerFormTemplateId) {
        await db
          .update(esignTemplates)
          .set({
            powerFormCompletions: sql`${esignTemplates.powerFormCompletions} + 1`,
          })
          .where(eq(esignTemplates.id, envelope.powerFormTemplateId));
        console.log(`[ESIGN] Incremented PowerForm completions for template ${envelope.powerFormTemplateId}`);
      }

      // Dispatch esign.envelope_completed event to both webhooks and integrations
      const eventPayload = {
        envelope: {
          id: envelope.id,
          envelopeId: envelope.envelopeId,
          title: envelope.title,
          status: 'completed',
          completedAt: new Date().toISOString(),
          createdAt: envelope.createdAt?.toISOString(),
        },
        signers: allSigners.map(s => ({
          name: s.name,
          email: s.email,
          signedAt: s.signedAt?.toISOString(),
        })),
        recipient: {
          name: recipient.name,
          email: recipient.email,
        },
      };

      // Send to webhooks (legacy system)
      dispatchWebhookEvent(envelope.userId, 'esign.envelope_completed', eventPayload).catch(err => {
        console.error('Failed to dispatch esign.envelope_completed webhook event:', err);
      });

      // Send to integrations (new system)
      dispatchIntegrationEvent(envelope.userId, 'esign.envelope_completed', eventPayload).catch(err => {
        console.error('Failed to dispatch esign.envelope_completed integration event:', err);
      });

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
          auditLog.map(a => {
            // Find the recipient who performed this action (if any)
            const actor = a.recipientId ? allRecipients.find(r => r.id === a.recipientId) : null;
            return {
              action: a.action,
              actorName: actor?.name || null,
              actorEmail: actor?.email || null,
              createdAt: a.timestamp,
              ipAddress: a.ipAddress,
              location: a.location,
            };
          })
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
      const envelopeUrl = `${process.env.APP_URL || 'https://brokervault.ai'}/esign/envelope/${envelope.envelopeId}`;
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
        const signingUrl = `${process.env.APP_URL || 'https://brokervault.ai'}/esign/sign/${nextSigner.accessToken}`;

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
            userId: envelope.userId, // Send from user's OAuth email if connected
          });
          console.log(`[ESIGN] Sent sequential signing invitation to ${nextSigner.email}`);
        } catch (emailError) {
          console.error(`[ESIGN] Failed to send email to next signer:`, emailError);
        }
      }
    }

    // Check if this is a PowerForm envelope with remaining signers to add
    let nextSignerInfo = null;
    if (!allSigned && envelope.powerFormTemplateId) {
      const template = await db
        .select()
        .from(esignTemplates)
        .where(eq(esignTemplates.id, envelope.powerFormTemplateId))
        .then(r => r[0]);

      if (template) {
        const placeholderRecipients = template.placeholderRecipients as Array<{
          id: string;
          label: string;
          role: string;
          color: string;
          order: number;
        }>;

        // Find placeholder IDs that already have recipients
        const existingRecipientLabels = new Set(
          allSigners.map(s => s.placeholderLabel).filter(Boolean)
        );

        // Find the next placeholder that doesn't have a recipient yet
        const nextPlaceholder = placeholderRecipients
          .filter(p => p.role === 'signer' && !existingRecipientLabels.has(p.label))
          .sort((a, b) => a.order - b.order)[0];

        if (nextPlaceholder) {
          const settings = template.powerFormSettings as { allowLinkSharing?: boolean } || {};
          nextSignerInfo = {
            placeholderId: nextPlaceholder.id,
            label: nextPlaceholder.label,
            color: nextPlaceholder.color,
            allowLinkSharing: settings.allowLinkSharing !== false,
            envelopeId: envelope.envelopeId,
            currentSignerToken: token,
          };
        }
      }
    }

    res.json({
      success: true,
      envelopeCompleted: allSigned,
      nextSignerInfo,
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

// AI Document Summarization for signers using Claude Vision
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

    // Check for page images (used for vision-based summarization)
    const pageImages = envelope.pageImages as string[] | null;

    if (!pageImages || pageImages.length === 0) {
      return res.status(400).json({ error: 'No document pages available to summarize' });
    }

    const maxPages = 8;
    const totalPages = pageImages.length;
    const pagesAnalyzed = Math.min(totalPages, maxPages);

    console.log(`[ESIGN] Summarizing ${pagesAnalyzed} of ${totalPages} page(s) for recipient ${recipient.id} using Claude Vision`);

    // Use Claude Vision to analyze page images directly
    // Limit to first 8 pages to control costs while getting good coverage
    const summary = await summarizeDocumentWithVision(pageImages, maxPages);

    // Log audit event
    await logAuditEvent(envelope.id, 'document_summarized', recipient.id, getClientIP(req));

    res.json({
      success: true,
      summary: summary.summary,
      keyPoints: summary.keyPoints,
      importantTerms: summary.importantTerms,
      estimatedReadTime: summary.estimatedReadTime,
      totalPages,
      pagesAnalyzed,
      pageLimitReached: totalPages > maxPages,
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



export { router as esignEnvelopeRoutes };
