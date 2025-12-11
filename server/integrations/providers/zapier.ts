/**
 * Zapier Provider
 *
 * Webhook-based integration with Zapier.
 * Users paste their Zapier webhook URL and we send events to it.
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

export class ZapierProvider extends BaseProvider {
  id: IntegrationProvider = 'zapier';
  name = 'Zapier';
  icon = 'zapier';
  description = 'Connect to thousands of apps via Zapier';
  authType: 'oauth' | 'webhook' | 'api_key' = 'webhook';
  destinationTypes: DestinationType[] = ['zapier_webhook'];

  /**
   * Execute Zapier webhook delivery
   */
  async execute(
    connection: IntegrationConnection | null,
    automation: IntegrationAutomation,
    mappedPayload: Record<string, any>,
    eventPayload: Record<string, any>
  ): Promise<ExecutionResult> {
    const config = automation.destinationConfig as WebhookDestinationConfig;
    const webhookUrl = connection?.webhookUrl || config?.url;

    if (!webhookUrl) {
      return {
        success: false,
        error: 'Zapier webhook URL not configured'
      };
    }

    // Validate it's a Zapier URL
    if (!webhookUrl.includes('hooks.zapier.com')) {
      return {
        success: false,
        error: 'Invalid Zapier webhook URL. URL must be from hooks.zapier.com'
      };
    }

    // Build payload - Zapier expects a flat structure for easier mapping
    const payload = {
      event_type: eventPayload.event,
      timestamp: eventPayload.timestamp,
      // Spread the mapped payload (field mappings applied) or original data
      ...(Object.keys(mappedPayload).length > 0 ? mappedPayload : eventPayload.data),
      // Include file URL if present
      ...(eventPayload.data?.signed_document_url && {
        file_url: eventPayload.data.signed_document_url
      })
    };

    const payloadString = JSON.stringify(payload);

    try {
      const response = await this.httpRequest(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'CIMShare-Integrations/1.0'
        },
        body: payloadString
      });

      const responseBody = await response.text().catch(() => '');

      if (response.ok) {
        // Zapier returns a request_id we can store
        let requestId: string | undefined;
        try {
          const json = JSON.parse(responseBody);
          requestId = json.id || json.request_id;
        } catch {}

        return {
          success: true,
          statusCode: response.status,
          responseBody: this.truncateResponse(responseBody),
          externalId: requestId
        };
      } else {
        return {
          success: false,
          statusCode: response.status,
          responseBody: this.truncateResponse(responseBody),
          error: `Zapier returned ${response.status}: ${responseBody.substring(0, 200)}`
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
        error: error.message || 'Failed to send to Zapier'
      };
    }
  }
}

// Export singleton instance
export const zapierProvider = new ZapierProvider();
