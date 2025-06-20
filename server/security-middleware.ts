/**
 * Security Middleware for CIM Share
 * Provides response sanitization and data leakage prevention
 */

import { Request, Response, NextFunction } from 'express';
import { validateResponseSafety, sanitizeForLogging } from './data-sanitizer';

/**
 * Middleware to sanitize API responses and prevent data leakage
 */
export function responseSanitizationMiddleware(req: Request, res: Response, next: NextFunction) {
  const originalJson = res.json;
  
  res.json = function(data: any) {
    // Validate response safety in development
    if (process.env.NODE_ENV === 'development') {
      const safety = validateResponseSafety(data);
      if (!safety.safe) {
        console.warn('⚠️  SECURITY WARNING: Response contains potentially sensitive data:', safety.violations);
        console.warn('Path:', req.path);
        console.warn('Method:', req.method);
      }
    }
    
    return originalJson.call(this, data);
  };
  
  next();
}

/**
 * Middleware to sanitize request logging
 */
export function logSanitizationMiddleware(req: Request, res: Response, next: NextFunction) {
  // Store original console methods
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  
  // Override console methods to sanitize sensitive data
  console.log = (...args) => {
    const sanitizedArgs = args.map(arg => sanitizeForLogging(arg));
    originalLog.apply(console, sanitizedArgs);
  };
  
  console.error = (...args) => {
    const sanitizedArgs = args.map(arg => sanitizeForLogging(arg));
    originalError.apply(console, sanitizedArgs);
  };
  
  console.warn = (...args) => {
    const sanitizedArgs = args.map(arg => sanitizeForLogging(arg));
    originalWarn.apply(console, sanitizedArgs);
  };
  
  // Restore original methods after request
  res.on('finish', () => {
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;
  });
  
  next();
}

/**
 * Middleware to add security headers
 */
export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction) {
  // Prevent sensitive data caching
  if (req.path.includes('/api/user') || req.path.includes('/api/profile') || req.path.includes('/api/admin')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  
  // Add security headers for sensitive endpoints
  if (req.path.includes('/api/')) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
  }
  
  next();
}

/**
 * Rate limiting specifically for sensitive endpoints
 */
export function sensitiveEndpointLimiter(req: Request, res: Response, next: NextFunction) {
  const sensitiveEndpoints = [
    '/api/user',
    '/api/profile', 
    '/api/admin',
    '/api/login',
    '/api/register',
    '/api/forgot-password'
  ];
  
  const isSensitive = sensitiveEndpoints.some(endpoint => req.path.startsWith(endpoint));
  
  if (isSensitive) {
    // Add stricter rate limiting headers for sensitive endpoints
    res.setHeader('X-RateLimit-Sensitive', 'true');
  }
  
  next();
}