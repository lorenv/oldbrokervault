# Plan-Aware Registration Flow

This document describes the plan-aware registration flow that allows users to select a subscription plan before registering, then automatically redirects them to Stripe checkout after account creation.

## Overview

When users visit the registration page with plan parameters in the URL (e.g., from a pricing page CTA), the system:

1. Captures the plan intent from URL parameters
2. Displays a banner showing the selected plan
3. Stores the intent in localStorage (persists for 24 hours)
4. After successful registration, redirects to Stripe checkout

## URL Parameters

| Parameter | Required | Values | Description |
|-----------|----------|--------|-------------|
| `plan` | Yes | `pro` | The plan identifier |
| `billing` | Yes | `annual`, `monthly` | Billing frequency |

### Example URLs

```
/register?plan=pro&billing=annual   # Pro plan, $49/mo billed annually
/register?plan=pro&billing=monthly  # Pro plan, $59/mo billed monthly
```

## Files

### `client/src/lib/plan-intent.ts`

Utility functions for managing plan intent:

| Function | Description |
|----------|-------------|
| `extractPlanIntent()` | Parses URL parameters, returns `PlanIntent` or `null` |
| `storePlanIntent(intent)` | Saves intent to localStorage with timestamp |
| `getPlanIntent()` | Retrieves stored intent (checks 24-hour expiry) |
| `clearPlanIntent()` | Removes intent from localStorage |

### `client/src/pages/register-page.tsx`

- Captures plan intent on mount via `useEffect`
- Cleans URL after capturing (removes `plan` and `billing` params)
- Displays banner with plan details when intent is present
- Shows contextual card description

### `client/src/hooks/use-auth.tsx`

- Checks for plan intent after successful registration
- Creates Stripe checkout session via `/api/subscription/create-checkout`
- Redirects to Stripe checkout URL
- Falls back to dashboard redirect if checkout fails

## User Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Pricing Page   │────▶│  Register Page  │────▶│ Stripe Checkout │
│                 │     │  (with banner)  │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        │ Click "Get Started"   │ Create account        │ Complete payment
        │ (adds URL params)     │ (intent stored)       │
        ▼                       ▼                       ▼
   ?plan=pro            Intent captured          Subscription active
   &billing=annual      URL cleaned
```

## Price Mapping

| Billing | Display Price | Plan ID | Stripe Price |
|---------|---------------|---------|--------------|
| Annual | $49/mo billed annually | `pro` | `STRIPE_PRICE_ID_STANDARD` |
| Monthly | $59/mo billed monthly | `pro_monthly` | `STRIPE_PRICE_ID_PRO_MONTHLY` |

## Persistence

- **Storage**: localStorage with key `pending-plan-upgrade`
- **Expiry**: 24 hours from capture
- **Behavior**: Intent persists if user navigates away and returns to `/register`

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Invalid URL params | No banner shown, normal registration flow |
| Expired intent (>24h) | Intent cleared, normal registration flow |
| Checkout API failure | Toast shown, redirects to dashboard |
| localStorage unavailable | Graceful degradation, no intent captured |

## Testing Checklist

- [ ] Visit `/register?plan=pro&billing=annual` - verify banner shows "$49/mo billed annually"
- [ ] Visit `/register?plan=pro&billing=monthly` - verify banner shows "$59/mo billed monthly"
- [ ] Visit `/register?plan=invalid&billing=foo` - verify no banner, normal flow
- [ ] Verify URL params are removed after page load
- [ ] Capture intent, navigate away, return to `/register` - verify banner persists
- [ ] Complete registration with intent - verify Stripe checkout redirect
- [ ] Simulate checkout API failure - verify dashboard redirect with toast
