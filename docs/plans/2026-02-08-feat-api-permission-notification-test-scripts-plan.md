---
title: "feat: Standalone API Test Scripts for Permissions & Notifications"
type: feat
date: 2026-02-08
brainstorm: docs/brainstorms/2026-02-08-automated-api-testing-brainstorm.md
---

# Standalone API Test Scripts for Permissions & Notifications

## Overview

Build two standalone Node.js/TypeScript test scripts that automatically verify:
1. **Permission enforcement** across all 4 roles (Owner, Admin, Member, Viewer) against every permission-gated API endpoint
2. **Notification preferences** persistence and toggle behavior via the GET/PUT `/api/user/notification-preferences` endpoints

Scripts run against the dev server (port 5000), use the existing auth system (session cookies), require zero new dependencies, and produce color-coded pass/fail console output.

## Problem Statement

Testing permissions and notification settings currently requires manually logging in as different role users and clicking through the UI one-by-one. With 31 permission keys across 4 roles (124+ test cases) and 14 notification toggles, this is time-consuming and error-prone. Manual testing also makes it easy to miss regressions when permissions or notification logic changes.

## Research Findings

### Current Permission Enforcement State

**Important discovery:** The permission system infrastructure exists (`shared/permissions.ts` with 31 keys, `server/middleware/permissions.ts` with `getUserPermissions`, `requirePermission`, `canManagePermissions`), but **most CRM endpoints only check authentication, not granular permissions**. Only these endpoints currently enforce permission keys:

| Endpoint | Method | Permission Check |
|----------|--------|-----------------|
| `/api/crm/organization/permissions` | GET | `canManagePermissions()` (owner/admin) |
| `/api/crm/organization/permissions` | PUT | `canManagePermissions()` (owner/admin) |
| `/api/crm/import/upload` | POST | `settings.data_import.manage` |
| `/api/crm/import/preview` | POST | `settings.data_import.manage` |
| `/api/crm/import/execute` | POST | `settings.data_import.manage` |

Document endpoints use **ownership-based** access control (userId match, collaborator role), not the role-permission system. E-signature endpoints use ownership checks on `createdBy`.

The test scripts should:
1. Test what's **actually enforced today** (the 5 endpoints above + ownership-based checks)
2. Test the **permission data layer** (that `getUserPermissions()` returns correct defaults/overrides per role)
3. Document which endpoints **lack permission checks** as a coverage report
4. Test notification preferences thoroughly

### Key Technical Details

- **Auth:** POST `/api/login` with `{email, password}` → session cookie (`connect.sid`)
- **Permission denial:** HTTP 403
- **Notification endpoints:** GET/PUT `/api/user/notification-preferences`
- **Notification defaults:** Email: mentions=true, taskAssigned=true, taskReminder=true, dealUpdates=false, teamInvites=true, esignRequests=true, esignCompleted=true, weeklyDigest=false; In-app: all true except no weeklyDigest/teamInvites
- **Dev server:** Port 5000, started with `npm run dev`

## Proposed Solution

### File Structure

```
tests/
├── test-permissions.ts        # Permission enforcement test script
├── test-notifications.ts      # Notification preferences test script
├── helpers/
│   ├── http-client.ts         # Fetch wrapper with session cookie management
│   ├── test-runner.ts         # Color-coded output, pass/fail tracking, reporting
│   └── test-setup.ts          # Server health check, user auth, test data seeding
└── README.md                  # How to run, what's tested, known gaps
```

### npm Scripts (in package.json)

```json
{
  "test:permissions": "tsx tests/test-permissions.ts",
  "test:notifications": "tsx tests/test-notifications.ts",
  "test:all": "tsx tests/test-permissions.ts && tsx tests/test-notifications.ts"
}
```

`tsx` is already a project dependency (used for `npm run dev`), so no new installs needed.

---

## Technical Approach

### Phase 1: Test Infrastructure (`tests/helpers/`)

#### `tests/helpers/http-client.ts`

Authenticated HTTP client that:
- Logs in via POST `/api/login` and stores the session cookie
- Provides `get(path)`, `post(path, body)`, `put(path, body)`, `patch(path, body)`, `delete(path)` methods
- Automatically attaches the session cookie to every request
- Handles 401 responses by re-authenticating once (session expiration recovery)
- Returns `{ status, body, ok }` for assertions

```typescript
// Usage:
const ownerClient = await createAuthClient('owner@test.local', 'TestPass123!');
const res = await ownerClient.get('/api/crm/organization/permissions');
// res.status === 200
```

#### `tests/helpers/test-runner.ts`

Lightweight test harness:
- `test(name, fn)` — registers a test case
- `describe(name, fn)` — groups tests
- `expect(actual).toBe(expected)` — simple assertion
- `expect(actual).toBeOneOf([200, 201])` — status code ranges
- Color-coded output: green ✓ for pass, red ✗ for fail
- Summary at end: `42 passed, 3 failed, 2 skipped`
- Exit code 1 if any failures (useful for CI later)

#### `tests/helpers/test-setup.ts`

Pre-test environment setup:
- **Health check:** GET `/api/user` or similar — retries 3 times with 2s delay, fails fast with clear message if server unreachable
- **Auth setup:** Authenticate as 4 pre-existing test users (one per role). These users must exist in the dev database — the script documents the required setup but does NOT auto-create users (too risky for dev data)
- **Config:** Base URL from `TEST_BASE_URL` env var, defaults to `http://localhost:5000`
- **Test data seeding:** Creates minimal test entities (one deal, one contact, one company, one task) under the test org, tagged with a `[TEST]` prefix for identification. Cleans up tagged entities at the end.

**Required pre-existing test users** (documented in README):

| Role | Email | Purpose |
|------|-------|---------|
| Owner | `test-owner@test.local` | Full access verification |
| Admin | `test-admin@test.local` | Near-full access verification |
| Member | `test-member@test.local` | Limited access verification |
| Viewer | `test-viewer@test.local` | Read-only verification |

All must belong to the same test organization with password `TestPass123!`.

---

### Phase 2: Permission Tests (`tests/test-permissions.ts`)

#### 2a. Permission Data Layer Tests

Test that `GET /api/crm/organization/my-permissions` returns correct permission data for each role:

```
describe('Permission Data Layer')
  for each role (owner, admin, member, viewer):
    test('${role} gets correct default permissions')
      → Login as role user
      → GET /api/crm/organization/my-permissions
      → Assert role field matches expected
      → Assert each of 31 permission keys matches expected default from shared/permissions.ts
```

This validates the permission system itself — even though most endpoints don't enforce it yet, the data must be correct for the frontend `use-permissions` hook to work.

#### 2b. Permission-Gated Endpoint Tests

Test the endpoints that actually enforce permissions today:

```
describe('Permission Management Endpoints (Owner/Admin only)')
  for each role:
    test('${role} GET /api/crm/organization/permissions → ${expected}')
    test('${role} PUT /api/crm/organization/permissions → ${expected}')

describe('Data Import Endpoints (settings.data_import.manage)')
  for each role:
    test('${role} POST /api/crm/import/upload → ${expected}')
    test('${role} POST /api/crm/import/preview → ${expected}')
    test('${role} POST /api/crm/import/execute → ${expected}')
```

Expected results matrix:

| Endpoint | Owner | Admin | Member | Viewer |
|----------|-------|-------|--------|--------|
| GET permissions matrix | 200 | 200 | 403 | 403 |
| PUT permissions | 200 | 200 | 403 | 403 |
| POST import/upload | 200 | 200 | 403 | 403 |
| POST import/preview | 200 | 200 | 403 | 403 |
| POST import/execute | 200 | 200 | 403 | 403 |

#### 2c. Custom Permission Override Tests

Test that customizing admin/member permissions actually changes enforcement:

```
describe('Custom Permission Overrides')
  test('Revoking settings.data_import.manage from admin blocks import')
    → As owner: PUT /api/crm/organization/permissions to revoke admin's data_import.manage
    → As admin: POST /api/crm/import/upload → expect 403
    → Cleanup: restore original permission

  test('Granting settings.data_import.manage to member allows import')
    → As owner: PUT /api/crm/organization/permissions to grant member's data_import.manage
    → As member: POST /api/crm/import/upload → expect 200
    → Cleanup: restore original permission
```

#### 2d. Locked Role Immutability Tests

```
describe('Locked Roles Cannot Be Customized')
  test('Cannot customize owner role permissions')
    → As owner: attempt PUT to modify owner role → expect rejection
  test('Cannot customize viewer role permissions')
    → As owner: attempt PUT to modify viewer role → expect rejection
```

#### 2e. Authentication-Only Endpoint Audit

For endpoints that only check auth (not permissions), run a lightweight audit:

```
describe('Authentication-Only Endpoints (Coverage Report)')
  for each CRM endpoint without permission checks:
    test('${endpoint} requires authentication')
      → Hit without session cookie → expect 401
    test('${endpoint} accessible by all authenticated roles')
      → Hit as viewer → record status (200 or 403)
      → Output as informational (not pass/fail) for coverage reporting
```

This produces a report like:
```
COVERAGE REPORT: Endpoints without granular permission checks
  GET /api/crm/deals           → All roles: 200 (no permission check)
  POST /api/crm/deals          → All roles: 200 (no permission check) ⚠️ Viewer can create deals
  DELETE /api/crm/deals/:id    → All roles: 200 (no permission check) ⚠️ Viewer can delete deals
```

---

### Phase 3: Notification Tests (`tests/test-notifications.ts`)

#### 3a. Default Preferences

```
describe('Default Notification Preferences')
  test('Fresh user gets correct defaults')
    → Login as test user
    → GET /api/user/notification-preferences
    → Assert each of 14 toggles matches expected defaults:
      Email: mentions=true, taskAssigned=true, taskReminder=true, dealUpdates=false,
             teamInvites=true, esignRequests=true, esignCompleted=true, weeklyDigest=false
      InApp: mentions=true, taskAssigned=true, taskReminder=true,
             dealUpdates=true, esignRequests=true, esignCompleted=true
```

#### 3b. Toggle Each Preference

```
describe('Individual Toggle Tests')
  for each of 14 preference keys:
    test('Toggle ${key} from default to opposite')
      → GET current value
      → PUT with opposite value
      → GET again
      → Assert value changed
      → PUT with original value (restore)
      → GET again
      → Assert restored
```

#### 3c. Partial Updates

```
describe('Partial Update Semantics')
  test('PUT with subset of fields preserves other fields')
    → GET all current values
    → PUT with only { emailMentions: false }
    → GET all values again
    → Assert emailMentions changed
    → Assert all other 13 fields unchanged
```

#### 3d. Bulk Update

```
describe('Bulk Update')
  test('Set all toggles to false')
    → PUT with all 14 keys set to false
    → GET and verify all are false
    → Restore all to defaults
```

#### 3e. Edge Cases

```
describe('Edge Cases')
  test('PUT with empty body returns current preferences or 400')
  test('PUT with unknown keys ignores them gracefully')
  test('PUT with non-boolean values returns 400')
  test('Preferences persist across logout/login')
    → Set a preference
    → Logout
    → Login again
    → Verify preference still set
```

---

## Acceptance Criteria

### Functional Requirements

- [x] `npm run test:permissions` runs all permission tests and outputs pass/fail results
- [x] `npm run test:notifications` runs all notification tests and outputs pass/fail results
- [x] `npm run test:all` runs both test suites sequentially
- [x] Permission tests verify correct access for all 4 roles on permission-gated endpoints
- [x] Permission tests verify the permission data layer returns correct defaults per role
- [x] Permission tests include custom override tests (grant/revoke)
- [x] Notification tests verify all 14 toggle defaults
- [x] Notification tests verify individual toggle changes persist
- [x] Notification tests verify partial update semantics
- [x] Coverage report identifies endpoints lacking permission checks

### Non-Functional Requirements

- [x] Scripts use zero new npm dependencies (only `tsx` which is already installed)
- [x] Scripts fail fast with clear error if server is not running
- [x] Scripts clean up any test data they create (notification prefs restored to defaults)
- [x] Color-coded console output (green pass, red fail, yellow skip/warn)
- [x] Exit code 0 on all pass, exit code 1 on any failure
- [x] `tests/README.md` documents setup requirements (test users, running server)

### Quality Gates

- [ ] All tests pass against a clean dev environment with correct test users
- [x] No test data left behind after script completion (even on failure — use try/finally)
- [x] TypeScript type-checking passes (`npm run check` includes test files)

---

## Implementation Phases

### Phase 1: Test Infrastructure
- `tests/helpers/http-client.ts` — authenticated HTTP client
- `tests/helpers/test-runner.ts` — lightweight test harness with colored output
- `tests/helpers/test-setup.ts` — health check, auth, seed data, cleanup

### Phase 2: Permission Tests
- `tests/test-permissions.ts` — all permission test cases
- Permission data layer tests (31 keys × 4 roles)
- Endpoint enforcement tests (5 gated endpoints × 4 roles)
- Custom override tests
- Coverage audit report

### Phase 3: Notification Tests
- `tests/test-notifications.ts` — all notification test cases
- Default value verification
- Individual toggle tests (14 toggles)
- Partial update semantics
- Edge cases

### Phase 4: Documentation & npm Scripts
- `tests/README.md` — setup instructions, test user creation, how to run
- `package.json` — add test:permissions, test:notifications, test:all scripts

---

## Dependencies & Risks

**Dependencies:**
- Dev server must be running on port 5000
- Test users (4 roles) must exist in the dev database
- At least one test organization must exist

**Risks:**
- **Session expiration during long test runs** — Mitigated by auto-re-auth on 401
- **Test data pollution** — Mitigated by `[TEST]` prefix tagging and cleanup
- **Server not running** — Mitigated by health check with clear error message
- **Permission system gaps** — Most CRM endpoints lack permission checks. Tests document this as a coverage report rather than failing, since it reflects the current intended behavior

## References

- Brainstorm: `docs/brainstorms/2026-02-08-automated-api-testing-brainstorm.md`
- Permission definitions: `shared/permissions.ts`
- Permission middleware: `server/middleware/permissions.ts`
- Notification preferences schema: `shared/schema.ts:2973-2997`
- Notification endpoints: `server/routes.ts:11568-11644`
- CRM routes: `server/routes/crm-routes.ts`
- Existing testing docs: `docs/testing/PRE-DEPLOYMENT-CHECKLIST.md`
