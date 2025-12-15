import { Router, Request, Response } from 'express';
import { db } from '../db';
import { users, teasers, cimDocuments, getFullName } from '@shared/schema';
import { eq, and, desc, asc, sql, like, or, gte, lte } from 'drizzle-orm';
import { z } from 'zod';

const router = Router();

// ============================================================================
// AUTHENTICATED ROUTES - User's listings settings management
// ============================================================================

// Get current user's listings settings
router.get('/settings', async (req: Request, res: Response) => {
  try {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, req.user.id),
      columns: {
        listingsEnabled: true,
        listingsSlug: true,
        listingsTitle: true,
        listingsTagline: true,
        listingsBannerUrl: true,
        listingsLayout: true,
        businessName: true,
        businessLogo: true,
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching listings settings:', error);
    res.status(500).json({ error: 'Failed to fetch listings settings' });
  }
});

// Update listings settings
const updateSettingsSchema = z.object({
  listingsEnabled: z.boolean().optional(),
  listingsSlug: z.string().min(3).max(50).regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens').optional(),
  listingsTitle: z.string().max(100).optional().nullable(),
  listingsTagline: z.string().max(500).optional().nullable(),
  listingsBannerUrl: z.string().optional().nullable(),
  listingsLayout: z.enum(['grid', 'list']).optional(),
});

router.put('/settings', async (req: Request, res: Response) => {
  try {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const validation = updateSettingsSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid input', details: validation.error.flatten() });
    }

    const data = validation.data;

    // If slug is being updated, check uniqueness
    if (data.listingsSlug) {
      const existingSlug = await db.query.users.findFirst({
        where: and(
          eq(users.listingsSlug, data.listingsSlug),
          sql`${users.id} != ${req.user.id}`
        )
      });

      if (existingSlug) {
        return res.status(400).json({ error: 'This URL slug is already taken' });
      }
    }

    const [updated] = await db.update(users)
      .set(data)
      .where(eq(users.id, req.user.id))
      .returning({
        listingsEnabled: users.listingsEnabled,
        listingsSlug: users.listingsSlug,
        listingsTitle: users.listingsTitle,
        listingsTagline: users.listingsTagline,
        listingsBannerUrl: users.listingsBannerUrl,
        listingsLayout: users.listingsLayout,
      });

    res.json(updated);
  } catch (error) {
    console.error('Error updating listings settings:', error);
    res.status(500).json({ error: 'Failed to update listings settings' });
  }
});

// Check if a slug is available
router.get('/check-slug/:slug', async (req: Request, res: Response) => {
  try {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { slug } = req.params;

    const existing = await db.query.users.findFirst({
      where: and(
        eq(users.listingsSlug, slug.toLowerCase()),
        sql`${users.id} != ${req.user.id}`
      )
    });

    res.json({ available: !existing });
  } catch (error) {
    console.error('Error checking slug availability:', error);
    res.status(500).json({ error: 'Failed to check slug availability' });
  }
});

// Generate a slug suggestion from business name
router.get('/suggest-slug', async (req: Request, res: Response) => {
  try {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, req.user.id),
      columns: { businessName: true }
    });

    if (!user?.businessName) {
      return res.json({ slug: null });
    }

    // Generate base slug from business name
    let baseSlug = user.businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);

    // Check if available
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const existing = await db.query.users.findFirst({
        where: and(
          eq(users.listingsSlug, slug),
          sql`${users.id} != ${req.user.id}`
        )
      });

      if (!existing) break;

      slug = `${baseSlug}-${counter}`;
      counter++;

      if (counter > 100) {
        slug = `${baseSlug}-${Date.now().toString(36)}`;
        break;
      }
    }

    res.json({ slug });
  } catch (error) {
    console.error('Error suggesting slug:', error);
    res.status(500).json({ error: 'Failed to suggest slug' });
  }
});

// Toggle featured status for a teaser
router.put('/teaser/:teaserId/featured', async (req: Request, res: Response) => {
  try {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const teaserId = parseInt(req.params.teaserId);
    const { isFeatured } = req.body;

    if (typeof isFeatured !== 'boolean') {
      return res.status(400).json({ error: 'isFeatured must be a boolean' });
    }

    // Verify the teaser belongs to the user
    const teaser = await db.query.teasers.findFirst({
      where: eq(teasers.id, teaserId),
      with: {
        document: {
          columns: { userId: true }
        }
      }
    }) as any;

    if (!teaser) {
      return res.status(404).json({ error: 'Teaser not found' });
    }

    // Get document to check ownership
    const doc = await db.query.cimDocuments.findFirst({
      where: eq(cimDocuments.id, teaser.documentId),
      columns: { userId: true }
    });

    if (!doc || doc.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get the highest featured order if setting as featured
    let featuredOrder = 0;
    if (isFeatured) {
      const maxOrder = await db.select({ max: sql<number>`COALESCE(MAX(featured_order), 0)` })
        .from(teasers)
        .innerJoin(cimDocuments, eq(teasers.documentId, cimDocuments.id))
        .where(eq(cimDocuments.userId, req.user.id));

      featuredOrder = (maxOrder[0]?.max || 0) + 1;
    }

    const [updated] = await db.update(teasers)
      .set({
        isFeatured,
        featuredOrder: isFeatured ? featuredOrder : 0
      })
      .where(eq(teasers.id, teaserId))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Error toggling featured status:', error);
    res.status(500).json({ error: 'Failed to update featured status' });
  }
});

// Update featured order for a teaser
router.put('/teaser/:teaserId/order', async (req: Request, res: Response) => {
  try {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const teaserId = parseInt(req.params.teaserId);
    const { featuredOrder } = req.body;

    if (typeof featuredOrder !== 'number' || featuredOrder < 0) {
      return res.status(400).json({ error: 'featuredOrder must be a non-negative number' });
    }

    // Verify the teaser belongs to the user
    const teaser = await db.query.teasers.findFirst({
      where: eq(teasers.id, teaserId)
    });

    if (!teaser) {
      return res.status(404).json({ error: 'Teaser not found' });
    }

    const doc = await db.query.cimDocuments.findFirst({
      where: eq(cimDocuments.id, teaser.documentId),
      columns: { userId: true }
    });

    if (!doc || doc.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [updated] = await db.update(teasers)
      .set({ featuredOrder })
      .where(eq(teasers.id, teaserId))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Error updating featured order:', error);
    res.status(500).json({ error: 'Failed to update featured order' });
  }
});

// ============================================================================
// PUBLIC ROUTES - Listings page viewing
// ============================================================================

// Check if listings page exists (quick check for loading state)
router.get('/public/:slug/check', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const user = await db.query.users.findFirst({
      where: and(
        eq(users.listingsSlug, slug.toLowerCase()),
        eq(users.listingsEnabled, true)
      ),
      columns: {
        id: true,
        businessName: true,
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'Listings page not found' });
    }

    res.json({ exists: true, businessName: user.businessName });
  } catch (error) {
    console.error('Error checking listings page:', error);
    res.status(500).json({ error: 'Failed to check listings page' });
  }
});

// Get public listings page data
router.get('/public/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const {
      industry,
      dealType,
      minPrice,
      maxPrice,
      minRevenue,
      maxRevenue,
      minEarnings,
      maxEarnings,
      search,
      sort = 'newest'
    } = req.query as Record<string, string | undefined>;

    // Get user by slug
    const user = await db.query.users.findFirst({
      where: and(
        eq(users.listingsSlug, slug.toLowerCase()),
        eq(users.listingsEnabled, true)
      ),
      columns: {
        id: true,
        businessName: true,
        businessLogo: true,
        profilePhoto: true,
        listingsTitle: true,
        listingsTagline: true,
        listingsBannerUrl: true,
        listingsLayout: true,
        email: true,
        phoneNumber: true,
        firstName: true,
        lastName: true,
        name: true,
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'Listings page not found' });
    }

    // Build query for teasers
    const results = await db
      .select({
        teaser: teasers,
        document: cimDocuments,
      })
      .from(teasers)
      .innerJoin(cimDocuments, eq(teasers.documentId, cimDocuments.id))
      .where(and(
        eq(cimDocuments.userId, user.id),
        eq(teasers.isPublished, true)
      ))
      .orderBy(
        desc(teasers.isFeatured),
        desc(teasers.featuredOrder),
        sort === 'oldest' ? asc(teasers.createdAt) :
        sort === 'price_high' ? desc(teasers.askingPrice) :
        sort === 'price_low' ? asc(teasers.askingPrice) :
        sort === 'revenue_high' ? desc(teasers.revenue) :
        sort === 'revenue_low' ? asc(teasers.revenue) :
        desc(teasers.createdAt) // default: newest
      );

    // Filter in JavaScript (for complex filters)
    let filteredTeasers = results.map(r => ({
      ...r.teaser,
      cimShareSlug: r.document.shareSlug || r.document.customSlug,
      ndaProtected: r.document.ndaProtected,
    }));

    // Industry filter
    if (industry) {
      const industries = industry.split(',').map(i => i.trim().toLowerCase());
      filteredTeasers = filteredTeasers.filter(t =>
        t.industryTags?.some(tag => industries.includes(tag.toLowerCase()))
      );
    }

    // Deal type filter
    if (dealType) {
      const dealTypes = dealType.split(',').map(d => d.trim().toLowerCase());
      filteredTeasers = filteredTeasers.filter(t =>
        t.dealTypeTags?.some(tag => dealTypes.includes(tag.toLowerCase()))
      );
    }

    // Price filters (parsing currency strings)
    const parseAmount = (str: string | null | undefined): number | null => {
      if (!str) return null;
      const num = parseFloat(str.replace(/[^0-9.]/g, ''));
      return isNaN(num) ? null : num;
    };

    if (minPrice) {
      const min = parseFloat(minPrice);
      filteredTeasers = filteredTeasers.filter(t => {
        const price = parseAmount(t.askingPrice);
        return price === null || price >= min;
      });
    }

    if (maxPrice) {
      const max = parseFloat(maxPrice);
      filteredTeasers = filteredTeasers.filter(t => {
        const price = parseAmount(t.askingPrice);
        return price === null || price <= max;
      });
    }

    if (minRevenue) {
      const min = parseFloat(minRevenue);
      filteredTeasers = filteredTeasers.filter(t => {
        const revenue = parseAmount(t.revenue);
        return revenue === null || revenue >= min;
      });
    }

    if (maxRevenue) {
      const max = parseFloat(maxRevenue);
      filteredTeasers = filteredTeasers.filter(t => {
        const revenue = parseAmount(t.revenue);
        return revenue === null || revenue <= max;
      });
    }

    if (minEarnings) {
      const min = parseFloat(minEarnings);
      filteredTeasers = filteredTeasers.filter(t => {
        const earnings = parseAmount(t.earnings);
        return earnings === null || earnings >= min;
      });
    }

    if (maxEarnings) {
      const max = parseFloat(maxEarnings);
      filteredTeasers = filteredTeasers.filter(t => {
        const earnings = parseAmount(t.earnings);
        return earnings === null || earnings <= max;
      });
    }

    // Keyword search
    if (search) {
      const searchLower = search.toLowerCase();
      filteredTeasers = filteredTeasers.filter(t =>
        t.headline?.toLowerCase().includes(searchLower) ||
        t.summary?.toLowerCase().includes(searchLower)
      );
    }

    // Build response
    const response = {
      broker: {
        businessName: user.businessName,
        businessLogo: user.businessLogo,
        profilePhoto: user.profilePhoto,
        name: getFullName(user),
        email: user.email,
        phone: user.phoneNumber,
      },
      settings: {
        title: user.listingsTitle,
        tagline: user.listingsTagline,
        bannerUrl: user.listingsBannerUrl,
        layout: user.listingsLayout,
      },
      listings: filteredTeasers.map(t => {
        // Get the document for this teaser to check for CIM cover image
        const doc = results.find(r => r.teaser.id === t.id)?.document;
        // If useCimCoverImage is true, use the CIM document's cover image
        const effectiveCoverImageUrl = t.useCimCoverImage && doc?.coverImageUrl
          ? doc.coverImageUrl
          : t.coverImageUrl;

        return {
          id: t.id,
          shareSlug: t.shareSlug,
          headline: t.headline,
          summary: t.summary,
          industryTags: t.industryTags,
          dealTypeTags: t.dealTypeTags,
          coverImageUrl: effectiveCoverImageUrl,
          showFinancials: t.showFinancials,
          financials: t.showFinancials ? {
            revenue: t.revenue,
            earnings: t.earnings,
            askingPrice: t.askingPrice,
          } : null,
          isFeatured: t.isFeatured,
          cimShareSlug: t.cimShareSlug,
          ndaProtected: t.ndaProtected,
          listingStatus: (t as any).listingStatus || 'active',
        };
      }),
      // Available filter options (for dropdowns)
      filterOptions: {
        industries: [...new Set(results.flatMap(r => r.teaser.industryTags || []))],
        dealTypes: [...new Set(results.flatMap(r => r.teaser.dealTypeTags || []))],
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching listings page:', error);
    res.status(500).json({ error: 'Failed to fetch listings page' });
  }
});

export default router;
