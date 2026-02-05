/**
 * Plan Intent Utilities
 *
 * Captures plan upgrade intent from URL parameters and persists for registration flow.
 * Used to redirect users to Stripe checkout after registration.
 */

const PLAN_INTENT_KEY = 'pending-plan-upgrade';
const PLAN_INTENT_EXPIRY_HOURS = 24;

export interface PlanIntent {
  plan: 'pro';
  billing: 'annual' | 'monthly';
  timestamp: number;
}

/**
 * Extract plan intent from URL parameters
 * Returns null if params are invalid
 */
export function extractPlanIntent(): PlanIntent | null {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  const plan = params.get('plan');
  const billing = params.get('billing');

  // Validate plan parameter
  if (plan !== 'pro') {
    return null;
  }

  // Validate billing parameter
  if (billing !== 'annual' && billing !== 'monthly') {
    return null;
  }

  return {
    plan: 'pro',
    billing,
    timestamp: Date.now(),
  };
}

/**
 * Store plan intent in localStorage
 */
export function storePlanIntent(intent: PlanIntent): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(PLAN_INTENT_KEY, JSON.stringify(intent));
  } catch {
    // localStorage might be unavailable (incognito mode)
  }
}

/**
 * Get stored plan intent from localStorage
 * Returns null if not found or expired
 */
export function getPlanIntent(): PlanIntent | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(PLAN_INTENT_KEY);
    if (!stored) return null;

    const intent: PlanIntent = JSON.parse(stored);

    // Check if expired (24 hours)
    const expiryMs = PLAN_INTENT_EXPIRY_HOURS * 60 * 60 * 1000;
    if (Date.now() - intent.timestamp > expiryMs) {
      clearPlanIntent();
      return null;
    }

    return intent;
  } catch {
    return null;
  }
}

/**
 * Clear stored plan intent from localStorage
 */
export function clearPlanIntent(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(PLAN_INTENT_KEY);
  } catch {
    // localStorage might be unavailable
  }
}
