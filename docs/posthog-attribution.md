# PostHog Analytics & UTM Attribution

This document describes the implementation of PostHog analytics and UTM-based marketing attribution tracking.

## Overview

The system captures marketing attribution data (UTM parameters) when users first visit the site and persists this data through to signup and beyond. PostHog is used for both client-side and server-side event tracking.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Journey                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Landing (with UTM params)                                   │
│     ↓                                                           │
│  2. UTM captured → localStorage (90 days) + sessionStorage      │
│     ↓                                                           │
│  3. Page views tracked → PostHog                                │
│     ↓                                                           │
│  4. Signup → Attribution sent to server → Stored in DB          │
│     ↓                                                           │
│  5. User identified in PostHog with attribution                 │
│     ↓                                                           │
│  6. Subscription events → Server-side PostHog (reliable)        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Environment Variables

| Variable | Location | Description |
|----------|----------|-------------|
| `VITE_POSTHOG_KEY` | Client | PostHog project API key (starts with `phc_`) |
| `VITE_POSTHOG_HOST` | Client | PostHog API host (default: `https://us.i.posthog.com`) |
| `POSTHOG_API_KEY` | Server | Personal API key for server-side events (starts with `phx_`) |

## UTM Parameters Tracked

| Parameter | Description | Example |
|-----------|-------------|---------|
| `utm_source` | Traffic source | google, facebook, newsletter |
| `utm_medium` | Marketing medium | cpc, email, social |
| `utm_campaign` | Campaign name | summer_sale_2024 |
| `utm_term` | Paid search keywords | business+software |
| `utm_content` | A/B test variant | hero_v2 |
| `ref` | Referral code | partner123 |
| `gclid` | Google Ads click ID | Auto-captured |
| `fbclid` | Facebook click ID | Auto-captured |
| `msclkid` | Microsoft Ads click ID | Auto-captured |

## Attribution Model

### First-Touch Attribution (90 days)
- Stored in `localStorage` on first visit with UTM params
- Used for signup attribution (how they discovered us)
- Persists across sessions until expiry

### Session Attribution
- Stored in `sessionStorage`
- Captures current session's source
- Used for conversion analysis

### Database Storage
Attribution is permanently stored on the user record at signup:
- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_term`
- `utm_content`
- `referrer_url`
- `landing_page`

## File Structure

```
client/src/
├── lib/
│   ├── utm.ts              # UTM capture & storage utilities
│   └── posthog.ts          # PostHog client wrapper
├── hooks/
│   └── use-tracking.tsx    # Page view & user tracking hook

server/
└── posthog.ts              # Server-side PostHog for payment events
```

## Client-Side Tracking

### Initialization (`App.tsx`)
```typescript
import { initializeTracking } from "./hooks/use-tracking";

function App() {
  useEffect(() => {
    initializeTracking();
  }, []);
  // ...
}
```

### Page View Tracking (`use-tracking.tsx`)
Automatically tracks:
- Page views on route changes
- User identification on login
- User reset on logout

### Available Tracking Functions

```typescript
import {
  trackEvent,
  trackSignupStarted,
  trackSignupCompleted,
  trackSubscriptionStarted,
  trackFeatureUsed,
  trackDocumentCreated,
  identifyUser,
  resetUser,
} from '@/lib/posthog';

// Track custom event
trackEvent('button_clicked', { button_name: 'cta_hero' });

// Track feature usage
trackFeatureUsed('sde_analyzer', { document_id: 123 });

// Track document creation
trackDocumentCreated({ documentType: 'cim', method: 'ai_generated' });
```

## Server-Side Tracking

Server-side tracking is used for critical events that shouldn't be blocked by ad blockers.

### Subscription Events (`server/stripe.ts`)
```typescript
import {
  trackSubscriptionStarted,
  trackSubscriptionCancelled,
} from "./posthog";

// Tracked automatically on Stripe webhook events:
// - checkout.session.completed → subscription_started
// - customer.subscription.updated (cancel) → subscription_cancelled
// - customer.subscription.deleted → subscription_cancelled
```

### Available Server Functions

```typescript
import {
  trackServerEvent,
  trackSubscriptionStarted,
  trackSubscriptionRenewed,
  trackSubscriptionCancelled,
  trackPaymentFailed,
  identifyUserServer,
} from "./posthog";
```

## Events Reference

### Automatic Events
| Event | Trigger | Properties |
|-------|---------|------------|
| `$pageview` | Route change | URL, UTM params |
| `signup_completed` | User registration | user_id, email, attribution |
| `subscription_started` | Stripe checkout complete | plan, price_id, billing_cycle |
| `subscription_cancelled` | Subscription cancelled | plan, reason |

### Manual Events (call as needed)
| Event | When to Use |
|-------|-------------|
| `signup_started` | Registration form opened |
| `feature_used` | Key feature engagement |
| `document_created` | CIM or document generated |

## Testing Attribution

### Test URL Format
```
https://yoursite.com/?utm_source=test&utm_medium=email&utm_campaign=dev_test
```

### Verify in Browser Console
```javascript
// Check stored attribution
localStorage.getItem('attribution_first_touch')
sessionStorage.getItem('attribution_session')
```

### Verify in PostHog
1. Go to PostHog dashboard → Activity
2. Filter by your test user
3. Check event properties for UTM data

## Source Categories

The system automatically categorizes traffic sources:

| Category | Detection Logic |
|----------|-----------------|
| `paid_google` | Has `gclid` parameter |
| `paid_facebook` | Has `fbclid` parameter |
| `paid_microsoft` | Has `msclkid` parameter |
| `paid` | utm_medium is cpc/ppc/paid |
| `email` | utm_medium is email |
| `social` | utm_medium is social |
| `referral` | Has `ref` param or utm_medium is referral |
| `organic_search` | Referrer from Google/Bing/DuckDuckGo |
| `organic_social` | Referrer from Facebook/Twitter/LinkedIn |
| `direct` | No attribution data |

## Database Schema

Added to `users` table:
```sql
utm_source      VARCHAR(255)
utm_medium      VARCHAR(255)
utm_campaign    VARCHAR(255)
utm_term        VARCHAR(255)
utm_content     VARCHAR(255)
referrer_url    TEXT
landing_page    TEXT
```

## Privacy Considerations

- PostHog respects Do Not Track (DNT) browser setting
- Users can opt out: `import { optOut } from '@/lib/posthog'`
- No PII is sent beyond email (for user identification)
- Attribution data is first-party only

## Troubleshooting

### Events not appearing in PostHog
1. Check `VITE_POSTHOG_KEY` is set correctly
2. Verify PostHog is initialized: check console for "PostHog API key not configured"
3. Check network tab for requests to `us.i.posthog.com`

### UTM params not persisting
1. Check localStorage is available (not blocked in incognito)
2. Verify URL has valid UTM params
3. Check browser console for storage errors

### Server events missing
1. Verify `POSTHOG_API_KEY` is set (server-side key, starts with `phx_`)
2. Check server logs for PostHog initialization message
3. Stripe webhooks must be configured correctly
