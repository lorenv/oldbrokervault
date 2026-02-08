# Brainstorm: Automated API Testing for Permissions & Notifications

**Date:** 2026-02-08
**Status:** Complete

## What We're Building

Standalone API test scripts that automatically verify:

1. **Permission enforcement** — Every permission-gated API endpoint is tested across all 4 roles (Owner, Admin, Member, Viewer) to confirm correct access control (200 vs 403 responses).

2. **Notification preferences** — Toggle each notification preference on/off and verify the settings persist correctly via the API.

The scripts run against the development database using the existing auth system, with color-coded pass/fail console output.

## Why This Approach

- **Standalone script over test framework** — Zero new dependencies, simple to run, solves the immediate pain of manual UI click-through testing.
- **API-only over browser automation** — Permissions are enforced at the API layer. If the API correctly blocks/allows, the UI layer (which reads the same permission data via `use-permissions` hook) follows suit. API tests are faster and more reliable.
- **Dev database is acceptable** — No need for isolated test DB setup, reducing complexity.

## Key Decisions

- **Approach:** Standalone Node.js/TypeScript scripts (no Vitest, no Playwright)
- **Runner:** `npm run test:permissions` and `npm run test:notifications`
- **Auth strategy:** Authenticate via existing auth endpoints as each role
- **Assertions:** HTTP status codes (200/403) for permissions; JSON body checks for notification preferences
- **Output:** Color-coded terminal output with pass/fail counts
- **Environment:** Runs against dev database with dev server running

## Scope

### Permissions to Test (30+ granular permissions across 4 roles)

| Category | Permissions |
|----------|------------|
| CRM | Deals (view/create/edit/delete), Contacts (CRUD), Companies (CRUD), Tasks (CRUD) |
| Documents | View, create/upload, edit, delete, share, download |
| E-Signatures | View envelopes, send, templates (CRUD) |
| Analytics | View analytics, export reports |
| Messages | View, reply |
| SDE Analyzer | View, run analysis |
| Settings | Team (view/manage), Permissions (view/manage), Pipelines, Custom fields, Billing (view/manage), Branding (view/edit), Integrations, Data import |

### Notification Preferences to Test

| Channel | Notifications |
|---------|--------------|
| Email | Mentions, task assigned, task due reminders, deal stage changes, team invitations, e-sign requests, document signed, weekly digest |
| In-App | Mentions, task assigned, task reminder, deal updates, e-sign requests, e-sign completed |

## Open Questions

- Do we need test user accounts pre-created, or should the script create them on the fly?
- Should the script clean up any test data it creates?
- Are there any endpoints that require specific test data to exist (e.g., a deal must exist to test deal permissions)?
