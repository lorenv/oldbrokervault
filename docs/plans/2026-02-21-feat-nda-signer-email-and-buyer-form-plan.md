---
title: "feat: NDA Signer Status Email & Buyer Qualification Form"
type: feat
status: completed
date: 2026-02-21
---

# NDA Signer Status Email & Buyer Qualification Form

## Overview

After signing an NDA, signers who require manual approval currently receive a basic "pending" email with no way to track their status. The signer should receive an email that includes:
1. A link to their NDA status page (`/nda/status/:token`)
2. A link to a "Buyer Qualification Form" that collects additional info about the buyer

The buyer form uses the existing `buyerSurveys`/`buyerSurveyResponses` schema (tables exist but no API routes or UI yet). Submitted form data enriches the CRM buyer contact record and helps brokers with future whitelist/qualification decisions.

## Problem Statement

- Signer gets no email link to check NDA status — the `statusUrl` is only returned in the JSON response (displayed briefly on screen) but not emailed
- No mechanism for signers to self-report qualification data (buyer type, budget, acquisition criteria, etc.)
- Brokers must manually ask buyers for this info — slows down the qualification pipeline

## Proposed Solution

### Part 1: Include Status Link in Pending Approval Email

**File:** `server/routes/nda-signing-routes.ts`

Two email paths need the status URL:

1. **Initial NDA sign endpoint** (line ~1052-1077): Already generates `statusToken` and `statusUrl`, but only returns it in JSON. Need to also send an email to the signer with the status link.

2. **Resend email endpoint** (line ~397-432): The "pending approval" email template at line 399-432 needs the status link added. This requires looking up the signature's `statusCheckToken`.

**Changes:**
- At line ~1052 (requiresManualApproval branch): Send a "pending confirmation" email to the signer containing the status URL
- At line ~399 (resend endpoint): Add status link to the pending approval email template
- Both emails include a CTA button: "Check NDA Status" → links to `/nda/status/:token`

### Part 2: Buyer Qualification Form — Backend

**Existing schema** (already in DB):
- `buyerSurveys` — configurable question templates per CIM/org
- `buyerSurveyResponses` — submitted answers linked to survey + signer email + optional contactId

**New file:** `server/routes/buyer-survey-routes.ts`

**Endpoints:**

1. **`GET /api/buyer-surveys`** — List broker's survey templates
   - Auth required, filtered by `userId`

2. **`POST /api/buyer-surveys`** — Create a survey template
   - Auth required
   - Body: `{ name, questions: [{ id, label, type, options?, required? }], isDefault?, isRequired?, cimDocumentId? }`
   - Question types: `text`, `select`, `multiselect`, `number`, `textarea`

3. **`PATCH /api/buyer-surveys/:id`** — Update a survey template

4. **`DELETE /api/buyer-surveys/:id`** — Delete a survey template

5. **`GET /api/buyer-surveys/for-document/:cimDocumentId`** — Get the survey that applies to a specific CIM document
   - Returns: document-specific survey if exists, else org default survey, else null
   - Public endpoint (no auth) — used by the signer-facing form

6. **`GET /api/buyer-form/:token`** — Get the buyer form for a signer by status token
   - Public endpoint (no auth)
   - Looks up NDA signature by `statusCheckToken`
   - Finds the applicable survey for that signature's CIM document
   - Returns: survey questions + any existing response + signer info
   - Maps buyer-specific CRM fields to form pre-fills: buyerType, financialCapability, estimatedBudget, acquisitionCriteria, etc.

7. **`POST /api/buyer-form/:token`** — Submit the buyer form
   - Public endpoint (no auth)
   - Validates `statusCheckToken` matches an existing signature
   - Saves to `buyerSurveyResponses`
   - **Also updates the CRM contact** record (matched by signer email):
     - Maps known fields: buyerType, financialCapability, estimatedBudget, acquisitionCriteria, priorAcquisitions
     - Custom survey fields go into `customProperties` JSON on the contact
   - Returns success

**Smart field mapping** — The form should detect "known" buyer fields and map them to the CRM contact schema:

| Survey Question Label Pattern | CRM Contact Field |
|------|--------|
| "Buyer Type" / "Organization Type" | `buyerType` |
| "Financial Capability" / "Funding Status" | `financialCapability` |
| "Estimated Budget" / "Investment Range" | `estimatedBudget` |
| "Acquisition Criteria" / "Target Profile" | `acquisitionCriteria` |
| "Prior Acquisitions" / "Previous Deals" | `priorAcquisitions` |
| "Company" / "Organization" | Company name (look up or create) |
| "LinkedIn" | `linkedinUrl` |
| "Phone" | `phone` |
| Everything else | `customProperties` JSON |

To avoid complexity, offer a "field binding" option in the survey builder where the broker explicitly maps each question to a CRM field (or "custom").

### Part 3: NDA Status Page Enhancement

**File:** `client/src/pages/nda-status-page.tsx`

Add below the status card:
- If a buyer survey exists for this CIM, show a "Complete Buyer Profile" section
- If already completed: show "Buyer Profile Submitted" with a checkmark
- If not yet completed: show a CTA card linking to `/buyer-form/:token`

### Part 4: Buyer Form Page (Frontend)

**New file:** `client/src/pages/buyer-form-page.tsx`

Public page (no auth required), accessed via `/buyer-form/:token`.

**Layout:**
1. Header with document title and broker branding
2. Dynamic form rendered from survey questions
3. Pre-filled with any existing response data
4. Submit button → POST `/api/buyer-form/:token`
5. Success state: "Thank you! Your information has been submitted."

**Form field types:**
- `text` → Input
- `textarea` → Textarea
- `select` → Select dropdown (from options array)
- `multiselect` → Checkbox group
- `number` → Number input

### Part 5: Default Survey Template

On first use (when broker has no surveys), auto-create a default survey with these questions:
- Organization Type (select: Strategic, Financial, Individual, Search Fund, Family Office, Other)
- Estimated Budget Range (select: Under $1M, $1M-$5M, $5M-$10M, $10M-$25M, $25M-$50M, $50M+)
- Prior Acquisitions (number)
- Brief Description of Interest (textarea)
- LinkedIn Profile URL (text)
- Phone Number (text)

All mapped to CRM fields via the field binding system.

### Part 6: Routing

**File:** `client/src/App.tsx`

Add routes:
- `/buyer-form/:token` → BuyerFormPage (public, no auth)
- `/settings/buyer-surveys` → Survey builder page (auth required, settings)

## Files Summary

| File | Action |
|------|--------|
| `server/routes/nda-signing-routes.ts` | Add status URL to pending emails (2 locations) |
| `server/routes/buyer-survey-routes.ts` | **New** — Survey CRUD + public form endpoints |
| `server/routes.ts` | Register buyer survey routes |
| `client/src/pages/nda-status-page.tsx` | Add buyer form CTA section |
| `client/src/pages/buyer-form-page.tsx` | **New** — Public buyer qualification form |
| `client/src/App.tsx` | Add routes |

## Acceptance Criteria

- [x] After signing an NDA that requires approval, signer receives email with status page link
  - Implemented: `nda-signing-routes.ts:1222-1234` sends `sendNdaPendingEmail` with statusUrl and buyerFormUrl
  - Resend endpoint also includes status + buyer form links (`nda-signing-routes.ts:492-501`)
- [x] NDA status page shows "Complete Buyer Profile" CTA when a survey exists
  - Implemented: `nda-status-page.tsx:156-177` checks `/api/buyer-form/:token` and shows CTA or "Submitted" state
  - Auto-refreshes every 30s while pending (`refetchInterval: 30000`)
- [x] Buyer form page renders questions dynamically from survey template
  - Implemented: `buyer-form-page.tsx` uses generic `FormRenderer` component
  - Supports text, textarea, select, multi_select, number fields with section grouping
- [x] Form submission updates CRM contact record with mapped fields
  - Implemented: `buyer-survey-routes.ts:652-667` calls `mapResponsesToCrmFields()` to update CRM contact
  - Supports direct field mapping (buyerType, financialCapability, etc.) and dot-notation (acquisitionCriteria.industries)
  - Unmapped fields stored in `customProperties` JSON
- [x] Broker can create/edit survey templates via settings
  - Implemented: `/settings/buyer-surveys` page with `FormBuilder` component
  - CRUD via `/api/buyer-surveys` endpoints
- [x] Default survey template auto-created for first-time use
  - Implemented: `buyer-survey-routes.ts:187-203` `ensureDefaultSurvey()` runs on first GET
  - Default questions: Org Type, Financial Capability, Budget, Prior Acquisitions, LinkedIn, Phone, Interest, Target Industries, Revenue Range, EBITDA Range, Geography
- [x] Form works without authentication (public, token-based access)
  - Implemented: `/api/buyer-form/:token` GET and POST are public endpoints using `statusCheckToken`

## Implementation Notes

- The `buyerSurveys` and `buyerSurveyResponses` tables already exist in the database — no migration needed
- Reuse `statusCheckToken` from `ndaSignatures` as the access token for the buyer form
- Keep the form simple — avoid building a full drag-and-drop form builder; a list of question fields with type selection is sufficient
- Consider rate-limiting the public form submission endpoint

## Implementation Status (2026-02-23)

**Status: COMPLETED** - All acceptance criteria met.

### Files Created
| File | Lines | Purpose |
|------|-------|---------|
| `server/routes/buyer-survey-routes.ts` | 675 | Survey CRUD + public form endpoints + CRM field mapping |
| `client/src/pages/buyer-form-page.tsx` | 228 | Public buyer qualification form |
| `client/src/pages/settings/buyer-surveys-page.tsx` | 319 | Survey builder settings page |
| `client/src/components/form-builder.tsx` | 325 | Generic reusable form builder component |
| `client/src/components/form-renderer.tsx` | 165 | Generic reusable form renderer component |

### Files Modified
| File | Change |
|------|--------|
| `server/routes/nda-signing-routes.ts` | Added `sendNdaPendingEmail` call at lines 1222-1234 with status + buyer form URLs |
| `server/email.ts` | Added `sendNdaPendingEmail()` function (lines 2006-2062) with status + buyer form CTA buttons |
| `server/routes.ts` | Registered `registerBuyerSurveyRoutes` |
| `client/src/App.tsx` | Added `/buyer-form/:token` (public) and `/settings/buyer-surveys` routes |
| `client/src/pages/nda-status-page.tsx` | Added buyer form CTA section (lines 156-177) |
| `client/src/components/layout/settings-layout.tsx` | Added "Buyer Surveys" to settings nav |

### Architecture Decisions
- **Generic FormBuilder/FormRenderer**: Built as reusable components in `client/src/components/` rather than buyer-specific. FormBuilder accepts configurable `sections`, `crmFieldOptions`, and `questionTypes` props.
- **Direct DB access**: Route files use `db` (drizzle) directly rather than going through `storage.ts`, consistent with other extracted route files.
- **Upsert pattern**: Buyer form submission uses upsert — existing responses are updated, not duplicated.
- **CRM field mapping**: Uses explicit `crmField` binding on each question (set in FormBuilder) rather than pattern-matching question labels.
