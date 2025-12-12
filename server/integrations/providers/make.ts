/**
 * Make (Integromat) Provider
 *
 * Webhook-based integration with Make.
 * Users paste their Make webhook URL and we send events to it.
 */

import { BaseProvider } from './base';
import type { ExecutionResult, WebhookDestinationConfig } from '../types';
import type {
  IntegrationConnection,
  IntegrationAutomation,
  IntegrationProvider,
  DestinationType
} from '@shared/schema';

export class MakeProvider extends BaseProvider {
  id: IntegrationProvider = 'make';
  name = 'Make';
  icon = 'make';
  description = 'Automate workflows with Make (formerly Integromat)';
  authType: 'oauth' | 'webhook' | 'api_key' = 'webhook';
  destinationTypes: DestinationType[] = ['make_webhook'];

  /**
   * Execute Make webhook delivery
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
        error: 'Make webhook URL not configured'
      };
    }

    // Validate it's a Make URL
    if (!webhookUrl.includes('hook.make.com') && !webhookUrl.includes('hook.integromat.com')) {
      return {
        success: false,
        error: 'Invalid Make webhook URL. URL must be from hook.make.com'
      };
    }

    // Build payload - Make works well with nested structures
    const payload = {
      event_type: eventPayload.event,
      timestamp: eventPayload.timestamp,
      data: Object.keys(mappedPayload).length > 0 ? mappedPayload : eventPayload.data,
      // Include file URL if present for easy access
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
          error: `Make returned ${response.status}: ${responseBody.substring(0, 200)}`
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
        error: error.message || 'Failed to send to Make'
      };
    }
  }
}

// Export singleton instance
export const makeProvider = new MakeProvider();
