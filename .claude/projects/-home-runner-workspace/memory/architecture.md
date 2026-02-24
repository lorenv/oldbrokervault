# BrokerVault Architecture Notes

## Backend Route Registration Pattern
1. Create route file in `server/routes/` exporting `registerXxxRoutes(app: Express)`
2. Import in `server/routes.ts` (around line 77-88)
3. Call `registerXxxRoutes(app)` around line 194-205
4. Auth pattern: `if (!req.user) return res.status(401)` then filter by `cimDocuments.userId = req.user.id`

## Frontend Page Pattern
1. Create page in `client/src/pages/` with `export default function XxxPage()`
2. Add lazy import in `client/src/App.tsx` (around line 20-85)
3. Add route path to `authenticatedRoutes` array (line 97-122)
4. Add `<ProtectedRoute path="/xxx" component={XxxPage} />` in AuthenticatedRouter (line 148-232)

## Sidebar Navigation
- File: `client/src/components/layout/app-sidebar.tsx`
- `mainNavItems` (line 60-67): CRM routes (Dashboard, Deals, Buyers, Sellers, Companies, Tasks)
- `secondaryNavItems` (line 70-78): Tools (AI CIMs, E-Signatures, NDAs, Data Room, Analytics, Messages, etc.)
- Badge system: Pending NDA approvals (from `/api/analytics/pending-approvals`), overdue tasks
- Icons already imported: Shield, FileText, Users, Signature, etc.

## Key Schema Tables
- `ndaSignatures` (shared/schema.ts:380): id, cimDocumentId, signerName, signerEmail, approved, rejected, fieldValues, stage
- `cimDocuments` (shared/schema.ts:178): id, userId, title, dealId, ndaProtected, ndaTemplateId, ndaApprovalRequired
- `deals` (shared/schema.ts:2679): id, organizationId, name, amount, pipelineId, stageId
- `ndaAccessTokens` (shared/schema.ts:405): token, cimDocumentId, ndaSignatureId

## Storage Methods
- `storage.getNdaSignatureById(signatureId)` — single signature
- `storage.approveNdaSignature(id, userId)` — approve + returns with accessToken
- `storage.rejectNdaSignature(id, userId)` — reject
- `storage.approveNdaSignaturesBatch(ids, userId)` — batch approve
- `storage.rejectNdaSignaturesBatch(ids, userId)` — batch reject
- `storage.getCimDocument(docId)` — get CIM doc
- `storage.getUserProfile(userId)` — get user profile for emails

## TypeScript Gotchas
- Server code: Don't spread Sets (`[...new Set()]`), use `Array.from(new Set())` instead — TS target doesn't support downlevelIteration
- Pre-existing TS errors: All `ProtectedRoute` lazy component assignments have type mismatch warnings — these are pre-existing, not blockers

## Table Styling (from CLAUDE.md)
- Outer: `<div className="bg-white rounded-lg border overflow-hidden">` (NO w-full)
- Inner: `<div className="overflow-x-auto">`
- Table: `<table className="w-full table-fixed">`
- Checkbox column: `w-10` class on th/td
- Data column widths: Set % only on `<th>`, total ~100%
- Pagination: `<TablePagination>` outside inner overflow div
