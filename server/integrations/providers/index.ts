/**
 * Provider Registry
 *
 * Central registry of all integration providers.
 * Use this to get providers by ID or list available providers.
 */

import type { IIntegrationProvider, ProviderInfo } from '../types';
import type { IntegrationProvider, DestinationType } from '@shared/schema';

import { webhookProvider } from './webhook';
import { zapierProvider } from './zapier';
import { makeProvider } from './make';
import { slackProvider } from './slack';
import { hubspotProvider } from './hubspot';
import { gmailProvider } from './gmail';
import { microsoftProvider } from './microsoft';

// Registry of all providers
const providers: Map<IntegrationProvider, IIntegrationProvider> = new Map([
  ['webhook', webhookProvider],
  ['zapier', zapierProvider],
  ['make', makeProvider],
  ['slack', slackProvider],
  ['hubspot', hubspotProvider],
  ['gmail', gmailProvider],
  ['microsoft', microsoftProvider],
]);

/**
 * Get a provider by ID
 */
export function getProvider(providerId: IntegrationProvider): IIntegrationProvider | undefined {
  return providers.get(providerId);
}

/**
 * Get all available providers
 */
export function getAllProviders(): IIntegrationProvider[] {
  return Array.from(providers.values());
}

/**
 * Get provider info for display in UI
 */
export function getProviderInfo(): ProviderInfo[] {
  return [
    {
      id: 'hubspot',
      name: 'HubSpot',
      icon: 'hubspot',
      description: 'Sync contacts, deals, and documents with HubSpot CRM',
      authType: 'oauth',
      destinationTypes: ['hubspot_contact', 'hubspot_deal', 'hubspot_company', 'hubspot_note'],
      status: 'available',
    },
    {
      id: 'slack',
      name: 'Slack',
      icon: 'slack',
      description: 'Send notifications to Slack channels',
      authType: 'oauth',
      destinationTypes: ['slack_message'],
      status: 'available',
    },
    {
      id: 'zapier',
      name: 'Zapier',
      icon: 'zapier',
      description: 'Connect to thousands of apps via Zapier',
      authType: 'webhook',
      destinationTypes: ['zapier_webhook'],
      status: 'available',
    },
    {
      id: 'make',
      name: 'Make',
      icon: 'make',
      description: 'Automate workflows with Make (formerly Integromat)',
      authType: 'webhook',
      destinationTypes: ['make_webhook'],
      status: 'available',
    },
    {
      id: 'webhook',
      name: 'Custom Webhook',
      icon: 'webhook',
      description: 'Send events to any URL endpoint',
      authType: 'webhook',
      destinationTypes: ['custom_webhook'],
      status: 'available',
    },
    {
      id: 'gmail',
      name: 'Gmail',
      icon: 'gmail',
      description: 'Connect your Gmail to sync email activity with contacts',
      authType: 'oauth',
      destinationTypes: [],
      status: gmailProvider.isConfigured() ? 'available' : 'coming_soon',
    },
    {
      id: 'microsoft',
      name: 'Microsoft 365',
      icon: 'microsoft',
      description: 'Connect your Outlook to sync email activity with contacts',
      authType: 'oauth',
      destinationTypes: [],
      status: microsoftProvider.isConfigured() ? 'available' : 'coming_soon',
    },
  ];
}

/**
 * Get the provider for a given destination type
 */
export function getProviderForDestination(destinationType: DestinationType): IIntegrationProvider | undefined {
  for (const provider of providers.values()) {
    if (provider.destinationTypes.includes(destinationType)) {
      return provider;
    }
  }
  return undefined;
}

/**
 * Check if a provider requires OAuth
 */
export function providerRequiresOAuth(providerId: IntegrationProvider): boolean {
  const provider = providers.get(providerId);
  return provider?.authType === 'oauth';
}

// Re-export individual providers for direct access
export { webhookProvider } from './webhook';
export { zapierProvider } from './zapier';
export { makeProvider } from './make';
export { slackProvider } from './slack';
export { hubspotProvider } from './hubspot';
export { gmailProvider } from './gmail';
export { microsoftProvider } from './microsoft';
