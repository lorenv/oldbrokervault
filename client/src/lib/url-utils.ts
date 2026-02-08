/**
 * Utility functions for URL generation that work consistently across environments
 */

const PRODUCTION_DOMAIN = 'brokervault.ai';

/**
 * Get the base URL for the application, handling both development and production environments
 */
export function getBaseUrl(): string {
  if (typeof window === 'undefined') {
    // Server-side rendering fallback
    return `https://${PRODUCTION_DOMAIN}`;
  }

  // Use localhost for development, production domain for everything else
  return window.location.hostname === 'localhost'
    ? window.location.origin
    : `https://${PRODUCTION_DOMAIN}`;
}

/**
 * Get the base URL with an optional custom subdomain
 * @param customSubdomain - Optional subdomain (e.g., "acme" for acme.brokervault.ai)
 */
export function getBaseUrlWithSubdomain(customSubdomain?: string | null): string {
  if (typeof window === 'undefined') {
    // Server-side rendering fallback
    if (customSubdomain) {
      return `https://${customSubdomain}.${PRODUCTION_DOMAIN}`;
    }
    return `https://${PRODUCTION_DOMAIN}`;
  }

  // Use localhost for development (no subdomain support locally)
  if (window.location.hostname === 'localhost') {
    return window.location.origin;
  }

  // Production with custom subdomain
  if (customSubdomain) {
    return `https://${customSubdomain}.${PRODUCTION_DOMAIN}`;
  }

  return `https://${PRODUCTION_DOMAIN}`;
}

/**
 * Generate a share URL for a given share slug
 */
export function generateShareUrl(shareSlug: string): string {
  const baseUrl = getBaseUrl();
  return `${baseUrl}/share/${shareSlug}`;
}

/**
 * Generate a share URL with custom subdomain support
 * @param shareSlug - The document's share slug
 * @param customSubdomain - Optional user's custom subdomain
 */
export function generateShareUrlWithSubdomain(shareSlug: string, customSubdomain?: string | null): string {
  const baseUrl = getBaseUrlWithSubdomain(customSubdomain);
  return `${baseUrl}/share/${shareSlug}`;
}

/**
 * Generate an NDA URL for a given share slug
 */
export function generateNdaUrl(shareSlug: string): string {
  const baseUrl = getBaseUrl();
  return `${baseUrl}/nda/${shareSlug}`;
}

/**
 * Generate an NDA URL with custom subdomain support
 * @param shareSlug - The document's share slug
 * @param customSubdomain - Optional user's custom subdomain
 */
export function generateNdaUrlWithSubdomain(shareSlug: string, customSubdomain?: string | null): string {
  const baseUrl = getBaseUrlWithSubdomain(customSubdomain);
  return `${baseUrl}/nda/${shareSlug}`;
}