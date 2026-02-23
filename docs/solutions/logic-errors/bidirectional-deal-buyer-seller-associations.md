---
title: Auto-Link NDA Signers to Deal Buyers Pipeline (Wrong Table Bug) & Bidirectional Deal Associations
date: 2026-02-21
category: logic-errors
severity: high
component: NDA Signing & Deal Association
modules:
  - server/routes/nda-signing-routes.ts
  - server/routes/crm-routes.ts
  - shared/schema.ts
  - client/src/pages/crm/buyer-detail-page.tsx
  - client/src/pages/crm/seller-detail-page.tsx
  - client/src/pages/crm/deal-detail-page.tsx
  - client/src/pages/crm/contact-detail-page.tsx
tags:
  - bidirectional-associations
  - NDA-signer-automation
  - deal-buyer-links
  - table-schema
  - data-integrity
  - cache-invalidation
symptoms:
  - NDA signers auto-linked to deals were inserted into dealContacts table instead of dealBuyers table
  - Signers appeared in deal "Seller" sidebar (wrong place) rather than Buyers kanban pipeline
  - Deal detail page showed incomplete buyer associations
  - Cache invalidation missing for buyer pipeline updates after NDA signing
  - Stale UI after linking/unlinking buyers or sellers
root_cause: |
  Auto-link feature in NDA signing endpoint (nda-signing-routes.ts) incorrectly inserted
  signer contacts into dealContacts table (which stores sellers with role='seller') instead of
  dealBuyers table (which stores buyer prospects with pipeline stages). The bidirectional
  association system maintains separate tables for deal contacts (sellers) and deal buyers
  (pipeline prospects), requiring correct table selection based on relationship type. Missing
  cache invalidation for buyer query keys prevented UI refresh after insertion.
resolution_time: ~2 hours
recurrence_risk: medium
---

# Bidirectional Deal ↔ Buyer/Seller Associations

## Problem Summary

BrokerVault's CRM needed bidirectional associations between deals and contacts, with different semantics for **buyers** (pipeline-tracked with stages) and **sellers** (role-based). Three interrelated problems were solved:

1. **Wrong Table Bug**: NDA signer auto-link inserted into `dealContacts` instead of `dealBuyers`, causing buyers to vanish from the pipeline
2. **Bidirectional Architecture**: Building a dual-table association system that correctly routes contacts based on type
3. **Cache Invalidation**: React Query caches not refreshing after link/unlink mutations

## Root Cause Analysis

### The Two-Table Design

The system maintains two separate junction tables for deal-contact relationships:

| Table | Purpose | Key Field | Used For |
|-------|---------|-----------|----------|
| `dealContacts` | General deal relationships | `role` (seller, advisor, etc.) | Seller sidebar on deal detail |
| `dealBuyers` | Buyer pipeline tracking | `stageId` (pipeline stage FK) | Buyer kanban board on deal detail |

This separation exists because buyers need pipeline stage progression tracking (NDA Signed → Qualified → LOI Submitted → etc.) while sellers/advisors don't need stages.

### The Bug

In `server/routes/nda-signing-routes.ts`, when an NDA signer was auto-created as a CRM contact, the auto-link code was inserting into `dealContacts` (the seller table) instead of `dealBuyers` (the buyer pipeline table). Since the buyer pipeline UI only reads from `dealBuyers`, auto-linked NDA signers were invisible in the buyer pipeline — they'd show up in the seller sidebar instead, or not at all.

### The Cache Problem

After mutations (link/unlink buyer or seller), React Query caches for related entities weren't being invalidated. The buyer detail page, deal detail page, and kanban board could all show stale data.

## Solution

### 1. Schema: Dual Junction Tables

**File: `shared/schema.ts`**

```typescript
// dealContacts — for sellers and other non-buyer contacts
export const dealContacts = pgTable("deal_contacts", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").notNull(),
  contactId: integer("contact_id").notNull(),
  role: text("role").default("other"), // primary, influencer, decision_maker, other
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// dealBuyers — for buyer pipeline tracking with stages
export const dealBuyers = pgTable("deal_buyers", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").notNull(),
  contactId: integer("contact_id"),
  companyId: integer("company_id"),
  stageId: integer("stage_id").notNull(), // FK to buyerPipelineStages
  notes: text("notes"),
  lastContactDate: timestamp("last_contact_date"),
  nextFollowUp: timestamp("next_follow_up"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

### 2. NDA Auto-Link Fix

**File: `server/routes/nda-signing-routes.ts` (lines ~1116-1186)**

The fix inserts into `dealBuyers` with proper stage assignment:

```typescript
// Auto-link signer as buyer on the deal's Buyers tab (dealBuyers — NOT dealContacts)
if (contactRecord) {
  // Find all deals linked to this CIM document
  const linkedDeals = await db
    .select({ dealId: dealDocuments.dealId })
    .from(dealDocuments)
    .where(eq(dealDocuments.cimDocumentId, cimDoc.id));

  const dealIdSet = new Set(linkedDeals.map(d => d.dealId));
  if (cimDoc.dealId) dealIdSet.add(cimDoc.dealId);
  const dealIds = Array.from(dealIdSet);

  for (let i = 0; i < dealIds.length; i++) {
    const dealId = dealIds[i];
    // Check if already in dealBuyers (not dealContacts!)
    const [existingBuyer] = await db
      .select().from(dealBuyers)
      .where(and(eq(dealBuyers.dealId, dealId), eq(dealBuyers.contactId, contactRecord.id)))
      .limit(1);

    if (!existingBuyer) {
      // Get the "NDA Signed" stage, or fall back to the first stage
      let stageId: number | null = null;
      const [ndaStage] = await db
        .select().from(buyerPipelineStages)
        .where(and(
          eq(buyerPipelineStages.organizationId, orgId),
          sql`LOWER(${buyerPipelineStages.name}) = 'nda signed'`
        ))
        .limit(1);

      stageId = ndaStage?.id ?? null;
      if (!stageId) {
        const [firstStage] = await db
          .select().from(buyerPipelineStages)
          .where(eq(buyerPipelineStages.organizationId, orgId))
          .orderBy(asc(buyerPipelineStages.displayOrder))
          .limit(1);
        if (firstStage) stageId = firstStage.id;
      }

      if (stageId) {
        // INSERT INTO dealBuyers — with pipeline stageId
        await db.insert(dealBuyers).values({
          dealId,
          contactId: contactRecord.id,
          stageId,
        });
      }
    }
  }
}
```

### 3. Bidirectional API Endpoints

**File: `server/routes/crm-routes.ts`**

Separate endpoints for each relationship type:

| Endpoint | Table | Use |
|----------|-------|-----|
| `POST /api/crm/deals/:dealId/contacts` | `dealContacts` | Link seller (with `role: 'seller'`) |
| `DELETE /api/crm/deals/:dealId/contacts/:contactId` | `dealContacts` | Unlink seller |
| `POST /api/crm/deals/:dealId/buyers` | `dealBuyers` | Link buyer (with `stageId`) |
| `DELETE /api/crm/deals/:dealId/buyers/:buyerId` | `dealBuyers` | Unlink buyer |

### 4. Contact Detail: Merging Both Tables

**File: `server/routes/crm-routes.ts` (contact detail endpoint)**

The contact detail API merges deals from both tables for a complete view:

```typescript
// Get deals where contact is a seller/advisor
const contactDeals = await db
  .select({ deal: deals, association: dealContacts })
  .from(dealContacts)
  .innerJoin(deals, eq(deals.id, dealContacts.dealId))
  .where(and(eq(dealContacts.contactId, contactId), isNull(deals.deletedAt)));

// Also get deals where contact is a buyer
const buyerDeals = await db
  .select({ deal: deals, buyerRecord: dealBuyers })
  .from(dealBuyers)
  .innerJoin(deals, eq(deals.id, dealBuyers.dealId))
  .where(and(eq(dealBuyers.contactId, contactId), isNull(deals.deletedAt)));

// Frontend deduplicates by deal ID
```

### 5. Cache Invalidation Pattern

**File: `client/src/pages/crm/buyer-detail-page.tsx`**

Comprehensive invalidation after buyer mutations:

```typescript
const linkDealMutation = useMutation({
  mutationFn: ({ dealId }) =>
    apiRequest("POST", `/api/crm/deals/${dealId}/buyers`, {
      body: { contactId: parseInt(id!) },
    }).then(res => res.json()),
  onSuccess: (_, variables) => {
    queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts", id] });
    queryClient.invalidateQueries({ queryKey: ["/api/crm/deals"], refetchType: 'all' });
    queryClient.invalidateQueries({ queryKey: ["/api/crm/deals", String(variables.dealId)] });
    queryClient.invalidateQueries({ queryKey: ["/api/crm/deals", String(variables.dealId), "buyers"] });
    queryClient.invalidateQueries({ queryKey: ["/api/crm/deals/kanban"], refetchType: 'all' });
  },
});
```

**File: `client/src/pages/crm/seller-detail-page.tsx`**

Simpler invalidation for seller mutations (no buyer-specific keys):

```typescript
const linkDealMutation = useMutation({
  mutationFn: ({ dealId }) =>
    apiRequest("POST", `/api/crm/deals/${dealId}/contacts`, {
      body: { contactId: parseInt(id!), role: "seller" },
    }).then(res => res.json()),
  onSuccess: (_, variables) => {
    queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts", id] });
    queryClient.invalidateQueries({ queryKey: ["/api/crm/deals"], refetchType: 'all' });
    queryClient.invalidateQueries({ queryKey: ["/api/crm/deals", String(variables.dealId)] });
  },
});
```

## Key Architectural Decisions

1. **Dual-Table over Single Table**: Buyers need `stageId` for pipeline tracking; sellers don't. A single table would bloat the seller relationship with unused columns and complicate queries.

2. **"NDA Signed" Stage Priority**: Auto-linked NDA signers are placed in the "NDA Signed" pipeline stage if it exists, falling back to the first stage. This ensures immediate visibility in the correct pipeline position.

3. **Merge at Query Time**: The contact detail endpoint queries both tables separately and returns combined results, letting the frontend decide how to display each relationship type.

4. **Hierarchical Cache Keys**: Using keys like `["/api/crm/deals", dealId, "buyers"]` enables granular invalidation without clearing broader deal caches unnecessarily.

5. **Idempotent Linking**: All link endpoints check for existing associations before inserting, preventing duplicates.

## Prevention Strategies

### Table Selection
- **Rule**: Buyers always go in `dealBuyers`, sellers/advisors always go in `dealContacts`
- **Pattern**: When writing code that links contacts to deals, always ask: "Is this a buyer or a seller?"
- **Validation**: Log which table was used: `Auto-linked contact to dealBuyers (not dealContacts)`

### Cache Invalidation Checklist
After any deal/contact mutation, invalidate:
- `/api/crm/contacts/{id}` — the contact record
- `/api/crm/deals/{dealId}` — the specific deal
- `/api/crm/deals/{dealId}/buyers` — the deal's buyer list (if buyer mutation)
- `/api/crm/deals/kanban` — the kanban board (if buyer mutation)
- `/api/crm/deals` — the deals list (broad invalidation)

### Test Cases

| Scenario | Expected | Table |
|----------|----------|-------|
| NDA signer auto-linked | Appears in `dealBuyers` with stageId | `dealBuyers` |
| NDA signer auto-linked | Does NOT appear in `dealContacts` | Verify absence |
| Seller linked to deal | Appears in `dealContacts` with role='seller' | `dealContacts` |
| Contact detail for buyer in 2 deals | Both deals returned (from `dealBuyers`) | Merge query |
| Contact is buyer on Deal A, seller on Deal B | Both deals returned, deduplicated | Both tables |
| Link buyer → refresh deal detail | Buyer visible in pipeline immediately | Cache invalidation |

### Warning Signs

| Symptom | Likely Cause |
|---------|-------------|
| Buyer missing from pipeline after NDA sign | Wrong table (dealContacts instead of dealBuyers) |
| Duplicate deals on contact detail page | Merge/dedup logic broken |
| Stale data after link/unlink | Missing cache invalidation |
| "Already exists" errors on link | Duplicate-check querying wrong table |
| Pipeline stage not assigned to auto-linked buyer | Stage lookup failed silently |

## Related Documentation

- **[Buyer Management Hub Plan](../../plans/2026-02-21-feat-buyer-management-hub-plan.md)** — 5-phase roadmap including this work (Phase 1-2)
- **[NDA Signer Email & Buyer Form Plan](../../plans/2026-02-21-feat-nda-signer-email-and-buyer-form-plan.md)** — Follow-up work for NDA status emails and buyer qualification forms
- **[KNOWLEDGE_BASE.md](../../KNOWLEDGE_BASE.md)** — Product docs including buyer pipeline description
- **[Architecture Notes](../../.claude/projects/-home-runner-workspace/memory/architecture.md)** — Backend/frontend patterns

## Files Changed

| File | Change |
|------|--------|
| `server/routes/nda-signing-routes.ts` | Fixed auto-link: `dealContacts` → `dealBuyers` with stage assignment |
| `server/routes/crm-routes.ts` | Added buyer/seller link/unlink endpoints, contact detail merge query |
| `shared/schema.ts` | `dealBuyers` and `dealContacts` table definitions |
| `client/src/pages/crm/buyer-detail-page.tsx` | Link/unlink mutations with comprehensive cache invalidation |
| `client/src/pages/crm/seller-detail-page.tsx` | Link/unlink mutations with cache invalidation |
| `client/src/pages/crm/deal-detail-page.tsx` | Buyers tab (dealBuyers) + Sellers sidebar (dealContacts) |
| `client/src/pages/crm/contact-detail-page.tsx` | Merged deal view from both tables |
