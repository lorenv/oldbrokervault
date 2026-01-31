import { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from './use-auth';
import {
  initPostHog,
  trackPageView,
  identifyUser,
  resetUser,
  isPostHogReady,
} from '../lib/posthog';
import { captureAttribution } from '../lib/utm';

let attributionCaptured = false;

/**
 * Initialize tracking on app load
 * Should be called once at app startup
 */
export function initializeTracking(): void {
  // Initialize PostHog
  initPostHog();

  // Capture UTM attribution on first load
  if (!attributionCaptured) {
    captureAttribution();
    attributionCaptured = true;
  }
}

/**
 * Hook to track page views and user identification
 * Replaces useAnalytics hook
 */
export function useTracking(): void {
  const [location] = useLocation();
  const { user } = useAuth();
  const prevLocationRef = useRef<string | null>(null);
  const prevUserIdRef = useRef<number | null>(null);

  // Track page views on route change
  useEffect(() => {
    if (!isPostHogReady()) return;

    // Track initial page view
    if (prevLocationRef.current === null) {
      trackPageView(location);
      prevLocationRef.current = location;
      return;
    }

    // Track subsequent page view changes
    if (location !== prevLocationRef.current) {
      trackPageView(location);
      prevLocationRef.current = location;
    }
  }, [location]);

  // Identify/reset user on auth state change
  useEffect(() => {
    if (!isPostHogReady()) return;

    // User logged in
    if (user && user.id !== prevUserIdRef.current) {
      identifyUser(user.id, {
        email: user.email,
        name: user.name || undefined,
        businessName: user.businessName || undefined,
        subscriptionStatus: user.subscriptionStatus,
        isAdmin: user.isAdmin,
        createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : undefined,
      });
      prevUserIdRef.current = user.id;
    }

    // User logged out
    if (!user && prevUserIdRef.current !== null) {
      resetUser();
      prevUserIdRef.current = null;
    }
  }, [user]);
}

/**
 * Hook to capture attribution on initial visit
 * Can be used in landing pages to ensure attribution is captured
 */
export function useCaptureAttribution(): void {
  useEffect(() => {
    if (!attributionCaptured) {
      captureAttribution();
      attributionCaptured = true;
    }
  }, []);
}
