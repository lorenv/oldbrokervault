# Broker Vault Pre-Launch Audit Report

**Date:** 2026-02-01
**Scope:** Security & Performance/Scale
**Motivation:** Pre-launch readiness

---

## Executive Summary

| Severity | Security | Performance | Total |
|----------|----------|-------------|-------|
| Critical | 1 | 1 | **2** |
| High | 3 | 6 | **9** |
| Medium | 13 | 11 | **24** |
| Low | 6 | 2 | **8** |
| **Total** | 23 | 20 | **43** |

**Immediate action required:** 2 critical issues + 9 high-severity issues should be addressed before launch.

---

## Critical Findings

### [SEC-001] Hardcoded Admin Credentials in Repository
- **Category:** Security / Secrets
- **Location:** server/add-premium-user.ts:17
- **Issue:** Hardcoded email and password for an admin user are stored in plain text in the codebase. Creates/updates an admin user with premium access until 2035.
- **Evidence:**
```typescript
const email = 'robert@dealve.cc';
const password = 'Flydccstone500!';
```
- **Fix:** Remove this script entirely or convert to use environment variables. Admin users should be provisioned through a secure administrative process.
- **Effort:** Low

### [PERF-001] Unbounded getAllUsers() and getAllCimDocuments() Queries
- **Category:** Performance / Database
- **Location:** server/storage.ts:1104-1109
- **Issue:** These methods return ALL records without pagination, LIMIT, or WHERE conditions.
- **Evidence:**
```typescript
async getAllUsers(): Promise<User[]> {
  return db.select().from(users);
}
```
- **Impact:** Full table scans. With 1000+ users creating multiple documents, causes memory exhaustion (O(n)), query timeouts, and connection pool starvation.
- **Fix:** Add pagination with LIMIT/OFFSET, use streaming for large datasets, restrict to admin-only with explicit limits.
- **Effort:** Medium

---

## High Findings

### [SEC-002] Weak Password Reset Token Generation
- **Category:** Security / Authentication
- **Location:** server/routes.ts:8191
- **Issue:** Password reset tokens use `Math.random()`, which is not cryptographically secure.
- **Evidence:**
```typescript
const resetToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
```
- **Fix:** Use `crypto.randomBytes(32).toString('hex')` as done in token-utils.ts.
- **Effort:** Low

### [SEC-005] Development Encryption Key Fallback
- **Category:** Security / Secrets
- **Location:** server/integrations/encryption.ts:26-31
- **Issue:** A deterministic "development" encryption key is generated when `INTEGRATION_ENCRYPTION_KEY` is not set. If NODE_ENV is misconfigured, this weak key could be used in production.
- **Fix:** Fail hard if encryption key is missing regardless of environment.
- **Effort:** Low

### [SEC-020] Session Secret Without Validation
- **Category:** Security / Authentication
- **Location:** server/security.ts:430
- **Issue:** Session secret is accessed with `!` assertion without validating existence or entropy. If missing or weak, sessions could be compromised.
- **Fix:** Add startup validation: ensure SESSION_SECRET exists and is at least 32 characters of random data.
- **Effort:** Low

### [PERF-002] N+1 Query Pattern in CRM Contact Migration
- **Category:** Performance / Database
- **Location:** server/routes/crm-routes.ts:236-289
- **Issue:** Sequential database inserts inside a for loop when migrating contacts.
- **Impact:** O(n) database round-trips. With 500 contacts = 1000+ individual queries instead of 2 batch inserts.
- **Fix:** Use batch inserts: `db.insert(crmContacts).values(contactsArray)`
- **Effort:** Low

### [PERF-004] Connection Pool Size Limited to 30 Connections
- **Category:** Performance / Connection Pooling
- **Location:** server/db.ts:24-33
- **Issue:** Maximum 30 database connections may be insufficient for 1000+ concurrent users.
- **Impact:** With 1000 concurrent users at 10 requests/second, 30 connections with 50ms average query time = 600 requests/second max.
- **Fix:** Increase pool size, implement PgBouncer, add read replicas.
- **Effort:** Medium

### [PERF-006] Large File Upload in Memory (200MB Limit)
- **Category:** Performance / Memory
- **Location:** server/routes.ts:2553-2561
- **Issue:** Large files stored entirely in memory buffer before processing.
- **Evidence:**
```typescript
const largeFileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }
});
```
- **Impact:** 10 concurrent 200MB uploads = 2GB memory usage. At 100 concurrent users = OOM crashes.
- **Fix:** Switch to `multer.diskStorage()` or streaming uploads to object storage.
- **Effort:** Medium

### [PERF-011] No Index Optimization for OR Query on Slugs
- **Category:** Performance / Database
- **Location:** shared/schema.ts:188-189, storage.ts
- **Issue:** Share pages query by slug using OR condition that may cause sequential scans.
- **Evidence:**
```typescript
.where(or(eq(cimDocuments.shareSlug, slug), eq(cimDocuments.customSlug, slug)))
```
- **Impact:** At 100K documents, each share page load could take 50-100ms.
- **Fix:** Create computed index or use UNION instead of OR.
- **Effort:** Low

### [PERF-016] PDF Generation Fully Synchronous
- **Category:** Performance / API
- **Location:** server/routes.ts:1609-1628
- **Issue:** PDF generation is a blocking CPU-intensive operation (5-30 seconds for complex documents).
- **Impact:** Blocks main thread, causing all other requests to queue. 10 concurrent PDF exports = unresponsive server.
- **Fix:** Move to worker threads, implement job queue (Bull/BullMQ), pre-generate and cache common PDFs.
- **Effort:** High

### [PERF-019] No Rate Limiting on Expensive Endpoints
- **Category:** Performance / API
- **Location:** server/routes.ts:1887
- **Issue:** CIM generation endpoint (uses external AI) has no per-user rate limiting.
- **Impact:** Single user could trigger hundreds of AI generations, exhausting API quota. Also opens DoS vector.
- **Fix:** Per-user rate limiting (e.g., 10/hour), request queuing, cost-based throttling.
- **Effort:** Medium

---

## Medium Findings

### [SEC-003] Plaintext Share Password Comparison (Timing Attack)
- **Category:** Security / Authentication
- **Location:** server/routes.ts:1088, 1421, 1685
- **Issue:** Share passwords compared using direct `===`, vulnerable to timing attacks. Also stored in plaintext.
- **Fix:** Use `crypto.timingSafeEqual()` and hash share passwords with bcrypt.
- **Effort:** Medium

### [SEC-004] CSP Allows 'unsafe-inline' and 'unsafe-eval'
- **Category:** Security / Headers
- **Location:** server/security.ts:142-143
- **Issue:** Content Security Policy allows unsafe directives, weakening XSS protection.
- **Fix:** Use nonces/hashes for inline scripts in production. Conditionally apply stricter CSP.
- **Effort:** Medium

### [SEC-008] OAuth Redirect URL Not Validated
- **Category:** Security / Authentication
- **Location:** server/auth.ts:768-770, 789-791
- **Issue:** OAuth redirect stored in session and used without validation. Enables open redirect attacks.
- **Fix:** Validate redirect is relative (starts with `/` not `//`) or matches allowed domains.
- **Effort:** Low

### [SEC-009] Weak Password Validation on Registration
- **Category:** Security / Authentication
- **Location:** server/auth.ts:430
- **Issue:** Registration doesn't enforce password strength requirements defined in security.ts.
- **Fix:** Apply `registerValidation` middleware to `/api/register` endpoint.
- **Effort:** Low

### [SEC-010] Debug Endpoint Exposed in Production
- **Category:** Security / Data Exposure
- **Location:** server/auth.ts:882-924
- **Issue:** `/api/debug/user` endpoint exposes detailed user information without environment check.
- **Fix:** Wrap in `if (process.env.NODE_ENV !== 'production')` or remove.
- **Effort:** Low

### [SEC-011] Session Cookie Security Depends on NODE_ENV
- **Category:** Security / Authentication
- **Location:** server/security.ts:433-440
- **Issue:** Cookie security depends on `NODE_ENV === 'production'`. If misconfigured, cookies won't be secured.
- **Fix:** Also detect HTTPS from request headers as additional check.
- **Effort:** Low

### [SEC-012] No Rate Limiting on Password Reset
- **Category:** Security / Authentication
- **Location:** server/routes.ts:8188
- **Issue:** Password reset has 1 hour expiry with no account lockout. Allows email enumeration and brute-forcing.
- **Fix:** Implement exponential backoff, consistent response times.
- **Effort:** Medium

### [SEC-013] Response Sanitization Middleware Disabled
- **Category:** Security / Data Exposure
- **Location:** server/security-middleware.ts:16-17
- **Issue:** Response sanitization commented out ("per user request").
- **Fix:** Re-enable `validateResponseSafety` check or implement alternative.
- **Effort:** Medium

### [SEC-014] Potential SSRF in Website Analysis
- **Category:** Security / Injection
- **Location:** server/routes.ts:1992-1993, 2071-2077
- **Issue:** User-provided website URLs passed to analysis functions without validation against internal addresses.
- **Fix:** Block requests to private IP ranges (10.x, 192.168.x, 127.x, localhost).
- **Effort:** Medium

### [SEC-017] SendGrid Webhook Lacks Signature Verification
- **Category:** Security / Input Validation
- **Location:** server/routes.ts:233-383
- **Issue:** SendGrid inbound webhook doesn't verify signature. Attackers could forge webhook requests.
- **Fix:** Implement SendGrid signature verification using `X-Twilio-Email-Event-Webhook-Signature`.
- **Effort:** Medium

### [SEC-019] Unsafe dangerouslySetInnerHTML Usage
- **Category:** Security / Injection
- **Location:** client/src/components/nda-field-form.tsx:236
- **Issue:** NDA content rendered with `dangerouslySetInnerHTML` without sanitization.
- **Fix:** Apply `sanitizeHtml(ndaContent)` before rendering.
- **Effort:** Low

### [PERF-003] In-Memory Cache with Fixed 1000 Entry Limit
- **Category:** Performance / Caching
- **Location:** server/cache.ts:14
- **Issue:** Share cache limited to 1000 entries with no distributed caching.
- **Impact:** At 1000+ concurrent users, cache thrashing occurs. Single-server = no cache sharing.
- **Fix:** Replace with Redis for distributed caching.
- **Effort:** Medium

### [PERF-005] EventEmitter MaxListeners Set to 1000-2000
- **Category:** Performance / Memory
- **Location:** server/db.ts:38, server/storage.ts:40
- **Issue:** Extremely high maxListeners values indicate potential memory leak patterns.
- **Fix:** Investigate why so many listeners needed, implement proper cleanup.
- **Effort:** Medium

### [PERF-008] Complex JOIN Query in getCimDocuments
- **Category:** Performance / Database
- **Location:** server/storage.ts:970-1000
- **Issue:** Dashboard query performs LEFT JOINs across 4 tables with GROUP BY on 20+ columns.
- **Impact:** Exponentially slower as tables grow. 10K documents + 50K signatures = massive intermediate results.
- **Fix:** Create materialized view, denormalize counts, or use separate cached queries.
- **Effort:** High

### [PERF-009] WebSocket Connection Without Limits
- **Category:** Performance / Concurrency
- **Location:** server/websocket.ts:192-228
- **Issue:** No limits on WebSocket connections per user or total, no maxPayload.
- **Fix:** Add `maxPayload` limit (1MB), per-IP connection limits, heartbeat timeout cleanup.
- **Effort:** Low

### [PERF-010] Frontend Bundle Lacks Tree Shaking
- **Category:** Performance / Frontend
- **Location:** vite.config.ts:53-96
- **Issue:** Manual chunking imports entire libraries. Recharts ~400KB, pdf-lib ~1.5MB.
- **Fix:** Use dynamic imports, consider lighter alternatives, route-based code splitting.
- **Effort:** Medium

### [PERF-012] Synchronous File System Operations
- **Category:** Performance / API
- **Location:** server/storage.ts:1310, 2017-2026
- **Issue:** Blocking sync file operations (readFileSync, unlinkSync) in async contexts.
- **Fix:** Replace with `fs.promises.readFile()`, `fs.promises.unlink()`.
- **Effort:** Low

### [PERF-013] No Request Timeout on External API Calls
- **Category:** Performance / API
- **Location:** Multiple (routes.ts, perplexity.ts)
- **Issue:** External API calls lack explicit timeouts.
- **Impact:** Hanging external API blocks handlers indefinitely, consuming connection pool slots.
- **Fix:** Implement AbortController with 30s timeout, add circuit breaker pattern.
- **Effort:** Medium

### [PERF-017] Missing Composite Indexes
- **Category:** Performance / Database
- **Location:** shared/schema.ts (multiple tables)
- **Issue:** Tables lack composite indexes for common query patterns.
- **Fix:** Add indexes: `(cim_document_id, approved)` on nda_signatures, `(user_id, deleted_at)` on cim_documents.
- **Effort:** Low

### [PERF-018] Session Store Using Database Without Cleanup
- **Category:** Performance / Database
- **Location:** server/storage.ts:21-28
- **Issue:** Session store prunes only every hour. With 1000+ daily users, table grows rapidly.
- **Fix:** Add index on session expiry, reduce prune interval, consider Redis for sessions.
- **Effort:** Medium

---

## Low Findings

### [SEC-006] Missing Rate Limiting on Share Financial Files
- **Category:** Security / Authorization
- **Location:** server/routes.ts:3274-3331
- **Issue:** Endpoint allows enumeration attacks on file IDs.
- **Fix:** Add rate limiting to prevent enumeration.
- **Effort:** Low

### [SEC-007] Verbose Error Logging in Production
- **Category:** Security / Data Exposure
- **Location:** server/routes.ts:694-695
- **Issue:** Detailed error info including stack traces logged with console.error.
- **Fix:** Use structured logging that masks sensitive data in production.
- **Effort:** Medium

### [SEC-015] Duplicate Route Handler for Password Reset
- **Category:** Security / Input Validation
- **Location:** server/routes.ts:8216 and 8327
- **Issue:** `/api/reset-password` defined twice. Second handler lacks password validation.
- **Fix:** Remove duplicate, ensure consistent validation.
- **Effort:** Low

### [SEC-016] Missing Input Validation on CRM File Uploads
- **Category:** Security / Input Validation
- **Location:** server/routes/crm-routes.ts:117-130
- **Issue:** Filename not sanitized before use.
- **Fix:** Sanitize filenames to remove path traversal and special characters.
- **Effort:** Low

### [SEC-018] Audit Logs Only In Memory
- **Category:** Security / Data Exposure
- **Location:** server/security.ts:106, 127-129
- **Issue:** Security audit logs stored only in memory (max 1000), lost on restart.
- **Fix:** Persist to database or external logging service.
- **Effort:** Medium

### [PERF-007] No Pagination on Activity Log Queries
- **Category:** Performance / Database
- **Location:** server/storage.ts:2498
- **Issue:** Activity log queries may fetch unbounded records.
- **Fix:** Ensure all list queries have proper LIMIT enforcement.
- **Effort:** Low

### [PERF-014] Sequential Document Version History
- **Category:** Performance / Database
- **Location:** shared/schema.ts:474-482
- **Issue:** Version history grows unboundedly without pruning.
- **Fix:** Implement version pruning, archive old versions, store deltas.
- **Effort:** Medium

### [PERF-015] No Database Query Logging in Production
- **Category:** Performance / Database
- **Location:** server/query-logger.ts
- **Issue:** Slow query detection not enabled in production.
- **Fix:** Enable slow query logging (>500ms), integrate with APM tool.
- **Effort:** Low

---

## Priority Action Plan

### Before Launch (Week 1)

**Critical + High - Must Fix:**

| ID | Issue | Effort | Owner |
|----|-------|--------|-------|
| SEC-001 | Remove hardcoded credentials | Low | |
| SEC-002 | Fix password reset token generation | Low | |
| SEC-005 | Remove dev encryption key fallback | Low | |
| SEC-020 | Validate SESSION_SECRET at startup | Low | |
| PERF-001 | Add pagination to getAllUsers/getAllCimDocuments | Medium | |
| PERF-002 | Batch CRM contact migration | Low | |
| PERF-006 | Switch large uploads to disk/streaming | Medium | |

### Post-Launch Sprint 1 (Week 2-3)

**High + Quick Medium Wins:**

| ID | Issue | Effort |
|----|-------|--------|
| PERF-004 | Increase connection pool + consider PgBouncer | Medium |
| PERF-016 | Move PDF generation to worker threads | High |
| PERF-019 | Rate limit expensive AI endpoints | Medium |
| SEC-008 | Validate OAuth redirect URLs | Low |
| SEC-009 | Enforce password strength on registration | Low |
| SEC-010 | Disable debug endpoint in production | Low |
| PERF-009 | Add WebSocket connection limits | Low |
| PERF-012 | Replace sync fs operations | Low |

### Ongoing Improvements (Week 4+)

- SEC-003: Hash share passwords (Medium)
- SEC-014: Add SSRF protection (Medium)
- SEC-017: Verify SendGrid webhooks (Medium)
- PERF-003: Implement Redis caching (Medium)
- PERF-008: Optimize dashboard query (High)
- PERF-010: Optimize frontend bundle (Medium)

---

## Appendix: Files Most Affected

| File | Finding Count |
|------|---------------|
| server/routes.ts | 12 |
| server/storage.ts | 6 |
| server/security.ts | 4 |
| server/auth.ts | 4 |
| shared/schema.ts | 3 |
| server/db.ts | 2 |
