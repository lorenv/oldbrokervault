---
title: Domain Migration from CIM Share to Broker Vault (cimshare.com → brokervault.ai)
date: 2026-02-08
category: integration-issues
severity: high
component: email-delivery, authentication, integrations
tags: [domain-migration, sendgrid, oauth, email-templates, branding, production-infrastructure]
symptoms: Application rebranding required comprehensive domain migration to support new brand identity
root_cause: Company rebranded from CIM Share to Broker Vault necessitating complete domain infrastructure change
resolution_time: ~1 hour (code changes)
affects_version: current
related_docs:
  - docs/DOMAIN-MIGRATION-CHECKLIST.md
---

# Domain Migration Solution: cimshare.com → brokervault.ai

**Date:** 2026-02-08
**Type:** Infrastructure Migration
**Scope:** Codebase-wide domain reference update (56 files, 200+ references)

## Overview

This document details the complete migration from the legacy `cimshare.com` domain to the new `brokervault.ai` brand. The migration involved updating all domain references across 56 files in both server and client codebases, including email addresses, URLs, OAuth callbacks, and regex patterns.

## Investigation Steps

### 1. Initial Discovery

Used grep to identify all cimshare.com references across the codebase:

```bash
# Find all occurrences
grep -r "cimshare\.com" --include="*.ts" --include="*.tsx" --include="*.xml" --include="*.txt"

# Count occurrences per file
grep -r "cimshare\.com" --include="*.ts" --include="*.tsx" | wc -l
```

This revealed approximately 200+ references across 56 files.

### 2. Categorization

References fell into several categories:

1. **Email addresses** - System transactional emails, support contacts, error alerts
2. **Base URLs** - Frontend URLs, API endpoints, OAuth callbacks
3. **Email threading domains** - Reply-to email patterns for message threading
4. **Regex patterns** - Email validation and parsing patterns
5. **User-Agent strings** - Integration service identifiers
6. **Static assets** - Sitemap and robots.txt
7. **Logo filenames** - Brand asset references

### 3. Impact Analysis

Critical areas requiring careful handling:

- **OAuth integrations** - Callback URLs for Slack, Gmail, HubSpot, Microsoft
- **Payment flows** - Stripe redirect URLs
- **Email threading system** - Regex patterns with escaped characters
- **SEO files** - Sitemap and robots.txt public URLs

## Email Address Mapping

All email addresses were migrated to maintain functional equivalence:

| Old Address | New Address | Purpose |
|------------|-------------|---------|
| `system@cimshare.com` | `system@brokervault.ai` | Main transactional sender |
| `support@cimshare.com` | `support@brokervault.ai` | Support/welcome emails |
| `signatures@cimshare.com` | `signatures@brokervault.ai` | E-signature notifications |
| `hello@cimshare.com` | `hello@brokervault.ai` | Welcome/marketing |
| `alerts@cimshare.com` | `alerts@brokervault.ai` | System error alerts |
| `rob@cimshare.com` | `rob@brokervault.ai` | Error alert recipient |
| `contact@cimshare.com` | `contact@brokervault.ai` | General contact |
| `thread-xxx@reply.cimshare.com` | `thread-xxx@reply.brokervault.ai` | Message threading |

## Solution Approach

### Strategy 1: Edit Tool with `replace_all`

For smaller files with manageable content size, used the Edit tool with `replace_all: true`:

```typescript
// Example: server/onboarding-email-system.ts
{
  file_path: "/home/runner/workspace/server/onboarding-email-system.ts",
  old_string: "system@cimshare.com",
  new_string: "system@brokervault.ai",
  replace_all: true
}
```

**Best for:** Files under 500 lines with clear, uniform replacements.

### Strategy 2: Sed via Bash Agents

For large files (routes.ts with 3000+ lines, email.ts with 1000+ lines), used sed for performance:

```bash
sed -i 's/cimshare\.com/brokervault.ai/g' server/routes.ts
sed -i 's/cimshare\.com/brokervault.ai/g' server/email.ts
```

**Best for:** Large files with many occurrences, simple find-replace patterns.

### Strategy 3: Logo Asset Update

Brand assets required filename changes:

```typescript
// email-components.ts
// Before:
const logoSrc = `https://www.cimshare.com/cim-share-logo.png`;

// After:
const logoSrc = `https://www.brokervault.ai/brokervaultlogo.svg`;
```

### Strategy 4: Central Configuration Update

Updated the source of truth for domain configuration:

```typescript
// client/src/lib/url-utils.ts
export const PRODUCTION_DOMAIN = 'https://brokervault.ai';

// This constant is used throughout the client codebase
```

## Files Updated

### Server Files (22 files)

**Core Email System:**
- `server/email.ts` - All from/replyTo addresses + URLs in email content
- `server/email-service.ts` - Default from email + welcome email sender
- `server/email-templates/email-components.ts` - Logo URL, footer links, copyright
- `server/email-templates/canspam-footer.ts` - Preferences link, copyright year
- `server/onboarding-email-system.ts` - Onboarding email sender
- `server/error-reporter.ts` - Alert and from email addresses

**Message Threading:**
- `server/message-service.ts` - Thread email domain + regex patterns (special handling required)

**Notification Systems:**
- `server/daily-signup-summary.ts` - Summary email sender
- `server/task-reminder-system.ts` - Task notification URLs

**API Routes:**
- `server/routes.ts` - All email addresses + base URLs (22 occurrences)
- `server/routes/esign/esign-envelope-routes.ts` - Signing URLs
- `server/routes/external-webhooks.ts` - Webhook test data

**Services:**
- `server/services/esignature-service.ts` - E-signature notification sender
- `server/services/unsubscribe-service.ts` - Frontend unsubscribe URL
- `server/sde-processor.ts` - SDE email sender + download URLs
- `server/ssr-renderer.ts` - Support email in error pages
- `server/stripe.ts` - Payment redirect URLs
- `server/seo-routes.ts` - SEO base URL
- `server/document-export.ts` - Document export URLs
- `server/image-helpers.ts` - URL in comments

**OAuth Integrations:**
- `server/integrations/providers/slack.ts` - OAuth callback URL
- `server/integrations/providers/gmail.ts` - OAuth callback URL
- `server/integrations/providers/hubspot.ts` - OAuth callback URL
- `server/integrations/providers/microsoft.ts` - OAuth callback URL

**Integration Services:**
- `server/integrations/providers/make.ts` - User-Agent: `CIMShare-Integrations` → `BrokerVault-Integrations`
- `server/integrations/providers/zapier.ts` - User-Agent string
- `server/integrations/providers/webhook.ts` - User-Agent string

### Client Files (34 files)

**Core Configuration:**
- `client/src/lib/url-utils.ts` - `PRODUCTION_DOMAIN` constant (source of truth)

**Pages:**
- `client/src/pages/home.tsx`
- `client/src/pages/pricing.tsx`
- `client/src/pages/contact.tsx`
- `client/src/pages/privacy.tsx`
- `client/src/pages/terms.tsx`
- `client/src/pages/security.tsx`
- `client/src/pages/acceptable-use.tsx`
- All feature pages (virtual-data-room, document-sharing, etc.)
- All solution pages (private-equity, investment-banking, etc.)
- Settings pages (profile, billing, security, etc.)

**Components:**
- `client/src/components/share-settings.tsx`
- `client/src/components/document-export.tsx`
- `client/src/components/nda-tab.tsx`
- `client/src/components/error-boundary.tsx`
- `client/src/components/footer.tsx`

**Public Assets:**
- `client/public/sitemap.xml` - All public URLs
- `client/public/robots.txt` - Sitemap URL

## Key Gotchas and Special Cases

### 1. Regex Pattern Escaping in message-service.ts

The message threading system uses regex patterns to parse email addresses. The dots in domain names were already escaped with backslashes:

```typescript
// Before:
const threadPattern = /thread-([a-z0-9]+)@(?:reply\.)?cimshare\.com/i;
const emailRegex = /[a-zA-Z0-9._%+-]+@cimshare\.com/;

// After:
const threadPattern = /thread-([a-z0-9]+)@(?:reply\.)?brokervault\.ai/i;
const emailRegex = /[a-zA-Z0-9._%+-]+@brokervault\.ai/;
```

**Problem:** Standard sed command would replace `cimshare.com` but not `cimshare\.com` (with escaped dot).

**Solution:** Required a separate sed pass with double-escaped dots:

```bash
# First pass: unescaped dots
sed -i 's/cimshare\.com/brokervault.ai/g' server/message-service.ts

# Second pass: escaped dots in regex patterns
sed -i 's/cimshare\\.com/brokervault\\.ai/g' server/message-service.ts
```

### 2. Copyright Year Update

Email templates also had hardcoded copyright years that needed updating:

```typescript
// Before:
<p>&copy; 2024 CIMShare, LLC. All rights reserved.</p>

// After:
<p>&copy; 2026 BrokerVault, LLC. All rights reserved.</p>
```

This required additional manual edits beyond the domain replacement.

### 3. OAuth Callback URL Critical Path

OAuth integration files are particularly sensitive because incorrect URLs break authentication flows:

```typescript
// server/integrations/providers/slack.ts
const redirectUri = `https://brokervault.ai/api/integrations/slack/callback`;
```

**Verification required:** After deployment, each OAuth integration must be tested:
- Slack workspace connection
- Gmail integration
- HubSpot CRM sync
- Microsoft 365 integration

### 4. User-Agent String Brand Update

Integration providers use User-Agent strings for logging and rate limiting:

```typescript
// Before:
headers: {
  'User-Agent': 'CIMShare-Integrations/1.0'
}

// After:
headers: {
  'User-Agent': 'BrokerVault-Integrations/1.0'
}
```

### 5. Stripe Payment Redirects

Payment success/cancel URLs must exactly match Stripe dashboard configuration:

```typescript
// server/stripe.ts
success_url: `https://brokervault.ai/settings/billing?session_id={CHECKOUT_SESSION_ID}`,
cancel_url: `https://brokervault.ai/settings/billing`
```

**Action required:** Update Stripe dashboard with new redirect URLs.

## Verification Steps

### 1. Comprehensive Grep Search

Verify no legacy references remain:

```bash
# Should return 0 results (except in attached_assets/)
grep -r "cimshare\.com" \
  --include="*.ts" \
  --include="*.tsx" \
  --include="*.xml" \
  --include="*.txt" \
  --exclude-dir="attached_assets"
```

### 2. Test Email Delivery

Send test emails from each system:

```bash
# Test transactional emails
curl -X POST https://brokervault.ai/api/test-email \
  -H "Content-Type: application/json" \
  -d '{"type": "welcome"}'

# Verify From header shows system@brokervault.ai
```

### 3. OAuth Flow Testing

Manually test each OAuth integration:

1. Disconnect integration
2. Reconnect using new callback URL
3. Verify successful authorization
4. Test data sync functionality

### 4. Payment Flow Testing

Test Stripe checkout flow:

1. Initiate subscription purchase
2. Complete payment
3. Verify redirect to `brokervault.ai/settings/billing`
4. Confirm subscription activation

### 5. SEO Verification

Check public-facing URLs:

```bash
# Verify sitemap
curl https://brokervault.ai/sitemap.xml

# Verify robots.txt
curl https://brokervault.ai/robots.txt

# All URLs should point to brokervault.ai
```

## Deployment Checklist

### Pre-Deployment

- [ ] DNS records configured for brokervault.ai
- [ ] SSL certificate installed for brokervault.ai
- [ ] Email service provider (SendGrid/etc.) verified sender for @brokervault.ai
- [ ] Stripe dashboard updated with new redirect URLs
- [ ] OAuth app configurations updated (Slack, Google, HubSpot, Microsoft)

### Post-Deployment

- [ ] Run verification grep search
- [ ] Test email delivery from all system addresses
- [ ] Test OAuth flows for all integrations
- [ ] Test Stripe payment flow
- [ ] Verify sitemap and robots.txt accessibility
- [ ] Monitor error logs for any domain-related issues
- [ ] Update external documentation referencing old domain

### Third-Party Updates Required

1. **Email Service Provider:** Add @brokervault.ai sender domains
2. **Stripe:** Update checkout success/cancel URLs
3. **OAuth Apps:** Update callback URLs in:
   - Slack App Settings
   - Google Cloud Console
   - HubSpot App Settings
   - Microsoft Azure App Registration
4. **DNS:** Configure MX records for email routing
5. **CDN/Hosting:** Update domain configuration

## Code Examples

### Example 1: Email Template Update

```typescript
// server/email-templates/email-components.ts

// Logo update
const logoSrc = `https://www.brokervault.ai/brokervaultlogo.svg`;

// Footer links
export const emailFooter = `
  <p style="font-size: 12px; color: #666;">
    <a href="https://www.brokervault.ai/privacy">Privacy Policy</a> |
    <a href="https://www.brokervault.ai/terms">Terms of Service</a>
  </p>
  <p style="font-size: 11px; color: #999;">
    &copy; 2026 BrokerVault, LLC. All rights reserved.
  </p>
`;
```

### Example 2: Message Threading Pattern

```typescript
// server/message-service.ts

export function parseThreadEmail(email: string): string | null {
  // Updated regex pattern with new domain
  const pattern = /thread-([a-z0-9]+)@(?:reply\.)?brokervault\.ai/i;
  const match = email.match(pattern);
  return match ? match[1] : null;
}

export function generateThreadEmail(threadId: string): string {
  return `thread-${threadId}@reply.brokervault.ai`;
}
```

### Example 3: OAuth Callback URL

```typescript
// server/integrations/providers/slack.ts

export const slackConfig = {
  clientId: process.env.SLACK_CLIENT_ID,
  clientSecret: process.env.SLACK_CLIENT_SECRET,
  redirectUri: `https://brokervault.ai/api/integrations/slack/callback`,
  scopes: ['channels:read', 'chat:write', 'files:write']
};
```

### Example 4: Central Domain Configuration

```typescript
// client/src/lib/url-utils.ts

export const PRODUCTION_DOMAIN = 'https://brokervault.ai';

export function getShareUrl(shareId: string): string {
  return `${PRODUCTION_DOMAIN}/s/${shareId}`;
}

export function getDocumentUrl(documentId: string): string {
  return `${PRODUCTION_DOMAIN}/documents/${documentId}`;
}
```

## Lessons Learned

1. **Use a central configuration constant** - Having `PRODUCTION_DOMAIN` in one place (url-utils.ts) made the client-side migration cleaner.

2. **Grep before you start** - Comprehensive search revealed the full scope (56 files) upfront.

3. **Category-based approach** - Grouping files by type (email system, OAuth, payments, etc.) helped ensure nothing was missed.

4. **Regex escaping is tricky** - The message-service.ts regex patterns required special handling due to escaped dots.

5. **Large file strategy** - Using sed for large files (routes.ts, email.ts) was significantly faster than Edit tool.

6. **Verify third-party dependencies** - OAuth providers, payment processors, and email services all need manual updates outside the codebase.

7. **Test in production** - While code updates are complete, actual functionality depends on external service configuration.

## Future Considerations

### Backward Compatibility

Consider implementing redirects for legacy links:

```typescript
// server/routes.ts
app.get('/s/:shareId', (req, res) => {
  // If request comes from cimshare.com, redirect to brokervault.ai
  if (req.hostname === 'cimshare.com') {
    return res.redirect(301, `https://brokervault.ai/s/${req.params.shareId}`);
  }
  // Normal handling
});
```

### Email Forwarding

Set up email forwarding from old addresses to maintain communication:

```
system@cimshare.com → system@brokervault.ai
support@cimshare.com → support@brokervault.ai
```

### Monitoring

Add logging to track any legacy domain references that slip through:

```typescript
// server/middleware/domain-logger.ts
app.use((req, res, next) => {
  if (req.body && JSON.stringify(req.body).includes('cimshare.com')) {
    logger.warn('Legacy domain reference detected', {
      path: req.path,
      body: req.body
    });
  }
  next();
});
```

## Conclusion

The domain migration from cimshare.com to brokervault.ai required careful coordination across 56 files, multiple subsystems, and external service providers. The key to success was comprehensive discovery, systematic categorization, appropriate tooling for different file sizes, and thorough verification.

The migration is **code-complete** but requires **third-party service updates** (OAuth apps, Stripe, email provider) before full production deployment.
