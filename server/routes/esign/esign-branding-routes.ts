/**
 * E-Sign Branding Routes
 * Manages user branding settings for e-signature documents
 */

import { Router, Request, Response } from 'express';
import { db } from '../../db';
import { userBranding, users, insertUserBrandingSchema } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { ObjectStorageService } from '../../object-storage';
import { sanitizeExtension } from '../../utils/sanitize-filename';
import { imageUpload } from './esign-utils';

const router = Router();

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

    let result;
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
      result = updated;
    } else {
      // Insert
      const [created] = await db
        .insert(userBranding)
        .values({
          userId: req.user.id,
          ...validated,
        })
        .returning();
      result = created;
    }

    // Sync logo and primary color changes to user profile
    if ('logoUrl' in validated || 'primaryColor' in validated) {
      try {
        const profileUpdate: any = {};
        if ('logoUrl' in validated) {
          profileUpdate.businessLogo = validated.logoUrl || null;
        }
        if ('primaryColor' in validated && validated.primaryColor) {
          profileUpdate.pdfPrimaryColor = validated.primaryColor;
        }
        if (Object.keys(profileUpdate).length > 0) {
          await db
            .update(users)
            .set(profileUpdate)
            .where(eq(users.id, req.user.id));
          console.log('[ESIGN] Synced branding changes to user profile');
        }
      } catch (syncError) {
        console.warn('[ESIGN] Failed to sync branding to user profile:', syncError);
        // Continue - branding was updated successfully
      }
    }

    res.json(result);
  } catch (error) {
    console.error('[ESIGN] Error updating branding:', error);
    if (error instanceof z.ZodError) {
      console.error('[ESIGN] Validation errors:', JSON.stringify(error.errors, null, 2));
      console.error('[ESIGN] Request body was:', JSON.stringify(req.body, null, 2));
      return res.status(400).json({ error: 'Invalid branding data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to update branding settings' });
  }
});

// Upload branding logo - extracts colors and syncs to both e-sign branding AND user profile
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
    const ext = sanitizeExtension(req.file.originalname) || '.png';
    const storageKey = `private/branding/${req.user.id}/logo${ext}`;
    const result = await objectStorage.uploadBuffer(storageKey, req.file.buffer, req.file.mimetype);

    // Extract brand colors from the uploaded logo
    let extractedColors: string[] = [];
    let primaryColor: string | null = null;
    try {
      const { extractBrandColors } = await import('../../services/brand-color-extractor');
      const colors = await extractBrandColors(req.file.buffer);
      extractedColors = colors.colors;
      primaryColor = extractedColors.length > 0 ? extractedColors[0] : null;
      console.log('[ESIGN] Extracted brand colors from logo:', extractedColors);
    } catch (colorError) {
      console.warn('[ESIGN] Brand color extraction failed:', colorError);
      // Continue without colors - not critical
    }

    // Add cache-busting timestamp to logo URL to prevent browser caching old image
    const logoUrlWithCacheBust = `${result.url}?t=${Date.now()}`;

    // Update e-sign branding record with logo and primary color
    const [existing] = await db
      .select()
      .from(userBranding)
      .where(eq(userBranding.userId, req.user.id))
      .limit(1);

    if (existing) {
      await db
        .update(userBranding)
        .set({
          logoUrl: logoUrlWithCacheBust,
          primaryColor: primaryColor || existing.primaryColor,
          updatedAt: new Date()
        })
        .where(eq(userBranding.userId, req.user.id));
    } else {
      await db.insert(userBranding).values({
        userId: req.user.id,
        logoUrl: logoUrlWithCacheBust,
        primaryColor: primaryColor || '#0072CE',
      });
    }

    // Also sync logo and colors to user profile (account settings)
    try {
      await db
        .update(users)
        .set({
          businessLogo: logoUrlWithCacheBust,
          brandColors: extractedColors.length > 0 ? extractedColors : undefined,
        })
        .where(eq(users.id, req.user.id));
      console.log('[ESIGN] Synced logo and colors to user profile');
    } catch (syncError) {
      console.warn('[ESIGN] Failed to sync logo to user profile:', syncError);
      // Continue - e-sign branding was updated successfully
    }

    res.json({
      logoUrl: logoUrlWithCacheBust,
      brandColors: extractedColors,
      primaryColor: primaryColor
    });
  } catch (error) {
    console.error('[ESIGN] Error uploading logo:', error);
    res.status(500).json({ error: 'Failed to upload logo' });
  }
});

export { router as esignBrandingRoutes };
