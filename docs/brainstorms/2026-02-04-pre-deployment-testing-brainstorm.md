# Pre-Deployment Testing Plan Brainstorm

**Date:** 2026-02-04
**Status:** Ready for planning
**Type:** Quality Assurance / Testing Infrastructure

## What We're Building

A comprehensive **manual test checklist** that an agent can follow to verify BrokerVault functionality before deployment. The checklist will:

1. Catch 404 errors and broken pages
2. Verify critical user flows work end-to-end
3. Document how to fix common issues when found
4. Be runnable against local development environment
5. Use freshly created test accounts and data

## Why This Approach

**Manual checklist over automation because:**
- No existing test infrastructure to build on
- Faster to implement and iterate
- Agent can use browser tools to follow checklist
- Can document fixes alongside failures in real-time
- Lower maintenance burden than automated tests

## Key Test Categories

### 1. Page Load Tests (No 404s)
Verify every route loads without errors.

**Public Pages (No Auth Required):**
- [ ] `/` - Home page
- [ ] `/pricing` - Pricing page
- [ ] `/login` - Login page
- [ ] `/register` - Registration page
- [ ] `/privacy-policy` - Privacy policy
- [ ] `/terms-of-service` - Terms of service
- [ ] `/eula` - EULA
- [ ] `/cookies-policy` - Cookies policy
- [ ] `/features/virtual-data-room` - Feature page
- [ ] `/features/nda-protection` - Feature page
- [ ] `/features/investor-database` - Feature page

**Authenticated Pages:**
- [ ] `/dashboard` - Main dashboard
- [ ] `/documents` - Document list
- [ ] `/data-room` - Data room
- [ ] `/deals` - Deals list (CRM)
- [ ] `/companies` - Companies list (CRM)
- [ ] `/contacts` - Contacts list (CRM)
- [ ] `/tasks` - Tasks list (CRM)
- [ ] `/messages` - Messages
- [ ] `/esign` - E-signature
- [ ] `/investor-database` - Investor database
- [ ] `/sde-analyzer` - SDE analyzer
- [ ] `/integrations` - Integrations
- [ ] `/webhooks` - Webhooks

**Settings Pages:**
- [ ] `/settings` - Settings root
- [ ] `/settings/profile` - Profile settings
- [ ] `/settings/branding` - Branding
- [ ] `/settings/branding/pdf` - PDF branding
- [ ] `/settings/branding/online` - Online branding
- [ ] `/settings/email` - Email settings
- [ ] `/settings/smtp` - SMTP configuration
- [ ] `/settings/team` - Team management
- [ ] `/settings/crm-visibility` - CRM visibility
- [ ] `/settings/custom-fields` - Custom fields
- [ ] `/settings/pipelines` - Pipeline settings
- [ ] `/settings/billing` - Billing
- [ ] `/settings/data` - Data management

### 2. Authentication Flow Tests

**Registration:**
- [ ] Can register new account with email/password
- [ ] Email validation works (rejects invalid emails)
- [ ] Password requirements enforced
- [ ] Redirects to dashboard after registration
- [ ] User profile is created correctly

**Login:**
- [ ] Can login with valid credentials
- [ ] Invalid credentials show error message
- [ ] Session persists after page refresh
- [ ] Logout works and clears session

**Protected Routes:**
- [ ] Unauthenticated users redirected to login
- [ ] After login, redirected back to intended page

### 3. Document (CIM) Workflow Tests

**Create Document:**
- [ ] Can create new CIM from dashboard
- [ ] AI generation from URL works
- [ ] Manual document creation works
- [ ] Document appears in document list
- [ ] Can open/view created document

**Edit Document:**
- [ ] Can edit document title
- [ ] Can edit company information
- [ ] Can add/edit sections
- [ ] Changes persist after save
- [ ] Can upload logo/images

**Share Document:**
- [ ] Can generate share link
- [ ] Share link is accessible without auth
- [ ] Password protection works (if enabled)
- [ ] NDA requirement works (if enabled)
- [ ] View tracking records visits

**Export Document:**
- [ ] PDF export downloads successfully
- [ ] Word export downloads successfully
- [ ] Exported files are not corrupted

**Delete Document:**
- [ ] Can delete document
- [ ] Document removed from list
- [ ] Share links stop working

### 4. CRM Workflow Tests

**Deals:**
- [ ] Can create new deal
- [ ] Can edit deal details
- [ ] Can move deal through pipeline stages
- [ ] Can delete deal
- [ ] Deal list displays correctly

**Companies:**
- [ ] Can create new company
- [ ] Can edit company details
- [ ] Can link company to deal
- [ ] Can delete company

**Contacts:**
- [ ] Can create new contact
- [ ] Can edit contact details
- [ ] Can link contact to company
- [ ] Can delete contact

**Tasks:**
- [ ] Can create new task
- [ ] Can set due date
- [ ] Can mark task complete
- [ ] Can delete task
- [ ] Task reminders display correctly

### 5. Share Link Tests

**Create Share Link:**
- [ ] Can create share link for document
- [ ] Can set expiration date
- [ ] Can enable/disable password
- [ ] Can enable/disable NDA requirement
- [ ] Link URL is generated

**Access Share Link:**
- [ ] Link loads document view
- [ ] Password prompt appears if protected
- [ ] NDA signing flow works if required
- [ ] Document content displays correctly
- [ ] Download buttons work

### 6. File Upload Tests

**Document Uploads:**
- [ ] Can upload files to data room
- [ ] Can upload financial files
- [ ] Progress indicator shows during upload
- [ ] File appears after upload completes
- [ ] Can download uploaded file
- [ ] Can delete uploaded file

**Image Uploads:**
- [ ] Can upload logo
- [ ] Can upload section images
- [ ] Images display correctly after upload

### 7. API Health Checks

**Core Endpoints:**
- [ ] `GET /api/user` - Returns current user
- [ ] `GET /api/cim` - Returns document list
- [ ] `GET /api/crm/deals` - Returns deals
- [ ] `GET /api/crm/companies` - Returns companies
- [ ] `GET /api/crm/contacts` - Returns contacts
- [ ] `GET /api/crm/tasks` - Returns tasks

### 8. E-Signature Flow Tests

**E-Sign Pages:**
- [ ] `/esign` - E-signature dashboard loads
- [ ] `/esign/templates` - Templates list loads
- [ ] `/esign/envelopes` - Envelopes list loads

**NDA Template Management:**
- [ ] Can view list of NDA templates
- [ ] Can create new NDA template
- [ ] Can edit existing template
- [ ] Can delete template
- [ ] Template fields save correctly

**Signing Session Creation:**
- [ ] Can create new signing session for a document
- [ ] Can add recipients to signing session
- [ ] Can assign signature fields to recipients
- [ ] Can send NDA to recipients
- [ ] Session status updates correctly

**Recipient Signing Flow:**
- [ ] Recipient receives signing link (check via test)
- [ ] Signing page loads without errors
- [ ] Recipient can view document
- [ ] Recipient can sign document
- [ ] Signature is captured and saved
- [ ] Post-signing redirect works

**Signature Verification:**
- [ ] Signed NDAs appear in signatures list
- [ ] Can view signed document
- [ ] Audit log records signing events
- [ ] Signed documents grant access to protected content

**NDA Access Control:**
- [ ] Document requires NDA when enabled
- [ ] Signed users can access protected document
- [ ] Unsigned users cannot access protected content
- [ ] Access tokens work correctly

### 9. Stripe Payment Flow Tests

**Prerequisites:**
- Stripe test mode enabled
- Test API keys configured
- Test card numbers available (4242 4242 4242 4242)

**Billing Page:**
- [ ] `/settings/billing` - Billing page loads
- [ ] Current plan displays correctly
- [ ] Usage/limits display correctly
- [ ] Upgrade options are visible

**Subscription Flow:**
- [ ] Can select a plan to upgrade
- [ ] Stripe checkout modal/redirect works
- [ ] Can enter test card details
- [ ] Payment processes successfully
- [ ] User plan updates after payment
- [ ] Confirmation shown to user

**Subscription Management:**
- [ ] Can view subscription details
- [ ] Can access customer portal (if available)
- [ ] Can cancel subscription
- [ ] Downgrade reflects in feature access

**Webhook Handling:**
- [ ] Stripe webhook endpoint responds (`POST /api/webhook/stripe`)
- [ ] Subscription created events update user
- [ ] Payment failed events handled gracefully
- [ ] Subscription cancelled events update access

**Feature Gating:**
- [ ] Free users see upgrade prompts
- [ ] Premium features locked for free users
- [ ] Premium features accessible after upgrade
- [ ] Usage limits enforced correctly

### 10. Error Handling Tests

**Expected Behaviors:**
- [ ] 404 page shows for invalid routes
- [ ] Error boundary catches component errors
- [ ] API errors show user-friendly messages
- [ ] Form validation errors display clearly

## Common Issues & Fixes

### 404 Errors

| Issue | Likely Cause | Fix |
|-------|--------------|-----|
| Page route returns 404 | Route not registered in App.tsx | Add route to router configuration |
| API endpoint 404 | Endpoint not registered in server | Add route to appropriate routes file |
| Static asset 404 | File missing or wrong path | Check public folder, verify import path |
| Share link 404 | Invalid slug or deleted document | Verify document exists, check shareSlug |

### Authentication Issues

| Issue | Likely Cause | Fix |
|-------|--------------|-----|
| Login redirect loop | Session not persisting | Check cookie settings, database session table |
| Protected route accessible | Missing auth middleware | Add `requireAuth` middleware to route |
| User data not loading | Session user mismatch | Check user caching, session retrieval |

### Document Issues

| Issue | Likely Cause | Fix |
|-------|--------------|-----|
| Document not saving | Validation error or DB issue | Check Drizzle schema, API error logs |
| Export fails | PDF generation error | Check puppeteer/jsPDF dependencies |
| Images not loading | S3/storage URL issue | Verify storage configuration, CORS settings |

### CRM Issues

| Issue | Likely Cause | Fix |
|-------|--------------|-----|
| Records not showing | Query filter issue | Check userId/orgId filters in query |
| Create fails | Missing required fields | Verify form sends all required fields |
| Delete fails | Foreign key constraint | Check cascade delete settings |

### E-Signature Issues

| Issue | Likely Cause | Fix |
|-------|--------------|-----|
| NDA template not saving | Missing required fields | Check template schema, required fields |
| Signing page won't load | Invalid/expired token | Check ndaAccessTokens table, regenerate token |
| Signature not capturing | Canvas/form issue | Check browser console for JS errors |
| Recipient not receiving link | Email not sent | Check SendGrid integration, email logs |
| Signed user still blocked | Access token not created | Verify ndaSignatures record, check access flow |
| Audit log empty | Logging not triggered | Check ndaAuditLog insert calls in signing flow |

### Stripe Payment Issues

| Issue | Likely Cause | Fix |
|-------|--------------|-----|
| Checkout not loading | Invalid Stripe key | Verify STRIPE_PUBLISHABLE_KEY in env |
| Payment fails | Test card not accepted | Use Stripe test cards (4242...), check API key mode |
| Plan not updating | Webhook not received | Check webhook endpoint, Stripe webhook logs |
| Webhook 400 error | Invalid signature | Verify STRIPE_WEBHOOK_SECRET matches |
| Features still locked | User cache stale | Clear user cache, refresh session |
| Portal not accessible | Customer not created | Ensure Stripe customer ID stored on user |

## Test Execution Instructions

### Prerequisites
1. App running locally (`npm run dev` or similar)
2. Database seeded/migrated
3. Browser with dev tools available

### Running Tests
1. Start at the top of each category
2. Check each item, marking pass/fail
3. For failures: note the error, check console, check network tab
4. Document fix if resolved, or escalate if blocked

### Test Account Creation
1. Navigate to `/register`
2. Use test email format: `test-YYYYMMDD-HHMM@example.com`
3. Use standard test password
4. Complete registration flow
5. Use this account for all authenticated tests

## Success Criteria

- All public pages load without 404
- All authenticated pages load when logged in
- Core workflows complete without errors:
  - Register → Login → Create Document → Share → Access Share Link
  - Create Deal → Add Company → Add Contact → Create Task
  - Create NDA Template → Send for Signing → Complete Signing → Access Protected Content
  - View Billing → Upgrade Plan (test mode) → Verify Feature Access
- No console errors on any page
- All API endpoints return expected data
- E-signature flow completes end-to-end
- Stripe test payments process successfully

## Scope Decisions

**In Scope:**
- All page load tests (public and authenticated)
- Authentication flows
- Document (CIM) workflows
- CRM workflows (deals, companies, contacts, tasks)
- Share link creation and access
- File uploads
- E-signature/NDA flows (native implementation)
- Stripe payment flows (test mode)
- API health checks
- Error handling

**Out of Scope:**
- Chrome extension testing
- SendGrid email delivery verification (can't easily test without real emails)
- DocuSign external integration (separate from native NDA signing)
- Cross-browser testing (Chrome only for now)

## Open Questions

1. What Stripe test account/keys should be used?
2. Should we test team/multi-user collaboration scenarios?
3. Are there specific edge cases in document generation to test?

## Next Steps

1. Run `/workflows:plan` to create implementation plan
2. Create the actual test checklist document
3. Create agent instructions for running tests
4. Optionally create a test results template

---

*This brainstorm was created to establish pre-deployment QA testing for BrokerVault.*
