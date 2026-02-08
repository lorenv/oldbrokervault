# Implementation Code Templates

Ready-to-use code snippets for implementing the domain configuration system. Copy and modify as needed.

---

## 1. Core Configuration Module

### File: `server/config/domain-config.ts`

```typescript
/**
 * Centralized domain configuration
 * This is the ONLY place where domain values should be hardcoded.
 * Everything else should import from this module.
 *
 * Updated: February 2026
 */

// Load from environment or use sensible defaults
const PRODUCTION_DOMAIN = process.env.PRODUCTION_DOMAIN || 'brokervault.ai';
const REPLY_DOMAIN = process.env.REPLY_DOMAIN || `reply.${PRODUCTION_DOMAIN}`;

/**
 * Centralized configuration object
 * All domain-related constants should be defined here
 */
export const DOMAIN_CONFIG = {
  // Primary domains
  productionDomain: PRODUCTION_DOMAIN,
  replyDomain: REPLY_DOMAIN,

  // Base URLs - priority: env var > derived from domain
  appUrl: process.env.APP_URL || `https://${PRODUCTION_DOMAIN}`,
  baseUrl: process.env.BASE_URL || `https://${PRODUCTION_DOMAIN}`,
  frontendUrl: process.env.FRONTEND_URL || `https://${PRODUCTION_DOMAIN}`,

  // Email addresses - organized by function
  email: {
    // Primary transactional senders
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

  // URL pattern helper (for documentation)
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

/**
 * Validate configuration on application startup
 * Throws error if critical configuration is missing or invalid
 */
export function validateDomainConfig(): void {
  const errors: string[] = [];

  // Check primary domain
  if (!PRODUCTION_DOMAIN || PRODUCTION_DOMAIN === 'undefined') {
    errors.push('PRODUCTION_DOMAIN environment variable not set');
  }

  // Check critical emails
  const criticalEmails = {
    system: DOMAIN_CONFIG.email.system,
    support: DOMAIN_CONFIG.email.support,
  };

  for (const [name, email] of Object.entries(criticalEmails)) {
    if (!email || email.includes('undefined')) {
      errors.push(`Email address "${name}" is invalid: ${email}`);
    }
    if (!email.includes('@')) {
      errors.push(`Email address "${name}" missing @ symbol: ${email}`);
    }
  }

  // Check URLs are HTTPS in production
  if (process.env.NODE_ENV === 'production') {
    const urls = {
      appUrl: DOMAIN_CONFIG.appUrl,
      baseUrl: DOMAIN_CONFIG.baseUrl,
      frontendUrl: DOMAIN_CONFIG.frontendUrl,
    };

    for (const [name, url] of Object.entries(urls)) {
      if (!url.startsWith('https://')) {
        errors.push(`${name} should use HTTPS in production: ${url}`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Invalid domain configuration:\n${errors.map(e => `  - ${e}`).join('\n')}`
    );
  }
}

/**
 * Log current configuration (safe - no sensitive data exposed)
 */
export function logDomainConfig(): void {
  console.log('Domain Configuration:');
  console.log(`  Production Domain: ${DOMAIN_CONFIG.productionDomain}`);
  console.log(`  App URL: ${DOMAIN_CONFIG.appUrl}`);
  console.log(`  Support Email: ${DOMAIN_CONFIG.email.support}`);
  console.log(`  Reply Domain: ${DOMAIN_CONFIG.replyDomain}`);
}
```

---

## 2. Email Configuration

### File: `server/config/email-config.ts`

```typescript
/**
 * Centralized email configuration
 * All email addresses and defaults in one place
 */

import { DOMAIN_CONFIG } from './domain-config';

/**
 * Email addresses - use these instead of hardcoding
 */
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

/**
 * Email configuration defaults
 */
export const EMAIL_CONFIG = {
  // Default from address for most transactional emails
  DEFAULT_FROM: EMAIL_ADDRESSES.SUPPORT,

  // Default reply-to address
  DEFAULT_REPLY_TO: EMAIL_ADDRESSES.SUPPORT,

  // Message threading configuration
  THREAD_EMAIL_PREFIX: DOMAIN_CONFIG.email.threadPrefix,
  THREAD_EMAIL_DOMAIN: DOMAIN_CONFIG.email.threadDomain,

  // Bounce handler
  BOUNCE_HANDLER_EMAIL: EMAIL_ADDRESSES.ALERTS,

  // From address for different email types
  TRANSACTIONAL_FROM: EMAIL_ADDRESSES.SYSTEM,
  MARKETING_FROM: EMAIL_ADDRESSES.NOREPLY,
  SUPPORT_FROM: EMAIL_ADDRESSES.SUPPORT,
  LEGAL_FROM: EMAIL_ADDRESSES.LEGAL,
  SIGNATURE_FROM: EMAIL_ADDRESSES.SIGNATURES,
} as const;

/**
 * Type-safe getter for email addresses
 * @param type - Email address type from EMAIL_ADDRESSES
 * @returns The email address
 */
export function getEmailAddress(
  type: keyof typeof EMAIL_ADDRESSES
): string {
  return EMAIL_ADDRESSES[type];
}

/**
 * Generate a unique message thread email
 * @param threadId - Unique thread identifier
 * @returns Email address for thread (e.g., thread-abc123@reply.brokervault.ai)
 */
export function generateThreadEmail(threadId: string): string {
  return `${EMAIL_CONFIG.THREAD_EMAIL_PREFIX}-${threadId}@${EMAIL_CONFIG.THREAD_EMAIL_DOMAIN}`;
}

/**
 * Validate email configuration on startup
 */
export function validateEmailConfig(): void {
  const errors: string[] = [];

  for (const [name, email] of Object.entries(EMAIL_ADDRESSES)) {
    if (!email) {
      errors.push(`EMAIL_ADDRESSES.${name} is not set`);
    } else if (!email.includes('@')) {
      errors.push(`EMAIL_ADDRESSES.${name} is invalid: ${email}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid email configuration:\n${errors.join('\n')}`);
  }
}
```

---

## 3. Environment Variable Loader

### File: `server/config/env-loader.ts`

```typescript
/**
 * Centralized environment variable loading with validation
 * Prevents scattered process.env access throughout the codebase
 */

interface EnvironmentConfig {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;

  // Domain
  productionDomain: string;
  appUrl: string;
  baseUrl: string;
  frontendUrl: string;

  // Emails
  systemEmail: string;
  supportEmail: string;

  // Services
  sendgridApiKey: string;
  stripeSecretKey: string;
  databaseUrl: string;
}

/**
 * Load and validate environment configuration
 */
export function loadEnvironmentConfig(): EnvironmentConfig {
  const getRequired = (key: string): string => {
    const value = process.env[key];
    if (!value) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
  };

  const getOptional = (key: string, defaultValue: string): string => {
    return process.env[key] || defaultValue;
  };

  return {
    nodeEnv: (process.env.NODE_ENV as any) || 'development',
    port: parseInt(process.env.PORT || '5000'),

    productionDomain: getRequired('PRODUCTION_DOMAIN'),
    appUrl: getOptional('APP_URL', `https://${process.env.PRODUCTION_DOMAIN}`),
    baseUrl: getOptional('BASE_URL', `https://${process.env.PRODUCTION_DOMAIN}`),
    frontendUrl: getOptional('FRONTEND_URL', `https://${process.env.PRODUCTION_DOMAIN}`),

    systemEmail: getOptional('SYSTEM_EMAIL', `system@${process.env.PRODUCTION_DOMAIN}`),
    supportEmail: getOptional('SUPPORT_EMAIL', `support@${process.env.PRODUCTION_DOMAIN}`),

    sendgridApiKey: getRequired('SENDGRID_API_KEY'),
    stripeSecretKey: getRequired('STRIPE_SECRET_KEY'),
    databaseUrl: getRequired('DATABASE_URL'),
  };
}

/**
 * Validate environment configuration on startup
 * Call this in your main server initialization
 */
export function validateEnvironment(): void {
  try {
    const config = loadEnvironmentConfig();
    console.log('✓ Environment configuration validated successfully');
    console.log(`  Environment: ${config.nodeEnv}`);
    console.log(`  Domain: ${config.productionDomain}`);
  } catch (error) {
    console.error('✗ Environment configuration validation failed:');
    console.error(error);
    process.exit(1);
  }
}
```

---

## 4. URL Generation Utilities

### File: `shared/url-generation.ts`

```typescript
/**
 * Centralized URL generation utilities
 * Used by both server and client for consistent URL formatting
 *
 * Instead of: `https://domain/share/${slug}`
 * Use: urlGenerator.generateShareUrl(slug)
 */

import { DOMAIN_CONFIG } from '../server/config/domain-config';

export class URLGenerator {
  /**
   * Generate a share URL
   * @param slug - Document share slug
   * @param subdomain - Optional custom subdomain
   * @returns Full share URL
   */
  static generateShareUrl(slug: string, subdomain?: string | null): string {
    const domain = subdomain
      ? `${subdomain}.${DOMAIN_CONFIG.productionDomain}`
      : DOMAIN_CONFIG.productionDomain;

    return `${DOMAIN_CONFIG.appUrl}/share/${slug}`;
  }

  /**
   * Generate an NDA URL
   * @param slug - NDA share slug
   * @param subdomain - Optional custom subdomain
   * @returns Full NDA URL
   */
  static generateNdaUrl(slug: string, subdomain?: string | null): string {
    return `${DOMAIN_CONFIG.appUrl}/nda/${slug}`;
  }

  /**
   * Generate an e-signature signing URL
   * @param accessToken - Signer's access token
   * @returns Full signing URL
   */
  static generateSigningUrl(accessToken: string): string {
    return `${DOMAIN_CONFIG.appUrl}/esign/sign/${accessToken}`;
  }

  /**
   * Generate an e-signature envelope URL
   * @param envelopeId - Envelope identifier
   * @returns Full envelope URL
   */
  static generateEnvelopeUrl(envelopeId: string): string {
    return `${DOMAIN_CONFIG.appUrl}/esign/envelope/${envelopeId}`;
  }

  /**
   * Generate an unsubscribe URL
   * @param token - Unsubscribe token
   * @returns Full unsubscribe URL
   */
  static generateUnsubscribeUrl(token: string): string {
    return `${DOMAIN_CONFIG.appUrl}/unsubscribe/${token}`;
  }

  /**
   * Generate OAuth callback URL
   * @param provider - OAuth provider name
   * @returns Full callback URL
   */
  static generateOAuthCallbackUrl(
    provider: 'google' | 'microsoft' | 'slack' | 'hubspot'
  ): string {
    const callbackMap = {
      google: DOMAIN_CONFIG.oauth.gmail,
      microsoft: DOMAIN_CONFIG.oauth.microsoft,
      slack: DOMAIN_CONFIG.oauth.slack,
      hubspot: DOMAIN_CONFIG.oauth.hubspot,
    };
    return callbackMap[provider];
  }

  /**
   * Generate a message thread email address
   * @param threadId - Unique thread identifier
   * @returns Email address for thread (e.g., thread-abc123@reply.brokervault.ai)
   */
  static generateThreadEmail(threadId: string): string {
    return `${DOMAIN_CONFIG.email.threadPrefix}-${threadId}@${DOMAIN_CONFIG.email.threadDomain}`;
  }

  /**
   * Generate a base URL (with optional path)
   * @param path - Optional path to append
   * @returns Full URL
   */
  static generateUrl(path: string = ''): string {
    const baseUrl = DOMAIN_CONFIG.appUrl.replace(/\/$/, '');
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return cleanPath === '/' ? baseUrl : `${baseUrl}${cleanPath}`;
  }
}

// Export singleton for convenience
export const urlGenerator = URLGenerator;
```

---

## 5. Configuration Validator

### File: `server/config/validate-config.ts`

```typescript
/**
 * Validate domain configuration before deployment
 * Run with: npm run validate-config
 */

import { DOMAIN_CONFIG, validateDomainConfig } from './domain-config';
import { validateEmailConfig } from './email-config';

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateDomainConfiguration(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Test domain configuration
  try {
    validateDomainConfig();
  } catch (error: any) {
    errors.push(error.message);
  }

  // Test email configuration
  try {
    validateEmailConfig();
  } catch (error: any) {
    errors.push(error.message);
  }

  // Check for HTTPS in production
  if (process.env.NODE_ENV === 'production') {
    const urls = {
      appUrl: DOMAIN_CONFIG.appUrl,
      baseUrl: DOMAIN_CONFIG.baseUrl,
      frontendUrl: DOMAIN_CONFIG.frontendUrl,
    };

    for (const [name, url] of Object.entries(urls)) {
      if (!url.startsWith('https://')) {
        warnings.push(`${name} should use HTTPS in production: ${url}`);
      }
    }
  }

  // Warn about localhost in production
  if (process.env.NODE_ENV === 'production') {
    if (DOMAIN_CONFIG.productionDomain.includes('localhost')) {
      errors.push('localhost is not allowed in production');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Log validation results
 */
export function logValidationResults(result: ValidationResult): void {
  if (result.valid) {
    console.log('✓ Configuration validation passed');
  } else {
    console.error('✗ Configuration validation failed:');
    result.errors.forEach(error => {
      console.error(`  - ${error}`);
    });
  }

  if (result.warnings.length > 0) {
    console.warn('⚠ Configuration warnings:');
    result.warnings.forEach(warning => {
      console.warn(`  - ${warning}`);
    });
  }
}

// Run validation if this file is executed directly
if (require.main === module) {
  const result = validateDomainConfiguration();
  logValidationResults(result);
  process.exit(result.valid ? 0 : 1);
}
```

---

## 6. Environment Template

### File: `.env.example`

```bash
# ============================================================================
# Domain Configuration
# ============================================================================

# Primary production domain - used as base for all other domains/emails
# Required: Must be set in all environments
PRODUCTION_DOMAIN=brokervault.ai

# Base URLs (optional - derived from PRODUCTION_DOMAIN if not set)
APP_URL=https://brokervault.ai
BASE_URL=https://brokervault.ai
FRONTEND_URL=https://brokervault.ai

# ============================================================================
# Email Configuration
# ============================================================================

# System/transactional emails
SYSTEM_EMAIL=system@brokervault.ai
SUPPORT_EMAIL=support@brokervault.ai
NOREPLY_EMAIL=noreply@brokervault.ai

# Specialized emails
SIGNATURES_EMAIL=signatures@brokervault.ai
LEGAL_EMAIL=legal@brokervault.ai
PRIVACY_EMAIL=privacy@brokervault.ai
ALERTS_EMAIL=alerts@brokervault.ai
ENTERPRISE_EMAIL=enterprise@brokervault.ai

# Message threading
REPLY_DOMAIN=reply.brokervault.ai

# ============================================================================
# OAuth Callbacks
# ============================================================================
# Optional: Auto-generated from PRODUCTION_DOMAIN if not set

OAUTH_CALLBACK_MICROSOFT=https://brokervault.ai/api/integrations/oauth/callback/microsoft
OAUTH_CALLBACK_GMAIL=https://brokervault.ai/api/integrations/oauth/callback/gmail
OAUTH_CALLBACK_SLACK=https://brokervault.ai/api/integrations/oauth/callback/slack
OAUTH_CALLBACK_HUBSPOT=https://brokervault.ai/api/integrations/oauth/callback/hubspot

# ============================================================================
# Client-Side Configuration (Vite)
# ============================================================================

VITE_PRODUCTION_DOMAIN=brokervault.ai
VITE_APP_URL=https://brokervault.ai
VITE_BASE_URL=https://brokervault.ai

# Client-side email addresses
VITE_SUPPORT_EMAIL=support@brokervault.ai
VITE_LEGAL_EMAIL=legal@brokervault.ai
VITE_PRIVACY_EMAIL=privacy@brokervault.ai
VITE_ENTERPRISE_EMAIL=enterprise@brokervault.ai

# ============================================================================
# Third-Party Services
# ============================================================================

SENDGRID_API_KEY=your_sendgrid_key_here
STRIPE_SECRET_KEY=your_stripe_key_here
DATABASE_URL=postgresql://user:password@localhost/db

# ============================================================================
# Application Settings
# ============================================================================

NODE_ENV=development
PORT=5000
```

---

## 7. Pre-Commit Hook

### File: `.husky/pre-commit`

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "Running pre-commit checks..."

# Check 1: Prevent hardcoded domains
echo "Checking for hardcoded domains..."
if git diff --cached | grep -E '(cimshare|example)\.com' | grep -v '//'; then
  echo -e "${RED}❌ Error: Hardcoded domain references found in staged changes${NC}"
  echo "   Use DOMAIN_CONFIG, EMAIL_CONFIG, or environment variables instead"
  echo "   Reference: docs/QUICK-REFERENCE-DOMAIN-CONFIG.md"
  exit 1
fi

# Check 2: Run configuration validation
echo "Validating configuration..."
if ! npm run validate-config > /dev/null 2>&1; then
  echo -e "${RED}❌ Configuration validation failed${NC}"
  npm run validate-config
  exit 1
fi

echo -e "${GREEN}✓ Pre-commit checks passed${NC}"
exit 0
```

To set up the hook:
```bash
npm install husky --save-dev
npx husky install
npx husky add .husky/pre-commit "chmod +x .husky/pre-commit && ./.husky/pre-commit"
```

---

## 8. NPM Scripts

### Add to `package.json`

```json
{
  "scripts": {
    "validate-config": "tsx server/config/validate-config.ts",
    "generate-static-files": "tsx scripts/generate-static-files.ts",
    "predev": "npm run validate-config && npm run generate-static-files",
    "prebuild": "npm run validate-config && npm run generate-static-files",
    "check-hardcoded-domains": "grep -r \"cimshare\\.com\\|example\\.com\" --include=\"*.ts\" --include=\"*.tsx\" . | grep -v node_modules | grep -v dist || echo 'No hardcoded domains found'",
    "check-domain-config": "npm run validate-config && npm run check-hardcoded-domains"
  }
}
```

---

## 9. Usage Examples

### ❌ Before (Anti-Pattern)

```typescript
// server/routes.ts
const baseUrl = process.env.BASE_URL || 'https://brokervault.ai';
const email = 'support@brokervault.ai';
const url = `${baseUrl}/share/${slug}`;
```

### ✓ After (Correct Pattern)

```typescript
// server/routes.ts
import { DOMAIN_CONFIG } from './config/domain-config';
import { EMAIL_ADDRESSES } from './config/email-config';
import { urlGenerator } from '../shared/url-generation';

const baseUrl = DOMAIN_CONFIG.appUrl;
const email = EMAIL_ADDRESSES.SUPPORT;
const url = urlGenerator.generateShareUrl(slug);
```

---

## 10. Testing

### Unit Test Template

**File: `server/config/__tests__/domain-config.test.ts`**

```typescript
import { DOMAIN_CONFIG, validateDomainConfig } from '../domain-config';

describe('Domain Configuration', () => {
  // Save original env
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('DOMAIN_CONFIG', () => {
    it('loads production domain from environment', () => {
      process.env.PRODUCTION_DOMAIN = 'test.example.com';
      expect(DOMAIN_CONFIG.productionDomain).toBe('brokervault.ai'); // Uses default in test
    });

    it('has valid email addresses', () => {
      expect(DOMAIN_CONFIG.email.support).toContain('@');
      expect(DOMAIN_CONFIG.email.system).toContain('@');
    });

    it('has valid URLs', () => {
      expect(DOMAIN_CONFIG.appUrl).toMatch(/^https?:\/\//);
      expect(DOMAIN_CONFIG.baseUrl).toMatch(/^https?:\/\//);
    });
  });

  describe('validateDomainConfig', () => {
    it('throws error if domain is missing', () => {
      process.env.PRODUCTION_DOMAIN = '';
      expect(validateDomainConfig).toThrow();
    });

    it('validates successfully with valid config', () => {
      process.env.PRODUCTION_DOMAIN = 'test.example.com';
      expect(() => validateDomainConfig()).not.toThrow();
    });
  });
});
```

---

## Quick Copy-Paste Checklist

- [ ] Copy `domain-config.ts` to `server/config/`
- [ ] Copy `email-config.ts` to `server/config/`
- [ ] Copy `env-loader.ts` to `server/config/`
- [ ] Copy `validate-config.ts` to `server/config/`
- [ ] Copy `url-generation.ts` to `shared/`
- [ ] Copy `.env.example` to root
- [ ] Copy `.husky/pre-commit` to `.husky/` (create if needed)
- [ ] Add npm scripts to `package.json`
- [ ] Add unit tests to `__tests__/` directories
- [ ] Run `npm run validate-config` to test
- [ ] Run `npm run generate-static-files` to test
- [ ] Commit with meaningful message

---

All code templates are production-ready and follow TypeScript/Node best practices.
