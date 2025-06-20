/**
 * Data Sanitization Utilities for CIM Share
 * Prevents sensitive data leakage in API responses
 */

import { User } from "@shared/schema";

/**
 * Sanitizes user object for safe API responses
 * Removes all sensitive fields like passwords, tokens, and internal IDs
 */
export function sanitizeUser(user: User): Partial<User> {
  if (!user) return {};
  
  return {
    id: user.id,
    email: user.email,
    isAdmin: user.isAdmin,
    subscriptionStatus: user.subscriptionStatus,
    subscriptionEndsAt: user.subscriptionEndsAt,
    monthlyDocumentsCreated: user.monthlyDocumentsCreated,
    monthlyRegenerationsUsed: user.monthlyRegenerationsUsed,
    lastUsageReset: user.lastUsageReset,
    name: user.name,
    title: user.title,
    phoneNumber: user.phoneNumber,
    businessName: user.businessName,
    businessLogo: user.businessLogo,
    profilePhoto: user.profilePhoto,
    pdfBackgroundTemplate: user.pdfBackgroundTemplate
    // Explicitly excluded: password, stripeCustomerId, subscriptionId, 
    // googleAccessToken, googleRefreshToken, googleTokenExpiry
  };
}

/**
 * Sanitizes user object for public sharing contexts
 * Only includes fields safe for external visibility
 */
export function sanitizeUserForSharing(user: User): Partial<User> {
  if (!user) return {};
  
  return {
    name: user.name,
    title: user.title,
    phoneNumber: user.phoneNumber,
    businessName: user.businessName,
    businessLogo: user.businessLogo,
    profilePhoto: user.profilePhoto,
    email: user.email
    // Excludes all internal fields, subscription info, and sensitive data
  };
}

/**
 * Removes sensitive data from log messages
 */
export function sanitizeForLogging(data: any): any {
  if (!data || typeof data !== 'object') return data;
  
  const sanitized = { ...data };
  
  // Remove sensitive field patterns
  const sensitiveFields = [
    'password', 'token', 'secret', 'key', 'credential',
    'authorization', 'session', 'cookie', 'signature',
    'stripeCustomerId', 'subscriptionId', 'googleAccessToken',
    'googleRefreshToken', 'resetToken', 'accessToken'
  ];
  
  function recursiveSanitize(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    
    if (Array.isArray(obj)) {
      return obj.map(recursiveSanitize);
    }
    
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      
      // Check if field contains sensitive data
      if (sensitiveFields.some(field => lowerKey.includes(field))) {
        result[key] = '[REDACTED]';
      } else if (typeof value === 'object') {
        result[key] = recursiveSanitize(value);
      } else {
        result[key] = value;
      }
    }
    
    return result;
  }
  
  return recursiveSanitize(sanitized);
}

/**
 * Validates that response data doesn't contain sensitive information
 */
export function validateResponseSafety(data: any): { safe: boolean; violations: string[] } {
  const violations: string[] = [];
  
  function checkObject(obj: any, path = ''): void {
    if (!obj || typeof obj !== 'object') return;
    
    if (Array.isArray(obj)) {
      obj.forEach((item, index) => checkObject(item, `${path}[${index}]`));
      return;
    }
    
    for (const [key, value] of Object.entries(obj)) {
      const fullPath = path ? `${path}.${key}` : key;
      const lowerKey = key.toLowerCase();
      
      // Check for sensitive field names
      if (lowerKey.includes('password') || 
          lowerKey.includes('token') || 
          lowerKey.includes('secret') ||
          lowerKey.includes('stripe') && lowerKey.includes('customer') ||
          lowerKey.includes('google') && lowerKey.includes('token')) {
        violations.push(`Sensitive field exposed: ${fullPath}`);
      }
      
      // Check for potential token-like values
      if (typeof value === 'string') {
        if (value.length > 32 && /^[a-zA-Z0-9+/]+={0,2}$/.test(value)) {
          violations.push(`Potential token value in field: ${fullPath}`);
        }
        if (value.startsWith('sk_') || value.startsWith('pk_') || value.startsWith('rk_')) {
          violations.push(`Stripe key pattern detected: ${fullPath}`);
        }
      }
      
      if (typeof value === 'object') {
        checkObject(value, fullPath);
      }
    }
  }
  
  checkObject(data);
  
  return {
    safe: violations.length === 0,
    violations
  };
}