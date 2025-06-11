/**
 * Utility functions for URL generation that work consistently across environments
 */

/**
 * Get the base URL for the application, handling both development and production environments
 */
export function getBaseUrl(): string {
  if (typeof window === 'undefined') {
    // Server-side rendering fallback
    return 'https://cimshare.com';
  }
  
  // Use localhost for development, production domain for everything else
  return window.location.hostname === 'localhost' 
    ? window.location.origin 
    : 'https://cimshare.com';
}

/**
 * Generate a share URL for a given share slug
 */
export function generateShareUrl(shareSlug: string): string {
  const baseUrl = getBaseUrl();
  return `${baseUrl}/share/${shareSlug}`;
}

/**
 * Generate an NDA URL for a given share slug
 */
export function generateNdaUrl(shareSlug: string): string {
  const baseUrl = getBaseUrl();
  return `${baseUrl}/nda/${shareSlug}`;
}