/**
 * Integration System Types
 *
 * Core type definitions for the integrations system including
 * provider interfaces, execution results, and field schemas.
 */

import type {
  IntegrationConnection,
  IntegrationAutomation,
  FieldMapping,
  IntegrationProvider,
  DestinationType,
  WebhookEventType
} from '@shared/schema';

// ============================================================================
// Provider Interface
// ============================================================================

/**
 * Base interface that all integration providers must implement
 */
export interface IIntegrationProvider {
  // Metadata
  id: IntegrationProvider;
  name: string;
  icon: string;
  description: string;
  authType: 'oauth' | 'webhook' | 'api_key';

  // What this provider can send to
  destinationTypes: DestinationType[];

  // OAuth methods (optional - only for oauth providers)
  getAuthUrl?(userId: number, state: string): string;
  handleCallback?(code: string, userId: number): Promise<OAuthResult>;
  refreshToken?(connection: IntegrationConnection): Promise<OAuthTokens>;

  // Schema/field fetching for field mapping UI
  getDestinationSchema?(
    connection: IntegrationConnection,
    destinationType: DestinationType
  ): Promise<FieldSchema[]>;

  // Execute the actual integration action
  execute(
    connection: IntegrationConnection | null,
    automation: IntegrationAutomation,
    mappedPayload: Record<string, any>,
    eventPayload: Record<string, any>
  ): Promise<ExecutionResult>;

  // Test the connection is still valid
  testConnection?(connection: IntegrationConnection): Promise<ConnectionTestResult>;
}

// ============================================================================
// OAuth Types
// ============================================================================

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scopes?: string[];
}

export interface OAuthResult {
  tokens: OAuthTokens;
  accountId: string;
  accountName: string;
}

// ============================================================================
// Field Schema Types
// ============================================================================

export interface FieldSchema {
  name: string;           // Internal field name (e.g., 'email', 'firstname')
  label: string;          // Display label (e.g., 'Email Address', 'First Name')
  type: FieldType;
  required: boolean;
  description?: string;
  options?: FieldOption[]; // For select/enum fields
  group?: string;          // For grouping fields in UI (e.g., 'Contact Info', 'Custom Properties')
}

export type FieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'email'
  | 'phone'
  | 'url'
  | 'select'
  | 'multiselect'
  | 'textarea';

export interface FieldOption {
  value: string;
  label: string;
}

// ============================================================================
// Execution Types
// ============================================================================

export interface ExecutionResult {
  success: boolean;
  externalId?: string;        // ID from the destination system
  externalUrl?: string;       // Link to view the record
  statusCode?: number;        // HTTP status code
  responseBody?: string;      // Response from destination (truncated)
  error?: string;             // Error message if failed
  fileUploaded?: boolean;     // Whether a file was attached
  fileName?: string;
  fileSize?: number;
}

export interface ConnectionTestResult {
  success: boolean;
  error?: string;
  accountInfo?: {
    id: string;
    name: string;
  };
}

// ============================================================================
// Event Payload Types
// ============================================================================

/**
 * Standard event payload structure
 */
export interface EventPayload {
  event: WebhookEventType;
  timestamp: string;
  test?: boolean;
  data: Record<string, any>;
}

/**
 * Event metadata for the field mapping UI
 */
export interface EventFieldMetadata {
  eventType: WebhookEventType;
  fields: EventField[];
}

export interface EventField {
  path: string;       // Dot notation path (e.g., 'data.signer_email')
  label: string;      // Human-readable label
  type: FieldType;
  example?: string;   // Example value for preview
}

// ============================================================================
// Condition Evaluation Types
// ============================================================================

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'is_empty'
  | 'is_not_empty';

export interface TriggerCondition {
  field: string;
  operator: ConditionOperator;
  value?: string;
}

// ============================================================================
// Provider Registry Types
// ============================================================================

export interface ProviderInfo {
  id: IntegrationProvider;
  name: string;
  icon: string;
  description: string;
  authType: 'oauth' | 'webhook' | 'api_key';
  destinationTypes: DestinationType[];
  status: 'available' | 'coming_soon';
}

// ============================================================================
// Destination Configuration Types
// ============================================================================

/**
 * HubSpot-specific destination config
 */
export interface HubSpotDestinationConfig {
  objectType: 'contact' | 'deal' | 'company';
  portalId?: string;
}

/**
 * Slack-specific destination config
 */
export interface SlackDestinationConfig {
  channelId: string;
  channelName?: string;
  messageTemplate?: string;
}

/**
 * Webhook destination config (Zapier, Make, custom)
 */
export interface WebhookDestinationConfig {
  url: string;
  headers?: Record<string, string>;
  includeSignature?: boolean;
}

export type DestinationConfig =
  | HubSpotDestinationConfig
  | SlackDestinationConfig
  | WebhookDestinationConfig
  | Record<string, any>;

// ============================================================================
// Error Types
// ============================================================================

export class IntegrationError extends Error {
  constructor(
    message: string,
    public code: IntegrationErrorCode,
    public statusCode?: number,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'IntegrationError';
  }
}

export type IntegrationErrorCode =
  | 'AUTH_EXPIRED'
  | 'AUTH_INVALID'
  | 'RATE_LIMITED'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'UNKNOWN';

/**
 * Map technical errors to user-friendly messages
 */
export const ERROR_MESSAGES: Record<IntegrationErrorCode, string> = {
  AUTH_EXPIRED: 'Your connection has expired. Please reconnect.',
  AUTH_INVALID: 'Your connection is no longer valid. Please reconnect.',
  RATE_LIMITED: 'Rate limit reached. We\'ll retry automatically.',
  NOT_FOUND: 'The record couldn\'t be found. It may have been deleted.',
  VALIDATION_ERROR: 'The data couldn\'t be saved due to validation errors.',
  NETWORK_ERROR: 'Unable to reach the destination. Please check your connection.',
  TIMEOUT: 'The request timed out. We\'ll retry automatically.',
  UNKNOWN: 'An unexpected error occurred.',
};
