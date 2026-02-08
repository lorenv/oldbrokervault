# Domain Configuration Implementation Roadmap

## Overview

This document provides a step-by-step implementation plan to convert the current scattered domain references into a centralized configuration system. Estimated effort: 4-6 weeks.

---

## Phase 1: Foundation Setup (Week 1)

### 1.1 Create Core Configuration Modules

#### Task 1.1.1: Create `server/config/domain-config.ts`

**Estimated effort:** 2 hours

**Deliverables:**
- Core `DOMAIN_CONFIG` constant with all domain/URL/email information
- Loads from environment variables with sensible defaults
- TypeScript types for configuration

**Definition of Done:**
- [ ] File created with all fields from the existing domain migration checklist
- [ ] All environment variables documented
- [ ] TypeScript types are strict and immutable (`as const`)
- [ ] Unit tests verify configuration loading

**Code to Create:**
```typescript
// See PREVENTION-STRATEGIES.md section 1.1 for full implementation
```

#### Task 1.1.2: Create `server/config/env-loader.ts`

**Estimated effort:** 1 hour

**Deliverables:**
- Centralized environment variable loading
- Validation of required variables
- Clear error messages for missing config

**Definition of Done:**
- [ ] Validates all required env vars on startup
- [ ] Provides helpful error messages
- [ ] Testable with mock environment
- [ ] Called during application initialization

#### Task 1.1.3: Create `.env.example`

**Estimated effort:** 30 minutes

**Deliverables:**
- Complete template of all required and optional environment variables
- Clear documentation of each variable
- Version-controlled reference for new developers

**Definition of Done:**
- [ ] Lists all domain-related variables
- [ ] Lists all email-related variables
- [ ] Includes sensible defaults
- [ ] Includes Vite client-side variables

### 1.2 Update Existing Environment Files

#### Task 1.2.1: Merge .env.example into .env

**Estimated effort:** 30 minutes

**Deliverables:**
- Updated .env file with all variables from template
- Proper values for current production domain

**Definition of Done:**
- [ ] All DOMAIN_CONFIG variables set
- [ ] All email variables set
- [ ] No undefined values in critical config
- [ ] File passes validation

### 1.3 Add Configuration Validation

#### Task 1.3.1: Create `server/config/validate-config.ts`

**Estimated effort:** 2 hours

**Deliverables:**
- Pre-deployment validation script
- Checks for common configuration errors
- Can be run during build process

**Definition of Done:**
- [ ] Validates domain format
- [ ] Validates email addresses
- [ ] Validates URL format
- [ ] Provides clear error messages
- [ ] Can be called as npm script

#### Task 1.3.2: Add npm script for validation

**Estimated effort:** 30 minutes

**Deliverables:**
- `npm run validate-config` command

**Definition of Done:**
- [ ] Script added to package.json
- [ ] Can be run locally
- [ ] Part of build process
- [ ] Part of CI/CD pipeline

**Result of Phase 1:**
- All configuration centralized in one module
- Environment variables properly documented
- Validation in place before deployment
- Ready for phase 2 service layer

---

## Phase 2: Service Layer (Week 2)

### 2.1 Create Email Configuration Service

#### Task 2.1.1: Create `server/config/email-config.ts`

**Estimated effort:** 1.5 hours

**Deliverables:**
- Centralized email address constants
- Email configuration defaults
- Type-safe email address getter function

**Definition of Done:**
- [ ] All email addresses exported as constants
- [ ] `EMAIL_CONFIG` object with defaults
- [ ] Type-safe email getter function
- [ ] Comments explaining each email purpose

### 2.2 Create URL Generation Utilities

#### Task 2.2.1: Create `shared/url-generation.ts`

**Estimated effort:** 2 hours

**Deliverables:**
- URL generator class with static methods
- Generates all types of URLs used in app
- Works on both client and server

**Definition of Done:**
- [ ] `URLGenerator` class created
- [ ] Methods for all URL types (share, nda, signing, etc.)
- [ ] Handles subdomains correctly
- [ ] Thread email generation
- [ ] OAuth callback URLs
- [ ] Unit tests for all methods

#### Task 2.2.2: Create client-side version

**Estimated effort:** 1.5 hours

**Deliverables:**
- `client/src/lib/domain-config.ts` with client-side configuration
- Mirrors server configuration
- Uses Vite environment variables

**Definition of Done:**
- [ ] Client domain config created
- [ ] Uses VITE_* environment variables
- [ ] Matches server configuration
- [ ] Works in development and production

**Result of Phase 2:**
- Email addresses no longer scattered
- URL generation centralized
- Ready to refactor existing code

---

## Phase 3: Automation (Week 2-3)

### 3.1 Static File Generation

#### Task 3.1.1: Create `scripts/generate-static-files.ts`

**Estimated effort:** 2 hours

**Deliverables:**
- Script that generates robots.txt from template
- Script that generates sitemap.xml from template
- Uses domain config for URLs

**Definition of Done:**
- [ ] robots.txt generation works
- [ ] sitemap.xml generation works
- [ ] Uses DOMAIN_CONFIG for URLs
- [ ] Can be run as npm script
- [ ] Part of build process

#### Task 3.1.2: Add to build process

**Estimated effort:** 1 hour

**Deliverables:**
- npm script for generating static files
- Integrated into `npm run build`

**Definition of Done:**
- [ ] `npm run generate-static-files` works
- [ ] Runs before other build steps
- [ ] Generates correct URLs
- [ ] No hardcoded domains in output

### 3.2 Add Pre-Commit Hooks

#### Task 3.2.1: Create `.husky/pre-commit`

**Estimated effort:** 1.5 hours

**Deliverables:**
- Pre-commit hook preventing hardcoded domains
- Runs config validation before commit

**Definition of Done:**
- [ ] Hook prevents commits with hardcoded domains
- [ ] Hook runs validation
- [ ] Clear error messages
- [ ] Developers can override if necessary

**Result of Phase 3:**
- Build process validates configuration
- Static files generated from templates
- Developers prevented from hardcoding domains
- Ready for refactoring phase

---

## Phase 4: Code Refactoring (Weeks 3-6)

This is the largest phase. Work through these files systematically, testing as you go.

### 4.1 Server-Side Routes (Week 3)

#### Task 4.1.1: Update `server/routes.ts`

**Estimated effort:** 4-6 hours

**Changes:**
- Replace `process.env.BASE_URL || 'https://brokervault.ai'` with `DOMAIN_CONFIG.appUrl`
- Replace hardcoded email addresses with `EMAIL_ADDRESSES.*`
- Replace hardcoded URLs with `urlGenerator.*` methods

**Definition of Done:**
- [ ] All domain references updated
- [ ] All email references updated
- [ ] All URL generation uses URLGenerator
- [ ] No `process.env.BASE_URL` references remain
- [ ] Tests pass
- [ ] Code review completed

**Validation:**
```bash
grep -n "process.env.BASE_URL\|'https://brokervault.ai'\|'https://cimshare.com'" server/routes.ts
# Should return only comments or test examples
```

### 4.2 Email System (Week 3)

#### Task 4.2.1: Update `server/email.ts`

**Estimated effort:** 4-6 hours

**Changes:**
- Replace all hardcoded `from:` addresses with constants
- Replace all hardcoded `replyTo:` addresses with constants
- Replace all hardcoded URLs with URLGenerator
- Update base URL fallbacks

**Definition of Done:**
- [ ] No hardcoded from addresses
- [ ] No hardcoded replyTo addresses
- [ ] All URLs generated via URLGenerator
- [ ] Tests pass
- [ ] Email templates send correctly

#### Task 4.2.2: Update `server/email-service.ts`

**Estimated effort:** 1 hour

**Changes:**
- Replace `'support@brokervault.ai'` with `EMAIL_CONFIG.DEFAULT_FROM`

#### Task 4.2.3: Update `server/message-service.ts`

**Estimated effort:** 2 hours

**Changes:**
- Replace thread email generation with centralized function
- Use URLGenerator for thread email addresses
- Update regex patterns

**Definition of Done:**
- [ ] Thread emails generated correctly
- [ ] Uses `EMAIL_CONFIG.THREAD_EMAIL_DOMAIN`
- [ ] Message threading still works

#### Task 4.2.4: Update other email files

**Estimated effort:** 2 hours

Files to update:
- `server/daily-signup-summary.ts`
- `server/onboarding-email-system.ts`
- `server/sde-processor.ts`
- `server/services/esignature-service.ts`

**Changes:**
- Replace `from: 'support@brokervault.ai'` with constants
- Replace URLs with URLGenerator

### 4.3 Email Templates (Week 3)

#### Task 4.3.1: Update `server/email-templates/email-components.ts`

**Estimated effort:** 1.5 hours

**Changes:**
- Replace logo URLs with URLGenerator
- Replace footer links with URLGenerator
- Replace support email with constant

#### Task 4.3.2: Update `server/email-templates/canspam-footer.ts`

**Estimated effort:** 1 hour

**Changes:**
- Replace preference links with URLGenerator

### 4.4 OAuth & Integrations (Week 4)

#### Task 4.4.1: Update OAuth providers

**Estimated effort:** 1 hour per provider (4 total)

Files:
- `server/integrations/providers/microsoft.ts`
- `server/integrations/providers/gmail.ts`
- `server/integrations/providers/slack.ts`
- `server/integrations/providers/hubspot.ts`

**Changes:**
- Replace redirect URLs with `DOMAIN_CONFIG.oauth.*`

**Definition of Done:**
- [ ] All OAuth callbacks use domain config
- [ ] No `process.env.BASE_URL ||` patterns remain
- [ ] OAuth login still works

#### Task 4.4.2: Update error reporting

**Estimated effort:** 30 minutes

Files:
- `server/error-reporter.ts`

**Changes:**
- Replace `'rob@cimshare.com'` and `'alerts@cimshare.com'` with constants

### 4.5 Core Services (Week 4)

#### Task 4.5.1: Update `server/seo-routes.ts`

**Estimated effort:** 30 minutes

#### Task 4.5.2: Update `server/stripe.ts`

**Estimated effort:** 1 hour

**Changes:**
- Replace redirect URLs with URLGenerator

#### Task 4.5.3: Update `server/ssr-renderer.ts`

**Estimated effort:** 1 hour

**Changes:**
- Replace email addresses with constants

#### Task 4.5.4: Update other service files

**Estimated effort:** 2 hours

Files:
- `server/services/unsubscribe-service.ts`
- `server/document-export.ts`
- `server/task-reminder-system.ts`

### 4.6 Client-Side Pages (Week 4-5)

#### Task 4.6.1: Update page files

**Estimated effort:** 6-8 hours

Files (organized by priority):

**High Priority (SEO/Core):**
- `client/src/pages/home-page.tsx`
- `client/src/pages/documents-page.tsx`
- `client/src/pages/pricing-page.tsx`
- `client/src/pages/contact-page.tsx`

**Medium Priority (Legal):**
- `client/src/pages/privacy-policy-page.tsx`
- `client/src/pages/terms-of-service-page.tsx`
- `client/src/pages/cookie-policy-page.tsx`
- `client/src/pages/eula-page.tsx`

**Lower Priority:**
- `client/src/pages/sde-analyzer-page.tsx`
- `client/src/pages/account-page.tsx`
- `client/src/pages/register-page.tsx`
- All feature and solution pages

**Changes:**
- Replace hardcoded canonical URLs
- Replace hardcoded support emails
- Replace hardcoded demo links with URLGenerator

### 4.7 Client-Side Components (Week 5)

#### Task 4.7.1: Update components

**Estimated effort:** 3-4 hours

Files:
- `client/src/components/share-settings-dialog.tsx`
- `client/src/components/document-export.tsx`
- `client/src/components/document-tabs/nda-tab.tsx`
- `client/src/components/document-tabs/edit-tab.tsx`
- `client/src/components/error-boundary.tsx`

**Changes:**
- Replace subdomain display with config
- Replace URL generation with URLGenerator
- Replace email addresses with constants

### 4.8 Static Files (Week 5)

#### Task 4.8.1: Update `client/index.html`

**Estimated effort:** 1 hour

**Changes:**
- Canonical URL (can be dynamic or use build-time generation)
- OG tags with correct domain
- Copyright year

#### Task 4.8.2: Regenerate `client/public/robots.txt`

**Estimated effort:** 30 minutes

**Changes:**
- Run generation script

#### Task 4.8.3: Regenerate `client/public/sitemap.xml`

**Estimated effort:** 30 minutes

**Changes:**
- Run generation script

### 4.9 E-Signature Routes (Week 5)

#### Task 4.9.1: Update esignature routes

**Estimated effort:** 2 hours

Files:
- `server/routes/esign/esign-envelope-routes.ts`
- `server/routes/esign/esign-powerform-routes.ts`

**Changes:**
- Replace signing URLs with URLGenerator
- Replace base URL fallbacks with config

### 4.10 Remaining Files (Week 5-6)

#### Task 4.10.1: Update any remaining files

**Estimated effort:** 2-3 hours

Files likely to have references:
- `server/image-helpers.ts`
- `server/task-reminder-system.ts`
- `chrome-extension/*` (if applicable)

**Result of Phase 4:**
- All hardcoded domain references replaced
- All configuration centralized
- All URLs generated via utility functions
- All emails use constants

---

## Phase 5: Testing & Deployment (Week 6)

### 5.1 Comprehensive Testing

#### Task 5.1.1: Write integration tests

**Estimated effort:** 4-6 hours

**Test areas:**
- Configuration loading
- URL generation for all types
- Email address constants
- Environment variable overrides
- Subdomain handling

**Test structure:**
```typescript
// server/config/__tests__/domain-config.test.ts
describe('Domain Configuration', () => {
  it('loads from environment variables', () => { ... });
  it('uses defaults when env vars missing', () => { ... });
  it('validates required configuration', () => { ... });
});

// shared/__tests__/url-generation.test.ts
describe('URL Generation', () => {
  it('generates share URLs correctly', () => { ... });
  it('generates NDA URLs correctly', () => { ... });
  it('handles subdomains', () => { ... });
});
```

#### Task 5.1.2: Verification script

**Estimated effort:** 1 hour

Create script to verify all changes:
```bash
npm run verify-domain-config
```

This should:
- Run validation
- Check for any remaining hardcoded domains
- Verify all imports use centralized config
- List any files that still need updating

### 5.2 Documentation

#### Task 5.2.1: Update README

**Estimated effort:** 1 hour

Add section on domain configuration

#### Task 5.2.2: Create migration guide

**Estimated effort:** 1 hour

Document for next migration (already done in PREVENTION-STRATEGIES.md)

### 5.3 Staging Deployment

#### Task 5.3.1: Deploy to staging

**Estimated effort:** 2-4 hours

**Verification checklist:**
- [ ] Application starts without errors
- [ ] Config validation passes
- [ ] All URLs use correct domain
- [ ] All emails send from correct address
- [ ] OAuth flows work
- [ ] Message threading works
- [ ] No hardcoded domain references in logs
- [ ] Error reporting sends to correct email
- [ ] SEO meta tags use correct domain

### 5.4 Production Deployment

#### Task 5.4.1: Deploy to production

**Estimated effort:** 2-4 hours

**Pre-deployment:**
- [ ] Run full test suite
- [ ] Run validation script
- [ ] All environment variables set
- [ ] Database migrations (if any)

**Post-deployment:**
- [ ] Monitor error logs for 24 hours
- [ ] Verify email sending
- [ ] Check analytics on new domain
- [ ] Monitor for broken links

**Result of Phase 5:**
- All code tested and verified
- Documentation complete
- Production deployment successful
- Architecture ready for future migrations

---

## Timeline Summary

| Phase | Duration | Tasks | Status |
|-------|----------|-------|--------|
| Phase 1: Foundation | Week 1 | Core config modules, env setup, validation | Estimated 8-10 hours |
| Phase 2: Services | Week 2 | Email config, URL generation, client config | Estimated 8-10 hours |
| Phase 3: Automation | Week 2-3 | Static generation, pre-commit hooks, build integration | Estimated 5-6 hours |
| Phase 4: Refactoring | Weeks 3-6 | Update 50+ files across server/client | Estimated 30-40 hours |
| Phase 5: Testing | Week 6 | Integration tests, verification, deployment | Estimated 10-12 hours |
| **Total** | **4-6 weeks** | **~61-78 hours** | |

### Parallel Execution Options

To reduce timeline:
- Phases 1-2 must be sequential (foundation before services)
- Phase 3 can run in parallel with Phase 2
- Phase 4 can be parallelized (different developers work on different files)
- Suggested: 2-3 developers, 3-4 weeks

---

## Rollback Plan

If issues arise during deployment:

### Option 1: Revert to Previous Configuration
```bash
git revert <commit-hash>
git push
```

### Option 2: Use Feature Flags
```typescript
const USE_NEW_CONFIG = process.env.USE_NEW_CONFIG === 'true';
const email = USE_NEW_CONFIG ? EMAIL_CONFIG.DEFAULT_FROM : 'support@brokervault.ai';
```

This allows gradual rollout before committing completely.

---

## Success Criteria

Phase 4 is considered complete when:

1. **Code Quality**
   - [ ] No hardcoded domain references (except in comments/docs)
   - [ ] All URLs use URLGenerator
   - [ ] All emails use EMAIL_ADDRESSES or EMAIL_CONFIG
   - [ ] All base URLs use DOMAIN_CONFIG
   - [ ] Code passes linting (including custom no-hardcoded-domains rule)

2. **Functionality**
   - [ ] All tests pass
   - [ ] Application starts without config errors
   - [ ] All existing features work
   - [ ] No broken links in emails
   - [ ] OAuth still works
   - [ ] Message threading still works

3. **Documentation**
   - [ ] PREVENTION-STRATEGIES.md complete
   - [ ] QUICK-REFERENCE-DOMAIN-CONFIG.md complete
   - [ ] Code comments explain centralized pattern
   - [ ] New developers can find domain config easily

4. **Maintainability**
   - [ ] Next domain migration is simple (change 2-3 files)
   - [ ] Configuration is obvious to developers
   - [ ] Validation prevents errors
   - [ ] Pre-commit hooks prevent regressions

---

## Future: Next Domain Migration

With this implementation complete, the next domain migration will:

**Time to migrate: 1-2 hours**

1. Update environment variables (5 min)
2. Update domain config files (5 min)
3. Run validation (1 min)
4. Build and test (10 min)
5. Deploy (5-10 min)
6. Monitor (optional)

Compared to the previous migration which took several days across multiple developers.

---

## Questions & Support

- Escalate blockers to infrastructure team
- Use Slack channel: #infrastructure-team
- Reference documents: PREVENTION-STRATEGIES.md, QUICK-REFERENCE-DOMAIN-CONFIG.md
