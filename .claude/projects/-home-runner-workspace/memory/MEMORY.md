# BrokerVault Project Memory

## Architecture & Patterns
- See [architecture.md](./architecture.md) for details on route registration, page patterns, and key files

## Recent Work (2026-02-21)

### NDA Hub — Top-Level Sidebar Entity
- Backend: `server/routes/nda-hub-routes.ts` — aggregated cross-CIM NDA endpoints
- Frontend: `client/src/pages/ndas-page.tsx` + `client/src/pages/nda-detail-page.tsx`
- Sidebar: "NDAs" with Shield icon and pending badge in `secondaryNavItems`
- Cross-links: nda-tab.tsx "Open in NDA Hub" per row

### URL-based CIM Type
- Schema: Added `externalUrl` field to `cimDocuments` table
- Backend: `POST /api/cim/external-url` in routes.ts creates URL-based CIM
- Share page: Redirects non-owner visitors to `externalUrl` if set
- Documents page: "Link External CIM" dialog added
- **IMPORTANT**: Must run `ALTER TABLE cim_documents ADD COLUMN IF NOT EXISTS external_url TEXT` on any new DB — drizzle-kit push was blocked by interactive prompt

### Buyer NDA Integration
- Backend: Added `ndaCount` per contact email in `GET /api/crm/contacts` response
- Backend: Added `isWhitelisted` flag and `dealId`/`dealName` in ndaHistory on contact detail
- Frontend: "NDAs" column on buyers-page.tsx table
- Frontend: Enhanced NDA section on buyer-detail-page.tsx (deal names, dates, status badges, NDA Hub links)

### NDA Whitelist Toggle
- Backend: `POST /api/nda-whitelist/toggle-contact` + `POST /api/nda-whitelist/toggle-company` in nda-whitelist-routes.ts
- Frontend: "Whitelist" / "Whitelisted" toggle button on buyer detail page header

### Deal ↔ CIM Linking
- Backend endpoint already existed: `POST /api/crm/deals/:dealId/documents` + `DELETE .../documents/:documentId`
- Frontend: Added "Link Existing" CIM button and unlink (X) on deal detail CIM tab

### Auto-Link NDA Signers to Deals (FIXED)
- In `server/routes/nda-signing-routes.ts`: After auto-creating CRM contact, looks up all deals linked to the CIM (via `dealDocuments` junction table + `cimDocuments.dealId`), auto-creates `dealBuyers` entry (Buyers tab)
- Uses "NDA Signed" pipeline stage if it exists, otherwise falls back to first stage
- Previously was inserting into `dealContacts` (wrong) — now correctly uses `dealBuyers`

### Bidirectional Deal ↔ Buyer/Seller Associations
- **Deal sidebar** = "Seller" (renamed from "Contacts") — uses `dealContacts` table with role='seller'
- **Deal Buyers tab** = buyers pipeline — uses `dealBuyers` table with pipeline stages
- **Buyer detail page**: linkDealMutation → `POST /api/crm/deals/:id/buyers` (dealBuyers)
- **Seller detail page**: linkDealMutation → `POST /api/crm/deals/:id/contacts` with role='seller' (dealContacts)
- **Contact detail API**: Merges deals from both `dealContacts` and `dealBuyers` (deduped)
- Remove buttons: All deal/buyer/seller associations have hover-reveal X buttons for unlinking
- Add Seller dialog: Only shows contacts with `contactType=seller` (server-side filter)
- CIM linking dialog: Uses server-side search via `/api/cim?search=...&limit=50`

### Cache Invalidation Fix
- Buyer/seller detail pages: mutations invalidate specific deal query keys + buyers + kanban

## Pending / Tomorrow
- **NDA Signer Email + Buyer Form**: Plan at `docs/plans/2026-02-21-feat-nda-signer-email-and-buyer-form-plan.md`
  - Add status page link to pending approval emails
  - Buyer qualification form using existing `buyerSurveys`/`buyerSurveyResponses` schema
  - Public form page at `/buyer-form/:token`

## Operational Notes
- Server must be restarted after adding new route files (no hot-reload)
- `drizzle-kit push` has interactive prompts that block in CLI — use direct SQL for schema changes
- Schema changes need actual DB ALTER TABLE, not just schema.ts edits
