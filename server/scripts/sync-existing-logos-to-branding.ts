/**
 * One-time script to sync existing business logos to e-signature branding settings.
 * Run with: npx tsx server/scripts/sync-existing-logos-to-branding.ts
 */

import { db } from '../db';
import { users, userBranding } from '../../shared/schema';
import { eq, isNull, and, isNotNull, notExists } from 'drizzle-orm';
import { extractBrandColors } from '../services/brand-color-extractor';
import { objectStorageImageManager } from '../image-manager-object-storage';

async function syncExistingLogosToEsignBranding() {
  console.log('[Sync] Starting sync of existing logos to e-signature branding...');

  // Find users who have a business logo but no e-signature branding record
  const usersWithLogosNobranding = await db
    .select({
      id: users.id,
      businessLogo: users.businessLogo,
      businessName: users.businessName,
    })
    .from(users)
    .leftJoin(userBranding, eq(users.id, userBranding.userId))
    .where(
      and(
        isNotNull(users.businessLogo),
        isNull(userBranding.id)
      )
    );

  console.log(`[Sync] Found ${usersWithLogosNobranding.length} users with logos but no e-signature branding`);

  let successCount = 0;
  let errorCount = 0;

  for (const user of usersWithLogosNobranding) {
    try {
      console.log(`[Sync] Processing user ${user.id} with logo: ${user.businessLogo}`);

      let primaryColor = '#0072CE';
      let extractedColors: string[] = [];

      // Try to extract brand colors from the logo
      if (user.businessLogo) {
        try {
          // Get the image buffer from object storage
          const imageBuffer = await objectStorageImageManager.getImageBuffer(user.businessLogo);
          if (imageBuffer) {
            const colors = await extractBrandColors(imageBuffer);
            primaryColor = colors.primary;
            extractedColors = colors.colors;
            console.log(`[Sync] Extracted colors for user ${user.id}:`, extractedColors);

            // Update user's brand colors if not already set
            await db.update(users)
              .set({ brandColors: extractedColors })
              .where(eq(users.id, user.id));
          }
        } catch (colorError) {
          console.warn(`[Sync] Could not extract colors for user ${user.id}:`, colorError);
        }
      }

      // Add cache-busting timestamp to logo URL
      const logoUrlWithCacheBust = `${user.businessLogo}?t=${Date.now()}`;

      // Create e-signature branding record
      await db.insert(userBranding).values({
        userId: user.id,
        logoUrl: logoUrlWithCacheBust,
        primaryColor: primaryColor,
        companyName: user.businessName || null,
      });

      console.log(`[Sync] Successfully synced branding for user ${user.id}`);
      successCount++;
    } catch (error) {
      console.error(`[Sync] Failed to sync branding for user ${user.id}:`, error);
      errorCount++;
    }
  }

  console.log(`[Sync] Completed! Success: ${successCount}, Errors: ${errorCount}`);
}

// Run the sync
syncExistingLogosToEsignBranding()
  .then(() => {
    console.log('[Sync] Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[Sync] Script failed:', error);
    process.exit(1);
  });
