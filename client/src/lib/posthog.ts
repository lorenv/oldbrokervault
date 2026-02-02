/**
 * PostHog Analytics Client
 *
 * Centralized PostHog integration for event tracking, user identification,
 * and page view analytics. Replaces Google Analytics.
 */

import posthog from 'posthog-js';
import { getAttribution, getSourceCategory, type Attribution } from './utm';

let isInitialized = false;

/**
 * Initialize PostHog with project API key
 */
export function initPostHog(): void {
  if (isInitialized) return;
  if (typeof window === 'undefined') return;

  const apiKey = import.meta.env.VITE_POSTHOG_KEY;
  const apiHost = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

  if (!apiKey) {
    console.warn('PostHog API key not configured. Analytics disabled.');
    return;
  }

  posthog.init(apiKey, {
    api_host: apiHost,
    // Capture page views automatically
    capture_pageview: false, // We'll handle this manually for SPA
    capture_pageleave: true,
    // Privacy settings
    respect_dnt: true,
    // Performance settings
    autocapture: true,
    disable_session_recording: false,
    // Cookie settings
    persistence: 'localStorage+cookie',
    // Cross-subdomain tracking
    cross_subdomain_cookie: true,
  });

  isInitialized = true;
}

/**
 * Check if PostHog is initialized
 */
export function isPostHogReady(): boolean {
  return isInitialized;
}

/**
 * Track a page view with UTM attribution
 */
export function trackPageView(path?: string): void {
  if (!isInitialized) return;

  const url = path || window.location.pathname + window.location.search;
  const attribution = getAttribution();

  posthog.capture('$pageview', {
    $current_url: window.location.origin + url,
    ...attribution,
  });
}

/**
 * Identify a user after login/signup
 */
export function identifyUser(
  userId: number | string,
  traits?: {
    email?: string;
    name?: string;
    businessName?: string;
    subscriptionStatus?: string;
    isAdmin?: boolean;
    createdAt?: string;
    [key: string]: any;
  }
): void {
  if (!isInitialized) return;

  const attribution = getAttribution();
  const sourceCategory = getSourceCategory(attribution);

  posthog.identify(String(userId), {
    ...traits,
    // Include first-touch attribution on identify
    initial_utm_source: attribution.utm_source,
    initial_utm_medium: attribution.utm_medium,
    initial_utm_campaign: attribution.utm_campaign,
    initial_referrer: attribution.referrer_url,
    initial_landing_page: attribution.landing_page,
    acquisition_source: sourceCategory,
  });
}

/**
 * Reset user identity (on logout)
 */
export function resetUser(): void {
  if (!isInitialized) return;
  posthog.reset();
}

/**
 * Track a custom event
 */
export function trackEvent(
  eventName: string,
  properties?: Record<string, any>
): void {
  if (!isInitialized) return;

  const attribution = getAttribution();

  posthog.capture(eventName, {
    ...properties,
    // Include current attribution context
    utm_source: attribution.utm_source,
    utm_medium: attribution.utm_medium,
    utm_campaign: attribution.utm_campaign,
  });
}

/**
 * Track signup started event
 */
export function trackSignupStarted(properties?: Record<string, any>): void {
  trackEvent('signup_started', {
    ...properties,
    ...getAttribution(),
  });
}

/**
 * Track signup completed event
 */
export function trackSignupCompleted(
  userId: number | string,
  email: string,
  properties?: Record<string, any>
): void {
  const attribution = getAttribution();
  const sourceCategory = getSourceCategory(attribution);

  trackEvent('signup_completed', {
    ...properties,
    user_id: userId,
    email,
    acquisition_source: sourceCategory,
    ...attribution,
  });
}

/**
 * Track subscription started event
 */
export function trackSubscriptionStarted(properties: {
  plan: string;
  billing_cycle: 'monthly' | 'annual';
  amount?: number;
  currency?: string;
}): void {
  trackEvent('subscription_started', properties);
}

/**
 * Track feature usage
 */
export function trackFeatureUsed(
  featureName: string,
  properties?: Record<string, any>
): void {
  trackEvent('feature_used', {
    feature: featureName,
    ...properties,
  });
}

/**
 * Track document created
 */
export function trackDocumentCreated(properties?: {
  documentType?: string;
  method?: string;
}): void {
  trackEvent('document_created', properties);
}

/**
 * Set user properties without triggering an event
 */
export function setUserProperties(properties: Record<string, any>): void {
  if (!isInitialized) return;
  posthog.people.set(properties);
}

/**
 * Increment a user property
 */
export function incrementUserProperty(property: string, value: number = 1): void {
  if (!isInitialized) return;
  // Use capture with $set to update user properties
  posthog.capture('$set', {
    $set: { [property]: value },
  });
}

/**
 * Register super properties (included with every event)
 */
export function registerSuperProperties(properties: Record<string, any>): void {
  if (!isInitialized) return;
  posthog.register(properties);
}

/**
 * Get the current distinct ID
 */
export function getDistinctId(): string | undefined {
  if (!isInitialized) return undefined;
  return posthog.get_distinct_id();
}

/**
 * Opt user out of tracking
 */
export function optOut(): void {
  if (!isInitialized) return;
  posthog.opt_out_capturing();
}

/**
 * Opt user back into tracking
 */
export function optIn(): void {
  if (!isInitialized) return;
  posthog.opt_in_capturing();
}

/**
 * Check if user has opted out
 */
export function hasOptedOut(): boolean {
  if (!isInitialized) return false;
  return posthog.has_opted_out_capturing();
}

// Export the raw posthog instance for advanced use cases
export { posthog };
