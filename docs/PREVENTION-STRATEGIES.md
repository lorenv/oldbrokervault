# Domain Migration Prevention Strategies

## Executive Summary

The domain migration from `cimshare.com` to `brokervault.ai` revealed critical architectural issues that allowed hardcoded domain references in 50+ files. This document provides comprehensive prevention strategies to avoid similar issues in future migrations and improve overall code maintainability.

---

## 1. Prevention Strategies

### 1.1 Centralize All Domain Configuration

#### Strategy: Create a Domain Constants Module

Create a single, canonical source of truth for all domain-related constants:

**File: `server/config/domain-config.ts`**
```typescript
/**
 * Centralized domain configuration
 * This is the ONLY place where domain values should be hardcoded
 */

// Primary domain configuration
const PRODUCTION_DOMAIN = process.env.PRODUCTION_DOMAIN || 'brokervault.ai';
const REPLY_DOMAIN = process.env.REPLY_DOMAIN || `reply.${PRODUCTION_DOMAIN}`;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Derive all URLs from the base domain
export const DOMAIN_CONFIG = {
  // Core domains
  productionDomain: PRODUCTION_DOMAIN,
  replyDomain: REPLY_DOMAIN,

  // Base URLs (used for app functionality)
  appUrl: process.env.APP_URL || `https://${PRODUCTION_DOMAIN}`,
  baseUrl: process.env.BASE_URL || `https://${PRODUCTION_DOMAIN}`,
  frontendUrl: process.env.FRONTEND_URL || `https://${PRODUCTION_DOMAIN}`,

  // Email addresses (organized by function)
  email: {
    // Primary transactional emails
    system: process.env.SYSTEM_EMAIL || `system@${PRODUCTION_DOMAIN}`,
    support: process.env.SUPPORT_EMAIL || `support@${PRODUCTION_DOMAIN}`,
    noreply: process.env.NOREPLY_EMAIL || `noreply@${PRODUCTION_DOMAIN}`,

    // Specialized functions
    signatures: process.env.SIGNATURES_EMAIL || `signatures@${PRODUCTION_DOMAIN}`,
    legal: process.env.LEGAL_EMAIL || `legal@${PRODUCTION_DOMAIN}`,
    privacy: process.env.PRIVACY_EMAIL || `privacy@${PRODUCTION_DOMAIN}`,
    alerts: process.env.ALERTS_EMAIL || `alerts@${PRODUCTION_DOMAIN}`,
    enterprise: process.env.ENTERPRISE_EMAIL || `enterprise@${PRODUCTION_DOMAIN}`,

    // Message threading system
    threadPrefix: 'thread',
    threadDomain: REPLY_DOMAIN,
  },

  // URL patterns
  patterns: {
    share: (slug: string) => `${PRODUCTION_DOMAIN}/share/${slug}`,
    nda: (slug: string) => `${PRODUCTION_DOMAIN}/nda/${slug}`,
    esign: (token: string) => `${PRODUCTION_DOMAIN}/esign/sign/${token}`,
    unsubscribe: (token: string) => `${PRODUCTION_DOMAIN}/unsubscribe/${token}`,
  },

  // OAuth callback URLs
  oauth: {
    microsoft: process.env.OAUTH_CALLBACK_MICROSOFT || `${PRODUCTION_DOMAIN}/api/integrations/oauth/callback/microsoft`,
    gmail: process.env.OAUTH_CALLBACK_GMAIL || `${PRODUCTION_DOMAIN}/api/integrations/oauth/callback/gmail`,
    slack: process.env.OAUTH_CALLBACK_SLACK || `${PRODUCTION_DOMAIN}/api/integrations/oauth/callback/slack`,
    hubspot: process.env.OAUTH_CALLBACK_HUBSPOT || `${PRODUCTION_DOMAIN}/api/integrations/oauth/callback/hubspot`,
  },

  // Metadata
  companyName: 'Broker Vault',
  currentYear: new Date().getFullYear(),
} as const;

// Validation - ensure critical configuration is set
export function validateDomainConfig(): void {
  const required = [
    DOMAIN_CONFIG.productionDomain,
    DOMAIN_CONFIG.email.system,
    DOMAIN_CONFIG.email.support,
  ];

  const missing = required.filter(value => !value || value.includes('undefined'));
  if (missing.length > 0) {
    throw new Error(
      `Invalid domain configuration. Missing or undefined values: ${missing.join(', ')}`
    );
  }
}
```

**File: `client/src/lib/domain-config.ts`** (client-side mirror)
```typescript
/**
 * Client-side domain configuration
 * Must match server configuration
 */

const PRODUCTION_DOMAIN = import.meta.env.VITE_PRODUCTION_DOMAIN || 'brokervault.ai';

export const DOMAIN_CONFIG = {
  productionDomain: PRODUCTION_DOMAIN,
  appUrl: import.meta.env.VITE_APP_URL || `https://${PRODUCTION_DOMAIN}`,
  baseUrl: import.meta.env.VITE_BASE_URL || `https://${PRODUCTION_DOMAIN}`,

  email: {
    support: import.meta.env.VITE_SUPPORT_EMAIL || `support@${PRODUCTION_DOMAIN}`,
    legal: import.meta.env.VITE_LEGAL_EMAIL || `legal@${PRODUCTION_DOMAIN}`,
    privacy: import.meta.env.VITE_PRIVACY_EMAIL || `privacy@${PRODUCTION_DOMAIN}`,
    enterprise: import.meta.env.VITE_ENTERPRISE_EMAIL || `enterprise@${PRODUCTION_DOMAIN}`,
  },

  companyName: 'Broker Vault',
  currentYear: new Date().getFullYear(),
} as const;
```

#### Implementation Pattern

Every file that needs domain info should import from the config:

**Before (Anti-Pattern):**
```typescript
// Scattered throughout codebase
const baseUrl = process.env.BASE_URL || 'https://brokervault.ai';
const supportEmail = 'support@brokervault.ai';
const threadEmail = `thread-${id}@reply.brokervault.ai`;
```

**After (Correct Pattern):**
```typescript
import { DOMAIN_CONFIG } from '../config/domain-config';

const baseUrl = DOMAIN_CONFIG.appUrl;
const supportEmail = DOMAIN_CONFIG.email.support;
const threadEmail = `${DOMAIN_CONFIG.email.threadPrefix}-${id}@${DOMAIN_CONFIG.email.threadDomain}`;
```

---

### 1.2 Environment Variable Strategy

#### Create a Comprehensive Environment Template

**File: `.env.example`**
```bash
# Domain Configuration
# Primary production domain (used as fallback for all URLs)
PRODUCTION_DOMAIN=brokervault.ai

# Base URLs (override if needed for development)
APP_URL=https://brokervault.ai
BASE_URL=https://brokervault.ai
FRONTEND_URL=https://brokervault.ai

# Email Configuration
SYSTEM_EMAIL=system@brokervault.ai
SUPPORT_EMAIL=support@brokervault.ai
NOREPLY_EMAIL=noreply@brokervault.ai
SIGNATURES_EMAIL=signatures@brokervault.ai
LEGAL_EMAIL=legal@brokervault.ai
PRIVACY_EMAIL=privacy@brokervault.ai
ALERTS_EMAIL=alerts@brokervault.ai
ENTERPRISE_EMAIL=enterprise@brokervault.ai

# Reply domain for message threading
REPLY_DOMAIN=reply.brokervault.ai

# OAuth Callbacks (optional - auto-generated from PRODUCTION_DOMAIN if not set)
OAUTH_CALLBACK_MICROSOFT=https://brokervault.ai/api/integrations/oauth/callback/microsoft
OAUTH_CALLBACK_GMAIL=https://brokervault.ai/api/integrations/oauth/callback/gmail
OAUTH_CALLBACK_SLACK=https://brokervault.ai/api/integrations/oauth/callback/slack
OAUTH_CALLBACK_HUBSPOT=https://brokervault.ai/api/integrations/oauth/callback/hubspot

# Client-side environment variables (Vite)
VITE_PRODUCTION_DOMAIN=brokervault.ai
VITE_APP_URL=https://brokervault.ai
VITE_BASE_URL=https://brokervault.ai
VITE_SUPPORT_EMAIL=support@brokervault.ai
VITE_LEGAL_EMAIL=legal@brokervault.ai
VITE_PRIVACY_EMAIL=privacy@brokervault.ai
VITE_ENTERPRISE_EMAIL=enterprise@brokervault.ai
```

#### Environment Loading Best Practices

**File: `server/config/env-loader.ts`**
```typescript
/**
 * Centralized environment variable loading with validation
 */

interface EnvironmentConfig {
  // Domain
  productionDomain: string;
  appUrl: string;
  baseUrl: string;
  frontendUrl: string;

  // Emails
  systemEmail: string;
  supportEmail: string;
  noreplyEmail: string;

  // Services
  sendgridApiKey: string;
  stripeSecretKey: string;
  databaseUrl: string;
}

function getEnvVar(key: string, required: boolean = true): string {
  const value = process.env[key];

  if (!value && required) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value || '';
}

export function loadEnvironmentConfig(): EnvironmentConfig {
  return {
    productionDomain: getEnvVar('PRODUCTION_DOMAIN', true),
    appUrl: process.env.APP_URL || `https://${getEnvVar('PRODUCTION_DOMAIN')}`,
    baseUrl: process.env.BASE_URL || `https://${getEnvVar('PRODUCTION_DOMAIN')}`,
    frontendUrl: process.env.FRONTEND_URL || `https://${getEnvVar('PRODUCTION_DOMAIN')}`,
    systemEmail: process.env.SYSTEM_EMAIL || `system@${getEnvVar('PRODUCTION_DOMAIN')}`,
    supportEmail: process.env.SUPPORT_EMAIL || `support@${getEnvVar('PRODUCTION_DOMAIN')}`,
    noreplyEmail: process.env.NOREPLY_EMAIL || `noreply@${getEnvVar('PRODUCTION_DOMAIN')}`,
    sendgridApiKey: getEnvVar('SENDGRID_API_KEY'),
    stripeSecretKey: getEnvVar('STRIPE_SECRET_KEY'),
    databaseUrl: getEnvVar('DATABASE_URL'),
  };
}

// Validate on startup
export function validateEnvironment(): void {
  try {
    loadEnvironmentConfig();
    console.log('✓ Environment configuration validated successfully');
  } catch (error) {
    console.error('✗ Environment configuration validation failed:', error);
    process.exit(1);
  }
}
```

---

### 1.3 URL Generation Utilities

#### Expand URL-Utils Module

**File: `shared/url-generation.ts`** (shared between client/server)
```typescript
/**
 * Centralized URL generation utilities
 * Used by both server and client for consistent URL formatting
 */

import { DOMAIN_CONFIG } from './domain-config';

export class URLGenerator {
  /**
   * Generate a share URL with optional subdomain
   */
  static generateShareUrl(slug: string, subdomain?: string): string {
    const domain = subdomain
      ? `${subdomain}.${DOMAIN_CONFIG.productionDomain}`
      : DOMAIN_CONFIG.productionDomain;
    return `${DOMAIN_CONFIG.appUrl}/share/${slug}`;
  }

  /**
   * Generate an NDA URL
   */
  static generateNdaUrl(slug: string, subdomain?: string): string {
    return `${DOMAIN_CONFIG.appUrl}/nda/${slug}`;
  }

  /**
   * Generate an e-signature signing URL
   */
  static generateSigningUrl(accessToken: string): string {
    return `${DOMAIN_CONFIG.appUrl}/esign/sign/${accessToken}`;
  }

  /**
   * Generate an unsubscribe URL
   */
  static generateUnsubscribeUrl(token: string): string {
    return `${DOMAIN_CONFIG.appUrl}/unsubscribe/${token}`;
  }

  /**
   * Generate OAuth callback URL
   */
  static generateOAuthCallbackUrl(provider: 'google' | 'microsoft' | 'slack' | 'hubspot'): string {
    const callbackMap = {
      google: DOMAIN_CONFIG.oauth.gmail,
      microsoft: DOMAIN_CONFIG.oauth.microsoft,
      slack: DOMAIN_CONFIG.oauth.slack,
      hubspot: DOMAIN_CONFIG.oauth.hubspot,
    };
    return callbackMap[provider];
  }

  /**
   * Generate a thread email address
   */
  static generateThreadEmail(threadId: string): string {
    return `${DOMAIN_CONFIG.email.threadPrefix}-${threadId}@${DOMAIN_CONFIG.email.threadDomain}`;
  }
}

// Export as singleton for convenience
export const urlGenerator = URLGenerator;
```

---

### 1.4 Email Configuration Management

#### Create Dedicated Email Constants

**File: `server/config/email-config.ts`**
```typescript
/**
 * All email addresses and configuration in one place
 */

import { DOMAIN_CONFIG } from './domain-config';

export const EMAIL_ADDRESSES = {
  // Primary transactional
  SYSTEM: DOMAIN_CONFIG.email.system,
  SUPPORT: DOMAIN_CONFIG.email.support,
  NOREPLY: DOMAIN_CONFIG.email.noreply,

  // Specialized
  SIGNATURES: DOMAIN_CONFIG.email.signatures,
  LEGAL: DOMAIN_CONFIG.email.legal,
  PRIVACY: DOMAIN_CONFIG.email.privacy,
  ALERTS: DOMAIN_CONFIG.email.alerts,
  ENTERPRISE: DOMAIN_CONFIG.email.enterprise,
} as const;

export const EMAIL_CONFIG = {
  // Default from email for transactional messages
  DEFAULT_FROM: EMAIL_ADDRESSES.SUPPORT,

  // Reply-to email for customer communications
  DEFAULT_REPLY_TO: EMAIL_ADDRESSES.SUPPORT,

  // Message threading
  THREAD_EMAIL_DOMAIN: DOMAIN_CONFIG.email.threadDomain,
  THREAD_EMAIL_PREFIX: DOMAIN_CONFIG.email.threadPrefix,

  // Bounce/error notifications
  BOUNCE_HANDLER_EMAIL: EMAIL_ADDRESSES.ALERTS,

  // Do not use these hardcoded anymore
  // ✗ from: 'support@brokervault.ai'
  // ✗ replyTo: 'support@cimshare.com'
  // Use: EMAIL_CONFIG.DEFAULT_FROM, EMAIL_CONFIG.DEFAULT_REPLY_TO
} as const;

// Type-safe email address getter
export function getEmailAddress(type: keyof typeof EMAIL_ADDRESSES): string {
  return EMAIL_ADDRESSES[type];
}
```

---

### 1.5 SEO and Static Content Strategy

#### Template-Based Static Files

**File: `scripts/generate-static-files.ts`**
```typescript
/**
 * Generate static files (robots.txt, sitemap.xml) from templates
 * Ensures domain consistency without manual hardcoding
 */

import fs from 'fs';
import path from 'path';
import { DOMAIN_CONFIG } from '../server/config/domain-config';

function generateRobotsTxt(): string {
  return `# Robots file generated for ${DOMAIN_CONFIG.productionDomain}
User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/

Sitemap: https://${DOMAIN_CONFIG.productionDomain}/sitemap.xml
`;
}

function generateSitemapXml(): string {
  const baseUrl = `https://${DOMAIN_CONFIG.productionDomain}`;
  const now = new Date().toISOString().split('T')[0];

  const urls = [
    '/',
    '/pricing',
    '/features',
    '/solutions/investment-banking',
    '/solutions/business-brokers',
    '/privacy-policy',
    '/terms-of-service',
    '/contact',
  ];

  const entries = urls
    .map(url => `  <url>
    <loc>${baseUrl}${url}</loc>
    <lastmod>${now}</lastmod>
    <priority>${url === '/' ? '1.0' : '0.8'}</priority>
  </url>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;
}

// Generate files during build
const publicDir = path.join(process.cwd(), 'client', 'public');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

fs.writeFileSync(path.join(publicDir, 'robots.txt'), generateRobotsTxt());
fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), generateSitemapXml());

console.log(`✓ Generated robots.txt and sitemap.xml for ${DOMAIN_CONFIG.productionDomain}`);
```

#### Update HTML Template Generation

**File: `scripts/generate-meta-tags.ts`**
```typescript
/**
 * Generate consistent meta tags for HTML files
 */

import { DOMAIN_CONFIG } from '../server/config/domain-config';

export function generateMetaTags(pagePath: string = ''): string {
  const canonicalUrl = `https://${DOMAIN_CONFIG.productionDomain}${pagePath}`;

  return `
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="Secure document sharing and virtual data room solution">

  <!-- Canonical URL -->
  <link rel="canonical" href="${canonicalUrl}" />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:site_name" content="${DOMAIN_CONFIG.companyName}" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:url" content="${canonicalUrl}" />

  <!-- Copy right -->
  <meta name="copyright" content="© ${DOMAIN_CONFIG.currentYear} ${DOMAIN_CONFIG.companyName}. All rights reserved." />
`;
}
```

---

### 1.6 Configuration Validation and Testing

#### Pre-Deployment Validation

**File: `server/config/validate-config.ts`**
```typescript
/**
 * Validate domain configuration before deployment
 */

import { DOMAIN_CONFIG } from './domain-config';

export function validateDomainConfiguration(): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check primary domain
  if (!DOMAIN_CONFIG.productionDomain || DOMAIN_CONFIG.productionDomain === 'undefined') {
    errors.push('PRODUCTION_DOMAIN not set');
  }

  // Check email addresses
  const emailKeys = Object.keys(DOMAIN_CONFIG.email) as Array<keyof typeof DOMAIN_CONFIG.email>;
  for (const key of emailKeys) {
    if (key !== 'threadPrefix' && key !== 'threadDomain') {
      const email = DOMAIN_CONFIG.email[key as any];
      if (!email || email.includes('undefined')) {
        errors.push(`Invalid email address: ${key}`);
      }
      if (!email?.includes('@')) {
        errors.push(`Email missing @ symbol: ${key} = ${email}`);
      }
    }
  }

  // Check URLs
  const urls = [DOMAIN_CONFIG.appUrl, DOMAIN_CONFIG.baseUrl, DOMAIN_CONFIG.frontendUrl];
  for (const url of urls) {
    if (!url.startsWith('https://') && !url.startsWith('http://')) {
      warnings.push(`URL should use https: ${url}`);
    }
  }

  // Check OAuth URLs
  const oauthKeys = Object.keys(DOMAIN_CONFIG.oauth);
  for (const key of oauthKeys) {
    const url = DOMAIN_CONFIG.oauth[key as keyof typeof DOMAIN_CONFIG.oauth];
    if (!url.startsWith('https://')) {
      warnings.push(`OAuth URL should use https: ${key} = ${url}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// Run validation on startup
if (require.main === module) {
  const result = validateDomainConfiguration();

  if (!result.valid) {
    console.error('✗ Configuration validation failed:');
    result.errors.forEach(error => console.error(`  - ${error}`));
    process.exit(1);
  }

  if (result.warnings.length > 0) {
    console.warn('⚠ Configuration warnings:');
    result.warnings.forEach(warning => console.warn(`  - ${warning}`));
  }

  console.log('✓ Configuration validation passed');
}
```

---

## 2. Best Practices for Future Domain Changes

### 2.1 Pre-Migration Checklist

#### 1. Update Configuration (Single Source of Truth)
- [ ] Update `PRODUCTION_DOMAIN` in `server/config/domain-config.ts`
- [ ] Update `PRODUCTION_DOMAIN` in `client/src/lib/domain-config.ts`
- [ ] Update `.env` file with all domain-related variables
- [ ] Run `npm run validate-config` to verify setup

#### 2. Verify Environment Variables
- [ ] Set `PRODUCTION_DOMAIN` in deployment environment
- [ ] Set `APP_URL`, `BASE_URL`, `FRONTEND_URL` (if different from PRODUCTION_DOMAIN)
- [ ] Set all email environment variables
- [ ] Set `REPLY_DOMAIN` for message threading

#### 3. Update External Services
- [ ] SendGrid: Add new domain authentication
- [ ] SendGrid: Verify all sender email addresses
- [ ] SendGrid: Update Inbound Parse webhook domain
- [ ] OAuth providers: Update all redirect URIs
- [ ] Stripe: Update webhook endpoints (if applicable)

#### 4. Generate Static Files
- [ ] Run `npm run generate-static-files` to update robots.txt and sitemap.xml
- [ ] Verify canonical URLs in `client/index.html`

#### 5. Code Verification
- [ ] Run `npm run validate-config` to check all configurations
- [ ] Run full test suite: `npm run test:all`
- [ ] Search codebase for any remaining hardcoded domains:
  ```bash
  grep -r "cimshare.com\|example.com" --include="*.ts" --include="*.tsx" \
    --exclude-dir=node_modules --exclude-dir=dist
  ```

#### 6. Build and Deploy
- [ ] Build with new environment: `npm run build`
- [ ] Test in staging environment
- [ ] Deploy to production
- [ ] Monitor error logs for 24 hours

### 2.2 Post-Migration Verification

#### Automated Checks
```bash
# Verify no hardcoded old domains remain (except in comments/docs)
grep -r "oldomain.com" --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules --exclude-dir=dist | grep -v "//"

# Verify all email addresses use new domain
grep -r "@[a-z]*\.com" --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules | grep -v "DOMAIN_CONFIG\|import\|email-config"

# Verify all URLs use proper configuration
grep -r "https://" --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules | grep -v "DOMAIN_CONFIG\|process.env\|http"
```

#### Manual Verification
- [ ] Test share link generation with correct domain
- [ ] Test email delivery (check From, Reply-To, links)
- [ ] Test OAuth flows with all providers
- [ ] Test message threading email addresses
- [ ] Verify sitemap.xml uses new domain
- [ ] Check robots.txt references new domain
- [ ] Verify canonical URLs in HTML

---

## 3. Post-Migration Verification Checklist

### 3.1 Functionality Testing

#### Email System
- [ ] Welcome emails sent with correct from address
- [ ] Support emails reference correct support email
- [ ] Share notifications include correct share links
- [ ] NDA notifications include correct NDA links
- [ ] Unsubscribe links work correctly
- [ ] Message threading emails send to correct reply address
- [ ] E-signature notifications have correct signing URLs

#### URL Generation
- [ ] Share URLs use correct domain
- [ ] NDA URLs use correct domain
- [ ] Signing URLs use correct domain
- [ ] OAuth callback URLs match configuration
- [ ] Subdomain URLs generate correctly

#### Email Integration
- [ ] Reply emails work correctly with message threading
- [ ] Bounce handling uses correct domain
- [ ] SendGrid inbound webhooks receive mail for new domain

### 3.2 Search Engine Verification

- [ ] robots.txt accessible at `https://domain/robots.txt`
- [ ] sitemap.xml accessible at `https://domain/sitemap.xml`
- [ ] Canonical URLs match new domain
- [ ] Google Search Console updated with new domain
- [ ] Bing Webmaster Tools updated with new domain

### 3.3 External Service Verification

- [ ] OAuth login works for Google, Microsoft, Slack, HubSpot
- [ ] Stripe webhooks deliver to new domain
- [ ] SendGrid accepts mail for new domain
- [ ] MX records resolve correctly for email domain
- [ ] SPF/DKIM/DMARC records configured for new domain

### 3.4 Monitoring and Error Tracking

- [ ] Error reporter sends alerts to new email address
- [ ] No 404 errors for missing domain references
- [ ] No hardcoded domain references in error logs
- [ ] Google Analytics tracking works on new domain
- [ ] Sentry/error tracking configured for new domain

---

## 4. Recommendations for Reducing Hardcoded Values

### 4.1 Eliminate Redundant Environment Variables

**Current (Redundant):**
```
BASE_URL=https://brokervault.ai
APP_URL=https://brokervault.ai
FRONTEND_URL=https://brokervault.ai
```

**Recommended (Single Source of Truth):**
```
PRODUCTION_DOMAIN=brokervault.ai
# All URLs derived from PRODUCTION_DOMAIN unless explicitly overridden
```

### 4.2 Create Constants for Email Templates

**Before (Scattered):**
```typescript
// In email.ts, message-service.ts, email-service.ts, etc.
from: 'support@brokervault.ai'
from: 'system@brokervault.ai'
from: 'alerts@brokervault.ai'
```

**After (Centralized):**
```typescript
import { EMAIL_CONFIG } from './config/email-config';

// Use consistent constants everywhere
from: EMAIL_CONFIG.DEFAULT_FROM
from: EMAIL_ADDRESSES.SYSTEM
from: EMAIL_ADDRESSES.ALERTS
```

### 4.3 Implement Type-Safe Configuration

Use TypeScript const assertions to prevent accidental modifications:

```typescript
export const DOMAIN_CONFIG = {
  productionDomain: 'brokervault.ai',
  // ...
} as const; // Ensures type safety and prevents mutations
```

### 4.4 Reduce OAuth Callback Duplication

**Before (Repeated in 4+ files):**
```typescript
// microsoft.ts
redirectUrl: `${process.env.BASE_URL || 'https://brokervault.ai'}/api/integrations/oauth/callback/microsoft`

// gmail.ts
redirectUrl: `${process.env.BASE_URL || 'https://brokervault.ai'}/api/integrations/oauth/callback/gmail`

// slack.ts
redirectUrl: `${process.env.BASE_URL || 'https://brokervault.ai'}/api/integrations/oauth/callback/slack`
```

**After (Single definition):**
```typescript
// oauth-config.ts
export const OAUTH_CONFIG = {
  microsoft: DOMAIN_CONFIG.oauth.microsoft,
  gmail: DOMAIN_CONFIG.oauth.gmail,
  slack: DOMAIN_CONFIG.oauth.slack,
  // ... all in one place
} as const;

// In each provider file:
redirectUrl: OAUTH_CONFIG.microsoft
```

### 4.5 Create Helper Functions for Common Patterns

**Instead of repeating:**
```typescript
const url = `${process.env.BASE_URL || 'https://brokervault.ai'}/share/${slug}`;
```

**Use utility function:**
```typescript
const url = urlGenerator.generateShareUrl(slug);
```

---

## 5. Automated Prevention Tools

### 5.1 Pre-Commit Hook

**File: `.husky/pre-commit`**
```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Prevent hardcoded domains from being committed
if git diff --cached | grep -E '(cimshare|example)\.com' | grep -v 'DOMAIN_CONFIG\|email-config\|domain-config'; then
  echo "❌ Error: Hardcoded domain references found in staged changes"
  echo "   Use DOMAIN_CONFIG or environment variables instead"
  exit 1
fi

# Run config validation
npm run validate-config || exit 1
```

### 5.2 ESLint Rules

Create custom ESLint rules to prevent hardcoded domains:

**File: `.eslintrc.js`**
```javascript
module.exports = {
  rules: {
    'no-hardcoded-domains': {
      create(context) {
        return {
          Literal(node) {
            if (typeof node.value === 'string') {
              if (/(cimshare|example)\.com/.test(node.value)) {
                context.report({
                  node,
                  message: 'Hardcoded domain detected. Use DOMAIN_CONFIG or environment variables instead.',
                });
              }
            }
          },
        };
      },
    },
  },
};
```

### 5.3 Build-Time Validation

Add validation to build process:

**File: `vite.config.ts` (client)**
```typescript
import { validateDomainConfiguration } from './server/config/validate-config';

export default {
  plugins: [
    {
      name: 'validate-config',
      apply: 'build',
      enforce: 'pre',
      async configResolved() {
        const result = validateDomainConfiguration();
        if (!result.valid) {
          throw new Error(
            `Invalid configuration: ${result.errors.join(', ')}`
          );
        }
      },
    },
  ],
};
```

---

## 6. Architecture Improvements Summary

### Current Issues Fixed
| Issue | Solution | File |
|-------|----------|------|
| 50+ hardcoded domain references | Centralized domain config module | `server/config/domain-config.ts` |
| Duplicated environment variable logic | Unified env-loader | `server/config/env-loader.ts` |
| Scattered email addresses | Centralized email-config | `server/config/email-config.ts` |
| Repeated URL patterns | URL generation utilities | `shared/url-generation.ts` |
| Inconsistent OAuth callbacks | Centralized OAuth config | `server/config/domain-config.ts` (oauth field) |
| Manual static file updates | Template-based generation | `scripts/generate-static-files.ts` |
| No validation before deploy | Configuration validator | `server/config/validate-config.ts` |

### Benefits of This Approach
1. **Single Source of Truth**: All domain config in one place
2. **Type Safety**: TypeScript ensures proper configuration
3. **Scalability**: Easy to add new domains/environments
4. **Maintainability**: Changes to domain handled in config files only
5. **Testability**: Configuration can be validated before runtime
6. **Automation**: Build-time and pre-commit validations
7. **Documentation**: Clear constants and patterns for new developers

---

## 7. Implementation Timeline

### Phase 1: Foundation (Week 1)
- [ ] Create `server/config/domain-config.ts`
- [ ] Create `server/config/env-loader.ts`
- [ ] Create `.env.example` with all variables
- [ ] Update `.env` with actual values

### Phase 2: Configuration Services (Week 2)
- [ ] Create `server/config/email-config.ts`
- [ ] Create `shared/url-generation.ts`
- [ ] Create `server/config/validate-config.ts`

### Phase 3: Automation (Week 3)
- [ ] Create `scripts/generate-static-files.ts`
- [ ] Add pre-commit hooks
- [ ] Add ESLint rules
- [ ] Add build-time validation

### Phase 4: Refactoring (Week 4-6)
- [ ] Update all server files to use centralized config
- [ ] Update all client files to use centralized config
- [ ] Update email templates
- [ ] Update static files

### Phase 5: Testing & Documentation (Week 7)
- [ ] Write integration tests
- [ ] Document configuration system
- [ ] Test with staging environment
- [ ] Deploy to production

---

## 8. Maintenance Guidelines

### Regular Audits
- Run configuration validation monthly: `npm run validate-config`
- Check for hardcoded domains quarterly
- Review environment variable usage in deployment logs

### When Adding Features
- Always use centralized configuration for domains/emails
- Never hardcode domain references
- Add environment variables for any new domain-dependent values

### When Migrating Again
1. Update `PRODUCTION_DOMAIN` in config files
2. Set environment variables
3. Run `npm run validate-config`
4. Run build and tests
5. Deploy

This architecture ensures the next domain migration will take hours instead of days.

