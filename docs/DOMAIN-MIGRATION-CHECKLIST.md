# Domain Migration Checklist

> **Purpose**: Track all hardcoded references to `cimshare.com` that need updating when changing domains.
>
> **Generated**: January 2026

---

## Critical Production Code

### Server-Side Files

#### High Priority (Core Functionality)

| File | Lines | What to Update |
|------|-------|----------------|
| `server/routes.ts` | 410, 444, 454, 456, 459, 461, 464, 467, 1174-1177, 1415-1419, 1760, 2250, 6006-6010, 6177-6178, 6223, 6294, 6299, 6974, 8248-8249, 9037-9038, 9131-9132, 9630 | Base URLs, email addresses, webhook info |
| `server/email.ts` | 202-203, 265, 385, 509, 586-587, 605-606, 667, 688, 716, 737-738, 794, 803, 866, 918, 1103-1104, 1232, 1304, 1405, 1502, 1583, 1604, 1609-1610, 1670, 1697, 1714, 1722, 1805, 1819 | All email from/replyTo addresses, URLs in email content |
| `server/message-service.ts` | 27, 55, 525, 533-534, 620-621, 752, 1002-1003 | Thread email addresses `@reply.cimshare.com` |
| `server/stripe.ts` | 184, 187, 287, 290, 370 | Payment redirect URLs |
| `server/email-service.ts` | 29, 66 | Default from email |

#### Medium Priority (Supporting Features)

| File | Lines | What to Update |
|------|-------|----------------|
| `server/error-reporter.ts` | 4-5 | `rob@cimshare.com`, `alerts@cimshare.com` |
| `server/document-export.ts` | 3394, 4252, 4441 | Image/export base URLs |
| `server/routes/esign-routes.ts` | 1509, 2224, 2779, 2866 | Signing URLs |
| `server/sde-processor.ts` | 159, 166 | Support email, download URL |
| `server/task-reminder-system.ts` | 189-190 | Task URLs |
| `server/daily-signup-summary.ts` | 86 | From email |
| `server/onboarding-email-system.ts` | 24 | From email |
| `server/seo-routes.ts` | 14 | Base URL |
| `server/ssr-renderer.ts` | 293 | Support email in HTML |
| `server/services/unsubscribe-service.ts` | 36 | Frontend URL |
| `server/services/esignature-service.ts` | 141, 419, 566 | From emails |
| `server/image-helpers.ts` | 74 | URL comment |

#### OAuth/Integrations

| File | Lines | What to Update |
|------|-------|----------------|
| `server/integrations/providers/microsoft.ts` | 30 | OAuth callback URL |
| `server/integrations/providers/gmail.ts` | 29 | OAuth callback URL |
| `server/integrations/providers/slack.ts` | 29 | OAuth callback URL |
| `server/integrations/providers/hubspot.ts` | 35 | OAuth callback URL |

#### Email Templates

| File | Lines | What to Update |
|------|-------|----------------|
| `server/email-templates/email-components.ts` | 280, 290, 292, 294, 296, 318 | Logo URL, footer links |
| `server/email-templates/canspam-footer.ts` | 21, 43 | Preferences link |

---

### Client-Side Files

#### Critical (SEO/Public)

| File | What to Update |
|------|----------------|
| `client/index.html` | Lines 25, 29, 32, 37, 40 - canonical URL, OG tags |
| `client/public/sitemap.xml` | All 18 URLs |
| `client/public/robots.txt` | Lines 2, 8 - domain comment, sitemap URL |

#### Core Utility (Centralizes Domain Logic)

| File | Lines | What to Update |
|------|-------|----------------|
| `client/src/lib/url-utils.ts` | 5, 24 | `PRODUCTION_DOMAIN` constant - **UPDATE THIS FIRST** |

#### Pages with Hardcoded URLs

| File | Lines | What to Update |
|------|-------|----------------|
| `client/src/pages/documents-page.tsx` | 641, 692, 950, 1001 | Share link clipboard copies |
| `client/src/pages/pricing-page.tsx` | 77, 80, 224, 598 | Contact emails, canonical |
| `client/src/pages/home-page.tsx` | 76, 182, 1188, 1225, 1262, 1299 | Demo links, canonical |
| `client/src/pages/sde-analyzer-page.tsx` | 465 | Support email |
| `client/src/pages/contact-page.tsx` | 66, 176 | Canonical, support email |
| `client/src/pages/checkout-success.tsx` | 130 | Support email |
| `client/src/pages/unsubscribe-page.tsx` | 152, 265 | Support email |
| `client/src/pages/account-page.tsx` | 912, 927 | Subdomain preview |
| `client/src/pages/settings/profile-page.tsx` | 368 | Subdomain suffix |
| `client/src/pages/settings/account-settings-page.tsx` | 543 | Subdomain suffix |

#### Legal/Policy Pages

| File | Lines | What to Update |
|------|-------|----------------|
| `client/src/pages/privacy-policy-page.tsx` | 10, 150, 201, 238 | Canonical, privacy email |
| `client/src/pages/terms-of-service-page.tsx` | 9, 152 | Canonical, legal email |
| `client/src/pages/cookie-policy-page.tsx` | 9, 158 | Canonical, privacy email |
| `client/src/pages/data-security-page.tsx` | 13, 287 | Canonical, privacy email |
| `client/src/pages/eula-page.tsx` | 9, 161 | Canonical, legal email |

#### Feature/Solution Pages

| File | Lines | What to Update |
|------|-------|----------------|
| `client/src/pages/features/ai-powered-cim.tsx` | 61, 131, 155, 179, 207, 796 | Canonical, demo links |
| `client/src/pages/features/*.tsx` | Various | Canonical URLs |
| `client/src/pages/solutions/*.tsx` | Various | Canonical URLs, enterprise email |
| `client/src/pages/virtual-data-room-page.tsx` | 76 | Canonical |
| `client/src/pages/resources-page.tsx` | 39 | Canonical |

#### Components

| File | Lines | What to Update |
|------|-------|----------------|
| `client/src/components/share-settings-dialog.tsx` | 126-127 | Subdomain display |
| `client/src/components/document-export.tsx` | 178, 401, 432, 1183, 1212 | Share URLs, subdomain display |
| `client/src/components/document-tabs/nda-tab.tsx` | 591 | Base URL |
| `client/src/components/document-tabs/edit-tab.tsx` | 48 | Base URL |
| `client/src/components/error-boundary.tsx` | 27 | Comment about error email |

---

## Email Addresses to Update

These need to be updated AND verified in SendGrid for the new domain:

| Address | Purpose |
|---------|---------|
| `system@cimshare.com` | Main transactional sender |
| `support@cimshare.com` | Support communications |
| `signatures@cimshare.com` | E-signature notifications |
| `hello@cimshare.com` | Welcome/marketing emails |
| `privacy@cimshare.com` | Privacy inquiries |
| `legal@cimshare.com` | Legal notices |
| `alerts@cimshare.com` | System alerts |
| `enterprise@cimshare.com` | Enterprise inquiries |
| `contact@cimshare.com` | General contact |
| `rob@cimshare.com` | Error alerts (server/error-reporter.ts) |
| `thread-xxx@reply.cimshare.com` | Message threading system |

---

## Files That Can Be Ignored

These are test/debug scripts and documentation that don't affect production:

- `test-*.js` files (~10 files)
- `debug-*.js` files (~5 files)
- `diagnose-*.js`, `check-*.js`, `monitor-*.js`
- `*.md` debug documentation (SENDGRID-*, EMAIL_WEBHOOK_DEBUG, etc.)
- `attached_assets/` folder
- `sendgrid-quick-test.sh`

---

## Environment Variables Already in Use

Many files already support env vars with fallback to `cimshare.com`:

```javascript
process.env.BASE_URL || 'https://cimshare.com'
process.env.APP_URL || 'https://cimshare.com'
process.env.FRONTEND_URL || 'https://cimshare.com'
process.env.VITE_APP_URL || 'https://cimshare.com'
```

**Recommendation**: Set these env vars in production to handle most server-side URLs automatically.

---

## Migration Steps

### 1. Pre-Migration (Before DNS Change)
- [ ] Set up new domain in SendGrid (domain authentication)
- [ ] Verify all email addresses on new domain
- [ ] Set up MX records for `reply.NEWDOMAIN.com`
- [ ] Update OAuth redirect URLs in provider dashboards (Google, Microsoft, Slack, HubSpot)

### 2. Environment Variables
- [ ] Set `BASE_URL=https://NEWDOMAIN.com`
- [ ] Set `APP_URL=https://NEWDOMAIN.com`
- [ ] Set `FRONTEND_URL=https://NEWDOMAIN.com`

### 3. Code Updates (COMPLETED 2026-02-08)
- [x] Update `client/src/lib/url-utils.ts` PRODUCTION_DOMAIN
- [x] Find/replace hardcoded domains in server files (22 files updated)
- [x] Find/replace hardcoded domains in client files (34 files updated)
- [x] Update `client/index.html` meta tags
- [x] Update `client/public/sitemap.xml`
- [x] Update `client/public/robots.txt`

### 4. Email System (COMPLETED 2026-02-08)
- [x] Update all `@cimshare.com` email addresses → `@brokervault.ai`
- [x] Update `reply.cimshare.com` thread email pattern in `server/message-service.ts`
- [x] Update email template logo (brokervaultlogo.svg)
- [x] Update copyright year to 2026
- [ ] Update SendGrid Inbound Parse hostname to `reply.brokervault.ai`

### 5. Post-Migration
- [ ] Set up 301 redirects from old domain
- [ ] Update any external documentation
- [ ] Monitor for broken links/emails

---

## Quick Search Commands

To find remaining references after migration:

```bash
# Find all remaining references
grep -r "cimshare\.com" --include="*.ts" --include="*.tsx" --include="*.html" --include="*.xml" .

# Exclude test files
grep -r "cimshare\.com" --include="*.ts" --include="*.tsx" . | grep -v "test-" | grep -v "debug-"
```
