/**
 * Custom Webhook Provider
 *
 * Handles sending events to user-defined webhook URLs.
 * This is the provider that existing webhooks will migrate to.
 */

import * as crypto from 'crypto';
import { BaseProvider } from './base';
import type { ExecutionResult, WebhookDestinationConfig } from '../types';
import type {
  IntegrationConnection,
  IntegrationAutomation,
  IntegrationProvider,
  DestinationType
} from '@shared/schema';

export class WebhookProvider extends BaseProvider {
  id: IntegrationProvider = 'webhook';
  name = 'Custom Webhook';
  icon = 'webhook';
  description = 'Send events to any URL endpoint';
  authType: 'oauth' | 'webhook' | 'api_key' = 'webhook';
  destinationTypes: DestinationType[] = ['custom_webhook'];

  /**
   * Generate HMAC signature for payload verification
   */
  private generateSignature(payload: string, secret: string): string {
    const timestamp = Math.floor(Date.now() / 1000);
    const signedPayload = `${timestamp}.${payload}`;
    const signature = crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');
    return `t=${timestamp},v1=${signature}`;
  }

  /**
   * Execute webhook delivery
   */
  async execute(
    connection: IntegrationConnection | null,
    automation: IntegrationAutomation,
    mappedPayload: Record<string, any>,
    eventPayload: Record<string, any>
  ): Promise<ExecutionResult> {
    // Get webhook URL and secret from connection or automation config
    const config = automation.destinationConfig as WebhookDestinationConfig;
    const webhookUrl = connection?.webhookUrl || config?.url;
    const webhookSecret = connection?.webhookSecret || '';

    if (!webhookUrl) {
      return {
        success: false,
        error: 'Webhook URL not configured'
      };
    }

    // Build the payload to send
    // For custom webhooks, we send the full event payload with field mappings applied
    const payload = {
      event: eventPayload.event,
      timestamp: eventPayload.timestamp,
      data: Object.keys(mappedPayload).length > 0 ? mappedPayload : eventPayload.data
    };

    const payloadString = JSON.stringify(payload);
    const signature = webhookSecret ? this.generateSignature(payloadString, webhookSecret) : '';

    const startTime = Date.now();

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'CIMShare-Integrations/1.0',
        'X-Webhook-Event': String(eventPayload.event),
        'X-Webhook-Event-Id': eventPayload.eventId || crypto.randomUUID(),
      };

      if (signature) {
        headers['X-Webhook-Signature'] = signature;
      }

      // Add any custom headers from config
      if (config?.headers) {
        Object.assign(headers, config.headers);
      }

      const response = await this.httpRequest(webhookUrl, {
        method: 'POST',
        headers,
        body: payloadString
      });

      const durationMs = Date.now() - startTime;
      const responseBody = await response.text().catch(() => '');

      if (response.ok) {
        return {
          success: true,
          statusCode: response.status,
          responseBody: this.truncateResponse(responseBody)
        };
      } else {
        return {
          success: false,
          statusCode: response.status,
          responseBody: this.truncateResponse(responseBody),
          error: `HTTP ${response.status}: ${responseBody.substring(0, 200)}`
        };
      }
    } catch (error: any) {
      const durationMs = Date.now() - startTime;

      if (error.name === 'AbortError') {
        return {
          success: false,
          error: 'Request timeout (30s)'
        };
      }

      return {
        success: false,
        error: error.message || 'Unknown error'
      };
    }
  }
}

// Export singleton instance
export const webhookProvider = new WebhookProvider();
