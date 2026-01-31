/**
 * UTM Tracking and Attribution Utilities
 *
 * Captures UTM parameters from URLs and persists them for attribution.
 * - First-touch attribution stored in localStorage (90 days)
 * - Session attribution stored in sessionStorage
 */

const UTM_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'ref',        // Common referral parameter
  'gclid',      // Google Ads click ID
  'fbclid',     // Facebook click ID
  'msclkid',    // Microsoft Ads click ID
] as const;

const FIRST_TOUCH_KEY = 'attribution_first_touch';
const SESSION_KEY = 'attribution_session';
const FIRST_TOUCH_EXPIRY_DAYS = 90;

export interface Attribution {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  ref?: string;
  gclid?: string;
  fbclid?: string;
  msclkid?: string;
  referrer_url?: string;
  landing_page?: string;
  timestamp?: number;
}

interface StoredAttribution extends Attribution {
  expiry: number;
}

/**
 * Extract UTM parameters from the current URL
 */
export function extractUtmParams(): Attribution {
  if (typeof window === 'undefined') return {};

  const params = new URLSearchParams(window.location.search);
  const attribution: Attribution = {};

  for (const param of UTM_PARAMS) {
    const value = params.get(param);
    if (value) {
      attribution[param] = value;
    }
  }

  return attribution;
}

/**
 * Check if the attribution object has any UTM parameters
 */
export function hasUtmParams(attribution: Attribution): boolean {
  return UTM_PARAMS.some(param => !!attribution[param]);
}

/**
 * Get first-touch attribution from localStorage
 */
export function getFirstTouchAttribution(): Attribution | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(FIRST_TOUCH_KEY);
    if (!stored) return null;

    const data: StoredAttribution = JSON.parse(stored);

    // Check if expired
    if (Date.now() > data.expiry) {
      localStorage.removeItem(FIRST_TOUCH_KEY);
      return null;
    }

    // Return without expiry field
    const { expiry, ...attribution } = data;
    return attribution;
  } catch {
    return null;
  }
}

/**
 * Store first-touch attribution in localStorage
 */
export function setFirstTouchAttribution(attribution: Attribution): void {
  if (typeof window === 'undefined') return;

  try {
    const data: StoredAttribution = {
      ...attribution,
      expiry: Date.now() + (FIRST_TOUCH_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
    };
    localStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(data));
  } catch {
    // localStorage might be unavailable (incognito mode)
  }
}

/**
 * Get session attribution from sessionStorage
 */
export function getSessionAttribution(): Attribution | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

/**
 * Store session attribution in sessionStorage
 */
export function setSessionAttribution(attribution: Attribution): void {
  if (typeof window === 'undefined') return;

  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(attribution));
  } catch {
    // sessionStorage might be unavailable
  }
}

/**
 * Capture and store UTM parameters on page load
 * Should be called once when the app initializes
 */
export function captureAttribution(): Attribution {
  if (typeof window === 'undefined') return {};

  const utmParams = extractUtmParams();
  const hasUtm = hasUtmParams(utmParams);

  // Build full attribution object
  const attribution: Attribution = {
    ...utmParams,
    referrer_url: document.referrer || undefined,
    landing_page: window.location.pathname + window.location.search,
    timestamp: Date.now(),
  };

  // Always store session attribution (current visit)
  if (hasUtm || document.referrer) {
    setSessionAttribution(attribution);
  }

  // Only set first-touch if it doesn't exist and we have attribution data
  const existingFirstTouch = getFirstTouchAttribution();
  if (!existingFirstTouch && (hasUtm || document.referrer)) {
    setFirstTouchAttribution(attribution);
  }

  return attribution;
}

/**
 * Get the best available attribution for signup/conversion
 * Prefers first-touch for signup attribution
 */
export function getAttribution(): Attribution {
  const firstTouch = getFirstTouchAttribution();
  const session = getSessionAttribution();

  // Return first-touch if available, otherwise session
  return firstTouch || session || {};
}

/**
 * Get attribution data formatted for API submission
 * Returns only the fields we want to store in the database
 */
export function getAttributionForSignup(): {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  referrer_url?: string;
  landing_page?: string;
} {
  const attribution = getAttribution();

  return {
    utm_source: attribution.utm_source || attribution.ref,
    utm_medium: attribution.utm_medium,
    utm_campaign: attribution.utm_campaign,
    utm_term: attribution.utm_term,
    utm_content: attribution.utm_content,
    referrer_url: attribution.referrer_url,
    landing_page: attribution.landing_page,
  };
}

/**
 * Clear all stored attribution (useful for testing)
 */
export function clearAttribution(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(FIRST_TOUCH_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage might be unavailable
  }
}

/**
 * Derive a source category from attribution data
 */
export function getSourceCategory(attribution: Attribution): string {
  if (attribution.gclid) return 'paid_google';
  if (attribution.fbclid) return 'paid_facebook';
  if (attribution.msclkid) return 'paid_microsoft';

  const medium = attribution.utm_medium?.toLowerCase();
  if (medium === 'cpc' || medium === 'ppc' || medium === 'paid') return 'paid';
  if (medium === 'email') return 'email';
  if (medium === 'social') return 'social';
  if (medium === 'referral' || attribution.ref) return 'referral';

  if (attribution.referrer_url) {
    const referrer = attribution.referrer_url.toLowerCase();
    if (referrer.includes('google.') || referrer.includes('bing.') || referrer.includes('duckduckgo.')) {
      return 'organic_search';
    }
    if (referrer.includes('facebook.') || referrer.includes('twitter.') || referrer.includes('linkedin.')) {
      return 'organic_social';
    }
    return 'referral';
  }

  return 'direct';
}
