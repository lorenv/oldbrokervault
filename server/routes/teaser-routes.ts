import { Router } from 'express';
import { db } from '../db';
import {
  teasers,
  teaserViews,
  userTeaserTags,
  cimDocuments,
  users,
  insertTeaserSchema,
  updateTeaserSchema,
  insertTeaserViewSchema,
  insertUserTeaserTagSchema,
  TEASER_INDUSTRY_TAGS,
  TEASER_DEAL_TYPE_TAGS
} from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import OpenAI from 'openai';
import * as crypto from 'crypto';
import PDFDocument from 'pdfkit';
import fetch from 'node-fetch';
import QRCode from 'qrcode';
import bcrypt from 'bcryptjs';

// Constants for bcrypt password hashing
const BCRYPT_ROUNDS = 10;

// Helper function to hash a share password
async function hashSharePassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

// Helper function to verify a share password
// Handles both bcrypt hashed passwords and legacy plaintext passwords
async function verifySharePassword(providedPassword: string, storedPassword: string): Promise<boolean> {
  // Check if the stored password is a bcrypt hash (starts with $2a$ or $2b$)
  if (storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$')) {
    return bcrypt.compare(providedPassword, storedPassword);
  }
  // Legacy plaintext password - use timing-safe comparison
  const providedBuffer = Buffer.from(providedPassword);
  const storedBuffer = Buffer.from(storedPassword);
  if (providedBuffer.length !== storedBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(providedBuffer, storedBuffer);
}

const router = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Generate a URL-friendly slug
function generateSlug(headline: string): string {
  const baseSlug = headline
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50);
  const randomSuffix = crypto.randomBytes(3).toString('hex');
  return `${baseSlug}-${randomSuffix}`;
}

// AI function to generate teaser content from CIM
async function generateTeaserContent(cimContent: string, cimTitle: string): Promise<{
  headline: string;
  summary: string;
  suggestedIndustryTags: string[];
  suggestedDealTypeTags: string[];
}> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are creating a teaser for a confidential business sale listing. A teaser is a sanitized, high-level overview that potential buyers see before signing an NDA.

IMPORTANT RULES:
- Do NOT include any specific company names, owner names, or employee names
- Do NOT include specific numbers, revenue figures, or financial data
- Do NOT include proprietary information, trade secrets, or competitive advantages in detail
- Do NOT use placeholders like "[redacted]" or "[company name]" - instead, write naturally without mentioning specifics
- Write in a formal, professional tone suitable for M&A transactions
- Keep the summary between 1-4 paragraphs (150-400 words)
- The headline should be compelling but generic enough to not identify the business (10-15 words max)

Available industry tags: ${TEASER_INDUSTRY_TAGS.join(', ')}
Available deal type tags: ${TEASER_DEAL_TYPE_TAGS.join(', ')}`
        },
        {
          role: "user",
          content: `Based on the following CIM content, generate a teaser. Respond in JSON format with these fields:
- headline: A compelling headline (10-15 words max)
- summary: A summary (1-4 paragraphs, 150-400 words) that describes the business opportunity generically without any specific names or numbers
- suggestedIndustryTags: Array of 1-3 industry tags from the available list
- suggestedDealTypeTags: Array of 1-2 deal type tags from the available list

CIM Title: ${cimTitle}

CIM Content:
${cimContent.substring(0, 12000)}`
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 2000,
      temperature: 0.7,
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');

    return {
      headline: result.headline || 'Attractive Business Opportunity',
      summary: result.summary || '',
      suggestedIndustryTags: result.suggestedIndustryTags || [],
      suggestedDealTypeTags: result.suggestedDealTypeTags || [],
    };
  } catch (error: any) {
    console.error('[TEASER] AI generation failed:', error);
    throw new Error(`Failed to generate teaser content: ${error.message}`);
  }
}

// ==================== AUTHENTICATED ROUTES ====================

// Get teaser for a CIM document
router.get('/cim/:documentId', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const documentId = parseInt(req.params.documentId);

    // Verify user owns the document
    const [doc] = await db
      .select()
      .from(cimDocuments)
      .where(and(
        eq(cimDocuments.id, documentId),
        eq(cimDocuments.userId, req.user!.id)
      ));

    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Get teaser if it exists
    const [teaser] = await db
      .select()
      .from(teasers)
      .where(eq(teasers.documentId, documentId));

    res.json(teaser || null);
  } catch (error) {
    console.error('Error fetching teaser:', error);
    res.status(500).json({ error: 'Failed to fetch teaser' });
  }
});

// Create teaser for a CIM document (with AI generation)
router.post('/cim/:documentId', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const documentId = parseInt(req.params.documentId);

    // Verify user owns the document
    const [doc] = await db
      .select()
      .from(cimDocuments)
      .where(and(
        eq(cimDocuments.id, documentId),
        eq(cimDocuments.userId, req.user!.id)
      ));

    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check if teaser already exists
    const [existingTeaser] = await db
      .select()
      .from(teasers)
      .where(eq(teasers.documentId, documentId));

    if (existingTeaser) {
      return res.status(400).json({ error: 'Teaser already exists for this document' });
    }

    // Get CIM content for AI generation
    let cimContent = '';
    if (doc.analysis && typeof doc.analysis === 'object') {
      // Extract text from analysis sections
      const analysis = doc.analysis as any;
      if (analysis.sections) {
        cimContent = analysis.sections
          .map((s: any) => `${s.title || ''}\n${s.content || ''}`)
          .join('\n\n');
      }
    }
    if (!cimContent && doc.transcript) {
      cimContent = doc.transcript;
    }

    // Generate teaser content with AI
    const aiContent = await generateTeaserContent(cimContent, doc.title);

    // Generate URL slug from headline
    const shareSlug = generateSlug(aiContent.headline);

    // Get financials from CIM if available
    const revenue = doc.revenue || '';
    const earnings = doc.ebitda || '';
    const askingPrice = doc.askingPrice || '';

    // Create the teaser
    const [newTeaser] = await db
      .insert(teasers)
      .values({
        documentId,
        headline: aiContent.headline,
        summary: aiContent.summary,
        industryTags: aiContent.suggestedIndustryTags,
        dealTypeTags: aiContent.suggestedDealTypeTags,
        coverImageUrl: null,
        useCimCoverImage: true,
        showFinancials: false,
        revenue,
        earnings,
        askingPrice,
        shareSlug,
        isPublished: false,
        includeWatermark: true,
        lastSyncedAt: new Date(),
        cimUpdatedSinceSync: false,
      })
      .returning();

    res.status(201).json(newTeaser);
  } catch (error) {
    console.error('Error creating teaser:', error);
    res.status(500).json({ error: 'Failed to create teaser' });
  }
});

// Update teaser
router.put('/cim/:documentId', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const documentId = parseInt(req.params.documentId);

    // Verify user owns the document
    const [doc] = await db
      .select()
      .from(cimDocuments)
      .where(and(
        eq(cimDocuments.id, documentId),
        eq(cimDocuments.userId, req.user!.id)
      ));

    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Validate update data
    const updateData = updateTeaserSchema.parse(req.body);

    // If shareSlug is being updated, check for uniqueness
    if (updateData.shareSlug) {
      const [existing] = await db
        .select()
        .from(teasers)
        .where(and(
          eq(teasers.shareSlug, updateData.shareSlug),
          sql`${teasers.documentId} != ${documentId}`
        ));

      if (existing) {
        return res.status(400).json({ error: 'This URL slug is already in use' });
      }
    }

    // Hash the sharePassword if provided
    let hashedPassword: string | null | undefined = updateData.sharePassword;
    if (updateData.sharePassword !== undefined) {
      if (updateData.sharePassword && updateData.sharePassword.trim()) {
        hashedPassword = await hashSharePassword(updateData.sharePassword);
      } else {
        hashedPassword = null;
      }
    }

    // Update the teaser
    const [updatedTeaser] = await db
      .update(teasers)
      .set({
        ...updateData,
        sharePassword: hashedPassword !== undefined ? hashedPassword : updateData.sharePassword,
        updatedAt: new Date(),
      })
      .where(eq(teasers.documentId, documentId))
      .returning();

    if (!updatedTeaser) {
      return res.status(404).json({ error: 'Teaser not found' });
    }

    res.json(updatedTeaser);
  } catch (error) {
    console.error('Error updating teaser:', error);
    res.status(500).json({ error: 'Failed to update teaser' });
  }
});

// Delete teaser
router.delete('/cim/:documentId', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const documentId = parseInt(req.params.documentId);

    // Verify user owns the document
    const [doc] = await db
      .select()
      .from(cimDocuments)
      .where(and(
        eq(cimDocuments.id, documentId),
        eq(cimDocuments.userId, req.user!.id)
      ));

    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Delete the teaser
    await db
      .delete(teasers)
      .where(eq(teasers.documentId, documentId));

    res.sendStatus(204);
  } catch (error) {
    console.error('Error deleting teaser:', error);
    res.status(500).json({ error: 'Failed to delete teaser' });
  }
});

// Refresh teaser from CIM (regenerate AI content)
router.post('/cim/:documentId/refresh', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const documentId = parseInt(req.params.documentId);

    // Verify user owns the document
    const [doc] = await db
      .select()
      .from(cimDocuments)
      .where(and(
        eq(cimDocuments.id, documentId),
        eq(cimDocuments.userId, req.user!.id)
      ));

    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Get existing teaser
    const [existingTeaser] = await db
      .select()
      .from(teasers)
      .where(eq(teasers.documentId, documentId));

    if (!existingTeaser) {
      return res.status(404).json({ error: 'Teaser not found' });
    }

    // Get CIM content for AI generation
    let cimContent = '';
    if (doc.analysis && typeof doc.analysis === 'object') {
      const analysis = doc.analysis as any;
      if (analysis.sections) {
        cimContent = analysis.sections
          .map((s: any) => `${s.title || ''}\n${s.content || ''}`)
          .join('\n\n');
      }
    }
    if (!cimContent && doc.transcript) {
      cimContent = doc.transcript;
    }

    // Regenerate teaser content with AI
    const aiContent = await generateTeaserContent(cimContent, doc.title);

    // Update teaser with new content
    const [updatedTeaser] = await db
      .update(teasers)
      .set({
        headline: aiContent.headline,
        summary: aiContent.summary,
        industryTags: aiContent.suggestedIndustryTags,
        dealTypeTags: aiContent.suggestedDealTypeTags,
        revenue: doc.revenue || existingTeaser.revenue,
        earnings: doc.ebitda || existingTeaser.earnings,
        askingPrice: doc.askingPrice || existingTeaser.askingPrice,
        lastSyncedAt: new Date(),
        cimUpdatedSinceSync: false,
        updatedAt: new Date(),
      })
      .where(eq(teasers.documentId, documentId))
      .returning();

    res.json(updatedTeaser);
  } catch (error) {
    console.error('Error refreshing teaser:', error);
    res.status(500).json({ error: 'Failed to refresh teaser' });
  }
});

// Get teaser analytics
router.get('/cim/:documentId/analytics', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const documentId = parseInt(req.params.documentId);

    // Verify user owns the document
    const [doc] = await db
      .select()
      .from(cimDocuments)
      .where(and(
        eq(cimDocuments.id, documentId),
        eq(cimDocuments.userId, req.user!.id)
      ));

    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Get teaser
    const [teaser] = await db
      .select()
      .from(teasers)
      .where(eq(teasers.documentId, documentId));

    if (!teaser) {
      return res.status(404).json({ error: 'Teaser not found' });
    }

    // Get view statistics
    const views = await db
      .select()
      .from(teaserViews)
      .where(eq(teaserViews.teaserId, teaser.id))
      .orderBy(desc(teaserViews.createdAt))
      .limit(100);

    const totalViews = teaser.viewCount;
    const ndaClicks = views.filter(v => v.clickedSignNda).length;
    const contactClicks = views.filter(v => v.clickedContact).length;
    const avgTimeSpent = views.length > 0
      ? Math.round(views.reduce((sum, v) => sum + v.timeSpentSeconds, 0) / views.length)
      : 0;

    res.json({
      totalViews,
      ndaClicks,
      contactClicks,
      avgTimeSpentSeconds: avgTimeSpent,
      recentViews: views.slice(0, 20),
    });
  } catch (error) {
    console.error('Error fetching teaser analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// ==================== TAG ROUTES ====================

// Get predefined and custom tags
router.get('/tags', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    // Get user's custom tags
    const customTags = await db
      .select()
      .from(userTeaserTags)
      .where(eq(userTeaserTags.userId, req.user!.id))
      .orderBy(userTeaserTags.tagValue);

    const customIndustryTags = customTags
      .filter(t => t.tagType === 'industry')
      .map(t => t.tagValue);

    const customDealTypeTags = customTags
      .filter(t => t.tagType === 'deal_type')
      .map(t => t.tagValue);

    res.json({
      industryTags: [...TEASER_INDUSTRY_TAGS, ...customIndustryTags],
      dealTypeTags: [...TEASER_DEAL_TYPE_TAGS, ...customDealTypeTags],
      customIndustryTags,
      customDealTypeTags,
    });
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

// Add custom tag
router.post('/tags', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const data = insertUserTeaserTagSchema.parse(req.body);

    // Check if tag already exists for this user
    const [existing] = await db
      .select()
      .from(userTeaserTags)
      .where(and(
        eq(userTeaserTags.userId, req.user!.id),
        eq(userTeaserTags.tagType, data.tagType),
        eq(userTeaserTags.tagValue, data.tagValue)
      ));

    if (existing) {
      return res.status(400).json({ error: 'Tag already exists' });
    }

    const [newTag] = await db
      .insert(userTeaserTags)
      .values({
        userId: req.user!.id,
        tagType: data.tagType,
        tagValue: data.tagValue,
      })
      .returning();

    res.status(201).json(newTag);
  } catch (error) {
    console.error('Error creating tag:', error);
    res.status(500).json({ error: 'Failed to create tag' });
  }
});

// Delete custom tag
router.delete('/tags/:tagType/:tagValue', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const { tagType, tagValue } = req.params;

    // Validate tag type
    if (tagType !== 'industry' && tagType !== 'deal_type') {
      return res.status(400).json({ error: 'Invalid tag type' });
    }

    // Delete the tag
    const result = await db
      .delete(userTeaserTags)
      .where(and(
        eq(userTeaserTags.userId, req.user!.id),
        eq(userTeaserTags.tagType, tagType),
        eq(userTeaserTags.tagValue, decodeURIComponent(tagValue))
      ));

    res.sendStatus(204);
  } catch (error) {
    console.error('Error deleting tag:', error);
    res.status(500).json({ error: 'Failed to delete tag' });
  }
});

// ==================== PUBLIC ROUTES ====================

// Check if teaser exists and if it needs password (quick check for UI)
router.get('/public/:slug/check', async (req, res) => {
  try {
    const { slug } = req.params;

    const [teaser] = await db
      .select({
        id: teasers.id,
        isPublished: teasers.isPublished,
        sharePassword: teasers.sharePassword,
        headline: teasers.headline,
      })
      .from(teasers)
      .where(eq(teasers.shareSlug, slug));

    if (!teaser) {
      return res.status(404).json({ error: 'Teaser not found' });
    }

    if (!teaser.isPublished) {
      return res.status(404).json({ error: 'Teaser not found' });
    }

    // Explicitly check for password requirement as boolean
    const hasPassword = teaser.sharePassword !== null && teaser.sharePassword !== '';

    res.json({
      exists: true,
      requiresPassword: hasPassword,
      headline: teaser.headline,
    });
  } catch (error) {
    console.error('Error checking teaser:', error);
    res.status(500).json({ error: 'Failed to check teaser' });
  }
});

// Get public teaser data
router.get('/public/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const { password } = req.query;

    console.log(`[TEASER] Fetching public teaser: ${slug}`);

    // Get teaser with owner info
    const [result] = await db
      .select({
        teaser: teasers,
        document: {
          id: cimDocuments.id,
          title: cimDocuments.title,
          coverImageUrl: cimDocuments.coverImageUrl,
          shareSlug: cimDocuments.shareSlug,
          customSlug: cimDocuments.customSlug,
          ndaProtected: cimDocuments.ndaProtected,
        },
        owner: {
          businessName: users.businessName,
          businessLogo: users.businessLogo,
          profilePhoto: users.profilePhoto,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          phoneNumber: users.phoneNumber,
        },
      })
      .from(teasers)
      .innerJoin(cimDocuments, eq(teasers.documentId, cimDocuments.id))
      .innerJoin(users, eq(cimDocuments.userId, users.id))
      .where(eq(teasers.shareSlug, slug));

    if (!result) {
      console.log(`[TEASER] Teaser not found for slug: ${slug}`);
      return res.status(404).json({ error: 'Teaser not found' });
    }

    const { teaser, document, owner } = result;
    console.log(`[TEASER] Found teaser id=${teaser.id}, isPublished=${teaser.isPublished}`);

    // Check if published
    if (!teaser.isPublished) {
      console.log(`[TEASER] Teaser is not published: ${slug}`);
      return res.status(404).json({ error: 'Teaser not found' });
    }

    // Check password if required
    if (teaser.sharePassword) {
      console.log(`[TEASER] Password protected teaser, checking password`);
      const passwordsMatch = password ? await verifySharePassword(password as string, teaser.sharePassword) : false;
      if (!password || !passwordsMatch) {
        return res.status(401).json({ error: 'Password required', requiresPassword: true });
      }
    }

    console.log(`[TEASER] Teaser access granted, tracking view`);

    // Get cover image URL (teaser-specific or from CIM)
    const coverImageUrl = teaser.useCimCoverImage
      ? document.coverImageUrl
      : teaser.coverImageUrl;

    // Get CIM share link for "Sign NDA" button
    const cimShareSlug = document.customSlug || document.shareSlug;

    // Track view
    const sessionId = crypto.randomBytes(16).toString('hex');
    await db.insert(teaserViews).values({
      teaserId: teaser.id,
      viewerIp: req.ip || null,
      viewerUserAgent: req.headers['user-agent'] || null,
      referrer: req.headers.referer || null,
      sessionId,
    });

    // Update view count
    await db
      .update(teasers)
      .set({
        viewCount: sql`${teasers.viewCount} + 1`,
        lastViewedAt: new Date(),
      })
      .where(eq(teasers.id, teaser.id));

    res.json({
      headline: teaser.headline,
      summary: teaser.summary,
      industryTags: teaser.industryTags,
      dealTypeTags: teaser.dealTypeTags,
      coverImageUrl,
      showFinancials: teaser.showFinancials,
      financials: teaser.showFinancials ? {
        revenue: teaser.revenue,
        earnings: teaser.earnings,
        askingPrice: teaser.askingPrice,
      } : null,
      broker: {
        businessName: owner.businessName,
        businessLogo: owner.businessLogo,
        profilePhoto: owner.profilePhoto,
        email: owner.email,
        name: [owner.firstName, owner.lastName].filter(Boolean).join(' '),
        phone: owner.phoneNumber,
      },
      cimShareSlug,
      ndaProtected: document.ndaProtected,
      sessionId,
    });
  } catch (error) {
    console.error('Error fetching public teaser:', error);
    res.status(500).json({ error: 'Failed to fetch teaser' });
  }
});

// Track teaser engagement (heartbeat for time spent)
router.post('/public/:slug/heartbeat', async (req, res) => {
  try {
    const { slug } = req.params;
    const { sessionId, timeSpentSeconds } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }

    // Update time spent
    await db
      .update(teaserViews)
      .set({
        timeSpentSeconds: timeSpentSeconds || 0,
      })
      .where(eq(teaserViews.sessionId, sessionId));

    res.sendStatus(200);
  } catch (error) {
    console.error('Error updating heartbeat:', error);
    res.status(500).json({ error: 'Failed to update' });
  }
});

// Track click events
router.post('/public/:slug/click', async (req, res) => {
  try {
    const { sessionId, action } = req.body;

    if (!sessionId || !action) {
      return res.status(400).json({ error: 'Session ID and action required' });
    }

    const updateData: any = {};
    if (action === 'sign_nda') {
      updateData.clickedSignNda = true;
    } else if (action === 'contact') {
      updateData.clickedContact = true;
    }

    await db
      .update(teaserViews)
      .set(updateData)
      .where(eq(teaserViews.sessionId, sessionId));

    res.sendStatus(200);
  } catch (error) {
    console.error('Error tracking click:', error);
    res.status(500).json({ error: 'Failed to track' });
  }
});

// PDF Export for public teaser
router.get('/public/:slug/export/pdf', async (req, res) => {
  try {
    const { slug } = req.params;
    const { password } = req.query;

    // Get teaser with owner info
    const [result] = await db
      .select({
        teaser: teasers,
        document: {
          id: cimDocuments.id,
          title: cimDocuments.title,
          coverImageUrl: cimDocuments.coverImageUrl,
        },
        owner: {
          businessName: users.businessName,
          businessLogo: users.businessLogo,
          profilePhoto: users.profilePhoto,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          phoneNumber: users.phoneNumber,
        },
      })
      .from(teasers)
      .innerJoin(cimDocuments, eq(teasers.documentId, cimDocuments.id))
      .innerJoin(users, eq(cimDocuments.userId, users.id))
      .where(eq(teasers.shareSlug, slug));

    if (!result) {
      return res.status(404).json({ error: 'Teaser not found' });
    }

    const { teaser, document, owner } = result;

    // Check if published
    if (!teaser.isPublished) {
      return res.status(404).json({ error: 'Teaser not found' });
    }

    // Check password if required
    if (teaser.sharePassword) {
      const passwordsMatch = password ? await verifySharePassword(password as string, teaser.sharePassword) : false;
      if (!password || !passwordsMatch) {
        return res.status(401).json({ error: 'Password required' });
      }
    }

    // Get cover image URL
    const coverImageUrl = teaser.useCimCoverImage
      ? document.coverImageUrl
      : teaser.coverImageUrl;

    // Create PDF
    const doc = new PDFDocument({
      size: 'LETTER',
      margin: 50,
      info: {
        Title: teaser.headline || 'Teaser',
        Author: owner.businessName || 'Confidential',
      },
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="teaser-${slug}.pdf"`
    );

    // Pipe PDF to response
    doc.pipe(res);

    // Helper function to fetch image buffer from various URL types
    const fetchImageBuffer = async (imageUrl: string): Promise<Buffer | null> => {
      try {
        if (!imageUrl) return null;

        console.log(`[PDF] Fetching image: ${imageUrl.substring(0, 100)}`);

        if (imageUrl.startsWith('data:')) {
          // Base64 image
          const base64Data = imageUrl.split(',')[1];
          return Buffer.from(base64Data, 'base64');
        } else if (imageUrl.startsWith('http')) {
          // External URL - fetch the image
          const response = await fetch(imageUrl);
          if (!response.ok) {
            console.log(`[PDF] External image fetch failed: ${response.status}`);
            return null;
          }
          return await response.buffer();
        } else if (imageUrl.startsWith('/api/')) {
          // Local API path - build full URL from request host
          const protocol = req.headers['x-forwarded-proto'] || 'https';
          const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:5000';
          const fullUrl = `${protocol}://${host}${imageUrl}`;
          console.log(`[PDF] Fetching local image from: ${fullUrl}`);
          const response = await fetch(fullUrl);
          if (!response.ok) {
            console.log(`[PDF] Local image fetch failed: ${response.status}`);
            return null;
          }
          return await response.buffer();
        }
        return null;
      } catch (e) {
        console.error('[PDF] Error fetching image:', e);
        return null;
      }
    };

    // Generate QR code for online version
    const teaserUrl = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers['x-forwarded-host'] || req.headers.host}/teaser/${slug}`;
    let qrCodeBuffer: Buffer | null = null;
    try {
      const qrDataUrl = await QRCode.toDataURL(teaserUrl, {
        width: 80,
        margin: 1,
        color: { dark: '#1a1a1a', light: '#ffffff' }
      });
      const base64Data = qrDataUrl.split(',')[1];
      qrCodeBuffer = Buffer.from(base64Data, 'base64');
      console.log(`[PDF] QR code generated for: ${teaserUrl}`);
    } catch (e) {
      console.error('[PDF] Error generating QR code:', e);
    }

    let yPosition = 50;

    // Add cover image if available
    if (coverImageUrl) {
      try {
        const coverBuffer = await fetchImageBuffer(coverImageUrl);
        if (coverBuffer) {
          // Add cover image at top, scaled to fit width
          doc.image(coverBuffer, 50, yPosition, {
            width: 510, // Full width minus margins
            height: 150,
            fit: [510, 150],
            align: 'center',
            valign: 'center'
          });
          yPosition += 170;
        }
      } catch (e) {
        console.error('Error loading cover image:', e);
        // Continue without cover image
      }
    }

    // Add watermark if enabled (after cover image so it appears on top of content)
    if (teaser.includeWatermark) {
      doc.save();
      doc.opacity(0.08);
      doc.fontSize(50);
      doc.rotate(-45, { origin: [306, 450] });
      doc.fillColor('#888888');
      doc.text('CONFIDENTIAL TEASER', 80, 450, { width: 500 });
      doc.restore();
    }

    // Add broker logo if available
    if (owner.businessLogo) {
      try {
        const logoBuffer = await fetchImageBuffer(owner.businessLogo);
        if (logoBuffer) {
          doc.image(logoBuffer, 50, yPosition, { height: 40 });
          yPosition += 55;
        }
      } catch (e) {
        console.error('Error loading logo:', e);
        // Continue without logo
      }
    }

    // Add headline
    doc.fontSize(24);
    doc.font('Helvetica-Bold');
    doc.fillColor('#1a1a1a');
    doc.text(teaser.headline || 'Business Opportunity', 50, yPosition, {
      width: 500,
    });
    yPosition = doc.y + 20;

    // Add tags
    doc.fontSize(10);
    doc.font('Helvetica');
    doc.fillColor('#666666');
    const allTags = [
      ...(teaser.industryTags || []),
      ...(teaser.dealTypeTags || []),
    ];
    if (allTags.length > 0) {
      doc.text(allTags.join(' | '), 50, yPosition, { width: 500 });
      yPosition = doc.y + 20;
    }

    // Add horizontal line
    doc.strokeColor('#e0e0e0');
    doc.lineWidth(1);
    doc.moveTo(50, yPosition).lineTo(560, yPosition).stroke();
    yPosition += 20;

    // Add summary
    doc.fontSize(11);
    doc.font('Helvetica');
    doc.fillColor('#333333');
    if (teaser.summary) {
      doc.text(teaser.summary, 50, yPosition, {
        width: 500,
        align: 'justify',
        lineGap: 4,
      });
      yPosition = doc.y + 30;
    }

    // Add financials if enabled
    if (teaser.showFinancials && (teaser.revenue || teaser.earnings || teaser.askingPrice)) {
      // Check if we need a new page (leave room for financials + contact section)
      if (yPosition > 550) {
        doc.addPage();
        yPosition = 50;
      }

      // Draw financial boxes
      const financials = [
        { label: 'Revenue', value: teaser.revenue },
        { label: 'Earnings', value: teaser.earnings },
        { label: 'Asking Price', value: teaser.askingPrice },
      ].filter(f => f.value);

      const numBoxes = financials.length;
      const totalWidth = 510; // Full width minus margins
      const boxSpacing = 15;
      const boxWidth = numBoxes > 0 ? (totalWidth - (boxSpacing * (numBoxes - 1))) / numBoxes : 160;
      const boxHeight = 55;
      let boxX = 50;

      doc.strokeColor('#e5e7eb');
      doc.lineWidth(1);

      financials.forEach((fin) => {
        // Draw box with light fill
        doc.save();
        doc.fillColor('#f9fafb');
        doc.roundedRect(boxX, yPosition, boxWidth, boxHeight, 6).fill();
        doc.restore();

        // Draw border
        doc.roundedRect(boxX, yPosition, boxWidth, boxHeight, 6).stroke();

        // Add label (positioned explicitly)
        doc.fontSize(9);
        doc.font('Helvetica');
        doc.fillColor('#6b7280');
        const labelY = yPosition + 12;
        doc.text(fin.label, boxX, labelY, { width: boxWidth, align: 'center' });

        // Add value (positioned explicitly)
        doc.fontSize(15);
        doc.font('Helvetica-Bold');
        doc.fillColor('#111827');
        const valueY = yPosition + 28;
        doc.text(fin.value || '', boxX, valueY, { width: boxWidth, align: 'center' });

        boxX += boxWidth + boxSpacing;
      });

      yPosition += boxHeight + 25;
    }

    // Add horizontal line
    doc.strokeColor('#e0e0e0');
    doc.lineWidth(1);
    doc.moveTo(50, yPosition).lineTo(560, yPosition).stroke();
    yPosition += 20;

    // Add broker contact info with profile photo
    const contactStartY = yPosition;
    let textStartX = 50;

    // Add profile photo if available
    if (owner.profilePhoto) {
      try {
        const profileBuffer = await fetchImageBuffer(owner.profilePhoto);
        if (profileBuffer) {
          doc.image(profileBuffer, 50, yPosition, {
            width: 50,
            height: 50,
            fit: [50, 50],
          });
          textStartX = 115; // Move text to the right of the photo
        }
      } catch (e) {
        console.error('[PDF] Error loading profile photo:', e);
      }
    }

    doc.fontSize(12);
    doc.font('Helvetica-Bold');
    doc.fillColor('#1a1a1a');
    if (owner.businessName) {
      doc.text(owner.businessName, textStartX, yPosition);
      yPosition = doc.y + 3;
    }

    doc.fontSize(10);
    doc.font('Helvetica');
    doc.fillColor('#333333');

    const ownerName = [owner.firstName, owner.lastName].filter(Boolean).join(' ');
    if (ownerName) {
      doc.text(ownerName, textStartX, yPosition);
      yPosition = doc.y + 3;
    }

    if (owner.email) {
      doc.text(owner.email, textStartX, yPosition);
      yPosition = doc.y + 3;
    }

    if (owner.phoneNumber) {
      doc.text(owner.phoneNumber, textStartX, yPosition);
      yPosition = doc.y + 3;
    }

    // Add QR code in the top right corner of contact section
    if (qrCodeBuffer) {
      try {
        doc.image(qrCodeBuffer, 480, contactStartY, {
          width: 70,
          height: 70,
        });
        // Add "Scan for online version" text under QR
        doc.fontSize(7);
        doc.font('Helvetica');
        doc.fillColor('#666666');
        doc.text('View Online', 480, contactStartY + 72, { width: 70, align: 'center' });
      } catch (e) {
        console.error('[PDF] Error adding QR code to PDF:', e);
      }
    }

    // Add footer
    yPosition = 720;
    doc.fontSize(8);
    doc.font('Helvetica');
    doc.fillColor('#999999');
    doc.text(
      'Confidential Teaser - For Qualified Buyers Only',
      50,
      yPosition,
      { width: 500, align: 'center' }
    );

    // Finalize PDF
    doc.end();
  } catch (error) {
    console.error('Error generating teaser PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

export default router;
