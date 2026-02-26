/**
 * Utility functions for URL generation that work consistently across environments.
 * Always uses the current window.location.origin so links work on any domain.
 */

/**
 * Get the base URL for the application based on the current browser location
 */
export function getBaseUrl(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  return window.location.origin;
}

/**
 * Get the base URL with an optional custom subdomain
 * @param customSubdomain - Optional subdomain (e.g., "acme" for acme.example.com)
 */
export function getBaseUrlWithSubdomain(customSubdomain?: string | null): string {
  if (typeof window === 'undefined') {
    return '';
  }

  if (!customSubdomain) {
    return window.location.origin;
  }

  // Build subdomain URL from current hostname
  const { protocol, hostname, port } = window.location;
  const subdomainHost = `${customSubdomain}.${hostname}`;
  const portSuffix = port ? `:${port}` : '';
  return `${protocol}//${subdomainHost}${portSuffix}`;
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