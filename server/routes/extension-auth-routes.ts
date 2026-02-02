/**
 * Extension Authentication Routes
 *
 * OAuth-style authentication flow for Chrome extension.
 * Allows users to authenticate via the web app and receive a token for the extension.
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { extensionTokens, users, organizationMembers } from '@shared/schema';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { generateExtensionToken } from '../middleware/extension-token-auth';
import path from 'path';

const router = Router();

// Token expiry: 30 days
const TOKEN_EXPIRY_DAYS = 30;

// Allowed origins for extension communication
const EXTENSION_ORIGINS = [
  'chrome-extension://', // Chrome extensions
];

/**
 * GET /api/extension/auth
 *
 * Initiates the auth flow. If user is logged in, redirects to callback.
 * If not logged in, redirects to login page with return URL.
 *
 * Supports Chrome identity API flow via redirect_uri parameter.
 */
router.get('/auth', async (req: Request, res: Response) => {
  const extensionId = req.query.extension_id as string;
  const redirectUri = req.query.redirect_uri as string;

  // Store extension info in session for callback
  if (extensionId) {
    (req.session as any).extensionId = extensionId;
  }
  if (redirectUri) {
    (req.session as any).extensionRedirectUri = redirectUri;
  }

  // Check if user is already authenticated
  if (req.isAuthenticated && req.isAuthenticated() && req.user) {
    // User is logged in, redirect to callback to generate token
    const callbackUrl = redirectUri
      ? `/api/extension/auth/callback?redirect_uri=${encodeURIComponent(redirectUri)}`
      : '/api/extension/auth/callback';
    return res.redirect(callbackUrl);
  }

  // User not logged in, redirect to login with return URL
  const callbackPath = redirectUri
    ? `/api/extension/auth/callback?redirect_uri=${encodeURIComponent(redirectUri)}`
    : '/api/extension/auth/callback';
  const returnUrl = encodeURIComponent(callbackPath);
  return res.redirect(`/login?redirect=${returnUrl}&extension=true`);
});

/**
 * GET /api/extension/auth/callback
 *
 * After successful login, generates a token and returns it to the extension.
 * Supports two modes:
 * 1. Chrome identity API: redirects to redirect_uri with token in URL params
 * 2. Popup mode: displays HTML page that uses postMessage
 */
router.get('/auth/callback', async (req: Request, res: Response) => {
  // Verify user is authenticated
  if (!req.isAuthenticated || !req.isAuthenticated() || !req.user) {
    return res.status(401).send('Not authenticated');
  }

  const user = req.user as any;
  const redirectUri = req.query.redirect_uri as string || (req.session as any).extensionRedirectUri;

  try {
    // Generate new extension token
    const token = generateExtensionToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + TOKEN_EXPIRY_DAYS);

    // Get user's organization (if any)
    const [membership] = await db
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, user.id))
      .limit(1);

    // Extract device info from user agent
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const deviceInfo = userAgent.substring(0, 200); // Truncate for storage

    // Store token in database
    await db.insert(extensionTokens).values({
      userId: user.id,
      organizationId: membership?.organizationId || null,
      token,
      deviceInfo,
      expiresAt,
    });

    // Clear session redirect URI
    delete (req.session as any).extensionRedirectUri;

    // If redirect_uri is provided (Chrome identity API flow), redirect with token
    // Security: Validate the redirect URL is a legitimate Chrome extension callback
    if (redirectUri) {
      try {
        const redirectUrl = new URL(redirectUri);
        // Only allow chromiumapp.org (Chrome identity API) or chrome-extension:// origins
        const isValidOrigin =
          redirectUrl.hostname.endsWith('.chromiumapp.org') ||
          redirectUrl.protocol === 'chrome-extension:';

        if (!isValidOrigin) {
          console.warn('[Extension Auth] Invalid redirect_uri origin:', redirectUrl.origin);
          return res.status(400).send('Invalid redirect URI');
        }

        // Use URL fragment instead of query params for security
        // Fragments are not sent to the server, reducing token exposure in logs
        const fragmentParams = new URLSearchParams();
        fragmentParams.set('token', token);
        fragmentParams.set('user_id', String(user.id));
        fragmentParams.set('email', user.email);
        return res.redirect(`${redirectUrl.origin}${redirectUrl.pathname}#${fragmentParams.toString()}`);
      } catch (e) {
        console.error('[Extension Auth] Invalid redirect_uri:', e);
        return res.status(400).send('Invalid redirect URI');
      }
    }

    // Fallback: Serve callback HTML page that sends token to extension via postMessage
    const callbackHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Authentication Successful</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .container {
      text-align: center;
      padding: 40px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      backdrop-filter: blur(10px);
    }
    h1 { margin: 0 0 16px 0; font-size: 24px; }
    p { margin: 0; opacity: 0.9; }
    .success-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="success-icon">&#10004;</div>
    <h1>Authentication Successful</h1>
    <p>You can close this window now.</p>
  </div>
  <script>
    (function() {
      const token = ${JSON.stringify(token)};
      const userId = ${user.id};
      const email = ${JSON.stringify(user.email)};

      // Send token to opener (extension popup)
      // Security: Only send to same origin or known extension origins
      if (window.opener) {
        // Try to send to opener's origin first (same-origin case)
        // For cross-origin (extension), the extension must listen with proper origin checks
        const message = {
          type: 'EXTENSION_AUTH_SUCCESS',
          token: token,
          user: { id: userId, email: email }
        };

        // Send to same origin (for web app popup scenarios)
        try {
          window.opener.postMessage(message, window.location.origin);
        } catch (e) {
          // Cross-origin - extension must handle this via its own event listener
          console.log('Cross-origin postMessage - extension should capture via chrome.identity');
        }
        // Close window after short delay
        setTimeout(() => window.close(), 1500);
      }
    })();
  </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(callbackHtml);
  } catch (error) {
    console.error('Extension auth callback error:', error);
    res.status(500).send('Failed to generate authentication token');
  }
});

/**
 * POST /api/extension/auth/refresh
 *
 * Refresh an extension token. Requires valid existing token.
 * Returns a new token and revokes the old one.
 */
router.post('/auth/refresh', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ext_')) {
    return res.status(401).json({ error: 'Invalid authorization header' });
  }

  const oldToken = authHeader.slice(7);

  try {
    // Find existing valid token
    const now = new Date();
    const [existingToken] = await db
      .select()
      .from(extensionTokens)
      .where(
        and(
          eq(extensionTokens.token, oldToken),
          isNull(extensionTokens.revokedAt)
        )
      )
      .limit(1);

    if (!existingToken) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Check if token is close to expiry (within 7 days) or expired
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    // Only allow refresh if token is within 7 days of expiry or already expired
    if (existingToken.expiresAt > sevenDaysFromNow) {
      return res.status(400).json({
        error: 'Token refresh not needed yet',
        expiresAt: existingToken.expiresAt
      });
    }

    // Generate new token
    const newToken = generateExtensionToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + TOKEN_EXPIRY_DAYS);

    // Revoke old token
    await db
      .update(extensionTokens)
      .set({ revokedAt: now })
      .where(eq(extensionTokens.id, existingToken.id));

    // Create new token
    await db.insert(extensionTokens).values({
      userId: existingToken.userId,
      organizationId: existingToken.organizationId,
      token: newToken,
      deviceInfo: existingToken.deviceInfo,
      expiresAt,
    });

    res.json({
      token: newToken,
      expiresAt
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

/**
 * POST /api/extension/auth/logout
 *
 * Revoke the current extension token.
 */
router.post('/auth/logout', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ext_')) {
    return res.status(401).json({ error: 'Invalid authorization header' });
  }

  const token = authHeader.slice(7);

  try {
    const now = new Date();

    // Revoke the token
    const result = await db
      .update(extensionTokens)
      .set({ revokedAt: now })
      .where(
        and(
          eq(extensionTokens.token, token),
          isNull(extensionTokens.revokedAt)
        )
      );

    res.json({ success: true, message: 'Token revoked' });
  } catch (error) {
    console.error('Token revocation error:', error);
    res.status(500).json({ error: 'Failed to revoke token' });
  }
});

/**
 * GET /api/extension/auth/status
 *
 * Check if a token is valid and return user info.
 */
router.get('/auth/status', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ext_')) {
    return res.status(401).json({ authenticated: false });
  }

  const token = authHeader.slice(7);

  try {
    const now = new Date();

    // Find valid token
    const [tokenRecord] = await db
      .select({
        token: extensionTokens,
        user: users
      })
      .from(extensionTokens)
      .innerJoin(users, eq(users.id, extensionTokens.userId))
      .where(
        and(
          eq(extensionTokens.token, token),
          isNull(extensionTokens.revokedAt)
        )
      )
      .limit(1);

    if (!tokenRecord || tokenRecord.token.expiresAt < now) {
      return res.json({ authenticated: false });
    }

    res.json({
      authenticated: true,
      user: {
        id: tokenRecord.user.id,
        email: tokenRecord.user.email,
        firstName: tokenRecord.user.firstName,
        lastName: tokenRecord.user.lastName,
        businessName: tokenRecord.user.businessName
      },
      expiresAt: tokenRecord.token.expiresAt
    });
  } catch (error) {
    console.error('Auth status check error:', error);
    res.status(500).json({ error: 'Failed to check auth status' });
  }
});

export default router;
