# Codebase Cleanup Brainstorm

**Date:** 2026-02-04
**Status:** COMPLETED

## What We're Addressing

A comprehensive audit of the BrokerVault codebase to identify and remove dead code, unused files, and identify oversized files that should be modularized.

---

## SECTION A: Files to DELETE (Dead Code)

### A1. Backup/Old Files (Safe to Remove)

| # | File | Lines | Reason |
|---|------|-------|--------|
| 1 | `server/routes-backup.ts` | 1 | Empty placeholder with comment "This will serve as a backup" |
| 2 | `server/document-export.ts.backup` | ~20 | Superseded by current document-export.ts |
| 3 | `shared/schema_backup.ts` | 1 | Empty placeholder backup |
| 4 | `shared/schema_old.ts` | 487 | Old schema with deprecated subscription plans (free/standard/premium) - not imported anywhere |
| 5 | `client/src/pages/documents-page-old.tsx` | varies | Old page component not in routing |
| 6 | `attached_assets/client/src/pages/dashboard-old.tsx` | varies | Old dashboard in attached_assets - not used |

### A2. Test Files in Root (Should be removed or gitignored)

| # | File | Reason |
|---|------|--------|
| 7 | `backup.sql` | Database backup shouldn't be in version control |
| 8 | `test-pdf.pdf` | Test artifact |
| 9 | `test-pdf-fixed.pdf` | Test artifact |
| 10 | `test-banner-pdf.pdf` | Test artifact |
| 11 | `test-cropped-pdf.pdf` | Test artifact |
| 12 | `test-cropped-auth-pdf.pdf` | Test artifact |
| 13 | `test-debug-crop.pdf` | Test artifact |
| 14 | `test-debug-crop2.pdf` | Test artifact |
| 15 | `test-fixed-crop.pdf` | Test artifact |
| 16 | `test-final-crop.pdf` | Test artifact |
| 17 | `test-pdf-export.pdf` | Test artifact |
| 18 | `test-pdf-export-debug.pdf` | Test artifact |
| 19 | `test-pdf-debug-final.pdf` | Test artifact |
| 20 | `test-optimized-pdf.pdf` | Test artifact |
| 21 | `test-share-pdf-debug.pdf` | Test artifact |
| 22 | `test-share-pdf-fixed.pdf` | Test artifact |
| 23 | `test-share-pdf-final.pdf` | Test artifact |
| 24 | `test-share-pdf-debug2.pdf` | Test artifact |
| 25 | `test-share-pdf-debug3.pdf` | Test artifact |
| 26 | `test-share-pdf-debug-final.pdf` | Test artifact |
| 27 | `test-custom-images-debug.pdf` | Test artifact |
| 28 | `test-custom-images-pdf.pdf` | Test artifact |
| 29 | `test-debug.pdf` | Test artifact |
| 30 | `test-fixed-bold.pdf` | Test artifact |
| 31 | `test-improved-list.pdf` | Test artifact |
| 32 | `test-linebreak-fix.pdf` | Test artifact |
| 33 | `test-list-debug.pdf` | Test artifact |
| 34 | `test-list-formatting.pdf` | Test artifact |
| 35 | `test-nonbreaking-spaces.pdf` | Test artifact |
| 36 | `test-pdf-sections-fix.pdf` | Test artifact |

---

## SECTION B: Code to Clean Up (In-File Dead Code)

### B1. Unused Imports

| # | File | Line | Issue |
|---|------|------|-------|
| 37 | `server/routes.ts` | 23 | `import * as fsSync from 'fs'` - never used in 11,968-line file |

### B2. Disabled/Commented Features

| # | File | Lines | Issue |
|---|------|-------|-------|
| 38 | `server/services/ai-assistant.ts` | 5-6 | Commented-out permission checks with TODO |
| 39 | `server/routes.ts` | ~922 | Disabled migration endpoint - "Migration functionality disabled" |

---

## SECTION C: Large Files to Split (Future Refactor)

These are files that are oversized and would benefit from modularization. This is informational - not for immediate removal.

### C1. Server Routes (Critical - 25,000+ lines combined)

| File | Lines | Recommendation |
|------|-------|----------------|
| `server/routes.ts` | 11,968 | Split into: auth-routes, payment-routes, document-routes, admin-routes, webhook-routes, etc. |
| `server/routes/crm-routes.ts` | 9,073 | Split into: deal-routes, contact-routes, company-routes, pipeline-routes, task-routes, team-routes |
| `server/routes/esign-routes.ts` | 3,968 | Split into: envelope-routes, template-routes |

### C2. Server Services (2,000+ lines each)

| File | Lines | Issue |
|------|-------|-------|
| `server/document-export.ts` | 4,571 | PDF/Word/HTML generation mixed with image processing |
| `server/storage.ts` | 2,864 | Interface + implementation + migrations all in one |
| `server/email.ts` | 2,029 | All email templates mixed together |
| `server/perplexity.ts` | 1,253 | CIM generation mixed with website analysis |
| `server/wordpress-export.ts` | 1,140 | WordPress integration |
| `server/message-service.ts` | 1,065 | All message operations |
| `server/stripe.ts` | 1,011 | All Stripe operations |

### C3. Client Components (1,500+ lines)

| File | Lines | Issue |
|------|-------|-------|
| `client/src/pages/integrations-page.tsx` | 3,920 | Workflows, webhooks, automations all in one |
| `client/src/pages/esign/esign-template-editor.tsx` | 2,160 | Template editor with field management |
| `client/src/pages/esign/esign-send.tsx` | 2,136 | Envelope creation, recipients, documents |
| `client/src/pages/crm/deal-detail-page.tsx` | 2,081 | Deal activities, contacts, timeline |
| `client/src/components/document-tabs/nda-tab.tsx` | 2,004 | Template selection, signing, protection |
| `client/src/components/cim-generator.tsx` | 1,975 | 75+ imports, multiple modes |
| `client/src/components/document-export.tsx` | 1,844 | Export interface with preview, branding |
| `client/src/pages/home-page.tsx` | 1,782 | Hero, pricing, features, FAQ all in one |
| `client/src/components/cim-display.tsx` | 1,761 | CIM content display and editing |

---

## Completed Work

### Phase 1: Dead Code Removal ✅
- Deleted 36 files (6 backup files, 29 test PDFs, 1 backup.sql)
- Added `.gitignore` patterns: `*.backup`, `test-*.pdf`

### Phase 2: esign-routes.ts Refactor ✅
**Original:** 3,968 lines in single file
**New structure:**
```
server/routes/
├── esign-routes.ts          (13 lines - re-export)
└── esign/
    ├── index.ts             (19 lines - orchestrator)
    ├── esign-utils.ts       (350 lines - shared utilities)
    ├── esign-branding-routes.ts    (180 lines)
    ├── esign-template-routes.ts    (360 lines)
    ├── esign-powerform-routes.ts   (560 lines)
    └── esign-envelope-routes.ts    (2,250 lines)
```

### Phase 3: routes.ts Webhook Extraction ✅
**Original:** 11,968 lines
**After extraction:** 11,593 lines (375 lines removed)
**New module:**
```
server/routes/
└── external-webhooks.ts     (315 lines)
    - verifySendGridInboundSecret middleware
    - verifySendGridEventSignature middleware
    - registerExternalWebhooks() function
    - SendGrid inbound, events, test, info endpoints
    - Stripe webhook endpoint
```

---

## Remaining Work: routes.ts and crm-routes.ts

### routes.ts (11,593 lines) - Future Refactor Plan

**Complexity:** Middleware interleaved with routes, shared helper functions, 192 routes across 40+ domains.

**Proposed structure:**
```
server/routes/
├── routes.ts                    (~2,000 lines - orchestrator + shared helpers)
└── main/
    ├── webhook-routes.ts        (~300 lines) - SendGrid, Stripe webhooks
    ├── cim-document-routes.ts   (~3,000 lines) - 76 CIM document routes
    ├── share-routes.ts          (~1,000 lines) - 14 sharing routes
    ├── subscription-routes.ts   (~500 lines) - Stripe, pricing, checkout
    ├── analytics-routes.ts      (~800 lines) - Dashboard, tracking
    ├── admin-routes.ts          (~500 lines) - Admin operations
    ├── user-profile-routes.ts   (~600 lines) - Profile, settings
    ├── nda-routes.ts            (~800 lines) - NDA templates, signatures
    ├── investor-routes.ts       (~500 lines) - Investor contacts
    └── utility-routes.ts        (~400 lines) - Unsplash, WordPress, PDF
```

**Key considerations:**
1. Webhook routes must be registered BEFORE auth middleware (lines 684-710)
2. Many helper functions are shared across routes
3. Some routes have rate limiters applied inline

### crm-routes.ts (9,073 lines) - Future Refactor Plan

**Proposed structure:**
```
server/routes/
└── crm/
    ├── index.ts                 (~200 lines - orchestrator)
    ├── crm-organization-routes.ts  (~500 lines)
    ├── crm-teams-routes.ts         (~450 lines)
    ├── crm-pipeline-routes.ts      (~400 lines)
    ├── crm-entities-routes.ts      (~1,100 lines) - Companies, contacts
    ├── crm-deal-routes.ts          (~2,200 lines)
    ├── crm-activity-routes.ts      (~1,400 lines) - Notes, tasks, attachments
    ├── crm-communications-routes.ts (~1,000 lines) - Email integration
    └── crm-admin-routes.ts         (~900 lines) - Search, permissions, import
```

## Key Decisions

1. ✅ Dead code removed (36 files)
2. ✅ gitignore patterns added
3. ✅ esign-routes.ts refactored into 6 focused modules
4. ✅ routes.ts webhook routes extracted to external-webhooks.ts
5. ⏳ routes.ts remaining refactor documented - tackle incrementally in future sprints
6. ⏳ crm-routes.ts refactor documented - tackle after routes.ts

## Open Questions

1. Priority for routes.ts refactor - which modules next (cim-document-routes, share-routes, etc.)?
2. Should we create a shared route utilities file for common helpers?
