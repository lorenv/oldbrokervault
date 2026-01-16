/**
 * Microsoft Provider
 *
 * OAuth-based integration with Microsoft 365 / Outlook for email syncing.
 * Uses Microsoft Identity Platform (OAuth 2.0) for authentication.
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

// Microsoft OAuth configuration
const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID || '';
const MICROSOFT_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET || '';
const MICROSOFT_TENANT_ID = process.env.MICROSOFT_TENANT_ID || 'common'; // 'common' for multi-tenant
const MICROSOFT_REDIRECT_URI = process.env.MICROSOFT_REDIRECT_URI ||
  `${process.env.BASE_URL || 'https://cimshare.com'}/api/integrations/oauth/callback/microsoft`;

// Microsoft Graph API scopes
const MICROSOFT_SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',                    // Required for refresh token
  'Mail.Read',                         // Read emails
  'Mail.Send',                         // Send emails
  'User.Read',                         // Get user profile
];

// Microsoft OAuth endpoints
const getAuthUrl = () => `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/oauth2/v2.0/authorize`;
const getTokenUrl = () => `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/oauth2/v2.0/token`;
const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';

export class MicrosoftProvider extends BaseProvider {
  id: IntegrationProvider = 'microsoft';
  name = 'Microsoft 365';
  icon = 'microsoft';
  description = 'Connect your Outlook account to sync email activity with contacts';
  authType: 'oauth' | 'webhook' | 'api_key' = 'oauth';
  destinationTypes: DestinationType[] = [];

  /**
   * Check if Microsoft OAuth is properly configured
   */
  isConfigured(): boolean {
    return !!(MICROSOFT_CLIENT_ID && MICROSOFT_CLIENT_SECRET);
  }

  /**
   * Generate OAuth authorization URL
   */
  getAuthUrl(userId: number, state: string): string {
    if (!this.isConfigured()) {
      throw new Error('Microsoft OAuth is not configured. Set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET environment variables.');
    }

    const params = new URLSearchParams({
      client_id: MICROSOFT_CLIENT_ID,
      redirect_uri: MICROSOFT_REDIRECT_URI,
      response_type: 'code',
      scope: MICROSOFT_SCOPES.join(' '),
      response_mode: 'query',
      state: state,
    });

    return `${getAuthUrl()}?${params.toString()}`;
  }

  /**
   * Handle OAuth callback - exchange code for tokens
   * Returns unencrypted tokens (encryption handled by route)
   */
  async handleCallback(code: string, userId: number): Promise<OAuthResult> {
    if (!this.isConfigured()) {
      throw new Error('Microsoft OAuth is not configured');
    }

    // Debug: Log lengths only (not actual values)
    console.error('[Microsoft] Token exchange debug:', JSON.stringify({
      clientIdLength: MICROSOFT_CLIENT_ID.length,
      clientSecretLength: MICROSOFT_CLIENT_SECRET.length,
      clientSecretFirst3: MICROSOFT_CLIENT_SECRET.substring(0, 3),
      clientSecretLast3: MICROSOFT_CLIENT_SECRET.substring(MICROSOFT_CLIENT_SECRET.length - 3),
      redirectUri: MICROSOFT_REDIRECT_URI,
    }));

    const response = await fetch(getTokenUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: MICROSOFT_CLIENT_ID,
        client_secret: MICROSOFT_CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: MICROSOFT_REDIRECT_URI,
        scope: MICROSOFT_SCOPES.join(' '),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[Microsoft] Token exchange failed:', errorData);
      throw new Error(errorData.error_description || 'Failed to exchange code for tokens');
    }

    const tokenData = await response.json();

    // Get user info
    const userInfo = await this.getUserInfo(tokenData.access_token);

    return {
      tokens: {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: tokenData.expires_in
          ? new Date(Date.now() + tokenData.expires_in * 1000)
          : undefined,
        scopes: MICROSOFT_SCOPES,
      },
      accountId: userInfo.email,
      accountName: userInfo.name || userInfo.email,
    };
  }

  /**
   * Exchange authorization code for tokens
   * @deprecated Use handleCallback instead
   */
  async exchangeCodeForTokens(code: string): Promise<OAuthResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'Microsoft OAuth is not configured',
      };
    }

    try {
      const response = await fetch(getTokenUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: MICROSOFT_CLIENT_ID,
          client_secret: MICROSOFT_CLIENT_SECRET,
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: MICROSOFT_REDIRECT_URI,
          scope: MICROSOFT_SCOPES.join(' '),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[Microsoft] Token exchange failed:', errorData);
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
      console.error('[Microsoft] Error exchanging code:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to exchange code',
      };
    }
  }

  /**
   * Get Microsoft user info from Graph API
   */
  private async getUserInfo(accessToken: string): Promise<{ email: string; name?: string }> {
    const response = await fetch(`${GRAPH_API_BASE}/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user info');
    }

    const data = await response.json();
    return {
      email: data.mail || data.userPrincipalName,
      name: data.displayName,
    };
  }

  /**
   * Refresh expired access token
   */
  async refreshAccessToken(connection: IntegrationConnection): Promise<OAuthTokens | null> {
    if (!connection.refreshToken) {
      console.error('[Microsoft] No refresh token available');
      return null;
    }

    try {
      const decryptedRefreshToken = decrypt(connection.refreshToken);

      const response = await fetch(getTokenUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: MICROSOFT_CLIENT_ID,
          client_secret: MICROSOFT_CLIENT_SECRET,
          refresh_token: decryptedRefreshToken,
          grant_type: 'refresh_token',
          scope: MICROSOFT_SCOPES.join(' '),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[Microsoft] Token refresh failed:', errorData);
        return null;
      }

      const tokenData = await response.json();

      return {
        accessToken: encrypt(tokenData.access_token),
        refreshToken: tokenData.refresh_token
          ? encrypt(tokenData.refresh_token)
          : connection.refreshToken, // Microsoft may return new refresh token
        expiresAt: tokenData.expires_in
          ? new Date(Date.now() + tokenData.expires_in * 1000)
          : undefined,
        scope: tokenData.scope,
      };
    } catch (error) {
      console.error('[Microsoft] Error refreshing token:', error);
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
      console.log('[Microsoft] Token expired or expiring soon, refreshing...');
      const newTokens = await this.refreshAccessToken(connection);
      if (newTokens) {
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

      // Try to get user's profile
      const response = await fetch(`${GRAPH_API_BASE}/me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: errorData.error?.message || 'Failed to verify Microsoft connection',
        };
      }

      const profile = await response.json();
      return {
        success: true,
        message: `Connected to ${profile.mail || profile.userPrincipalName}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed',
      };
    }
  }

  /**
   * Get recent emails from Outlook
   */
  async getRecentEmails(
    connection: IntegrationConnection,
    options: {
      maxResults?: number;
      filter?: string;
      after?: Date;
    } = {}
  ): Promise<any[]> {
    const accessToken = await this.getValidAccessToken(connection);
    if (!accessToken) {
      throw new Error('Failed to get valid access token');
    }

    const { maxResults = 20, filter = '', after } = options;

    // Build OData query parameters
    const params = new URLSearchParams({
      $top: maxResults.toString(),
      $select: 'id,subject,from,toRecipients,receivedDateTime,bodyPreview,isRead',
      $orderby: 'receivedDateTime desc',
    });

    // Add filter for date if provided
    if (after) {
      const afterFilter = `receivedDateTime ge ${after.toISOString()}`;
      params.append('$filter', filter ? `${filter} and ${afterFilter}` : afterFilter);
    } else if (filter) {
      params.append('$filter', filter);
    }

    const response = await fetch(
      `${GRAPH_API_BASE}/me/messages?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch emails');
    }

    const data = await response.json();
    const messages = data.value || [];

    return messages.map((email: any) => ({
      id: email.id,
      from: email.from?.emailAddress?.address,
      fromName: email.from?.emailAddress?.name,
      to: email.toRecipients?.map((r: any) => r.emailAddress?.address).join(', '),
      subject: email.subject,
      date: email.receivedDateTime,
      snippet: email.bodyPreview,
      isRead: email.isRead,
    }));
  }

  /**
   * Send an email via Outlook
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

    const message = {
      message: {
        subject: subject,
        body: {
          contentType: isHtml ? 'HTML' : 'Text',
          content: body,
        },
        toRecipients: [
          {
            emailAddress: {
              address: to,
            },
          },
        ],
      },
      saveToSentItems: true,
    };

    const response = await fetch(`${GRAPH_API_BASE}/me/sendMail`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.error?.message || 'Failed to send email',
      };
    }

    // Microsoft sendMail doesn't return message ID on success
    return {
      success: true,
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
      error: 'Microsoft provider does not support automation execution',
    };
  }
}

// Export singleton instance
export const microsoftProvider = new MicrosoftProvider();
