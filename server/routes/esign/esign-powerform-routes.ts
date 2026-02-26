/**
 * E-Sign PowerForm Routes
 * Manages public form functionality for e-signature templates
 */

import { Router, Request, Response } from 'express';
import { db } from '../../db';
import {
  esignTemplates,
  esignEnvelopes,
  esignRecipients,
  esignFields,
  esignAuditLog,
  userBranding,
  users,
  getFullName,
  updatePowerFormSchema,
  powerFormSettingsSchema,
  PowerFormSettings
} from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { z } from 'zod';
import { generateSecureToken } from '../../token-utils';
import { sendEsignInvitationEmail } from '../../email';

const router = Router();

// Enable/configure PowerForm on a template
router.post('/templates/:id/powerform', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const templateId = parseInt(req.params.id);
    if (isNaN(templateId)) {
      return res.status(400).json({ error: 'Invalid template ID' });
    }

    // Validate request body
    const validated = updatePowerFormSchema.parse(req.body);

    // Verify template ownership
    const [template] = await db
      .select()
      .from(esignTemplates)
      .where(
        and(
          eq(esignTemplates.id, templateId),
          eq(esignTemplates.userId, req.user.id)
        )
      );

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // If enabling PowerForm, validate and set up slug
    if (validated.enabled) {
      // Generate slug if not provided
      let slug = validated.slug;
      if (!slug) {
        // Generate from template name
        slug = template.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 40);

        // Add random suffix to ensure uniqueness
        slug = `${slug}-${generateSecureToken(4).toLowerCase()}`;
      }

      // Check if slug is already taken (by another template)
      const [existingSlug] = await db
        .select({ id: esignTemplates.id })
        .from(esignTemplates)
        .where(
          and(
            eq(esignTemplates.powerFormSlug, slug),
            sql`${esignTemplates.id} != ${templateId}`
          )
        );

      if (existingSlug) {
        return res.status(400).json({ error: 'This URL slug is already in use' });
      }

      // Parse and validate settings
      const settings: PowerFormSettings = validated.settings
        ? powerFormSettingsSchema.parse(validated.settings)
        : {
            multiSignerMode: 'choice',
            allowLinkSharing: true,
          };

      // Update template with PowerForm settings
      const [updated] = await db
        .update(esignTemplates)
        .set({
          powerFormEnabled: true,
          powerFormSlug: slug,
          powerFormSettings: settings,
          powerFormCreatedAt: template.powerFormCreatedAt || new Date(),
          updatedAt: new Date(),
        })
        .where(eq(esignTemplates.id, templateId))
        .returning();

      // Generate full URL
      const baseUrl = process.env.BASE_URL || '';
      const powerFormUrl = `${baseUrl}/esign/form/${slug}`;

      res.json({
        success: true,
        powerFormUrl,
        slug,
        settings,
        template: updated,
      });
    } else {
      // Disable PowerForm
      const [updated] = await db
        .update(esignTemplates)
        .set({
          powerFormEnabled: false,
          updatedAt: new Date(),
        })
        .where(eq(esignTemplates.id, templateId))
        .returning();

      res.json({
        success: true,
        template: updated,
      });
    }
  } catch (error) {
    console.error('[ESIGN] Error updating PowerForm settings:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to update PowerForm settings' });
  }
});

// Check if a PowerForm slug is available
router.get('/powerform/check-slug/:slug', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { slug } = req.params;
    const excludeTemplateId = req.query.excludeTemplateId
      ? parseInt(req.query.excludeTemplateId as string)
      : undefined;

    let query = db
      .select({ id: esignTemplates.id })
      .from(esignTemplates)
      .where(eq(esignTemplates.powerFormSlug, slug));

    const [existing] = await query;

    // Available if not exists, or if it's the template we're editing
    const available = !existing || (excludeTemplateId && existing.id === excludeTemplateId);

    res.json({ available, slug });
  } catch (error) {
    console.error('[ESIGN] Error checking PowerForm slug:', error);
    res.status(500).json({ error: 'Failed to check slug availability' });
  }
});

// Get PowerForm by slug (PUBLIC - no auth required)
router.get('/form/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    // Find the template by slug
    const [template] = await db
      .select()
      .from(esignTemplates)
      .where(
        and(
          eq(esignTemplates.powerFormSlug, slug),
          eq(esignTemplates.powerFormEnabled, true)
        )
      );

    if (!template) {
      return res.status(404).json({ error: 'PowerForm not found or not active' });
    }

    // Check if expired
    const settings = template.powerFormSettings as PowerFormSettings;
    if (settings.expiresAt) {
      const expiryDate = new Date(settings.expiresAt);
      if (expiryDate < new Date()) {
        return res.status(410).json({ error: 'This PowerForm has expired' });
      }
    }

    // Check if max completions reached
    if (settings.maxCompletions && template.powerFormCompletions >= settings.maxCompletions) {
      return res.status(410).json({ error: 'This PowerForm has reached its maximum number of completions' });
    }

    // Get template owner's branding
    const [owner] = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, template.userId));

    const [branding] = await db
      .select()
      .from(userBranding)
      .where(eq(userBranding.userId, template.userId));

    // Parse placeholder recipients
    const placeholderRecipients = template.placeholderRecipients as Array<{
      id: string;
      label: string;
      role: string;
      color: string;
      order: number;
    }>;

    // Filter to only signers (not CC)
    const signerPlaceholders = placeholderRecipients
      .filter(p => p.role === 'signer')
      .sort((a, b) => a.order - b.order);

    res.json({
      template: {
        id: template.id,
        name: template.name,
        description: template.description,
        pageImages: template.pageImages,
        totalPages: template.totalPages,
      },
      placeholderRecipients: signerPlaceholders,
      settings: {
        multiSignerMode: settings.multiSignerMode || 'choice',
        customMessage: settings.customMessage,
        allowLinkSharing: settings.allowLinkSharing !== false,
      },
      owner: owner ? {
        name: getFullName(owner) || owner.email?.split('@')[0],
      } : null,
      branding: branding ? {
        logoUrl: branding.logoUrl,
        companyName: branding.companyName,
        primaryColor: branding.primaryColor,
      } : null,
    });
  } catch (error) {
    console.error('[ESIGN] Error fetching PowerForm:', error);
    res.status(500).json({ error: 'Failed to fetch PowerForm' });
  }
});

// Start a PowerForm signing session (PUBLIC - no auth required)
router.post('/form/:slug/start', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    // Validate request body
    const startSchema = z.object({
      signers: z.array(z.object({
        placeholderId: z.string(),
        name: z.string().min(1, 'Name is required'),
        email: z.string().email('Valid email is required'),
      })).min(1, 'At least one signer is required'),
      multiSignerMode: z.enum(['upfront', 'sequential']).optional(),
    });

    const validated = startSchema.parse(req.body);

    // Find the template
    const [template] = await db
      .select()
      .from(esignTemplates)
      .where(
        and(
          eq(esignTemplates.powerFormSlug, slug),
          eq(esignTemplates.powerFormEnabled, true)
        )
      );

    if (!template) {
      return res.status(404).json({ error: 'PowerForm not found or not active' });
    }

    // Check expiration and max completions
    const settings = template.powerFormSettings as PowerFormSettings;
    if (settings.expiresAt && new Date(settings.expiresAt) < new Date()) {
      return res.status(410).json({ error: 'This PowerForm has expired' });
    }
    if (settings.maxCompletions && template.powerFormCompletions >= settings.maxCompletions) {
      return res.status(410).json({ error: 'This PowerForm has reached its maximum number of completions' });
    }

    // Get template fields and placeholder recipients
    const templateFields = template.fields as Array<{
      id: string;
      type: string;
      x: number;
      y: number;
      width: number;
      height: number;
      page: number;
      assignedTo: string;
      required: boolean;
    }>;

    const placeholderRecipients = template.placeholderRecipients as Array<{
      id: string;
      label: string;
      role: string;
      color: string;
      order: number;
    }>;

    // Determine signing order based on mode
    const effectiveMode = validated.multiSignerMode || settings.multiSignerMode || 'choice';
    const signingOrder = effectiveMode === 'upfront' ? 'parallel' : 'sequential';

    // Generate envelope ID
    const envelopeId = `env_${generateSecureToken(12)}`;

    // Create the envelope
    const [envelope] = await db
      .insert(esignEnvelopes)
      .values({
        envelopeId,
        userId: template.userId,
        title: template.name,
        message: settings.customMessage || null,
        status: 'sent',
        signingOrder,
        documentUrl: template.documentUrl,
        pageImages: template.pageImages,
        totalPages: template.totalPages,
        templateId: template.id,
        powerFormTemplateId: template.id,
        documentHash: null,
      })
      .returning();

    // Create mapping from placeholder ID to signer info
    const signerMap = new Map(
      validated.signers.map(s => [s.placeholderId, s])
    );

    // Create recipients
    const createdRecipients: Array<{
      id: number;
      placeholderId: string;
      accessToken: string;
      name: string;
      email: string;
      order: number;
    }> = [];

    for (const placeholder of placeholderRecipients) {
      const signerInfo = signerMap.get(placeholder.id);

      if (placeholder.role === 'signer' && !signerInfo) {
        if (effectiveMode === 'upfront') {
          return res.status(400).json({
            error: `Missing signer information for ${placeholder.label}`
          });
        }
        continue;
      }

      const accessToken = generateSecureToken(24);

      const [recipient] = await db
        .insert(esignRecipients)
        .values({
          envelopeId: envelope.id,
          name: signerInfo?.name || placeholder.label,
          email: signerInfo?.email || '',
          role: placeholder.role as 'signer' | 'cc',
          placeholderLabel: placeholder.label,
          color: placeholder.color,
          signingOrder: placeholder.order,
          status: 'sent',
          accessToken,
          sentAt: new Date(),
          invitedVia: 'powerform_link',
        })
        .returning();

      if (signerInfo) {
        createdRecipients.push({
          id: recipient.id,
          placeholderId: placeholder.id,
          accessToken,
          name: signerInfo.name,
          email: signerInfo.email,
          order: placeholder.order,
        });
      }
    }

    // Create fields for each recipient
    for (const field of templateFields) {
      const recipient = createdRecipients.find(r => r.placeholderId === field.assignedTo);
      if (!recipient) continue;

      await db.insert(esignFields).values({
        envelopeId: envelope.id,
        recipientId: recipient.id,
        type: field.type,
        x: String(field.x),
        y: String(field.y),
        width: String(field.width),
        height: String(field.height),
        page: field.page,
        required: field.required,
      });
    }

    // Log audit event
    await db.insert(esignAuditLog).values({
      envelopeId: envelope.id,
      action: 'envelope_created',
      details: {
        source: 'powerform',
        powerFormSlug: slug,
        templateId: template.id,
        signerCount: createdRecipients.length,
      },
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    });

    // Get first signer
    const firstSigner = createdRecipients.sort((a, b) => a.order - b.order)[0];

    if (!firstSigner) {
      return res.status(400).json({ error: 'No signers were created' });
    }

    // Generate signing URL
    const baseUrl = process.env.BASE_URL || '';
    const signingUrl = `${baseUrl}/esign/sign/${firstSigner.accessToken}`;

    res.json({
      success: true,
      envelopeId: envelope.envelopeId,
      signingToken: firstSigner.accessToken,
      signingUrl,
      recipients: createdRecipients.map(r => ({
        id: r.id,
        name: r.name,
        email: r.email,
        order: r.order,
        signingUrl: `${baseUrl}/esign/sign/${r.accessToken}`,
      })),
    });
  } catch (error) {
    console.error('[ESIGN] Error starting PowerForm session:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to start PowerForm session' });
  }
});

// Add next signer to a PowerForm envelope (for sequential mode)
router.post('/form/envelope/:envelopeId/add-signer', async (req: Request, res: Response) => {
  try {
    const { envelopeId } = req.params;

    // Validate request
    const addSignerSchema = z.object({
      currentSignerToken: z.string(),
      nextSigner: z.object({
        placeholderId: z.string(),
        name: z.string().min(1),
        email: z.string().email(),
      }),
      sendEmail: z.boolean().default(false),
    });

    const validated = addSignerSchema.parse(req.body);

    // Find the envelope
    const [envelope] = await db
      .select()
      .from(esignEnvelopes)
      .where(eq(esignEnvelopes.envelopeId, envelopeId));

    if (!envelope) {
      return res.status(404).json({ error: 'Envelope not found' });
    }

    // Verify current signer token
    const [currentSigner] = await db
      .select()
      .from(esignRecipients)
      .where(
        and(
          eq(esignRecipients.envelopeId, envelope.id),
          eq(esignRecipients.accessToken, validated.currentSignerToken)
        )
      );

    if (!currentSigner) {
      return res.status(403).json({ error: 'Invalid signer token' });
    }

    // Get the template for placeholder info
    const template = envelope.powerFormTemplateId
      ? await db.select().from(esignTemplates).where(eq(esignTemplates.id, envelope.powerFormTemplateId)).then(r => r[0])
      : null;

    if (!template) {
      return res.status(400).json({ error: 'Template not found for this PowerForm envelope' });
    }

    const placeholderRecipients = template.placeholderRecipients as Array<{
      id: string;
      label: string;
      role: string;
      color: string;
      order: number;
    }>;

    const placeholder = placeholderRecipients.find(p => p.id === validated.nextSigner.placeholderId);
    if (!placeholder) {
      return res.status(400).json({ error: 'Invalid placeholder ID' });
    }

    // Create the new recipient
    const accessToken = generateSecureToken(24);

    const [newRecipient] = await db
      .insert(esignRecipients)
      .values({
        envelopeId: envelope.id,
        name: validated.nextSigner.name,
        email: validated.nextSigner.email,
        role: 'signer',
        placeholderLabel: placeholder.label,
        color: placeholder.color,
        signingOrder: placeholder.order,
        status: 'sent',
        accessToken,
        sentAt: new Date(),
        invitedVia: validated.sendEmail ? 'email' : 'link_share',
        invitedByRecipientId: currentSigner.id,
      })
      .returning();

    // Create fields for the new recipient
    const templateFields = template.fields as Array<{
      id: string;
      type: string;
      x: number;
      y: number;
      width: number;
      height: number;
      page: number;
      assignedTo: string;
      required: boolean;
    }>;

    for (const field of templateFields) {
      if (field.assignedTo === validated.nextSigner.placeholderId) {
        await db.insert(esignFields).values({
          envelopeId: envelope.id,
          recipientId: newRecipient.id,
          type: field.type,
          x: String(field.x),
          y: String(field.y),
          width: String(field.width),
          height: String(field.height),
          page: field.page,
          required: field.required,
        });
      }
    }

    // Log audit event
    await db.insert(esignAuditLog).values({
      envelopeId: envelope.id,
      recipientId: newRecipient.id,
      action: 'recipient_added',
      details: {
        addedBy: currentSigner.email,
        method: validated.sendEmail ? 'email' : 'link_share',
      },
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    });

    const baseUrl = process.env.BASE_URL || '';
    const signingUrl = `${baseUrl}/esign/sign/${accessToken}`;

    // Send email if requested
    if (validated.sendEmail) {
      const [owner] = await db
        .select()
        .from(users)
        .where(eq(users.id, envelope.userId));

      const [branding] = await db
        .select()
        .from(userBranding)
        .where(eq(userBranding.userId, envelope.userId));

      await sendEsignInvitationEmail({
        recipientEmail: validated.nextSigner.email,
        recipientName: validated.nextSigner.name,
        senderName: currentSigner.name,
        senderEmail: owner?.email || currentSigner.email,
        documentTitle: envelope.title,
        message: envelope.message || undefined,
        signingUrl,
        branding: branding || undefined,
        userId: envelope.userId,
      });
    }

    res.json({
      success: true,
      recipient: {
        id: newRecipient.id,
        name: newRecipient.name,
        email: newRecipient.email,
        signingUrl,
      },
      emailSent: validated.sendEmail,
    });
  } catch (error) {
    console.error('[ESIGN] Error adding signer to PowerForm envelope:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to add signer' });
  }
});

// List PowerForms for the current user
router.get('/powerforms', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const templates = await db
      .select()
      .from(esignTemplates)
      .where(
        and(
          eq(esignTemplates.userId, req.user.id),
          eq(esignTemplates.powerFormEnabled, true)
        )
      )
      .orderBy(desc(esignTemplates.powerFormCreatedAt));

    const baseUrl = process.env.BASE_URL || '';

    const powerForms = templates.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      slug: t.powerFormSlug,
      url: `${baseUrl}/esign/form/${t.powerFormSlug}`,
      settings: t.powerFormSettings,
      completions: t.powerFormCompletions,
      createdAt: t.powerFormCreatedAt,
    }));

    res.json(powerForms);
  } catch (error) {
    console.error('[ESIGN] Error fetching PowerForms:', error);
    res.status(500).json({ error: 'Failed to fetch PowerForms' });
  }
});

export { router as esignPowerformRoutes };
