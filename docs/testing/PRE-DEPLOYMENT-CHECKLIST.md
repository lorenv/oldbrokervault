# BrokerVault Pre-Deployment Testing Checklist

**Version:** 1.0
**Last Updated:** 2026-02-04
**Purpose:** Verify all BrokerVault functionality before deployment

---

## How to Use This Checklist

1. Copy this file or use the TEST-RESULTS-TEMPLATE.md for tracking
2. Execute tests in order (prerequisites first)
3. Mark each test: `[ ]` pending, `[x]` passed, `[!]` failed
4. Document failures with details in the Notes column
5. Refer to TROUBLESHOOTING-GUIDE.md for common fixes

---

## Phase 1: Prerequisites

Before running tests, verify your environment is ready.

| Requirement | Command/Check | Status | Notes |
|------------|---------------|--------|-------|
| App running locally | `npm run dev` - server starts on port 5000 | [ ] | |
| Database accessible | No connection errors in console | [ ] | |
| Environment variables | `.env` file exists with required keys | [ ] | |
| Browser ready | Chrome with DevTools available | [ ] | |
| Stripe test mode | `STRIPE_PUBLISHABLE_KEY` starts with `pk_test_` | [ ] | |

### Environment Variables Required
```
DATABASE_URL
SESSION_SECRET
STRIPE_SECRET_KEY (test mode)
STRIPE_PUBLISHABLE_KEY (test mode)
STRIPE_WEBHOOK_SECRET
SENDGRID_API_KEY (optional for email tests)
```

---

## Phase 2: Test Account Setup

Create a fresh test account for this test run.

| Step | Action | Status | Notes |
|------|--------|--------|-------|
| 1 | Navigate to `http://localhost:5000/register` | [ ] | |
| 2 | Enter email: `test-YYYYMMDD-HHMM@example.com` | [ ] | Replace YYYYMMDD-HHMM with current date/time |
| 3 | Enter password: `TestPassword123!` | [ ] | |
| 4 | Complete registration form | [ ] | |
| 5 | Verify redirect to `/dashboard` | [ ] | |
| 6 | Record test account email below | [ ] | |

**Test Account Used:** `_______________________________`
**Created At:** `_______________________________`

---

## Phase 3: Page Load Tests

Verify every route loads without 404 errors or console errors.

### 3.1 Public Pages (No Authentication Required)

| Route | Expected Behavior | Status | Notes |
|-------|-------------------|--------|-------|
| `/` | Login page loads | [ ] | |
| `/login` | Login page loads | [ ] | |
| `/register` | Registration form loads | [ ] | |
| `/auth` | Login page loads | [ ] | |
| `/reset-password` | Password reset form loads | [ ] | |
| `/checkout-success` | Checkout success page loads | [ ] | |
| `/unsubscribe` | Unsubscribe page loads | [ ] | |

### 3.2 Authenticated Pages (Require Login)

**Login first, then test these routes.**

| Route | Expected Behavior | Status | Notes |
|-------|-------------------|--------|-------|
| `/dashboard` | Dashboard with stats loads | [ ] | |
| `/documents` | Document list loads | [ ] | |
| `/analytics` | Analytics page loads | [ ] | |
| `/premium` | Premium dashboard loads | [ ] | |
| `/investor-database` | Investor database loads | [ ] | |
| `/sde-analyzer` | SDE analyzer tool loads | [ ] | |
| `/data-room` | Data room page loads | [ ] | |
| `/messages` | Messages inbox loads | [ ] | |
| `/integrations` | Integrations page loads | [ ] | |
| `/nda-templates` | NDA templates list loads | [ ] | |
| `/template-editor` | Template editor loads | [ ] | |
| `/listings-settings` | Listings settings loads | [ ] | |
| `/admin` | Admin page loads (if admin user) | [ ] | Skip if not admin |

### 3.3 CRM Pages

| Route | Expected Behavior | Status | Notes |
|-------|-------------------|--------|-------|
| `/deals` | Deals list/pipeline loads | [ ] | |
| `/tasks` | Tasks list loads | [ ] | |
| `/companies` | Companies list loads | [ ] | |
| `/contacts` | Contacts list loads | [ ] | |

### 3.4 E-Signature Pages

| Route | Expected Behavior | Status | Notes |
|-------|-------------------|--------|-------|
| `/esign` | E-signature dashboard loads | [ ] | |
| `/esign/templates` | E-sign templates list loads | [ ] | |
| `/esign/templates/new` | New template form loads | [ ] | |
| `/esign/send` | Send document form loads | [ ] | |
| `/esign/settings` | E-sign settings page loads | [ ] | |

### 3.5 Settings Pages

| Route | Expected Behavior | Status | Notes |
|-------|-------------------|--------|-------|
| `/settings` | Settings index page loads | [ ] | |
| `/settings/profile` | Profile settings loads | [ ] | |
| `/settings/notifications` | Notification settings loads | [ ] | |
| `/settings/manage-users` | User management loads | [ ] | |
| `/settings/billing` | Billing page loads | [ ] | |
| `/settings/team` | Team settings loads | [ ] | |
| `/settings/crm-visibility` | CRM visibility settings | [ ] | |
| `/settings/pipelines` | Pipeline settings loads | [ ] | |
| `/settings/custom-fields` | Custom fields page loads | [ ] | |
| `/settings/data-management` | Data management loads | [ ] | |
| `/settings/email` | Email settings loads | [ ] | |
| `/settings/integrations` | Integrations settings loads | [ ] | |
| `/settings/webhooks` | Webhooks page loads | [ ] | |
| `/settings/branding` | Branding settings loads | [ ] | |
| `/settings/nda-templates` | NDA templates settings loads | [ ] | |

### 3.6 Error Handling

| Route | Expected Behavior | Status | Notes |
|-------|-------------------|--------|-------|
| `/nonexistent-page-xyz` | 404 Not Found page displays | [ ] | |
| `/settings/fake-page` | 404 or redirect to settings | [ ] | |

---

## Phase 4: Authentication Flow Tests

### 4.1 Registration

| Test | Steps | Expected | Status | Notes |
|------|-------|----------|--------|-------|
| Valid registration | 1. Go to `/register` 2. Enter valid email/password 3. Submit | Account created, redirect to dashboard | [ ] | |
| Invalid email | 1. Go to `/register` 2. Enter "not-an-email" 3. Submit | Validation error shown | [ ] | |
| Weak password | 1. Enter password "123" 2. Submit | Validation error shown | [ ] | |
| Duplicate email | 1. Use existing email 2. Submit | Error message shown | [ ] | |

### 4.2 Login

| Test | Steps | Expected | Status | Notes |
|------|-------|----------|--------|-------|
| Valid login | 1. Go to `/login` 2. Enter test credentials 3. Submit | Logged in, redirect to dashboard | [ ] | |
| Invalid password | 1. Enter wrong password 2. Submit | Error message shown | [ ] | |
| Invalid email | 1. Enter nonexistent email 2. Submit | Error message shown | [ ] | |
| Session persistence | 1. Login 2. Refresh page | Still logged in | [ ] | |

### 4.3 Logout

| Test | Steps | Expected | Status | Notes |
|------|-------|----------|--------|-------|
| Logout | 1. Click logout button 2. Verify | Redirected to login, session cleared | [ ] | |
| Access after logout | 1. Logout 2. Navigate to `/dashboard` | Redirected to login | [ ] | |

### 4.4 Protected Routes

| Test | Steps | Expected | Status | Notes |
|------|-------|----------|--------|-------|
| Unauthenticated access | 1. Logout 2. Go to `/dashboard` directly | Redirected to login | [ ] | |
| Return URL | 1. Try `/documents` while logged out 2. Login | Redirected back to `/documents` | [ ] | |

---

## Phase 5: Document (CIM) Workflow Tests

### 5.1 Create Document

| Test | Steps | Expected | Status | Notes |
|------|-------|----------|--------|-------|
| Create from dashboard | 1. Go to `/dashboard` 2. Click "Create CIM" 3. Fill form 4. Save | Document created, appears in list | [ ] | |
| AI generation | 1. Create new CIM 2. Enter website URL 3. Generate | AI generates content | [ ] | |
| Manual creation | 1. Create new CIM 2. Enter details manually 3. Save | Document saved with manual content | [ ] | |

### 5.2 Edit Document

| Test | Steps | Expected | Status | Notes |
|------|-------|----------|--------|-------|
| Edit title | 1. Open document 2. Change title 3. Save | Title updated | [ ] | |
| Edit company info | 1. Open document 2. Edit company details 3. Save | Company info saved | [ ] | |
| Add section | 1. Open document 2. Add new section 3. Save | Section appears | [ ] | |
| Upload logo | 1. Open document 2. Upload logo image 3. Save | Logo displays | [ ] | |

### 5.3 Share Document

| Test | Steps | Expected | Status | Notes |
|------|-------|----------|--------|-------|
| Generate share link | 1. Open document 2. Click Share 3. Generate link | Share URL created | [ ] | |
| Access share link | 1. Copy share URL 2. Open in incognito | Document loads publicly | [ ] | |
| Password protection | 1. Enable password on share 2. Access link | Password prompt shown | [ ] | |
| NDA requirement | 1. Enable NDA on share 2. Access link | NDA signing required | [ ] | |

### 5.4 Export Document

| Test | Steps | Expected | Status | Notes |
|------|-------|----------|--------|-------|
| PDF export | 1. Open document 2. Click Export PDF | PDF downloads successfully | [ ] | |
| Word export | 1. Open document 2. Click Export Word | DOCX downloads successfully | [ ] | |
| File not corrupted | 1. Open downloaded files | Files open correctly | [ ] | |

### 5.5 Delete Document

| Test | Steps | Expected | Status | Notes |
|------|-------|----------|--------|-------|
| Delete document | 1. Open document 2. Click Delete 3. Confirm | Document removed from list | [ ] | |
| Share link invalid | 1. Try old share link | 404 or error shown | [ ] | |

---

## Phase 6: CRM Workflow Tests

### 6.1 Deals

| Test | Steps | Expected | Status | Notes |
|------|-------|----------|--------|-------|
| Create deal | 1. Go to `/deals` 2. Click New Deal 3. Fill form 4. Save | Deal created, appears in list | [ ] | |
| Edit deal | 1. Open deal 2. Edit details 3. Save | Changes saved | [ ] | |
| Move pipeline stage | 1. Drag deal to new stage OR use dropdown | Stage updated | [ ] | |
| Delete deal | 1. Open deal 2. Delete 3. Confirm | Deal removed | [ ] | |

### 6.2 Companies

| Test | Steps | Expected | Status | Notes |
|------|-------|----------|--------|-------|
| Create company | 1. Go to `/companies` 2. Click New 3. Fill form 4. Save | Company created | [ ] | |
| Edit company | 1. Open company 2. Edit 3. Save | Changes saved | [ ] | |
| Link to deal | 1. Open deal 2. Add company association | Company linked | [ ] | |
| Delete company | 1. Delete company | Company removed | [ ] | |

### 6.3 Contacts

| Test | Steps | Expected | Status | Notes |
|------|-------|----------|--------|-------|
| Create contact | 1. Go to `/contacts` 2. Click New 3. Fill form 4. Save | Contact created | [ ] | |
| Edit contact | 1. Open contact 2. Edit 3. Save | Changes saved | [ ] | |
| Link to company | 1. Create/edit contact 2. Associate with company | Contact linked | [ ] | |
| Delete contact | 1. Delete contact | Contact removed | [ ] | |

### 6.4 Tasks

| Test | Steps | Expected | Status | Notes |
|------|-------|----------|--------|-------|
| Create task | 1. Go to `/tasks` 2. Click New Task 3. Fill form 4. Save | Task created | [ ] | |
| Set due date | 1. Create/edit task 2. Set due date | Due date saved | [ ] | |
| Mark complete | 1. Check task checkbox | Task marked complete | [ ] | |
| Delete task | 1. Delete task | Task removed | [ ] | |

---

## Phase 7: Share Link Tests

### 7.1 Create Share Link

| Test | Steps | Expected | Status | Notes |
|------|-------|----------|--------|-------|
| Basic share link | 1. Open document 2. Generate share link | URL generated | [ ] | |
| Set expiration | 1. Set expiration date 2. Save | Expiration saved | [ ] | |
| Enable password | 1. Enable password protection 2. Set password | Password enabled | [ ] | |
| Enable NDA | 1. Enable NDA requirement | NDA enabled | [ ] | |

### 7.2 Access Share Link

| Test | Steps | Expected | Status | Notes |
|------|-------|----------|--------|-------|
| Public access | 1. Open share link in incognito | Document loads | [ ] | |
| Password prompt | 1. Access password-protected link | Password form shown | [ ] | |
| Correct password | 1. Enter correct password | Document loads | [ ] | |
| Wrong password | 1. Enter wrong password | Error shown | [ ] | |
| NDA signing | 1. Access NDA-protected link 2. Sign NDA | Access granted after signing | [ ] | |
| Download from share | 1. Access share link 2. Click download | File downloads | [ ] | |

---

## Phase 8: File Upload Tests

### 8.1 Document Uploads

| Test | Steps | Expected | Status | Notes |
|------|-------|----------|--------|-------|
| Upload to data room | 1. Go to `/data-room` 2. Upload file | File uploaded, appears in list | [ ] | |
| Upload financial file | 1. Open document 2. Upload financial file | File attached | [ ] | |
| Progress indicator | 1. Upload large file | Progress bar shows | [ ] | |
| Download file | 1. Click download on uploaded file | File downloads | [ ] | |
| Delete file | 1. Delete uploaded file | File removed | [ ] | |

### 8.2 Image Uploads

| Test | Steps | Expected | Status | Notes |
|------|-------|----------|--------|-------|
| Upload logo | 1. Edit document 2. Upload logo | Logo displays | [ ] | |
| Upload section image | 1. Edit section 2. Add image | Image displays | [ ] | |
| Image persistence | 1. Upload image 2. Refresh page | Image still shows | [ ] | |

---

## Phase 9: E-Signature Flow Tests

### 9.1 NDA Template Management

| Test | Steps | Expected | Status | Notes |
|------|-------|----------|--------|-------|
| View templates | 1. Go to `/esign/templates` | Template list loads | [ ] | |
| Create template | 1. Click New Template 2. Fill form 3. Save | Template created | [ ] | |
| Edit template | 1. Open template 2. Edit 3. Save | Changes saved | [ ] | |
| Delete template | 1. Delete template | Template removed | [ ] | |

### 9.2 Signing Session

| Test | Steps | Expected | Status | Notes |
|------|-------|----------|--------|-------|
| Create session | 1. Go to `/esign/send` 2. Select document 3. Add recipient | Session created | [ ] | |
| Add recipients | 1. Add multiple recipients | All recipients added | [ ] | |
| Send for signing | 1. Click Send | Session sent, status updates | [ ] | |

### 9.3 Recipient Signing (Simulate)

| Test | Steps | Expected | Status | Notes |
|------|-------|----------|--------|-------|
| Signing page loads | 1. Access signing link | Signing page loads | [ ] | |
| View document | 1. On signing page, view document | Document displays | [ ] | |
| Complete signature | 1. Sign in signature field 2. Submit | Signature captured | [ ] | |

### 9.4 Signature Verification

| Test | Steps | Expected | Status | Notes |
|------|-------|----------|--------|-------|
| View signed NDA | 1. Check envelope detail | Signed document visible | [ ] | |
| Audit log | 1. View audit trail | Signing events logged | [ ] | |

---

## Phase 10: Stripe Payment Flow Tests

**Prerequisites:** Stripe test mode enabled, use test card `4242 4242 4242 4242`

### 10.1 Billing Page

| Test | Steps | Expected | Status | Notes |
|------|-------|----------|--------|-------|
| Page loads | 1. Go to `/settings/billing` | Billing page loads | [ ] | |
| Current plan shown | 1. View current subscription | Plan displays correctly | [ ] | |
| Upgrade options | 1. View available plans | Plans and pricing shown | [ ] | |

### 10.2 Subscription Flow

| Test | Steps | Expected | Status | Notes |
|------|-------|----------|--------|-------|
| Select plan | 1. Click upgrade on a plan | Checkout initiates | [ ] | |
| Stripe checkout | 1. Stripe checkout loads | Checkout form displays | [ ] | |
| Test payment | 1. Enter `4242 4242 4242 4242` 2. Complete | Payment succeeds | [ ] | |
| Plan updates | 1. After payment, check plan | New plan active | [ ] | |

### 10.3 Subscription Management

| Test | Steps | Expected | Status | Notes |
|------|-------|----------|--------|-------|
| View details | 1. View subscription details | Details correct | [ ] | |
| Cancel subscription | 1. Cancel subscription | Cancellation processed | [ ] | |
| Feature access | 1. Check premium features | Access matches plan | [ ] | |

---

## Phase 11: API Health Checks

Test API endpoints return expected responses.

| Endpoint | Method | Expected Response | Status | Notes |
|----------|--------|-------------------|--------|-------|
| `/api/user` | GET | Current user object | [ ] | |
| `/api/cim` | GET | Array of documents | [ ] | |
| `/api/crm/deals` | GET | Array of deals | [ ] | |
| `/api/crm/companies` | GET | Array of companies | [ ] | |
| `/api/crm/contacts` | GET | Array of contacts | [ ] | |
| `/api/crm/tasks` | GET | Array of tasks | [ ] | |
| `/api/esign/templates` | GET | Array of templates | [ ] | |
| `/api/esign/envelopes` | GET | Array of envelopes | [ ] | |

---

## Phase 12: Error Handling Tests

| Test | Steps | Expected | Status | Notes |
|------|-------|----------|--------|-------|
| 404 page | 1. Navigate to `/invalid-route` | Custom 404 page shows | [ ] | |
| API error display | 1. Trigger API error | User-friendly error shown | [ ] | |
| Form validation | 1. Submit invalid form data | Validation errors display | [ ] | |
| Network error | 1. Disconnect network 2. Try action | Error handled gracefully | [ ] | |

---

## Test Summary

### Results

| Category | Total | Passed | Failed | Skipped |
|----------|-------|--------|--------|---------|
| Prerequisites | 5 | | | |
| Page Load - Public | 7 | | | |
| Page Load - Authenticated | 13 | | | |
| Page Load - CRM | 4 | | | |
| Page Load - E-Sign | 5 | | | |
| Page Load - Settings | 15 | | | |
| Authentication | 10 | | | |
| Documents | 14 | | | |
| CRM | 16 | | | |
| Share Links | 10 | | | |
| File Uploads | 8 | | | |
| E-Signature | 10 | | | |
| Stripe Payments | 9 | | | |
| API Health | 8 | | | |
| Error Handling | 4 | | | |
| **TOTAL** | **128** | | | |

### Overall Result

- [ ] **PASS** - All critical tests passed
- [ ] **FAIL** - One or more critical tests failed

### Failures Summary

List any failures here with links to details:

1.
2.
3.

---

## Agent Execution Guide

### Prerequisites
1. Ensure the app is running: `npm run dev`
2. Have browser automation available (agent-browser, Playwright MCP, etc.)
3. Copy TEST-RESULTS-TEMPLATE.md to `results/YYYY-MM-DD-test-run.md`

### Execution Flow
1. Start at Phase 1 (Prerequisites)
2. Execute each test section sequentially
3. For each test:
   - Navigate to the URL/perform the action
   - Check for console errors (open DevTools → Console)
   - Check network tab for failed requests (DevTools → Network, filter by errors)
   - Mark `[x]` for pass, `[!]` for fail
   - Document any failures with details in Notes column
4. If a test fails:
   - Check TROUBLESHOOTING-GUIDE.md for known fixes
   - Apply fix if possible
   - Re-run the failed test
   - Document resolution
5. Generate summary in Test Summary section
6. Save results to `results/` folder

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
- Note test account email used (in Phase 2)
- Do NOT delete test data (useful for debugging)
- Save results file with date in filename

---

*Checklist version 1.0 - Created 2026-02-04*
