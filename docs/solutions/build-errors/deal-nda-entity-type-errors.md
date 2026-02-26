---
title: "TypeScript Errors During NDA-CIM Separation Refactor"
type: build-errors
date: 2026-02-24
status: resolved
severity: medium
tags:
  - typescript
  - drizzle-orm
  - react-props
  - schema-mismatch
  - nda-refactor
  - migration
component:
  - server/routes/deal-nda-routes.ts
  - client/src/pages/deal-nda-page.tsx
  - shared/schema.ts
symptoms:
  - "TypeScript compile error at deal-nda-routes.ts:385 — Property 'organizationId' does not exist on type for userBranding table"
  - "TypeScript compile error at deal-nda-page.tsx:222 — FillableNdaDocument component received wrong props (template object instead of individual props; isSubmitting instead of isLoading)"
  - "drizzle-kit push blocked by interactive prompts during migration, requiring manual psql execution"
root_cause: "Schema assumptions carried over from pre-refactor code: (1) deal-nda-routes referenced organizationId on userBranding table which only has userId; (2) deal-nda-page passed a monolithic template object instead of destructured individual props expected by FillableNdaDocument component"
---

# TypeScript Errors During NDA-CIM Separation Refactor

## Problem

During a large feature implementation (separating NDAs from CIM documents into their own deal-level entity), two TypeScript compilation errors were caught by `npx tsc --noEmit`, plus a migration tooling issue:

1. **`server/routes/deal-nda-routes.ts:385`** — `Property 'organizationId' does not exist on type` for `userBranding` table
2. **`client/src/pages/deal-nda-page.tsx:222`** — Wrong props passed to `FillableNdaDocument` component
3. **`drizzle-kit push`** — Interactive prompts blocked schema migration in non-interactive shell

## Solution

### Fix 1: Replace `userBranding.organizationId` with Organization Member Lookup

**Investigation:** The `userBranding` table schema in `shared/schema.ts` only has `userId`, not `organizationId`. Branding fields (`businessLogo`, `businessName`) live directly on the `users` table. The correct lookup path is: NDA `organizationId` -> `organizationMembers` -> `users`.

**Code fix in `server/routes/deal-nda-routes.ts`:**

Update imports — remove `userBranding`, add `users`:

```typescript
// Remove: userBranding
// Ensure these are imported:
import { users, organizationMembers } from "@shared/schema";
```

Replace the branding lookup:

```typescript
// BEFORE (broken — userBranding has no organizationId column):
const [branding] = await db
  .select()
  .from(userBranding)
  .where(eq(userBranding.organizationId, nda.organizationId))
  .limit(1);

// AFTER (working — look up an org member, then get their user profile):
let businessLogo: string | null = null;
let businessName: string | null = null;
try {
  const [orgMember] = await db
    .select({ userId: organizationMembers.userId })
    .from(organizationMembers)
    .where(eq(organizationMembers.organizationId, nda.organizationId))
    .limit(1);
  if (orgMember?.userId) {
    const [ownerUser] = await db
      .select({ businessLogo: users.businessLogo, businessName: users.businessName })
      .from(users)
      .where(eq(users.id, orgMember.userId))
      .limit(1);
    if (ownerUser) {
      businessLogo = ownerUser.businessLogo || null;
      businessName = ownerUser.businessName || null;
    }
  }
} catch {
  // Ignore branding lookup errors — page still renders without branding
}
```

### Fix 2: Pass Individual Props to `FillableNdaDocument`

**Investigation:** The `FillableNdaDocumentProps` interface expects `documentTitle`, `ndaContent`, `signatureFields`, `isLoading` as separate props. The code passed a single `template` object and used `isSubmitting`.

**Code fix in `client/src/pages/deal-nda-page.tsx`:**

```tsx
// BEFORE (broken — wrong prop shape):
<FillableNdaDocument
  template={templateData}
  onSubmit={handleSign}
  isSubmitting={signMutation.isPending}
  prefilledName={prefilledName}
  prefilledEmail={prefilledEmail}
/>

// AFTER (working — individual props matching FillableNdaDocumentProps):
<FillableNdaDocument
  documentTitle={templateData.name}
  ndaContent={templateData.fileContent}
  signatureFields={templateData.signatureFields}
  onSubmit={handleSign}
  isLoading={signMutation.isPending}
  prefilledName={prefilledName}
  prefilledEmail={prefilledEmail}
/>
```

Also made `handleSign` async to match the expected `Promise<void>` return type:

```typescript
const handleSign = async (fieldValues: Record<string, string>) => {
  setError(null);
  signMutation.mutate(fieldValues);
};
```

### Fix 3: Bypass `drizzle-kit push` Interactive Prompts

**Problem:** `npx drizzle-kit push` launched interactive prompts that blocked in the Replit agent shell.

**Workaround — run SQL directly via `psql`:**

```sql
CREATE TABLE IF NOT EXISTS deal_ndas (...);
ALTER TABLE nda_signatures ADD COLUMN IF NOT EXISTS deal_nda_id INTEGER;
ALTER TABLE nda_access_tokens ADD COLUMN IF NOT EXISTS deal_nda_id INTEGER;
```

The `IF NOT EXISTS` guards make the SQL idempotent. After running, `drizzle-kit push` reports no pending changes.

## Prevention Strategies

### 1. Schema Column Mismatches in Drizzle ORM

- **Always read `shared/schema.ts` before writing queries.** Confirm exact column names (`userId` vs `organizationId`) against the table definition.
- **Grep for existing usage patterns** before writing new queries. Running a search for `userBranding` across `server/routes/` would reveal every existing query uses `.where(eq(userBranding.userId, ...))`.
- **Run `npx tsc --noEmit` before committing** any new query code. Drizzle ORM generates column-level types from table definitions — TypeScript catches mismatches at compile time.

### 2. React Component Prop Contracts

- **Read the component's Props interface before passing props.** Open the component file and check the exact prop names and types.
- **Destructure API responses explicitly** at the call site rather than passing whole objects. This makes mismatches visible to TypeScript.
- **Search for naming conventions** (`isLoading` vs `isSubmitting`) in the codebase before guessing.

### 3. Database Migrations with drizzle-kit

- **Use `drizzle-kit generate` + `drizzle-kit migrate`** instead of `drizzle-kit push` for non-interactive environments.
- **For additive-only changes** (new tables, new nullable columns), direct SQL with `IF NOT EXISTS` guards is a reliable alternative.
- **Keep migration snapshots in sync** after manual SQL — update `migrations/meta/_journal.json` and snapshot files.

## Checklist

### Before Writing Any Query
- [ ] Read the full table definition in `shared/schema.ts`
- [ ] Confirm exact column names you intend to use
- [ ] Search for existing query patterns against the same table

### Before Wiring Up a React Component
- [ ] Read the target component's Props type/interface
- [ ] Destructure API response fields explicitly at the call site
- [ ] Confirm boolean prop names match (`isLoading` vs `isSubmitting` vs `isPending`)

### Before Running Migrations
- [ ] Local dev: `drizzle-kit push` is acceptable
- [ ] CI/staging/production: use `drizzle-kit generate` then `drizzle-kit migrate`
- [ ] Review generated SQL for destructive operations

### After Implementation
- [ ] Run `npx tsc --noEmit` — zero new errors
- [ ] Verify dev server starts without runtime errors
- [ ] Test new API endpoints with at least one request

## Related Documentation

- **`docs/solutions/logic-errors/orgid-scope-refactoring-error.md`** — Same class of error: referencing `orgId` that doesn't exist in the expected scope during route extraction refactoring. Covers `tsc --noEmit --strict` pre-commit checks.
- **`docs/solutions/logic-errors/bidirectional-deal-buyer-seller-associations.md`** — Wrong-table bug where NDA signers were inserted into `dealContacts` instead of `dealBuyers`. Demonstrates the pattern of correct table/column selection in Drizzle ORM queries.
- **`docs/plans/2026-02-23-refactor-deal-centric-restructuring-plan.md`** — References `organizationId` usage patterns and `drizzle-kit push` friction.
