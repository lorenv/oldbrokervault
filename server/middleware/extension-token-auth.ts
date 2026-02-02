import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { extensionTokens, users } from '@shared/schema';
import { eq, and, isNull, gt } from 'drizzle-orm';

// Extension token format: ext_<48 hex chars> (24 bytes = 48 hex chars)
const EXTENSION_TOKEN_REGEX = /^ext_[a-f0-9]{48}$/;

// Sliding window: extend expiry by this amount on each use
const TOKEN_EXTENSION_DAYS = 7;
// Maximum token lifetime (30 days from creation)
const MAX_TOKEN_LIFETIME_DAYS = 30;

export interface ExtensionAuthRequest extends Request {
  extensionToken?: {
    id: number;
    userId: number;
    organizationId: number | null;
  };
}

/**
 * Middleware to authenticate requests using extension tokens.
 * Validates Bearer ext_xxx tokens, sets req.user and req.extensionToken,
 * and updates lastUsedAt with sliding window expiry.
 */
export async function extensionTokenAuth(
  req: ExtensionAuthRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.slice(7); // Remove 'Bearer ' prefix

  // Validate token format
  if (!EXTENSION_TOKEN_REGEX.test(token)) {
    return res.status(401).json({ error: 'Invalid token format' });
  }

  try {
    // Find valid token (not revoked, not expired)
    const now = new Date();
    const [tokenRecord] = await db
      .select()
      .from(extensionTokens)
      .where(
        and(
          eq(extensionTokens.token, token),
          isNull(extensionTokens.revokedAt),
          gt(extensionTokens.expiresAt, now)
        )
      )
      .limit(1);

    if (!tokenRecord) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Fetch the user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, tokenRecord.userId))
      .limit(1);

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Update lastUsedAt and extend expiry (sliding window)
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + TOKEN_EXTENSION_DAYS);

    // Cap at maximum lifetime (30 days from creation)
    const maxExpiry = new Date(tokenRecord.createdAt);
    maxExpiry.setDate(maxExpiry.getDate() + MAX_TOKEN_LIFETIME_DAYS);

    const finalExpiry = newExpiresAt > maxExpiry ? maxExpiry : newExpiresAt;

    await db
      .update(extensionTokens)
      .set({
        lastUsedAt: now,
        expiresAt: finalExpiry
      })
      .where(eq(extensionTokens.id, tokenRecord.id));

    // Set user on request (compatible with passport's req.user)
    req.user = user as any;
    req.extensionToken = {
      id: tokenRecord.id,
      userId: tokenRecord.userId,
      organizationId: tokenRecord.organizationId
    };

    next();
  } catch (error) {
    console.error('Extension token auth error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
}

/**
 * Generate a new extension token string.
 * Format: ext_<48 hex chars>
 */
export function generateExtensionToken(): string {
  const crypto = require('crypto');
  return `ext_${crypto.randomBytes(24).toString('hex')}`;
}

/**
 * Validate extension token format.
 */
export function isValidExtensionTokenFormat(token: string): boolean {
  return EXTENSION_TOKEN_REGEX.test(token);
}
