/**
 * Base Provider Class
 *
 * Abstract base class that provides common functionality for all providers.
 * Specific providers extend this and implement their own execute() method.
 */

import type {
  IIntegrationProvider,
  ExecutionResult,
  FieldSchema,
  ConnectionTestResult,
  OAuthResult,
  OAuthTokens
} from '../types';
import type {
  IntegrationConnection,
  IntegrationAutomation,
  IntegrationProvider,
  DestinationType
} from '@shared/schema';

export abstract class BaseProvider implements IIntegrationProvider {
  abstract id: IntegrationProvider;
  abstract name: string;
  abstract icon: string;
  abstract description: string;
  abstract authType: 'oauth' | 'webhook' | 'api_key';
  abstract destinationTypes: DestinationType[];

  /**
   * Execute the integration action
   * Must be implemented by each provider
   */
  abstract execute(
    connection: IntegrationConnection | null,
    automation: IntegrationAutomation,
    mappedPayload: Record<string, any>,
    eventPayload: Record<string, any>
  ): Promise<ExecutionResult>;

  /**
   * Get the schema/fields for a destination type
   * Override in providers that support field mapping
   */
  async getDestinationSchema(
    connection: IntegrationConnection,
    destinationType: DestinationType
  ): Promise<FieldSchema[]> {
    return [];
  }

  /**
   * Test if a connection is still valid
   * Override in OAuth providers
   */
  async testConnection(connection: IntegrationConnection): Promise<ConnectionTestResult> {
    return {
      success: true,
      accountInfo: {
        id: connection.providerAccountId || '',
        name: connection.providerAccountName || ''
      }
    };
  }

  // OAuth methods - override in OAuth providers
  getAuthUrl?(userId: number, state: string): string;
  handleCallback?(code: string, userId: number): Promise<OAuthResult>;
  refreshToken?(connection: IntegrationConnection): Promise<OAuthTokens>;

  /**
   * Helper: Make HTTP request with timeout
   */
  protected async httpRequest(
    url: string,
    options: RequestInit,
    timeoutMs: number = 30000
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      return response;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Helper: Truncate response body for storage
   */
  protected truncateResponse(body: string, maxLength: number = 1000): string {
    if (body.length <= maxLength) {
      return body;
    }
    return body.substring(0, maxLength) + '... (truncated)';
  }
}
