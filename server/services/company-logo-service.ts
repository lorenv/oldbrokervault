/**
 * Company Logo Auto-Fetch Service
 *
 * Automatically fetches company logos from their websites using HTML scraping.
 * No AI involved - uses regex patterns to find logo images.
 *
 * Controls:
 * - Rate limited to 10 fetches per minute per organization
 * - Max 3 retry attempts per company
 * - Never overwrites manually uploaded logos
 * - Skipped for bulk imports
 */

import { db } from '../db';
import { companies } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { extractLogoFromWebsite } from '../website-analyzer';

// Rate limiting: track fetches per org
const orgFetchCounts = new Map<number, { count: number; resetAt: number }>();
const MAX_FETCHES_PER_MINUTE = 10;
const MAX_FETCH_ATTEMPTS = 3;

/**
 * Check if an organization can fetch a logo (rate limiting)
 */
function canFetchForOrg(organizationId: number): boolean {
  const now = Date.now();
  const orgData = orgFetchCounts.get(organizationId);

  if (!orgData || now > orgData.resetAt) {
    // Reset counter for new minute window
    orgFetchCounts.set(organizationId, { count: 0, resetAt: now + 60000 });
    return true;
  }

  return orgData.count < MAX_FETCHES_PER_MINUTE;
}

/**
 * Increment fetch count for an organization
 */
function incrementFetchCount(organizationId: number): void {
  const now = Date.now();
  const orgData = orgFetchCounts.get(organizationId);

  if (!orgData || now > orgData.resetAt) {
    orgFetchCounts.set(organizationId, { count: 1, resetAt: now + 60000 });
  } else {
    orgData.count++;
  }
}

/**
 * Normalize website URL for comparison
 */
function normalizeWebsiteUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  let normalized = url.trim().toLowerCase();
  // Remove protocol
  normalized = normalized.replace(/^https?:\/\//, '');
  // Remove www.
  normalized = normalized.replace(/^www\./, '');
  // Remove trailing slash
  normalized = normalized.replace(/\/$/, '');

  return normalized || null;
}

/**
 * Check if website URL has changed
 */
function hasWebsiteChanged(oldWebsite: string | null | undefined, newWebsite: string | null | undefined): boolean {
  const normalizedOld = normalizeWebsiteUrl(oldWebsite);
  const normalizedNew = normalizeWebsiteUrl(newWebsite);

  // If new website is empty/null, no change worth processing
  if (!normalizedNew) return false;

  // If old was empty and new has value, it changed
  if (!normalizedOld && normalizedNew) return true;

  // Compare normalized versions
  return normalizedOld !== normalizedNew;
}

/**
 * Queue a logo fetch for a company (non-blocking)
 * Call this after company create/update when website is provided/changed
 */
export async function queueLogoFetch(
  companyId: number,
  organizationId: number,
  websiteUrl: string,
  options: { isNewCompany?: boolean; previousWebsite?: string | null } = {}
): Promise<void> {
  const { isNewCompany = false, previousWebsite = null } = options;

  // Don't block the main request - run in background
  setImmediate(async () => {
    try {
      await fetchCompanyLogo(companyId, organizationId, websiteUrl, { isNewCompany, previousWebsite });
    } catch (error) {
      console.error(`[LogoService] Background fetch failed for company ${companyId}:`, error);
    }
  });
}

/**
 * Fetch and save a company logo
 */
async function fetchCompanyLogo(
  companyId: number,
  organizationId: number,
  websiteUrl: string,
  options: { isNewCompany?: boolean; previousWebsite?: string | null } = {}
): Promise<void> {
  const { isNewCompany = false, previousWebsite = null } = options;

  console.log(`[LogoService] Processing logo fetch for company ${companyId}, website: ${websiteUrl}`);

  // Get current company state
  const [company] = await db
    .select()
    .from(companies)
    .where(and(eq(companies.id, companyId), eq(companies.organizationId, organizationId)));

  if (!company) {
    console.log(`[LogoService] Company ${companyId} not found, skipping`);
    return;
  }

  // Check if logo was manually uploaded - never overwrite
  if (company.logoSource === 'manual') {
    console.log(`[LogoService] Company ${companyId} has manual logo, skipping auto-fetch`);
    return;
  }

  // For updates: check if website actually changed
  if (!isNewCompany && !hasWebsiteChanged(previousWebsite, websiteUrl)) {
    console.log(`[LogoService] Website unchanged for company ${companyId}, skipping`);
    return;
  }

  // If website changed, reset fetch attempts (it's a new URL to try)
  const shouldResetAttempts = !isNewCompany && hasWebsiteChanged(previousWebsite, websiteUrl);

  // Check retry limit (unless we're resetting due to new URL)
  if (!shouldResetAttempts && company.logoFetchAttempts >= MAX_FETCH_ATTEMPTS) {
    console.log(`[LogoService] Company ${companyId} exceeded max attempts (${MAX_FETCH_ATTEMPTS}), skipping`);
    return;
  }

  // Check rate limit
  if (!canFetchForOrg(organizationId)) {
    console.log(`[LogoService] Rate limit reached for org ${organizationId}, will retry later`);
    // Schedule retry after rate limit window
    setTimeout(() => {
      queueLogoFetch(companyId, organizationId, websiteUrl, options);
    }, 60000);
    return;
  }

  // Increment rate limit counter
  incrementFetchCount(organizationId);

  // Update attempt tracking
  const newAttemptCount = shouldResetAttempts ? 1 : company.logoFetchAttempts + 1;
  await db
    .update(companies)
    .set({
      logoFetchAttempts: newAttemptCount,
      logoLastFetchAt: new Date(),
    })
    .where(eq(companies.id, companyId));

  console.log(`[LogoService] Attempting logo extraction for company ${companyId} (attempt ${newAttemptCount}/${MAX_FETCH_ATTEMPTS})`);

  try {
    // Use existing extractLogoFromWebsite function (no AI, just HTML scraping)
    const logoPath = await extractLogoFromWebsite(websiteUrl, organizationId);

    if (logoPath) {
      console.log(`[LogoService] Successfully extracted logo for company ${companyId}: ${logoPath}`);

      // Save the logo URL
      await db
        .update(companies)
        .set({
          logoUrl: logoPath,
          logoSource: 'auto',
          updatedAt: new Date(),
        })
        .where(eq(companies.id, companyId));
    } else {
      console.log(`[LogoService] No logo found for company ${companyId} at ${websiteUrl}`);
    }
  } catch (error) {
    console.error(`[LogoService] Error fetching logo for company ${companyId}:`, error);
    // Attempt count already incremented, will retry on next trigger if under limit
  }
}

/**
 * Determine if logo fetch should be triggered based on company data
 * Call this to check before queueing
 */
export function shouldFetchLogo(
  company: { logoSource?: string | null; logoFetchAttempts?: number; website?: string | null },
  newWebsite: string | null | undefined,
  previousWebsite?: string | null
): boolean {
  // No website provided
  if (!newWebsite || !newWebsite.trim()) {
    return false;
  }

  // Manual logo - never auto-fetch
  if (company.logoSource === 'manual') {
    return false;
  }

  // New company with website - always try
  if (previousWebsite === undefined) {
    return true;
  }

  // Website changed - reset and try
  if (hasWebsiteChanged(previousWebsite, newWebsite)) {
    return true;
  }

  // Same website, check if we should retry
  const attempts = company.logoFetchAttempts || 0;
  if (attempts >= MAX_FETCH_ATTEMPTS) {
    return false;
  }

  // Only retry if we don't have a logo yet
  return !company.logoSource;
}
