/**
 * Slack Provider
 *
 * OAuth-based integration with Slack.
 * Allows users to send notifications to Slack channels.
 */

import { BaseProvider } from './base';
import { encrypt, decrypt } from '../encryption';
import type {
  ExecutionResult,
  FieldSchema,
  OAuthResult,
  OAuthTokens,
  SlackDestinationConfig,
  ConnectionTestResult
} from '../types';
import type {
  IntegrationConnection,
  IntegrationAutomation,
  IntegrationProvider,
  DestinationType
} from '@shared/schema';

// Slack OAuth configuration
const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID || '';
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET || '';
const SLACK_REDIRECT_URI = process.env.SLACK_REDIRECT_URI ||
  `${process.env.BASE_URL || ''}/api/integrations/oauth/callback/slack`;

// Required scopes for posting messages, reading channels, and uploading files
// chat:write.public allows posting to public channels without joining first
const SLACK_SCOPES = ['chat:write', 'chat:write.public', 'channels:read', 'groups:read', 'files:write', 'channels:join'];

export class SlackProvider extends BaseProvider {
  id: IntegrationProvider = 'slack';
  name = 'Slack';
  icon = 'slack';
  description = 'Send notifications to Slack channels';
  authType: 'oauth' | 'webhook' | 'api_key' = 'oauth';
  destinationTypes: DestinationType[] = ['slack_message'];

  /**
   * Generate OAuth authorization URL
   */
  getAuthUrl(userId: number, state: string): string {
    const params = new URLSearchParams({
      client_id: SLACK_CLIENT_ID,
      scope: SLACK_SCOPES.join(','),
      redirect_uri: SLACK_REDIRECT_URI,
      state: state,
    });

    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }

  /**
   * Handle OAuth callback and exchange code for tokens
   */
  async handleCallback(code: string, userId: number): Promise<OAuthResult> {
    const response = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: SLACK_CLIENT_ID,
        client_secret: SLACK_CLIENT_SECRET,
        code: code,
        redirect_uri: SLACK_REDIRECT_URI,
      }),
    });

    const data = await response.json();

    if (!data.ok) {
      throw new Error(data.error || 'Failed to authenticate with Slack');
    }

    return {
      tokens: {
        accessToken: data.access_token,
        // Slack tokens don't expire, but we still encrypt them
        scopes: data.scope?.split(',') || SLACK_SCOPES,
      },
      accountId: data.team?.id || '',
      accountName: data.team?.name || 'Slack Workspace',
    };
  }

  /**
   * Test connection by getting workspace info
   */
  async testConnection(connection: IntegrationConnection): Promise<ConnectionTestResult> {
    const accessToken = connection.accessTokenEncrypted
      ? decrypt(connection.accessTokenEncrypted)
      : null;

    if (!accessToken) {
      return {
        success: false,
        error: 'No access token available'
      };
    }

    try {
      const response = await fetch('https://slack.com/api/auth.test', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.ok) {
        return {
          success: true,
          accountInfo: {
            id: data.team_id || '',
            name: data.team || '',
          }
        };
      } else {
        return {
          success: false,
          error: data.error || 'Connection test failed'
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to test connection'
      };
    }
  }

  /**
   * Get list of channels for the connected workspace
   */
  async getChannels(connection: IntegrationConnection): Promise<{ id: string; name: string }[]> {
    const accessToken = connection.accessTokenEncrypted
      ? decrypt(connection.accessTokenEncrypted)
      : null;

    if (!accessToken) {
      return [];
    }

    try {
      // Get public channels
      const publicResponse = await fetch('https://slack.com/api/conversations.list?types=public_channel&limit=200', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      const publicData = await publicResponse.json();

      // Get private channels the bot is in
      const privateResponse = await fetch('https://slack.com/api/conversations.list?types=private_channel&limit=200', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      const privateData = await privateResponse.json();

      const channels: { id: string; name: string }[] = [];

      if (publicData.ok && publicData.channels) {
        channels.push(...publicData.channels.map((c: any) => ({
          id: c.id,
          name: `#${c.name}`
        })));
      }

      if (privateData.ok && privateData.channels) {
        channels.push(...privateData.channels.map((c: any) => ({
          id: c.id,
          name: `🔒 ${c.name}`
        })));
      }

      return channels.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error('Failed to fetch Slack channels:', error);
      return [];
    }
  }

  /**
   * Execute Slack message send
   */
  async execute(
    connection: IntegrationConnection | null,
    automation: IntegrationAutomation,
    mappedPayload: Record<string, any>,
    eventPayload: Record<string, any>
  ): Promise<ExecutionResult> {
    console.log('[SlackProvider.execute] Starting execution');
    console.log('[SlackProvider.execute] Connection:', connection ? 'present' : 'null');
    console.log('[SlackProvider.execute] destinationConfig:', JSON.stringify(automation.destinationConfig));

    if (!connection) {
      console.log('[SlackProvider.execute] No connection found');
      return {
        success: false,
        error: 'Slack connection not found'
      };
    }

    const accessToken = connection.accessTokenEncrypted
      ? decrypt(connection.accessTokenEncrypted)
      : null;

    if (!accessToken) {
      console.log('[SlackProvider.execute] No access token');
      return {
        success: false,
        error: 'Slack access token not available'
      };
    }

    console.log('[SlackProvider.execute] Access token retrieved successfully');

    const config = automation.destinationConfig as SlackDestinationConfig;
    console.log('[SlackProvider.execute] Config channelId:', config?.channelId);
    if (!config?.channelId) {
      console.log('[SlackProvider.execute] No channel configured');
      return {
        success: false,
        error: 'Slack channel not configured'
      };
    }

    // Build the message
    const message = this.buildMessage(config, mappedPayload, eventPayload);

    try {
      const response = await this.httpRequest('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: config.channelId,
          ...message
        }),
      });

      const data = await response.json();

      if (data.ok) {
        return {
          success: true,
          statusCode: 200,
          externalId: data.ts, // Message timestamp (Slack's message ID)
          externalUrl: data.channel ? `https://slack.com/archives/${data.channel}/p${data.ts?.replace('.', '')}` : undefined,
          responseBody: JSON.stringify({ ok: true, ts: data.ts })
        };
      } else if (data.error === 'not_in_channel') {
        // Try to join the channel first, then retry
        console.log('[SlackProvider.execute] Bot not in channel, attempting to join...');
        const joinResponse = await this.httpRequest('https://slack.com/api/conversations.join', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ channel: config.channelId }),
        });
        const joinData = await joinResponse.json();

        if (joinData.ok) {
          console.log('[SlackProvider.execute] Successfully joined channel, retrying message...');
          // Retry sending the message
          const retryResponse = await this.httpRequest('https://slack.com/api/chat.postMessage', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              channel: config.channelId,
              ...message
            }),
          });
          const retryData = await retryResponse.json();

          if (retryData.ok) {
            return {
              success: true,
              statusCode: 200,
              externalId: retryData.ts,
              externalUrl: retryData.channel ? `https://slack.com/archives/${retryData.channel}/p${retryData.ts?.replace('.', '')}` : undefined,
              responseBody: JSON.stringify({ ok: true, ts: retryData.ts })
            };
          } else {
            return {
              success: false,
              statusCode: 200,
              error: retryData.error || 'Failed to send Slack message after joining channel',
              responseBody: JSON.stringify(retryData)
            };
          }
        } else {
          console.log('[SlackProvider.execute] Failed to join channel:', joinData.error);
          return {
            success: false,
            statusCode: 200,
            error: `Cannot post to channel: ${joinData.error || 'unable to join'}. Please add the bot to this channel manually.`,
            responseBody: JSON.stringify(data)
          };
        }
      } else {
        return {
          success: false,
          statusCode: 200,
          error: data.error || 'Failed to send Slack message',
          responseBody: JSON.stringify(data)
        };
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: 'Request timeout (30s)'
        };
      }

      return {
        success: false,
        error: error.message || 'Failed to send Slack message'
      };
    }
  }

  /**
   * Build Slack message with blocks
   */
  private buildMessage(
    config: SlackDestinationConfig,
    mappedPayload: Record<string, any>,
    eventPayload: Record<string, any>
  ): { text: string; blocks?: any[] } {
    // If there's a custom template, use it
    if (config.messageTemplate) {
      const text = this.interpolateTemplate(config.messageTemplate, mappedPayload, eventPayload);
      return { text };
    }

    // Default: Build a nice block-based message
    const eventType = eventPayload.event || 'Unknown Event';
    const eventLabel = this.getEventLabel(eventType);
    const data = Object.keys(mappedPayload).length > 0 ? mappedPayload : eventPayload.data;

    const blocks: any[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: eventLabel,
          emoji: true
        }
      }
    ];

    // Add data fields
    const fields = Object.entries(data || {})
      .filter(([key, value]) => value !== null && value !== undefined && !key.includes('url'))
      .slice(0, 10) // Limit to 10 fields
      .map(([key, value]) => ({
        type: 'mrkdwn',
        text: `*${this.formatFieldName(key)}:*\n${String(value)}`
      }));

    if (fields.length > 0) {
      blocks.push({
        type: 'section',
        fields: fields.slice(0, 2) // Slack allows max 2 fields per section
      });

      // Add remaining fields in additional sections
      for (let i = 2; i < fields.length; i += 2) {
        blocks.push({
          type: 'section',
          fields: fields.slice(i, i + 2)
        });
      }
    }

    // Add link if available
    const linkUrl = data?.document_url || data?.signed_document_url || data?.external_url;
    if (linkUrl) {
      blocks.push({
        type: 'actions',
        elements: [{
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'View Details',
            emoji: true
          },
          url: linkUrl,
          action_id: 'view_details'
        }]
      });
    }

    // Add timestamp
    blocks.push({
      type: 'context',
      elements: [{
        type: 'mrkdwn',
        text: `Sent from Broker Vault at ${new Date().toLocaleString()}`
      }]
    });

    return {
      text: eventLabel, // Fallback text for notifications
      blocks
    };
  }

  /**
   * Interpolate template with payload values
   */
  private interpolateTemplate(
    template: string,
    mappedPayload: Record<string, any>,
    eventPayload: Record<string, any>
  ): string {
    const allData = {
      ...eventPayload,
      ...eventPayload.data,
      ...mappedPayload
    };

    return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const trimmedKey = key.trim();
      const value = this.getNestedValue(allData, trimmedKey);
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: Record<string, any>, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Format field name for display
   */
  private formatFieldName(key: string): string {
    return key
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  /**
   * Get human-readable event label
   */
  private getEventLabel(eventType: string): string {
    const labels: Record<string, string> = {
      'cim.created': '📄 Document Created',
      'cim.updated': '📝 Document Updated',
      'cim.published': '🚀 Document Published',
      'cim.viewed': '👁️ Document Viewed',
      'cim.downloaded': '⬇️ Document Downloaded',
      'nda.signed': '✍️ NDA Signed',
      'nda.declined': '❌ NDA Declined',
      'esign.envelope_completed': '✅ E-Signature Completed',
      'contact.created': '👤 Contact Created',
      'contact.updated': '👤 Contact Updated',
      'message.received': '💬 Message Received',
      'message.sent': '📤 Message Sent',
      'dataroom.file_uploaded': '📁 File Uploaded',
      'dataroom.file_viewed': '📂 File Viewed',
      'dataroom.access_granted': '🔓 Access Granted',
    };

    return labels[eventType] || `📌 ${eventType}`;
  }
}

// Export singleton instance
export const slackProvider = new SlackProvider();
