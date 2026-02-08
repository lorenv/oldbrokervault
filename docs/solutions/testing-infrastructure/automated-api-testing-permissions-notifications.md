---
title: "Automated API Testing for Role-Based Permissions and Notification Preferences"
date: 2026-02-08
category: testing-infrastructure
tags:
  - testing
  - permissions
  - rbac
  - notifications
  - api-testing
  - test-automation
  - typescript
severity: medium
component:
  - permission-system
  - notification-preferences
  - api-endpoints
symptom: |
  Manual UI testing required for 124+ permission test cases (31 keys x 4 roles)
  plus 14 notification preference toggles. Each test required logging in as different
  role users and manually clicking through features.
root_cause_type: missing-automated-tests
time_to_fix: medium
recurrence_risk: low
---

# Automated API Testing for Permissions and Notifications

## Problem

Testing permissions and notification settings required manually logging in as each of 4 roles (Owner, Admin, Member, Viewer) and clicking through the UI to verify access was correctly granted or denied. With 31 permission keys across 4 roles (124+ test cases) and 14 notification toggles, this was:

- **Time-consuming** — full manual pass took 30+ minutes
- **Error-prone** — easy to miss a permission combination
- **Not repeatable** — no way to regression-test after changes

## Key Discovery

During research, we found that **most CRM endpoints only check authentication, not granular role-based permissions**. The permission system infrastructure exists (`shared/permissions.ts` with 31 keys, `server/middleware/permissions.ts` with middleware), but only 5 endpoints currently enforce permission keys:

| Endpoint | Permission Check |
|----------|-----------------|
| GET `/api/crm/organization/permissions` | `canManagePermissions()` (owner/admin) |
| PUT `/api/crm/organization/permissions` | `canManagePermissions()` (owner/admin) |
| POST `/api/crm/import/upload` | `settings.data_import.manage` |
| POST `/api/crm/import/preview` | `settings.data_import.manage` |
| POST `/api/crm/import/execute` | `settings.data_import.manage` |

This shaped the test strategy: test what's enforced today, validate the permission data layer, and produce a coverage report showing gaps.

## Solution

Standalone API test scripts using zero new dependencies (only `tsx` which was already installed). Run via npm scripts against the dev server.

### File Structure

```
tests/
├── helpers/
│   ├── http-client.ts    # Authenticated fetch with session cookies, auto-re-auth on 401
│   ├── test-runner.ts    # Lightweight describe/test/expect harness, colored output
│   └── test-setup.ts     # Server health check (3 retries), auth for all 4 roles
├── test-permissions.ts    # Permission enforcement tests
├── test-notifications.ts  # Notification preference tests
└── README.md              # Setup docs
```

### npm Scripts

```json
{
  "test:permissions": "tsx tests/test-permissions.ts",
  "test:notifications": "tsx tests/test-notifications.ts",
  "test:all": "tsx tests/test-permissions.ts && tsx tests/test-notifications.ts"
}
```

### Key Design Decisions

1. **Standalone scripts over test framework** — Zero dependencies, uses existing `tsx`. Can add Vitest later if CI integration is needed.

2. **API-only over browser automation** — Permissions are enforced at the API layer. Faster, more reliable, no browser dependencies.

3. **Session cookie auth** — Login via `POST /api/login`, extract `connect.sid` cookie, attach to all subsequent requests. Auto-re-auth on 401 (session expiration).

4. **Pre-existing test users** — Scripts require 4 users to exist in the dev database (one per role, same org). Documented in README rather than auto-created to avoid dev data risks.

5. **Informational coverage audit** — Endpoints without permission checks are reported as informational (not failures), since the current behavior is intentional.

### What's Tested

**Permission tests:**
- Data layer: 31 permission keys return correct defaults for each of 4 roles
- 5 gated endpoints: correct 200/403 responses per role
- Custom overrides: granting/revoking permissions changes enforcement
- Locked roles: owner/viewer permissions can't be customized
- Coverage audit: informational report of auth-only endpoints

**Notification tests:**
- All 14 toggle defaults match expected values
- Each toggle can be flipped individually and restored
- Partial updates don't affect other fields (merge semantics)
- Bulk updates (all false, all true)
- Edge cases: empty body, unknown keys, non-boolean values, cross-session persistence, per-user isolation

### Example: HTTP Client Pattern

```typescript
// Authenticated client with session cookie management
const ownerClient = await createAuthClient('test-owner@test.local', 'TestPass123!');
const res = await ownerClient.get('/api/crm/organization/permissions');
// res.status === 200, res.body contains permission matrix
```

The client automatically:
- Stores session cookie from login
- Attaches cookie to every request
- Re-authenticates once on 401 (session expiration)

### Example: Permission Override Test

```typescript
// Revoke admin's data_import.manage
await clients.owner.put('/api/crm/organization/permissions', {
  permissionKey: 'settings.data_import.manage',
  role: 'admin',
  granted: false,
});

// Admin should now be blocked
const res = await clients.admin.post('/api/crm/import/preview', { ... });
expect(res.status).toBe(403);

// Cleanup: restore to default
await clients.owner.put('/api/crm/organization/permissions', {
  permissionKey: 'settings.data_import.manage',
  role: 'admin',
  granted: true,
});
```

## Prevention

- **Run `npm run test:all` after any changes** to permission middleware, role definitions, or notification preference endpoints
- **When adding new permission-gated endpoints**, add corresponding test cases to `test-permissions.ts`
- **The coverage audit** helps identify endpoints that should have permission checks but don't

## Gotchas

- Test users must exist before running — the scripts don't auto-create them
- Dev server must be running on port 5000 (or set `TEST_BASE_URL`)
- The notification tests restore preferences to defaults after each test, but if the script crashes mid-run, preferences may be in a non-default state
- Import endpoints (`/upload`, `/preview`, `/execute`) have permission checks AND input validation — tests use invalid bodies to distinguish "got past permission check (400)" from "blocked by permission check (403)"

## Related Documentation

- [Implementation Plan](../../plans/2026-02-08-feat-api-permission-notification-test-scripts-plan.md)
- [Brainstorm](../../brainstorms/2026-02-08-automated-api-testing-brainstorm.md)
- [Pre-Deployment Checklist](../../testing/PRE-DEPLOYMENT-CHECKLIST.md) — Phase 11 API Health Checks
- [Troubleshooting Guide](../../testing/TROUBLESHOOTING-GUIDE.md) — Auth and API error patterns

## Key Files

- `shared/permissions.ts` — 31 permission keys, 4 role defaults
- `server/middleware/permissions.ts` — `getUserPermissions()`, `requirePermission()`, `canManagePermissions()`
- `server/routes/crm-routes.ts:7990-8079` — Permission management endpoints
- `server/routes.ts:11568-11644` — Notification preference endpoints
