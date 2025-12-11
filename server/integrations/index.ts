/**
 * Integrations Module Entry Point
 *
 * Re-exports all integration functionality for easy importing.
 */

// Core types
export * from './types';

// Encryption utilities
export { encrypt, decrypt, generateWebhookSecret } from './encryption';

// Provider registry
export {
  getProvider,
  getAllProviders,
  getProviderInfo,
  getProviderForDestination,
  providerRequiresOAuth,
} from './providers';

// Automation engine
export {
  dispatchIntegrationEvent,
  retryRun,
  testAutomation,
  processRetries,
} from './automation-engine';

// Individual providers (for direct access if needed)
export { webhookProvider } from './providers/webhook';
export { zapierProvider } from './providers/zapier';
export { makeProvider } from './providers/make';
export { slackProvider } from './providers/slack';
export { hubspotProvider } from './providers/hubspot';
