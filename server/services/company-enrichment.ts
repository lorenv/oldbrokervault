/**
 * Company Enrichment Service
 *
 * Handles auto-creating companies from contact email domains and enriching
 * them with data from their website and the Perplexity API.
 *
 * Flow:
 * 1. Extract domain from a contact's email address
 * 2. Find or create a company record for that domain
 * 3. Enrich the company with website metadata and AI-powered research
 * 4. Link the contact to the company
 */

import { db } from "../db";
import { companies, crmContacts, type Company } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { fetchWithTimeout, API_TIMEOUTS } from "../utils/fetch-with-timeout";

const PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions";

/** Generic email providers that should not generate company records. */
const GENERIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "aol.com",
  "icloud.com",
  "me.com",
  "live.com",
  "msn.com",
  "protonmail.com",
  "mail.com",
]);

/**
 * Extract the domain portion from an email address.
 * Returns an empty string if the email is invalid.
 */
export function extractDomainFromEmail(email: string): string {
  if (!email || !email.includes("@")) {
    return "";
  }
  return email.split("@")[1].toLowerCase().trim();
}

/**
 * Look up an existing company by domain within an organization, or create a
 * new one with basic information derived from the domain.
 *
 * Returns `null` for generic email domains (gmail, yahoo, etc.) or if the
 * email address is invalid.
 */
export async function findOrCreateCompanyFromEmail(
  email: string,
  organizationId: number,
): Promise<Company | null> {
  const domain = extractDomainFromEmail(email);

  if (!domain || GENERIC_EMAIL_DOMAINS.has(domain)) {
    return null;
  }

  // Check for an existing company with this domain in the organization
  const [existing] = await db
    .select()
    .from(companies)
    .where(and(eq(companies.organizationId, organizationId), eq(companies.domain, domain)))
    .limit(1);

  if (existing) {
    return existing;
  }

  // Derive a readable company name from the domain (e.g. "blackstone.com" → "Blackstone")
  const domainName = domain.split(".")[0];
  const companyName = domainName.charAt(0).toUpperCase() + domainName.slice(1);

  const [created] = await db
    .insert(companies)
    .values({
      organizationId,
      name: companyName,
      domain,
      website: `https://${domain}`,
      enrichmentStatus: "pending",
    })
    .returning();

  return created;
}

/**
 * Enrich a company record by fetching its website and optionally querying
 * the Perplexity API for additional information.
 *
 * Updates the company record in-place with whatever data can be gathered.
 */
export async function enrichCompanyFromWebsite(companyId: number): Promise<void> {
  const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);

  if (!company) {
    console.error(`[company-enrichment] Company ${companyId} not found`);
    return;
  }

  if (!company.website) {
    await markEnrichmentFailed(companyId, "No website URL available");
    return;
  }

  try {
    // --- Step 1: Fetch basic metadata from the website HTML ---
    const websiteData = await fetchWebsiteMetadata(company.website);

    // --- Step 2: Use Perplexity for deeper research if available ---
    let perplexityData: PerplexityEnrichmentResult | null = null;
    if (process.env.PERPLEXITY_API_KEY) {
      perplexityData = await researchCompanyWithPerplexity(company.name, company.website);
    }

    // --- Step 3: Merge and persist ---
    const enrichedFields: Record<string, unknown> = {
      enrichmentStatus: "enriched",
      enrichedAt: new Date(),
      enrichmentData: {
        websiteMeta: websiteData,
        perplexity: perplexityData,
      },
    };

    // Improve company name from website data if the current name looks auto-generated
    // (i.e., just the domain without spaces). Prefer og:site_name, then extract from <title>.
    const betterName = extractCompanyNameFromWebsite(websiteData, company.name, company.domain || "");
    if (betterName && betterName !== company.name) {
      enrichedFields.name = betterName;
      console.log(`[company-enrichment] Improved company name: "${company.name}" → "${betterName}"`);
    }

    // Set logo if we found one and it hasn't been manually set
    if (websiteData?.logoUrl && company.logoSource !== "manual") {
      enrichedFields.logoUrl = websiteData.logoUrl;
      enrichedFields.logoSource = "auto";
      enrichedFields.logoFetchAttempts = (company.logoFetchAttempts || 0) + 1;
      enrichedFields.logoLastFetchAt = new Date();
    }

    // Prefer Perplexity data when available, fall back to website metadata
    if (perplexityData?.description || websiteData?.description) {
      enrichedFields.description = perplexityData?.description || websiteData?.description;
    }
    if (perplexityData?.industry) {
      enrichedFields.industry = perplexityData.industry;
    }
    if (perplexityData?.employeeCount) {
      enrichedFields.employeeCount = perplexityData.employeeCount;
    }
    if (perplexityData?.foundedYear) {
      enrichedFields.foundedYear = perplexityData.foundedYear;
    }
    if (perplexityData?.city) {
      enrichedFields.city = perplexityData.city;
    }
    if (perplexityData?.state) {
      enrichedFields.state = perplexityData.state;
    }
    if (perplexityData?.country) {
      enrichedFields.country = perplexityData.country;
    }
    if (perplexityData?.linkedinUrl) {
      enrichedFields.linkedinUrl = perplexityData.linkedinUrl;
    }

    await db.update(companies).set(enrichedFields).where(eq(companies.id, companyId));

    console.log(`[company-enrichment] Successfully enriched company ${companyId} (${company.name})`);
  } catch (error) {
    console.error(`[company-enrichment] Failed to enrich company ${companyId}:`, error);
    await markEnrichmentFailed(companyId, error instanceof Error ? error.message : String(error));
  }
}

/**
 * Link a CRM contact to a company by setting the companyId field.
 */
export async function linkContactToCompany(contactId: number, companyId: number): Promise<void> {
  await db
    .update(crmContacts)
    .set({ companyId, updatedAt: new Date() })
    .where(eq(crmContacts.id, contactId));
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface WebsiteMetadata {
  title: string | null;
  description: string | null;
  siteName: string | null;
  logoUrl: string | null;
}

interface PerplexityEnrichmentResult {
  description: string | null;
  industry: string | null;
  employeeCount: string | null;
  foundedYear: number | null;
  city: string | null;
  state: string | null;
  country: string | null;
  linkedinUrl: string | null;
}

/**
 * Try to extract a properly formatted company name from website metadata.
 * Prefers og:site_name, then tries to extract from <title> by stripping common
 * suffixes like " | Home", " - Welcome", " – Official Site", etc.
 *
 * Returns null if no better name can be determined.
 */
function extractCompanyNameFromWebsite(
  websiteData: WebsiteMetadata,
  currentName: string,
  domain: string,
): string | null {
  // og:site_name is the most reliable — sites explicitly set this to their brand name
  if (websiteData.siteName) {
    const name = websiteData.siteName.trim();
    // Sanity check: not too long, not a full sentence
    if (name.length > 0 && name.length <= 60 && !name.includes(".com")) {
      return name;
    }
  }

  // Try extracting from <title>
  if (websiteData.title) {
    // Common title patterns: "Company Name | Tagline", "Company Name - Home", "Welcome to Company Name"
    let name = websiteData.title;

    // Strip common separators and everything after them
    const separatorPattern = /\s*[|–—\-:]\s*.+$/;
    name = name.replace(separatorPattern, "").trim();

    // Strip common prefixes
    name = name.replace(/^Welcome\s+to\s+/i, "").trim();

    // Sanity checks
    if (
      name.length > 0 &&
      name.length <= 60 &&
      !name.includes(".com") &&
      // Make sure the extracted name is actually different/better than what we have
      name.toLowerCase() !== currentName.toLowerCase()
    ) {
      // Verify it looks like a company name (not a generic phrase like "Home" or "Official Site")
      const genericTerms = ["home", "official site", "homepage", "welcome", "index"];
      if (!genericTerms.includes(name.toLowerCase())) {
        return name;
      }
    }
  }

  return null;
}

/**
 * Fetch the target website and extract metadata: title, description, logo, and site name.
 */
async function fetchWebsiteMetadata(websiteUrl: string): Promise<WebsiteMetadata> {
  try {
    const response = await fetchWithTimeout(websiteUrl, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CompanyEnrichmentBot/1.0)",
        Accept: "text/html",
      },
      redirect: "follow",
    }, API_TIMEOUTS.STANDARD);

    if (!response.ok) {
      console.warn(`[company-enrichment] Website returned ${response.status} for ${websiteUrl}`);
      return { title: null, description: null, siteName: null, logoUrl: null };
    }

    const html = await response.text();
    const baseUrl = new URL(websiteUrl).origin;

    // Extract <title>
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : null;

    // Extract meta description
    const descMatch = html.match(
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
    );
    const descMatchAlt = html.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i,
    );
    const description = descMatch?.[1]?.trim() || descMatchAlt?.[1]?.trim() || null;

    // Extract og:site_name (best source for the actual company name)
    const siteNameMatch = html.match(
      /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i,
    ) || html.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i,
    );
    const siteName = siteNameMatch?.[1]?.trim() || null;

    // Extract logo URL — try multiple sources in priority order
    let logoUrl: string | null = null;

    // 1. og:image (often the company logo or a branded image)
    const ogImageMatch = html.match(
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    ) || html.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    );

    // 2. apple-touch-icon (high-res logo, usually 180x180)
    const appleTouchMatch = html.match(
      /<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']([^"']+)["']/i,
    ) || html.match(
      /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']apple-touch-icon["']/i,
    );

    // 3. Standard favicon (32x32 or larger)
    const iconMatch = html.match(
      /<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i,
    ) || html.match(
      /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut )?icon["']/i,
    );

    // Prefer apple-touch-icon (clean square logo) > og:image > favicon
    const rawLogoUrl = appleTouchMatch?.[1] || ogImageMatch?.[1] || iconMatch?.[1] || null;

    if (rawLogoUrl) {
      // Resolve relative URLs to absolute
      try {
        logoUrl = rawLogoUrl.startsWith("http") ? rawLogoUrl : new URL(rawLogoUrl, baseUrl).toString();
      } catch {
        logoUrl = null;
      }
    }

    return { title, description, siteName, logoUrl };
  } catch (error) {
    console.warn(`[company-enrichment] Could not fetch website ${websiteUrl}:`, error);
    return { title: null, description: null, siteName: null, logoUrl: null };
  }
}

/**
 * Query the Perplexity API to research a company and return structured data.
 */
async function researchCompanyWithPerplexity(
  companyName: string,
  websiteUrl: string,
): Promise<PerplexityEnrichmentResult | null> {
  try {
    const prompt = `Research the company "${companyName}" (website: ${websiteUrl}). Return a JSON object with these fields only:
{
  "description": "A 1-2 sentence description of what the company does",
  "industry": "Primary industry (e.g., Technology, Financial Services, Healthcare)",
  "employeeCount": "Approximate employee count range (e.g., 51-200, 1001+)",
  "foundedYear": 2010,
  "city": "Headquarters city",
  "state": "Headquarters state/region",
  "country": "Headquarters country",
  "linkedinUrl": "LinkedIn company page URL or null"
}
Return ONLY valid JSON. No markdown, no explanation. Use null for any field you cannot determine with confidence.`;

    const response = await fetchWithTimeout(PERPLEXITY_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "system",
            content: "You are a company research assistant. Return only valid JSON with no additional text.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 500,
        temperature: 0.1,
        stream: false,
      }),
    }, API_TIMEOUTS.AI_API);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[company-enrichment] Perplexity API error ${response.status}:`, errorText);
      return null;
    }

    const data = await response.json();
    const content: string = data.choices?.[0]?.message?.content ?? "";

    // Extract JSON from the response, handling possible markdown wrapping
    let jsonStr = content;
    const jsonBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonBlockMatch) {
      jsonStr = jsonBlockMatch[1];
    }

    const parsed = JSON.parse(jsonStr.trim());

    return {
      description: parsed.description || null,
      industry: parsed.industry || null,
      employeeCount: parsed.employeeCount || null,
      foundedYear: typeof parsed.foundedYear === "number" ? parsed.foundedYear : null,
      city: parsed.city || null,
      state: parsed.state || null,
      country: parsed.country || null,
      linkedinUrl: parsed.linkedinUrl || null,
    };
  } catch (error) {
    console.error("[company-enrichment] Perplexity enrichment failed:", error);
    return null;
  }
}

/**
 * Mark a company's enrichment as failed and store the reason.
 */
async function markEnrichmentFailed(companyId: number, reason: string): Promise<void> {
  await db
    .update(companies)
    .set({
      enrichmentStatus: "failed",
      enrichedAt: new Date(),
      enrichmentData: { error: reason },
    })
    .where(eq(companies.id, companyId));
}
