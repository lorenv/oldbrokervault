# BrokerVault Testing Troubleshooting Guide

**Purpose:** Quick reference for diagnosing and fixing common issues found during testing.

---

## How to Use This Guide

1. Identify the issue category (404, Auth, Document, etc.)
2. Find matching symptoms in the table
3. Check the "Likely Cause" column
4. Apply the suggested fix
5. Re-run the failed test

---

## 404 Errors

### Page/Route 404s

| Symptom | Likely Cause | Fix | Files to Check |
|---------|--------------|-----|----------------|
| Page route returns 404 | Route not registered | Add route to router | `client/src/App.tsx` |
| Route works locally but not after build | Lazy import path wrong | Check import path in App.tsx | `client/src/App.tsx` |
| Route shows blank page | Component error | Check browser console for errors | Component file |
| Settings sub-route 404 | Route not in authenticated router | Add to `AuthenticatedRouter` | `client/src/App.tsx:132-222` |

### API Endpoint 404s

| Symptom | Likely Cause | Fix | Files to Check |
|---------|--------------|-----|----------------|
| API endpoint 404 | Endpoint not registered | Add to routes file | `server/routes/*.ts` |
| API works in dev, not in prod | Route file not imported | Import in server/index.ts | `server/index.ts` |
| API 404 for specific ID | Record doesn't exist | Check database for record | Database / API logs |
| Nested API route 404 | Path mismatch | Verify route path matches frontend call | Route file + frontend API call |

### Static Asset 404s

| Symptom | Likely Cause | Fix | Files to Check |
|---------|--------------|-----|----------------|
| Image 404 | Wrong path or missing file | Check file exists in public/ | `public/` directory |
| Font 404 | Font file missing | Add font file or use CDN | `public/fonts/` |
| CSS 404 after build | Build output mismatch | Run fresh build | `vite.config.ts` |

### Share Link 404s

| Symptom | Likely Cause | Fix | Files to Check |
|---------|--------------|-----|----------------|
| Share link 404 | Invalid slug | Verify shareSlug exists in DB | `cimDocuments` table |
| Share link was working, now 404 | Document deleted | Check if doc was soft deleted | `cimDocuments.deletedAt` |
| Share link shows wrong content | Slug collision | Check for duplicate slugs | Database query |

---

## Authentication Issues

### Login Problems

| Symptom | Likely Cause | Fix | Files to Check |
|---------|--------------|-----|----------------|
| Login redirect loop | Session not persisting | Check cookie settings, clear cookies | `server/auth.ts`, browser cookies |
| "Invalid credentials" for valid user | Password hash mismatch | Reset password or check hash algorithm | `server/auth.ts` |
| Login works but user data empty | Session/user mismatch | Clear session table, re-login | `session` table |
| OAuth login fails | OAuth callback URL wrong | Check OAuth app settings | Google/Microsoft console |

### Session Issues

| Symptom | Likely Cause | Fix | Files to Check |
|---------|--------------|-----|----------------|
| Logged out unexpectedly | Session expired | Increase session maxAge | `server/auth.ts` |
| User data stale | Cache not invalidated | Clear user cache | `server/cache.ts` |
| Session not created | Database connection issue | Check PostgreSQL connection | `server/db.ts` |

### Protected Route Issues

| Symptom | Likely Cause | Fix | Files to Check |
|---------|--------------|-----|----------------|
| Protected route accessible without login | Missing ProtectedRoute wrapper | Wrap with ProtectedRoute | `client/src/App.tsx` |
| Protected route shows 404 when logged in | Route not in authenticatedRoutes array | Add to array | `client/src/App.tsx:89-112` |
| API returns 401 unexpectedly | Session cookie not sent | Check credentials: 'include' on fetch | Frontend API calls |

---

## Document (CIM) Issues

### Create/Save Issues

| Symptom | Likely Cause | Fix | Files to Check |
|---------|--------------|-----|----------------|
| Document not saving | Validation error | Check API response for errors | Browser network tab |
| Required fields error | Missing form data | Verify all required fields sent | Form component |
| AI generation fails | API key issue or rate limit | Check OpenAI/Perplexity keys | `.env`, `server/index.ts` |
| Duplicate slug error | Slug already exists | Generate new unique slug | Backend slug generation |

### Display Issues

| Symptom | Likely Cause | Fix | Files to Check |
|---------|--------------|-----|----------------|
| Document content blank | Data not loaded | Check API response | Network tab |
| Sections not showing | Section data structure wrong | Verify customSections schema | `shared/schema.ts` |
| Formatting broken | HTML sanitization issue | Check HTML rendering | Component rendering code |

### Export Issues

| Symptom | Likely Cause | Fix | Files to Check |
|---------|--------------|-----|----------------|
| PDF export fails | PDF library error | Check server logs | `server/document-export.ts` |
| Word export fails | DOCX generation error | Check docx library | `server/document-export.ts` |
| Export downloads empty file | Content not passed | Verify document data sent | Export API endpoint |
| Export timeout | Document too large | Increase timeout or paginate | Server configuration |

### Image Issues

| Symptom | Likely Cause | Fix | Files to Check |
|---------|--------------|-----|----------------|
| Logo not displaying | Storage URL invalid | Check object storage config | Storage configuration |
| Images broken after save | URL not persisted | Check image persistence logic | Document save handler |
| Images load slowly | Not optimized | Run image optimization | `scripts/optimize-images.js` |
| CORS error on images | Storage CORS misconfigured | Update CORS settings | Object storage settings |

---

## CRM Issues

### Data Not Showing

| Symptom | Likely Cause | Fix | Files to Check |
|---------|--------------|-----|----------------|
| Records not showing | userId filter issue | Check query filters | `server/routes/crm-routes.ts` |
| Only some records show | Pagination issue | Check limit/offset | API query params |
| Wrong user's data showing | Auth context wrong | Verify req.user | Auth middleware |
| CRM page empty after login | Org visibility settings | Check CRM visibility config | User settings |

### CRUD Operations

| Symptom | Likely Cause | Fix | Files to Check |
|---------|--------------|-----|----------------|
| Create fails silently | Validation error swallowed | Add error handling | Form component |
| Update doesn't persist | Optimistic update failed | Check mutation error handling | React Query mutation |
| Delete fails | Foreign key constraint | Check cascade delete or remove relations first | `shared/schema.ts` relations |
| Bulk operations fail | Transaction issue | Wrap in transaction | Backend route handler |

### Relationships

| Symptom | Likely Cause | Fix | Files to Check |
|---------|--------------|-----|----------------|
| Can't link company to deal | Relation not created | Check relation API | CRM routes |
| Linked records not showing | Join query wrong | Verify SQL join | Backend query |
| Deleting breaks related records | Cascade not set | Add onDelete cascade | Schema relations |

---

## E-Signature Issues

### Template Issues

| Symptom | Likely Cause | Fix | Files to Check |
|---------|--------------|-----|----------------|
| Template not saving | Schema mismatch | Check ndaTemplates schema | `shared/schema.ts` |
| Template fields missing | Field data not included | Verify field serialization | Template editor component |
| Can't edit template | Template locked | Check if template is in use | Template status |

### Signing Session Issues

| Symptom | Likely Cause | Fix | Files to Check |
|---------|--------------|-----|----------------|
| Session not created | Missing required data | Check session creation API | `server/routes/esign-routes.ts` |
| Recipients not added | Recipient validation failed | Verify email format | Session creation form |
| Send fails | Email service error | Check SendGrid config | `server/email.ts` |

### Signing Flow Issues

| Symptom | Likely Cause | Fix | Files to Check |
|---------|--------------|-----|----------------|
| Signing page 404 | Invalid/expired token | Regenerate access token | `ndaAccessTokens` table |
| Signing page won't load | Token validation failed | Check token expiry | Token validation logic |
| Signature not capturing | Canvas rendering issue | Check browser console | Signature component |
| Submit fails | Signature data malformed | Verify signature format | Signing API handler |

### Post-Signing Issues

| Symptom | Likely Cause | Fix | Files to Check |
|---------|--------------|-----|----------------|
| Signed NDA not in list | Insert failed | Check ndaSignatures table | Database |
| Signed user still blocked | Access token not created | Verify access flow | Access token creation |
| Audit log empty | Logging not triggered | Check audit log insert | Signing completion handler |
| Redirect after signing fails | Redirect URL missing | Set redirect URL in session | Session creation |

---

## Stripe Payment Issues

### Configuration Issues

| Symptom | Likely Cause | Fix | Files to Check |
|---------|--------------|-----|----------------|
| Checkout not loading | Invalid publishable key | Verify STRIPE_PUBLISHABLE_KEY | `.env` |
| "API key invalid" error | Wrong environment keys | Use test keys for dev | `.env` |
| Prices not showing | Price IDs wrong | Check Stripe dashboard for IDs | Pricing configuration |

### Payment Flow Issues

| Symptom | Likely Cause | Fix | Files to Check |
|---------|--------------|-----|----------------|
| Payment fails with test card | Not in test mode | Verify using test keys | `.env` |
| Checkout redirects fail | Success/cancel URLs wrong | Check URL configuration | Checkout session creation |
| Payment succeeds but plan not updated | Webhook not received | Check webhook endpoint | `server/routes/webhook-routes.ts` |

### Webhook Issues

| Symptom | Likely Cause | Fix | Files to Check |
|---------|--------------|-----|----------------|
| Webhook returns 400 | Invalid signature | Verify STRIPE_WEBHOOK_SECRET | `.env` |
| Webhook returns 500 | Handler error | Check server logs | Webhook handler |
| Events not processing | Event type not handled | Add event handler | Webhook switch statement |
| Duplicate events | Idempotency issue | Add event ID checking | Webhook handler |

### Subscription Issues

| Symptom | Likely Cause | Fix | Files to Check |
|---------|--------------|-----|----------------|
| Plan not updating after payment | User cache stale | Clear cache, refresh session | `server/cache.ts` |
| Features still locked | Subscription check wrong | Verify plan comparison logic | Feature gate checks |
| Customer portal 404 | Customer ID not stored | Ensure Stripe customer saved | User update on checkout |
| Cancel doesn't work | API error | Check Stripe API call | Cancellation handler |

---

## File Upload Issues

### Upload Failures

| Symptom | Likely Cause | Fix | Files to Check |
|---------|--------------|-----|----------------|
| Upload fails immediately | File too large | Increase size limit | Upload configuration |
| Upload times out | Slow connection/large file | Increase timeout | Server/client config |
| Upload succeeds but file missing | Storage write failed | Check storage credentials | Object storage config |
| Wrong file type error | MIME type validation | Update allowed types | Upload validation |

### Download Issues

| Symptom | Likely Cause | Fix | Files to Check |
|---------|--------------|-----|----------------|
| Download fails | Signed URL expired | Regenerate URL | Download endpoint |
| Download returns wrong file | File ID mismatch | Verify file lookup | Download handler |
| CORS error on download | Storage CORS settings | Update allowed origins | Object storage config |

---

## Database Issues

### Connection Issues

| Symptom | Likely Cause | Fix | Files to Check |
|---------|--------------|-----|----------------|
| "Connection refused" | Database not running | Start PostgreSQL | Database service |
| "Connection timeout" | Pool exhausted | Increase pool size | `server/db.ts` |
| "SSL required" | SSL not configured | Add SSL to connection | DATABASE_URL |

### Query Issues

| Symptom | Likely Cause | Fix | Files to Check |
|---------|--------------|-----|----------------|
| Query returns empty | Filter too restrictive | Check WHERE clauses | Query in route handler |
| Query very slow | Missing index | Add database index | `migrations/` |
| "Column not found" | Schema out of sync | Run db:push | `npm run db:push` |

---

## General Debugging Tips

### Browser DevTools

1. **Console Tab:** Look for JavaScript errors (red text)
2. **Network Tab:** Filter by `Fetch/XHR`, look for red (failed) requests
3. **Check status codes:** 4xx = client error, 5xx = server error
4. **Response tab:** Read error messages from API

### Server Logs

1. Check terminal running `npm run dev`
2. Look for stack traces
3. Search for the endpoint being called

### Database Debugging

```sql
-- Check if record exists
SELECT * FROM "cimDocuments" WHERE id = 'xxx';

-- Check user session
SELECT * FROM "session" WHERE sess->>'userId' = 'xxx';

-- Check recent errors in any audit log
SELECT * FROM "ndaAuditLog" ORDER BY "createdAt" DESC LIMIT 10;
```

### Quick Fixes

| Issue Type | Quick Fix |
|------------|-----------|
| Stale data | Hard refresh (Ctrl+Shift+R) |
| Auth issues | Clear cookies, re-login |
| Cache issues | Clear localStorage |
| Build issues | Delete `dist/`, rebuild |
| Dependencies | Delete `node_modules/`, reinstall |

---

## Escalation

If you cannot resolve an issue:

1. Document everything (steps, errors, screenshots)
2. Note what you tried
3. Create a detailed issue/ticket
4. Tag with severity (Critical/High/Medium/Low)
5. Include environment details (branch, commit, config)

---

*Troubleshooting Guide v1.0 - Created 2026-02-04*
