---
title: NDA Signature Submission Fails with "orgId is not defined" ReferenceError
date: 2026-02-23
category: runtime-errors
severity: high
components:
  - server/routes/nda-signing-routes.ts
symptoms:
  - Runtime ReferenceError "orgId is not defined" when buyer submits NDA signature
  - NDA signing flow crashes and prevents signature submission
  - advanceBuyerOnApproval() calls fail due to undefined orgId variable
root_cause: Variable orgId declared with const inside if (ownerMembership) block scope but referenced outside that block in outer scope
resolution: Hoisted orgId declaration to outer function scope with null guards on downstream calls
tags:
  - variable-scoping
  - block-scope
  - nda-signing
  - buyer-flow
  - reference-error
  - route-extraction
  - refactoring
---

# NDA Signature Submission Fails with "orgId is not defined"

## Problem Symptom

When a buyer submits an NDA signature via the share page, the server throws a `ReferenceError: orgId is not defined`, crashing the entire NDA signing flow. No NDA signatures can be submitted.

## Root Cause Analysis

During refactoring of the NDA signing endpoint from the monolithic `server/routes.ts` (~9800 lines) into `server/routes/nda-signing-routes.ts`, variable scope was incorrectly managed. The `orgId` variable was declared with `const` inside a nested `try → if` block:

```typescript
// Line ~1019: Auto-create company from signer's email domain
try {
  const [ownerMembership] = await db
    .select({ organizationId: organizationMembers.organizationId })
    .from(organizationMembers)
    .where(and(
      eq(organizationMembers.userId, cimDoc.userId),
      eq(organizationMembers.status, 'active')
    ))
    .limit(1);

  if (ownerMembership) {
    const orgId = ownerMembership.organizationId;  // <-- scoped to this block
    // ... 130+ lines of CRM contact creation, company linking, deal buyer linking ...
  }
} catch (crmError) {
  // Don't fail signing if CRM sync fails
}

// Line ~1192: OUTSIDE the if block and try block
if (cimDoc.ndaApprovalRequired) {
  const whitelistMatch = await checkWhitelist(signerEmail, cimDoc.id, cimDoc.userId);
  if (whitelistMatch) {
    advanceBuyerOnApproval(signerEmail, cimDoc.id, orgId);  // <-- ReferenceError!
  }
}

// Line ~1246: Also outside
if (!requiresManualApproval) {
  advanceBuyerOnApproval(signerEmail, cimDoc.id, orgId);  // <-- ReferenceError!
}
```

JavaScript/TypeScript `const` and `let` are block-scoped. The `orgId` declared inside `if (ownerMembership) { ... }` is invisible to code outside that block. The two `advanceBuyerOnApproval()` calls at lines 1200 and 1246 attempt to reference `orgId` in the outer function scope where it doesn't exist.

**Why TypeScript didn't catch it**: The variable name `orgId` existed in the file (inside the if block), so TypeScript's type checking within the nested scope was valid. The outer-scope references may have been added after the initial extraction without a full recompilation, or the build tooling (esbuild) was more lenient than `tsc --strict`.

## Investigation Steps

1. **Reproduced the error**: Attempted NDA signing through the share page, confirmed server crash with "orgId is not defined"
2. **Grepped for all `orgId` references**: Found declaration at line 1032 (inside if block) and usages at lines 1200, 1246 (outside block)
3. **Traced block scope boundaries**: Confirmed the `if (ownerMembership) { }` block ends at line 1164, but references occur at 1200 and 1246
4. **Assessed business logic**: Organization lookup is needed for three code paths: CRM sync, whitelist auto-approval, and pipeline advancement

## Solution

Two changes applied:

### 1. Hoist the organization lookup to outer scope

```typescript
// Look up the CIM owner's organization (needed for CRM, whitelist, and pipeline)
let orgId: number | null = null;
try {
  const [ownerMembership] = await db
    .select({ organizationId: organizationMembers.organizationId })
    .from(organizationMembers)
    .where(and(
      eq(organizationMembers.userId, cimDoc.userId),
      eq(organizationMembers.status, 'active')
    ))
    .limit(1);
  if (ownerMembership) {
    orgId = ownerMembership.organizationId;
  }
} catch (orgLookupError) {
  console.error('Failed to look up owner organization:', orgLookupError);
}

// CRM operations now use orgId from outer scope
try {
  if (orgId) {
    // ... company creation, CRM contact linking, deal buyer linking ...
  }
} catch (crmError) {
  console.error('Auto-create company/CRM contact failed:', crmError);
}
```

### 2. Add null guards on downstream calls

```typescript
// Line 1207: Whitelist auto-approval path
if (orgId) advanceBuyerOnApproval(signerEmail, cimDoc.id, orgId);

// Line 1253: No-approval-required path
if (orgId) advanceBuyerOnApproval(signerEmail, cimDoc.id, orgId);
```

**Key design decisions**:
- Used `let orgId: number | null = null` (not `let orgId: number | undefined`) for explicit nullability
- Separated the org lookup error handling from the CRM sync error handling
- Null guards ensure NDA signing still succeeds even if org lookup fails (pipeline advancement is non-critical)

## Prevention Strategies

### For This Codebase

1. **Run `tsc --noEmit --strict` before committing route extractions**: The TypeScript compiler with strict mode would have caught the undefined reference at build time.

2. **Pre-extraction variable mapping**: Before extracting code from a large file, map all variables to their declaration locations. Identify any that cross scope boundaries.

3. **Post-extraction checklist**:
   - [ ] Every variable referenced in the extracted code is either declared in scope or passed as a parameter
   - [ ] `npm run build` passes with zero errors
   - [ ] Integration test covers the primary happy path of the extracted route

### For Route Extraction Generally

**Pattern: Hoist shared state before try blocks**
```typescript
// GOOD: Variables needed across multiple code paths declared at function scope
let orgId: number | null = null;
let company: Company | null = null;

try { /* populate orgId */ } catch { /* log */ }
try { /* use orgId for CRM */ } catch { /* log */ }
// orgId safely accessible here
```

**Pattern: Extract context into a typed object**
```typescript
interface SigningContext {
  orgId: number | null;
  signerEmail: string;
  cimDoc: CimDocument;
}

function buildContext(req: Request): SigningContext {
  // All context extraction in one place
}
```

### Detection Methods

| Method | When | Catches this bug? |
|--------|------|---|
| `tsc --strict --noEmit` | Build time | Yes |
| ESLint `no-undef` rule | Lint time | Yes |
| Integration test on NDA signing | Test time | Yes |
| Null guard pattern (`if (orgId)`) | Runtime | Graceful degradation |

## Related Documentation

- [Bidirectional Deal Buyer/Seller Associations](./bidirectional-deal-buyer-seller-associations.md) -- Related auto-link bug where NDA signers were inserted into wrong table; also involves orgId-dependent stage lookups
- [Buyer Management Hub Plan](../../plans/2026-02-21-feat-buyer-management-hub-plan.md) -- Context for the route extraction that caused this bug (Phase 1-2 implementation)
- [NDA Signer Email & Buyer Form Plan](../../plans/2026-02-21-feat-nda-signer-email-and-buyer-form-plan.md) -- Describes the NDA signing flow modifications

## Files Changed

| File | Change |
|------|--------|
| `server/routes/nda-signing-routes.ts` | Hoisted orgId declaration, added null guards on advanceBuyerOnApproval calls |
