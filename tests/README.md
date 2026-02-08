# API Test Scripts

Standalone test scripts for verifying permission enforcement and notification preferences.

## Prerequisites

1. **Dev server must be running** on port 5000 (or set `TEST_BASE_URL`):
   ```bash
   npm run dev
   ```

2. **Test users must exist** in the database with these exact credentials:

   | Role   | Email                      | Password       |
   |--------|----------------------------|----------------|
   | Owner  | `test-owner@test.local`    | `TestPass123!` |
   | Admin  | `test-admin@test.local`    | `TestPass123!` |
   | Member | `test-member@test.local`   | `TestPass123!` |
   | Viewer | `test-viewer@test.local`   | `TestPass123!` |

   All 4 users must belong to the **same organization**.

### Creating Test Users

Register each user via the app's signup flow or directly via API:

```bash
# Register each test user (repeat for each role email above)
curl -X POST http://localhost:5000/api/register \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "test-owner@test.local",
    "password": "TestPass123!",
    "name": "Test Owner",
    "businessName": "Test Organization",
    "agreeToTerms": true
  }'
```

After registering the owner, invite the other 3 users to the same organization via the Team Settings page, assigning them the appropriate roles (Admin, Member, Viewer).

## Running Tests

```bash
# Run permission tests only
npm run test:permissions

# Run notification tests only
npm run test:notifications

# Run all tests
npm run test:all
```

### Environment Variables

| Variable        | Default                   | Description           |
|-----------------|---------------------------|-----------------------|
| `TEST_BASE_URL` | `http://localhost:5000`   | Base URL of dev server |

## What's Tested

### Permission Tests (`test-permissions.ts`)

- **Permission Data Layer** — Verifies `GET /api/crm/organization/my-permissions` returns correct role and all 31 permission key defaults for each of the 4 roles
- **Permission-Gated Endpoints** — Tests that Owner/Admin can access permission management and data import endpoints while Member/Viewer get 403
- **Custom Permission Overrides** — Tests granting/revoking permissions for admin and member roles, verifies enforcement changes
- **Locked Role Immutability** — Verifies that Owner and Viewer role permissions cannot be customized
- **Coverage Audit** — Informational report showing which CRM endpoints lack granular permission checks (only require authentication)

### Notification Tests (`test-notifications.ts`)

- **Default Values** — Verifies all 14 notification preference defaults match expected values
- **Individual Toggles** — Tests toggling each of the 14 preferences on/off and back
- **Partial Updates** — Verifies that updating a subset of preferences doesn't affect the rest
- **Bulk Updates** — Tests setting all preferences to false, then all to true
- **Edge Cases** — Empty body, unknown keys, non-boolean values, persistence across sessions, per-user isolation, unauthenticated access

## Known Gaps

Most CRM data endpoints (deals, contacts, companies, tasks) only check **authentication** — not granular role-based permissions. The permission system infrastructure exists but isn't wired to all endpoints yet. The coverage audit section of the permission tests documents this.
