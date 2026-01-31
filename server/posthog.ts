/**
 * Server-side PostHog Analytics
 *
 * Used for reliable tracking of critical events like payments
 * that shouldn't be blocked by ad blockers.
 */

import { PostHog } from 'posthog-node';

let posthogClient: PostHog | null = null;

/**
 * Initialize PostHog server client
 */
export function initPostHogServer(): void {
  const apiKey = process.env.POSTHOG_API_KEY;
  const host = process.env.POSTHOG_HOST || 'https://us.i.posthog.com';

  if (!apiKey) {
    console.warn('PostHog API key not configured. Server-side analytics disabled.');
    return;
  }

  posthogClient = new PostHog(apiKey, {
    host,
    // Flush events every 10 seconds or when buffer reaches 20 events
    flushAt: 20,
    flushInterval: 10000,
  });

  console.log('PostHog server client initialized');
}

/**
 * Check if PostHog is initialized
 */
export function isPostHogServerReady(): boolean {
  return posthogClient !== null;
}

/**
 * Track a server-side event
 */
export function trackServerEvent(
  userId: string | number,
  eventName: string,
  properties?: Record<string, any>
): void {
  if (!posthogClient) return;

  posthogClient.capture({
    distinctId: String(userId),
    event: eventName,
    properties: {
      ...properties,
      $lib: 'posthog-node',
      source: 'server',
    },
  });
}

/**
 * Identify a user server-side
 */
export function identifyUserServer(
  userId: string | number,
  properties?: Record<string, any>
): void {
  if (!posthogClient) return;

  posthogClient.identify({
    distinctId: String(userId),
    properties,
  });
}

/**
 * Track subscription started event
 */
export function trackSubscriptionStarted(
  userId: number,
  properties: {
    plan: string;
    priceId: string;
    amount?: number;
    currency?: string;
    billingCycle?: 'monthly' | 'annual';
    stripeCustomerId?: string;
    subscriptionId?: string;
  }
): void {
  trackServerEvent(userId, 'subscription_started', {
    ...properties,
    // Standard PostHog revenue tracking
    $set: {
      subscription_plan: properties.plan,
      subscription_status: 'active',
    },
  });
}

/**
 * Track subscription renewed event
 */
export function trackSubscriptionRenewed(
  userId: number,
  properties: {
    plan: string;
    amount?: number;
    currency?: string;
  }
): void {
  trackServerEvent(userId, 'subscription_renewed', properties);
}

/**
 * Track subscription cancelled event
 */
export function trackSubscriptionCancelled(
  userId: number,
  properties: {
    plan: string;
    reason?: string;
  }
): void {
  trackServerEvent(userId, 'subscription_cancelled', {
    ...properties,
    $set: {
      subscription_status: 'cancelled',
    },
  });
}

/**
 * Track subscription upgraded event
 */
export function trackSubscriptionUpgraded(
  userId: number,
  properties: {
    fromPlan: string;
    toPlan: string;
    amount?: number;
  }
): void {
  trackServerEvent(userId, 'subscription_upgraded', {
    ...properties,
    $set: {
      subscription_plan: properties.toPlan,
    },
  });
}

/**
 * Track payment failed event
 */
export function trackPaymentFailed(
  userId: number,
  properties: {
    plan: string;
    errorCode?: string;
    errorMessage?: string;
  }
): void {
  trackServerEvent(userId, 'payment_failed', properties);
}

/**
 * Flush all pending events (call on server shutdown)
 */
export async function flushPostHog(): Promise<void> {
  if (!posthogClient) return;
  await posthogClient.shutdown();
}

/**
 * Alias for linking anonymous ID to user ID
 */
export function aliasUser(userId: string | number, anonymousId: string): void {
  if (!posthogClient) return;

  posthogClient.alias({
    distinctId: String(userId),
    alias: anonymousId,
  });
}

export { posthogClient };
