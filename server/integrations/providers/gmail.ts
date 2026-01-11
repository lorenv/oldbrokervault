/**
 * Gmail Provider
 *
 * OAuth-based integration with Gmail for email syncing and activity tracking.
 * Uses Google OAuth 2.0 for authentication.
 */

import { BaseProvider } from './base';
import { encrypt, decrypt } from '../encryption';
import type {
  ExecutionResult,
  FieldSchema,
  OAuthResult,
  OAuthTokens,
  ConnectionTestResult
} from '../types';
import type {
  IntegrationConnection,
  IntegrationAutomation,
  IntegrationProvider,
  DestinationType,
  FieldMapping
} from '@shared/schema';

// Gmail OAuth configuration
const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '';
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '';
const GMAIL_REDIRECT_URI = process.env.GMAIL_REDIRECT_URI ||
  `${process.env.BASE_URL || 'https://cimshare.com'}/api/integrations/oauth/callback/gmail`;

// Gmail API scopes
// Read-only by default for safety - upgrade to modify if needed
const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',     // Read emails
  'https://www.googleapis.com/auth/gmail.send',          // Send emails
  'https://www.googleapis.com/auth/userinfo.email',      // Get user email
  'https://www.googleapis.com/auth/userinfo.profile',    // Get user profile
];

// Google OAuth endpoints
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1';

export class GmailProvider extends BaseProvider {
  id: IntegrationProvider = 'gmail';
  name = 'Gmail';
  icon = 'gmail';
  description = 'Connect your Gmail account to sync email activity with contacts';
  authType: 'oauth' | 'webhook' | 'api_key' = 'oauth';
  destinationTypes: DestinationType[] = [];

  /**
   * Check if Gmail is properly configured
   */
  isConfigured(): boolean {
    return !!(GMAIL_CLIENT_ID && GMAIL_CLIENT_SECRET);
  }

  /**
   * Generate OAuth authorization URL
   */
  getAuthUrl(userId: number, state: string): string {
    if (!this.isConfigured()) {
      throw new Error('Gmail OAuth is not configured. Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET environment variables.');
    }

    const params = new URLSearchParams({
      client_id: GMAIL_CLIENT_ID,
      redirect_uri: GMAIL_REDIRECT_URI,
      response_type: 'code',
      scope: GMAIL_SCOPES.join(' '),
      access_type: 'offline',  // Required for refresh token
      prompt: 'consent',       // Force consent to get refresh token
      state: state,
    });

    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<OAuthResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'Gmail OAuth is not configured',
      };
    }

    try {
      const response = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: GMAIL_CLIENT_ID,
          client_secret: GMAIL_CLIENT_SECRET,
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: GMAIL_REDIRECT_URI,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[Gmail] Token exchange failed:', errorData);
        return {
          success: false,
          error: errorData.error_description || 'Failed to exchange code for tokens',
        };
      }

      const tokenData = await response.json();

      // Get user info
      const userInfo = await this.getUserInfo(tokenData.access_token);

      // Encrypt tokens before storing
      const encryptedTokens: OAuthTokens = {
        accessToken: encrypt(tokenData.access_token),
        refreshToken: tokenData.refresh_token ? encrypt(tokenData.refresh_token) : undefined,
        expiresAt: tokenData.expires_in
          ? new Date(Date.now() + tokenData.expires_in * 1000)
          : undefined,
        scope: tokenData.scope,
      };

      return {
        success: true,
        tokens: encryptedTokens,
        accountId: userInfo.email,
        accountName: userInfo.name || userInfo.email,
      };
    } catch (error) {
      console.error('[Gmail] Error exchanging code:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to exchange code',
      };
    }
  }

  /**
   * Get Gmail user info
   */
  private async getUserInfo(accessToken: string): Promise<{ email: string; name?: string }> {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user info');
    }

    const data = await response.json();
    return {
      email: data.email,
      name: data.name,
    };
  }

  /**
   * Refresh expired access token
   */
  async refreshAccessToken(connection: IntegrationConnection): Promise<OAuthTokens | null> {
    if (!connection.refreshToken) {
      console.error('[Gmail] No refresh token available');
      return null;
    }

    try {
      const decryptedRefreshToken = decrypt(connection.refreshToken);

      const response = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: GMAIL_CLIENT_ID,
          client_secret: GMAIL_CLIENT_SECRET,
          refresh_token: decryptedRefreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[Gmail] Token refresh failed:', errorData);
        return null;
      }

      const tokenData = await response.json();

      return {
        accessToken: encrypt(tokenData.access_token),
        refreshToken: connection.refreshToken, // Keep existing refresh token
        expiresAt: tokenData.expires_in
          ? new Date(Date.now() + tokenData.expires_in * 1000)
          : undefined,
        scope: tokenData.scope,
      };
    } catch (error) {
      console.error('[Gmail] Error refreshing token:', error);
      return null;
    }
  }

  /**
   * Get valid access token, refreshing if needed
   */
  async getValidAccessToken(connection: IntegrationConnection): Promise<string | null> {
    const now = new Date();
    const expiresAt = connection.tokenExpiresAt ? new Date(connection.tokenExpiresAt) : null;

    // Check if token is expired or will expire in next 5 minutes
    if (expiresAt && expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
      console.log('[Gmail] Token expired or expiring soon, refreshing...');
      const newTokens = await this.refreshAccessToken(connection);
      if (newTokens) {
        // Update connection with new tokens (caller should persist this)
        return decrypt(newTokens.accessToken);
      }
      return null;
    }

    return connection.accessToken ? decrypt(connection.accessToken) : null;
  }

  /**
   * Test the connection
   */
  async testConnection(connection: IntegrationConnection): Promise<ConnectionTestResult> {
    try {
      const accessToken = await this.getValidAccessToken(connection);
      if (!accessToken) {
        return {
          success: false,
          error: 'Failed to get valid access token',
        };
      }

      // Try to get user's Gmail profile
      const response = await fetch(`${GMAIL_API_BASE}/users/me/profile`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: errorData.error?.message || 'Failed to verify Gmail connection',
        };
      }

      const profile = await response.json();
      return {
        success: true,
        message: `Connected to ${profile.emailAddress}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed',
      };
    }
  }

  /**
   * Get recent emails from Gmail
   */
  async getRecentEmails(
    connection: IntegrationConnection,
    options: {
      maxResults?: number;
      query?: string;
      after?: Date;
    } = {}
  ): Promise<any[]> {
    const accessToken = await this.getValidAccessToken(connection);
    if (!accessToken) {
      throw new Error('Failed to get valid access token');
    }

    const { maxResults = 20, query = '', after } = options;

    // Build Gmail search query
    let searchQuery = query;
    if (after) {
      const afterTimestamp = Math.floor(after.getTime() / 1000);
      searchQuery += ` after:${afterTimestamp}`;
    }

    const params = new URLSearchParams({
      maxResults: maxResults.toString(),
    });
    if (searchQuery.trim()) {
      params.append('q', searchQuery.trim());
    }

    const listResponse = await fetch(
      `${GMAIL_API_BASE}/users/me/messages?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!listResponse.ok) {
      throw new Error('Failed to fetch emails');
    }

    const listData = await listResponse.json();
    const messages = listData.messages || [];

    // Fetch full message details for each email
    const emailDetails = await Promise.all(
      messages.slice(0, maxResults).map(async (msg: { id: string }) => {
        const msgResponse = await fetch(
          `${GMAIL_API_BASE}/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );
        if (!msgResponse.ok) return null;
        return msgResponse.json();
      })
    );

    return emailDetails.filter(Boolean).map((email: any) => {
      const headers = email.payload?.headers || [];
      const getHeader = (name: string) =>
        headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value;

      return {
        id: email.id,
        threadId: email.threadId,
        from: getHeader('From'),
        to: getHeader('To'),
        subject: getHeader('Subject'),
        date: getHeader('Date'),
        snippet: email.snippet,
        labelIds: email.labelIds,
      };
    });
  }

  /**
   * Send an email via Gmail
   */
  async sendEmail(
    connection: IntegrationConnection,
    options: {
      to: string;
      subject: string;
      body: string;
      isHtml?: boolean;
    }
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const accessToken = await this.getValidAccessToken(connection);
    if (!accessToken) {
      return { success: false, error: 'Failed to get valid access token' };
    }

    const { to, subject, body, isHtml = false } = options;

    // Create email in RFC 2822 format
    const mimeType = isHtml ? 'text/html' : 'text/plain';
    const emailLines = [
      `To: ${to}`,
      `Subject: ${subject}`,
      `Content-Type: ${mimeType}; charset=utf-8`,
      '',
      body,
    ];
    const email = emailLines.join('\r\n');

    // Base64 URL encode the email
    const encodedEmail = Buffer.from(email)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const response = await fetch(`${GMAIL_API_BASE}/users/me/messages/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: encodedEmail }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.error?.message || 'Failed to send email',
      };
    }

    const result = await response.json();
    return {
      success: true,
      messageId: result.id,
    };
  }

  // Required methods from BaseProvider (not used for email integrations)
  getDestinationFields(destinationType: DestinationType): FieldSchema[] {
    return [];
  }

  async execute(
    automation: IntegrationAutomation,
    connection: IntegrationConnection,
    eventData: Record<string, any>
  ): Promise<ExecutionResult> {
    return {
      success: false,
      error: 'Gmail provider does not support automation execution',
    };
  }
}

// Export singleton instance
export const gmailProvider = new GmailProvider();
