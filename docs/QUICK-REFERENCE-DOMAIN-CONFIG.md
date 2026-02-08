# Domain Configuration Quick Reference

## TL;DR - For Developers

### When you need a domain/email/URL...

**DON'T do this:**
```typescript
const email = 'support@brokervault.ai';  // ❌ Hardcoded
const url = `https://brokervault.ai/share/${id}`;  // ❌ Hardcoded
const baseUrl = process.env.BASE_URL || 'https://brokervault.ai';  // ❌ Scattered
```

**DO this:**
```typescript
import { DOMAIN_CONFIG } from '../config/domain-config';
import { urlGenerator } from '../url-generation';
import { EMAIL_CONFIG } from '../config/email-config';

const email = EMAIL_CONFIG.DEFAULT_FROM;  // ✓ Centralized
const url = urlGenerator.generateShareUrl(id);  // ✓ Uses config
const baseUrl = DOMAIN_CONFIG.appUrl;  // ✓ From environment
```

---

## Common Tasks

### Task: Send an email from support address
```typescript
import { EMAIL_CONFIG } from './config/email-config';

await sendEmail({
  from: EMAIL_CONFIG.DEFAULT_FROM,  // ✓ Use this
  to: recipientEmail,
  subject: 'Help',
});
```

### Task: Generate a share link
```typescript
import { urlGenerator } from './url-generation';

const shareLink = urlGenerator.generateShareUrl(shareSlug);
// Result: https://brokervault.ai/share/abc123
```

### Task: Create a message thread email
```typescript
import { EMAIL_CONFIG } from './config/email-config';

const threadEmail = `${EMAIL_CONFIG.THREAD_EMAIL_PREFIX}-${threadId}@${EMAIL_CONFIG.THREAD_EMAIL_DOMAIN}`;
// Result: thread-abc123@reply.brokervault.ai
```

### Task: Set OAuth redirect URL
```typescript
import { DOMAIN_CONFIG } from './config/domain-config';

const redirectUrl = DOMAIN_CONFIG.oauth.microsoft;
// Result: https://brokervault.ai/api/integrations/oauth/callback/microsoft
```

### Task: Get privacy email for contact form
```typescript
import { EMAIL_ADDRESSES } from './config/email-config';

await sendEmail({
  to: EMAIL_ADDRESSES.PRIVACY,  // ✓ Use this constant
});
```

---

## All Available Constants

### Server-Side

#### Domain Config
```typescript
import { DOMAIN_CONFIG } from 'server/config/domain-config';

// Properties available:
DOMAIN_CONFIG.productionDomain        // 'brokervault.ai'
DOMAIN_CONFIG.replyDomain             // 'reply.brokervault.ai'
DOMAIN_CONFIG.appUrl                  // 'https://brokervault.ai'
DOMAIN_CONFIG.baseUrl                 // 'https://brokervault.ai'
DOMAIN_CONFIG.frontendUrl             // 'https://brokervault.ai'
DOMAIN_CONFIG.companyName             // 'Broker Vault'
DOMAIN_CONFIG.currentYear             // 2026
```

#### Email Config
```typescript
import { EMAIL_ADDRESSES, EMAIL_CONFIG } from 'server/config/email-config';

// Individual emails:
EMAIL_ADDRESSES.SYSTEM                // 'system@brokervault.ai'
EMAIL_ADDRESSES.SUPPORT               // 'support@brokervault.ai'
EMAIL_ADDRESSES.NOREPLY               // 'noreply@brokervault.ai'
EMAIL_ADDRESSES.SIGNATURES            // 'signatures@brokervault.ai'
EMAIL_ADDRESSES.LEGAL                 // 'legal@brokervault.ai'
EMAIL_ADDRESSES.PRIVACY               // 'privacy@brokervault.ai'
EMAIL_ADDRESSES.ALERTS                // 'alerts@brokervault.ai'
EMAIL_ADDRESSES.ENTERPRISE            // 'enterprise@brokervault.ai'

// Defaults:
EMAIL_CONFIG.DEFAULT_FROM             // 'support@brokervault.ai'
EMAIL_CONFIG.DEFAULT_REPLY_TO         // 'support@brokervault.ai'
EMAIL_CONFIG.THREAD_EMAIL_DOMAIN      // 'reply.brokervault.ai'
EMAIL_CONFIG.THREAD_EMAIL_PREFIX      // 'thread'
```

#### URL Generator
```typescript
import { urlGenerator } from 'shared/url-generation';

urlGenerator.generateShareUrl(slug)              // /share/...
urlGenerator.generateNdaUrl(slug)                // /nda/...
urlGenerator.generateSigningUrl(token)           // /esign/sign/...
urlGenerator.generateUnsubscribeUrl(token)       // /unsubscribe/...
urlGenerator.generateOAuthCallbackUrl(provider)  // /api/integrations/oauth/callback/...
urlGenerator.generateThreadEmail(threadId)       // thread-xxx@reply.brokervault.ai
```

### Client-Side

#### Domain Config (Client)
```typescript
import { DOMAIN_CONFIG } from 'client/src/lib/domain-config';

DOMAIN_CONFIG.productionDomain        // 'brokervault.ai'
DOMAIN_CONFIG.appUrl                  // 'https://brokervault.ai'
DOMAIN_CONFIG.baseUrl                 // 'https://brokervault.ai'
DOMAIN_CONFIG.companyName             // 'Broker Vault'
DOMAIN_CONFIG.currentYear             // 2026

// Email addresses:
DOMAIN_CONFIG.email.support           // 'support@brokervault.ai'
DOMAIN_CONFIG.email.legal             // 'legal@brokervault.ai'
DOMAIN_CONFIG.email.privacy           // 'privacy@brokervault.ai'
DOMAIN_CONFIG.email.enterprise        // 'enterprise@brokervault.ai'
```

---

## Migration Path (For Next Domain Change)

### Step 1: Update Configuration (5 minutes)
```bash
# Edit these files:
# 1. server/config/domain-config.ts - Change PRODUCTION_DOMAIN
# 2. client/src/lib/domain-config.ts - Change PRODUCTION_DOMAIN
# 3. .env - Update PRODUCTION_DOMAIN and email variables
```

### Step 2: Validate (1 minute)
```bash
npm run validate-config
```

### Step 3: Generate Static Files (1 minute)
```bash
npm run generate-static-files
```

### Step 4: Test (5 minutes)
```bash
npm run test:all
```

### Step 5: Build (5 minutes)
```bash
npm run build
```

### Step 6: Deploy
```bash
# Deploy with updated environment variables
```

**Total time: ~20 minutes** (vs. several hours for the previous migration)

---

## File Locations Reference

| What | File |
|------|------|
| Server domain config | `server/config/domain-config.ts` |
| Server email config | `server/config/email-config.ts` |
| Server environment loader | `server/config/env-loader.ts` |
| Server config validator | `server/config/validate-config.ts` |
| Shared URL utilities | `shared/url-generation.ts` |
| Client domain config | `client/src/lib/domain-config.ts` |
| Environment template | `.env.example` |
| Actual environment | `.env` |
| Build script | `vite.config.ts` |

---

## Validation Commands

```bash
# Validate configuration before deployment
npm run validate-config

# Check for any remaining hardcoded domains (grep)
grep -r "cimshare.com\|example.com" --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules --exclude-dir=dist

# Check that all emails use the configured domain
grep -r "@[a-z]*\.com" --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules | grep -v "DOMAIN_CONFIG\|EMAIL_"

# Run full test suite
npm run test:all
```

---

## Environment Variables

### Required
```
PRODUCTION_DOMAIN=brokervault.ai
```

### Optional (will be derived from PRODUCTION_DOMAIN if not set)
```
APP_URL=https://brokervault.ai
BASE_URL=https://brokervault.ai
FRONTEND_URL=https://brokervault.ai
SYSTEM_EMAIL=system@brokervault.ai
SUPPORT_EMAIL=support@brokervault.ai
NOREPLY_EMAIL=noreply@brokervault.ai
SIGNATURES_EMAIL=signatures@brokervault.ai
LEGAL_EMAIL=legal@brokervault.ai
PRIVACY_EMAIL=privacy@brokervault.ai
ALERTS_EMAIL=alerts@brokervault.ai
ENTERPRISE_EMAIL=enterprise@brokervault.ai
REPLY_DOMAIN=reply.brokervault.ai
```

---

## Common Mistakes (Avoid These!)

### ❌ Mistake 1: Hardcoding domain in a new feature
```typescript
// DON'T do this:
const supportEmail = 'support@brokervault.ai';
```

### ✓ Fix: Use configuration
```typescript
// DO this:
import { EMAIL_ADDRESSES } from './config/email-config';
const supportEmail = EMAIL_ADDRESSES.SUPPORT;
```

---

### ❌ Mistake 2: Using process.env directly instead of config
```typescript
// DON'T do this:
const baseUrl = process.env.BASE_URL || 'https://brokervault.ai';
```

### ✓ Fix: Use domain config
```typescript
// DO this:
import { DOMAIN_CONFIG } from './config/domain-config';
const baseUrl = DOMAIN_CONFIG.appUrl;
```

---

### ❌ Mistake 3: Duplicating URL generation logic
```typescript
// DON'T do this in 10 different files:
const shareUrl = `${baseUrl}/share/${slug}`;
const ndaUrl = `${baseUrl}/nda/${slug}`;
const signingUrl = `${baseUrl}/esign/sign/${token}`;
```

### ✓ Fix: Use URL generator
```typescript
// DO this once and reuse:
import { urlGenerator } from './url-generation';
const shareUrl = urlGenerator.generateShareUrl(slug);
const ndaUrl = urlGenerator.generateNdaUrl(slug);
const signingUrl = urlGenerator.generateSigningUrl(token);
```

---

### ❌ Mistake 4: Forgetting to update tests
```typescript
// If you change a domain, tests will fail with hardcoded URLs
```

### ✓ Fix: Mock configuration in tests
```typescript
jest.mock('./config/domain-config', () => ({
  DOMAIN_CONFIG: {
    productionDomain: 'test.local',
    appUrl: 'https://test.local',
    // ... etc
  },
}));
```

---

## Need to Add a New Domain-Dependent Value?

### 1. Add to `DOMAIN_CONFIG`
```typescript
// server/config/domain-config.ts
export const DOMAIN_CONFIG = {
  // ... existing fields
  myNewValue: process.env.MY_NEW_VALUE || 'default-value',
} as const;
```

### 2. Add environment variable to `.env.example`
```bash
MY_NEW_VALUE=some-value
```

### 3. Use it everywhere else
```typescript
import { DOMAIN_CONFIG } from './config/domain-config';
const value = DOMAIN_CONFIG.myNewValue;
```

---

## Support & Questions

- See full implementation guide: `/docs/PREVENTION-STRATEGIES.md`
- See migration checklist: `/docs/DOMAIN-MIGRATION-CHECKLIST.md`
- Ask on Slack: #infrastructure-team
