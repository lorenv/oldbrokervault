import { Request, Response, NextFunction } from 'express';
import { cognitoAuth } from './cognito-auth';
import { storage } from './storage';
import { User as SelectUser } from '@shared/schema';
import { logger } from './logger';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      cognitoUser?: any; // Cognito user payload
      user?: SelectUser; // Local user data
    }
  }
}

/**
 * Middleware to authenticate JWT tokens from Cognito
 */
export async function authenticateToken(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ message: 'Access token required' });
    }

    // Verify the token with Cognito
    const cognitoUser = await cognitoAuth.verifyAccessToken(token);
    req.cognitoUser = cognitoUser;

    // Get local user data based on Cognito user ID
    const localUser = await storage.getUserByCognitoId(cognitoUser.sub);
    
    if (!localUser) {
      return res.status(401).json({ message: 'User not found in local database' });
    }

    req.user = localUser;
    next();
  } catch (error: any) {
    logger.error('Token authentication failed', { 
      errorMessage: error.message,
      path: req.path 
    });
    
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

/**
 * Optional authentication middleware - sets user if valid token exists
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      try {
        const cognitoUser = await cognitoAuth.verifyAccessToken(token);
        req.cognitoUser = cognitoUser;

        const localUser = await storage.getUserByCognitoId(cognitoUser.sub);
        if (localUser) {
          req.user = localUser;
        }
      } catch (error) {
        // Token invalid, but continue without authentication
        logger.debug('Optional auth failed, continuing without user', { 
          path: req.path 
        });
      }
    }

    next();
  } catch (error: any) {
    // If anything fails, just continue without authentication
    logger.debug('Optional auth middleware error', { 
      errorMessage: error.message,
      path: req.path 
    });
    next();
  }
}

/**
 * Require admin access
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  if (!req.user.isAdmin) {
    return res.status(403).json({ message: 'Admin access required' });
  }

  next();
}