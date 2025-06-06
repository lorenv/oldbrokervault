import crypto from 'crypto';

/**
 * Generate a cryptographically secure random token
 */
export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate a user-friendly redirect ID
 */
export function generateRedirectId(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Validate token format
 */
export function isValidTokenFormat(token: string): boolean {
  return /^[a-f0-9]{64}$/.test(token);
}

/**
 * Validate redirect ID format
 */
export function isValidRedirectIdFormat(redirectId: string): boolean {
  return /^[a-f0-9]{32}$/.test(redirectId);
}