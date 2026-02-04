---
title: "feat: Pre-Deployment Testing System"
type: feat
date: 2026-02-04
status: ready
brainstorm: docs/brainstorms/2026-02-04-pre-deployment-testing-brainstorm.md
---

# Pre-Deployment Testing System

## Overview

Create a comprehensive manual testing system that allows an agent (or human) to verify BrokerVault functionality before deployment. The system catches 404 errors, verifies critical user flows, and documents how to fix issues when found.

**Key Deliverables:**
1. Agent-executable test checklist document
2. Test results template for tracking pass/fail
3. Troubleshooting guide for common issues
4. Instructions for running the test suite

## Problem Statement

BrokerVault has no existing test infrastructure (no unit tests, no e2e tests). Before deploying changes, there's no systematic way to verify that:
- All pages load without 404 errors
- Core user workflows complete successfully
- API endpoints respond correctly
- Payment and e-signature flows work

This creates risk of deploying broken functionality to production.

## Proposed Solution

A **manual test checklist** approach that:
- Can be executed by an AI agent using browser automation tools
- Runs against local development environment
- Creates fresh test accounts for each run
- Documents failures with screenshots and steps to fix
- Produces a pass/fail report

**Why manual over automated:**
- No existing test infrastructure to build on
- Faster to implement and iterate
- Agent-compatible with browser tools
- Lower maintenance burden
- Can document fixes in real-time

## Technical Approach

### File Structure

```
docs/
├── testing/
│   ├── PRE-DEPLOYMENT-CHECKLIST.md    # Main test checklist (agent-executable)
│   ├── TEST-RESULTS-TEMPLATE.md       # Copy for each test run
│   ├── TROUBLESHOOTING-GUIDE.md       # Issue → Cause → Fix reference
│   └── results/                       # Historical test results
│       └── YYYY-MM-DD-test-run.md
```

### Implementation Phases

#### Phase 1: Create Core Test Checklist

Create `docs/testing/PRE-DEPLOYMENT-CHECKLIST.md` with:

**Section 1: Prerequisites**
- [ ] App running locally (`npm run dev`)
- [ ] Database migrated (`npm run db:push`)
- [ ] Environment variables configured
- [ ] Browser with dev tools ready

**Section 2: Test Account Setup**
```markdown
## Test Account Creation
1. Navigate to http://localhost:5000/register
2. Register with email: test-YYYYMMDD-HHMM@example.com
3. Password: TestPassword123!
4. Complete registration
5. Note the test account details for later tests
```

**Section 3: Page Load Tests (31 routes)**
Organized by category:
- Public pages (11 routes)
- Authenticated pages (13 routes)
- Settings pages (12 routes)

Format for each test:
```markdown
| Route | Expected | Status | Notes |
|-------|----------|--------|-------|
| `/` | Home page loads, no console errors | ⬜ | |
| `/pricing` | Pricing page loads | ⬜ | |
```

**Section 4: Workflow Tests**
Step-by-step instructions for each workflow:
- Authentication (register, login, logout, protected routes)
- Document lifecycle (create, edit, share, export, delete)
- CRM operations (deals, companies, contacts, tasks)
- Share links (create, access, password, NDA)
- File uploads (data room, images)
- E-signature (templates, sessions, signing)
- Stripe payments (billing, upgrade, webhook)

**Section 5: API Health Checks**
```markdown
## API Verification
Test each endpoint returns expected data:

| Endpoint | Method | Expected | Status |
|----------|--------|----------|--------|
| `/api/user` | GET | Current user object | ⬜ |
| `/api/cim` | GET | Document array | ⬜ |
```

#### Phase 2: Create Test Results Template

Create `docs/testing/TEST-RESULTS-TEMPLATE.md`:

```markdown
# Test Run: YYYY-MM-DD HH:MM

## Summary
- **Tester:** [Agent/Human name]
- **Environment:** Local (localhost:5000)
- **Duration:** [start] - [end]
- **Result:** ⬜ PASS / ⬜ FAIL

## Statistics
- Total tests: XX
- Passed: XX
- Failed: XX
- Skipped: XX

## Failures
[List each failure with details]

### Failure 1: [Test Name]
- **Route/Feature:**
- **Expected:**
- **Actual:**
- **Console Errors:**
- **Network Errors:**
- **Screenshot:** [if applicable]
- **Fix Applied:** [or "Escalated"]

## Test Account Used
- Email: test-YYYYMMDD-HHMM@example.com
- Created: [timestamp]
```

#### Phase 3: Create Troubleshooting Guide

Create `docs/testing/TROUBLESHOOTING-GUIDE.md` with:

**404 Errors**
| Issue | Likely Cause | Fix |
|-------|--------------|-----|
| Page route 404 | Route not in App.tsx | Add route to `client/src/App.tsx` |
| API endpoint 404 | Endpoint not registered | Add to `server/routes/*.ts` |
| Static asset 404 | Wrong path | Check `public/` folder |
| Share link 404 | Invalid/deleted doc | Check `shareSlug` in database |

**Authentication Issues**
| Issue | Likely Cause | Fix |
|-------|--------------|-----|
| Redirect loop | Session not persisting | Check cookies, `session` table |
| Can't access protected | Auth middleware missing | Add `requireAuth` to route |

**Document Issues**
| Issue | Likely Cause | Fix |
|-------|--------------|-----|
| Not saving | Validation error | Check schema, API logs |
| Export fails | PDF library error | Check puppeteer/jsPDF |
| Images broken | Storage URL issue | Check S3/CORS config |

**CRM Issues**
| Issue | Likely Cause | Fix |
|-------|--------------|-----|
| Records missing | Filter issue | Check userId/orgId filters |
| Create fails | Missing fields | Verify form data |

**E-Signature Issues**
| Issue | Likely Cause | Fix |
|-------|--------------|-----|
| Template not saving | Schema mismatch | Check `ndaTemplates` schema |
| Signing page 404 | Invalid token | Check `ndaAccessTokens` |
| Signature not saving | Canvas issue | Check JS console |

**Stripe Issues**
| Issue | Likely Cause | Fix |
|-------|--------------|-----|
| Checkout fails | Invalid key | Verify `STRIPE_PUBLISHABLE_KEY` |
| Plan not updating | Webhook missed | Check webhook logs |
| Webhook 400 | Bad signature | Verify `STRIPE_WEBHOOK_SECRET` |

#### Phase 4: Agent Execution Instructions

Add to the checklist a section for agent-specific instructions:

```markdown
## Agent Execution Guide

### Prerequisites
1. Ensure the app is running: `npm run dev`
2. Have browser automation available (agent-browser, Playwright MCP, etc.)

### Execution Flow
1. Copy TEST-RESULTS-TEMPLATE.md to results/YYYY-MM-DD-test-run.md
2. Start at Phase 1 (Prerequisites)
3. Execute each test section sequentially
4. For each test:
   - Navigate to the URL/perform the action
   - Check for console errors (open dev tools)
   - Check network tab for failed requests
   - Mark ✅ PASS or ❌ FAIL
   - Document any failures with details
5. If a test fails:
   - Check TROUBLESHOOTING-GUIDE.md for known fixes
   - Apply fix if possible
   - Re-run the failed test
   - Document resolution
6. Generate summary report

### Reporting Format
For each failure, capture:
- URL/route tested
- Expected behavior
- Actual behavior
- Console errors (copy full text)
- Network errors (status codes, responses)
- Steps to reproduce
- Attempted fix and result

### Test Data Cleanup
After testing:
- Note test account email used
- Do NOT delete test data (useful for debugging)
- Mark test run as complete
```

## Acceptance Criteria

### Functional Requirements
- [ ] `PRE-DEPLOYMENT-CHECKLIST.md` covers all 10 test categories from brainstorm
- [ ] Checklist includes all 31+ page routes
- [ ] Each workflow has step-by-step instructions
- [ ] `TEST-RESULTS-TEMPLATE.md` can track pass/fail for all tests
- [ ] `TROUBLESHOOTING-GUIDE.md` covers all documented issues
- [ ] Agent can execute checklist without human intervention

### Quality Gates
- [ ] All routes in checklist verified against `client/src/App.tsx`
- [ ] All API endpoints verified against `server/routes/*.ts`
- [ ] Troubleshooting guide covers issues from brainstorm

## Success Metrics

1. **Coverage:** Checklist covers 100% of routes in App.tsx
2. **Executability:** Agent can complete full test run without getting stuck
3. **Actionability:** When tests fail, troubleshooting guide provides fix path
4. **Repeatability:** Test can be run before any deployment

## Dependencies & Prerequisites

- App must be runnable locally (`npm run dev`)
- Database must be accessible
- Stripe test mode keys configured (for payment tests)
- Browser automation tool available (for agent execution)

## File References

### Routes to Test
- Client routes: `client/src/App.tsx`
- API routes: `server/routes/*.ts`
- Route registration: `server/index.ts`

### Key Files for Fixes
- Authentication: `server/auth.ts`
- Database schema: `shared/schema.ts`
- Document handling: `server/routes/cim-routes.ts` (in index.ts)
- CRM routes: `server/routes/crm-routes.ts`
- E-signature: `server/routes/nda-template-routes.ts`, `server/routes/esign-routes.ts`
- Payments: `server/routes/webhook-routes.ts` (Stripe)

## Scope

**In Scope:**
- All page load tests (public + authenticated)
- Authentication flows
- Document (CIM) workflows
- CRM workflows (deals, companies, contacts, tasks)
- Share link creation and access
- File uploads
- E-signature/NDA flows
- Stripe payment flows (test mode)
- API health checks
- Error handling

**Out of Scope:**
- Chrome extension testing
- SendGrid email delivery verification
- DocuSign external integration
- Cross-browser testing (Chrome only)
- Automated test scripts (future enhancement)

## Implementation Checklist

- [x] Create `docs/testing/` directory
- [x] Create `PRE-DEPLOYMENT-CHECKLIST.md` with all test sections
- [x] Create `TEST-RESULTS-TEMPLATE.md`
- [x] Create `TROUBLESHOOTING-GUIDE.md`
- [x] Create `docs/testing/results/` directory for historical runs
- [x] Verify all routes against App.tsx
- [ ] Verify all API endpoints against server routes
- [ ] Test checklist with a dry run

## Future Considerations

1. **Automation:** Convert critical tests to Playwright scripts
2. **CI Integration:** Run subset of tests on PR merge
3. **Visual Regression:** Screenshot comparison for UI changes
4. **Performance Testing:** Add load time benchmarks
5. **Accessibility Testing:** Add a11y checks to checklist

---

*Plan created from brainstorm: docs/brainstorms/2026-02-04-pre-deployment-testing-brainstorm.md*
