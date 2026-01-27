# Replit Migration Guide

This document outlines all Replit-specific dependencies in the codebase and provides a step-by-step migration plan for moving to a different hosting provider.

---

## Table of Contents

1. [Dependency Analysis](#dependency-analysis)
2. [Migration Plan](#migration-plan)
3. [Pre-Migration Checklist](#pre-migration-checklist)
4. [Post-Migration Testing](#post-migration-testing)

---

## Dependency Analysis

### Critical Dependencies (Must Replace)

| Component | Location | Purpose | Migration Impact |
|-----------|----------|---------|------------------|
| `@replit/object-storage` | `package.json`, `server/object-storage.ts` | File/image uploads and cloud storage | **HIGH** - Must replace with S3, GCS, or similar |

#### Object Storage Details

The `server/object-storage.ts` file provides these methods that rely on Replit's object storage:

- `uploadBuffer(key, buffer, contentType)` - Upload files
- `downloadBuffer(key)` - Download files
- `deleteFile(key)` - Delete files
- `exists(key)` - Check if file exists
- `list(prefix)` - List files with prefix

**Files stored include:**
- Company logos
- Document uploads
- E-signature PDFs
- CIM (Confidential Information Memorandum) documents

---

### Development Dependencies (Can Remove)

| Component | Location | Purpose | Migration Impact |
|-----------|----------|---------|------------------|
| `@replit/vite-plugin-cartographer` | `package.json:165`, `vite.config.ts:31-34` | Code navigation in Replit IDE | **LOW** - Dev only, remove |
| `@replit/vite-plugin-runtime-error-modal` | `package.json:166`, `vite.config.ts:15` | Error overlay during development | **LOW** - Dev only, remove |
| `@replit/vite-plugin-shadcn-theme-json` | `package.json:54`, `vite.config.ts:16` | Shadcn UI theme JSON support | **LOW** - Optional, can remove or replace |

---

### Environment Variables

| Variable | Files | Purpose | Required After Migration |
|----------|-------|---------|-------------------------|
| `REPL_ID` | `server/db.ts:14`, `vite.config.ts:29` | Detect Replit environment | No - Remove checks |
| `REPL_SLUG` | `server/db.ts:14`, `server/stripe.ts:371`, `vite.config.ts:123` | Project identifier for URLs | No - Use `BASE_URL` instead |
| `REPLIT_DEV_DOMAIN` | `server/email.ts:502`, `server/services/esignature-service.ts:136`, `server/stripe.ts:196`, `vite.config.ts:123` | Development URL generation | No - Use `BASE_URL` instead |
| `REPLIT_DOMAINS` | `server/stripe.ts:196,299` | Stripe redirect URLs in dev | No - Use `BASE_URL` instead |
| `REPLIT_DB_URL` | `server/db.ts:14` | Checked but not used | No - Already unused |

---

### Code References by File

#### `server/object-storage.ts`
- **Lines:** Entire file
- **Impact:** CRITICAL
- **Description:** Complete object storage service using `@replit/object-storage`
- **Action:** Rewrite to use AWS S3, Google Cloud Storage, Cloudflare R2, or similar

#### `server/db.ts`
- **Lines:** 9-14, 24-32
- **Impact:** MEDIUM
- **Description:** Environment detection for database pool optimization
- **Code:**
  ```typescript
  const isReplit = process.env.REPL_ID || process.env.REPLIT_DB_URL || process.env.REPL_SLUG;

  const poolConfig = {
    max: isProduction ? 30 : (isReplit ? 20 : 10),
    idleTimeoutMillis: isReplit ? 60000 : 30000,
    connectionTimeoutMillis: isReplit ? 12000 : 8000,
    // ...
  };
  ```
- **Action:** Remove `isReplit` checks, use `isProduction` only

#### `server/email.ts`
- **Lines:** 502-504
- **Impact:** MEDIUM
- **Description:** Password reset email URL generation
- **Code:**
  ```typescript
  const baseUrl = process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : process.env.BASE_URL || 'https://your-app.replit.app';
  ```
- **Action:** Simplify to use `process.env.BASE_URL`

#### `server/services/esignature-service.ts`
- **Lines:** 136
- **Impact:** MEDIUM
- **Description:** E-signature signing URL generation
- **Code:**
  ```typescript
  const signingUrl = `${process.env.REPLIT_DEV_DOMAIN || 'https://your-domain.com'}/sign/${recipient.accessToken}`;
  ```
- **Action:** Change to use `process.env.BASE_URL`

#### `server/stripe.ts`
- **Lines:** 196, 299, 371
- **Impact:** MEDIUM
- **Description:** Stripe redirect URLs for payment flows
- **Action:** Replace Replit domain logic with `process.env.BASE_URL`

#### `server/security.ts`
- **Lines:** 239-240
- **Impact:** LOW
- **Description:** CSP allowlist includes Replit domains
- **Code:**
  ```typescript
  "https://*.replit.dev",
  "https://*.replit.app",
  ```
- **Action:** Remove Replit domains, add your production domain

#### `vite.config.ts`
- **Lines:** 3, 5, 15-16, 28-35, 123
- **Impact:** LOW (dev only)
- **Description:** Replit Vite plugins and HMR configuration
- **Action:** Remove Replit plugins, simplify HMR config

#### Diagnostic Scripts (Informational Only)
- `diagnose-sendgrid.js` - Contains hardcoded `cimshare.replit.app` URLs
- `check-mx-records.js` - Contains domain references
- **Action:** Update URLs after migration

---

## Migration Plan

### Phase 1: Object Storage Migration (Critical)

**Estimated effort: 2-4 hours**

1. **Choose a replacement storage provider:**
   - **AWS S3** (recommended - most documentation, widely supported)
   - **Google Cloud Storage** (good if using GCP)
   - **Cloudflare R2** (S3-compatible, no egress fees)
   - **DigitalOcean Spaces** (S3-compatible, simple pricing)
   - **MinIO** (self-hosted S3-compatible)

2. **Install the new SDK:**
   ```bash
   npm uninstall @replit/object-storage
   npm install @aws-sdk/client-s3
   ```

3. **Create new storage bucket:**
   - Create bucket in your chosen provider
   - Configure CORS for your domain
   - Set up IAM credentials with minimal permissions

4. **Rewrite `server/object-storage.ts`:**

   Replace with S3-compatible implementation:
   ```typescript
   import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

   const s3 = new S3Client({
     region: process.env.AWS_REGION || "us-east-1",
     credentials: {
       accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
       secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
     },
   });

   const BUCKET = process.env.S3_BUCKET_NAME!;

   export async function uploadBuffer(key: string, buffer: Buffer, contentType: string): Promise<string> {
     await s3.send(new PutObjectCommand({
       Bucket: BUCKET,
       Key: key,
       Body: buffer,
       ContentType: contentType,
     }));
     return key;
   }

   export async function downloadBuffer(key: string): Promise<Buffer> {
     const response = await s3.send(new GetObjectCommand({
       Bucket: BUCKET,
       Key: key,
     }));
     return Buffer.from(await response.Body!.transformToByteArray());
   }

   export async function deleteFile(key: string): Promise<void> {
     await s3.send(new DeleteObjectCommand({
       Bucket: BUCKET,
       Key: key,
     }));
   }

   export async function exists(key: string): Promise<boolean> {
     try {
       await s3.send(new HeadObjectCommand({
         Bucket: BUCKET,
         Key: key,
       }));
       return true;
     } catch {
       return false;
     }
   }

   export async function list(prefix: string): Promise<string[]> {
     const response = await s3.send(new ListObjectsV2Command({
       Bucket: BUCKET,
       Prefix: prefix,
     }));
     return response.Contents?.map(obj => obj.Key!) || [];
   }
   ```

5. **Migrate existing files:**
   - Export all files from Replit object storage before migration
   - Upload to new storage provider
   - Update any URLs stored in database if using absolute URLs

6. **Add new environment variables:**
   ```env
   AWS_REGION=us-east-1
   AWS_ACCESS_KEY_ID=your-access-key
   AWS_SECRET_ACCESS_KEY=your-secret-key
   S3_BUCKET_NAME=your-bucket-name
   ```

---

### Phase 2: Remove Development Dependencies

**Estimated effort: 30 minutes**

1. **Uninstall Replit packages:**
   ```bash
   npm uninstall @replit/vite-plugin-cartographer @replit/vite-plugin-runtime-error-modal @replit/vite-plugin-shadcn-theme-json
   ```

2. **Update `vite.config.ts`:**

   Before:
   ```typescript
   import { defineConfig } from "vite";
   import react from "@vitejs/plugin-react";
   import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
   import path, { dirname } from "path";
   import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
   import { fileURLToPath } from "url";
   import { visualizer } from "rollup-plugin-visualizer";

   // ... later in plugins:
   plugins: [
     react(),
     runtimeErrorOverlay(),
     themePlugin(),
     // Replit cartographer plugin...
   ],
   ```

   After:
   ```typescript
   import { defineConfig } from "vite";
   import react from "@vitejs/plugin-react";
   import path, { dirname } from "path";
   import { fileURLToPath } from "url";
   import { visualizer } from "rollup-plugin-visualizer";

   // ... later in plugins:
   plugins: [
     react(),
     // Keep visualizer for bundle analysis
   ],
   ```

3. **Simplify HMR configuration:**

   Before:
   ```typescript
   server: {
     hmr: process.env.REPLIT_DEV_DOMAIN || process.env.REPL_SLUG ? false : { overlay: true },
   },
   ```

   After:
   ```typescript
   server: {
     hmr: { overlay: true },
   },
   ```

---

### Phase 3: Update Environment Variable Usage

**Estimated effort: 1 hour**

1. **Add `BASE_URL` to your environment:**
   ```env
   BASE_URL=https://yourdomain.com
   ```

2. **Update `server/email.ts` (line 502-504):**

   Before:
   ```typescript
   const baseUrl = process.env.REPLIT_DEV_DOMAIN
     ? `https://${process.env.REPLIT_DEV_DOMAIN}`
     : process.env.BASE_URL || 'https://your-app.replit.app';
   ```

   After:
   ```typescript
   const baseUrl = process.env.BASE_URL;
   if (!baseUrl) throw new Error('BASE_URL environment variable is required');
   ```

3. **Update `server/services/esignature-service.ts` (line 136):**

   Before:
   ```typescript
   const signingUrl = `${process.env.REPLIT_DEV_DOMAIN || 'https://your-domain.com'}/sign/${recipient.accessToken}`;
   ```

   After:
   ```typescript
   const signingUrl = `${process.env.BASE_URL}/sign/${recipient.accessToken}`;
   ```

4. **Update `server/stripe.ts` (lines 196, 299, 371):**
   - Replace all `REPLIT_DOMAINS` and `REPL_SLUG` references
   - Use `process.env.BASE_URL` for all redirect URLs

---

### Phase 4: Update Database Configuration

**Estimated effort: 30 minutes**

1. **Update `server/db.ts`:**

   Before:
   ```typescript
   const isReplit = process.env.REPL_ID || process.env.REPLIT_DB_URL || process.env.REPL_SLUG;

   const poolConfig = {
     max: isProduction ? 30 : (isReplit ? 20 : 10),
     idleTimeoutMillis: isReplit ? 60000 : 30000,
     connectionTimeoutMillis: isReplit ? 12000 : 8000,
     statement_timeout: isReplit ? 20000 : 15000,
     query_timeout: isReplit ? 20000 : 15000,
   };
   ```

   After:
   ```typescript
   const poolConfig = {
     max: isProduction ? 30 : 10,
     idleTimeoutMillis: 30000,
     connectionTimeoutMillis: 8000,
     statement_timeout: 15000,
     query_timeout: 15000,
   };
   ```

   Note: Adjust these values based on your new hosting provider's recommendations.

---

### Phase 5: Update Security Configuration

**Estimated effort: 15 minutes**

1. **Update `server/security.ts` (lines 239-240):**

   Remove from CSP allowlists:
   ```typescript
   "https://*.replit.dev",
   "https://*.replit.app",
   ```

   Add your production domain:
   ```typescript
   "https://yourdomain.com",
   "https://*.yourdomain.com",
   ```

---

### Phase 6: Update Diagnostic Scripts

**Estimated effort: 15 minutes**

1. **Update `diagnose-sendgrid.js`:**
   - Replace `cimshare.replit.app` with your production domain

2. **Update `check-mx-records.js`:**
   - Update any hardcoded domain references

---

## Pre-Migration Checklist

### Infrastructure Setup
- [ ] Choose and set up new hosting provider (Vercel, Railway, Render, Fly.io, AWS, etc.)
- [ ] Set up object storage bucket (S3, GCS, R2, etc.)
- [ ] Configure bucket CORS policy
- [ ] Create IAM credentials for storage access
- [ ] Set up PostgreSQL database (can keep Neon or migrate)
- [ ] Configure custom domain and SSL

### Data Migration
- [ ] Export all files from Replit object storage
- [ ] Upload files to new storage provider
- [ ] Backup database
- [ ] Test database connection from new host

### Environment Configuration
- [ ] Create `.env` file for new environment
- [ ] Set `BASE_URL` to production domain
- [ ] Set storage credentials (AWS_ACCESS_KEY_ID, etc.)
- [ ] Set `DATABASE_URL` for database connection
- [ ] Configure all other required environment variables

### Code Changes
- [ ] Replace `@replit/object-storage` with S3 SDK
- [ ] Remove Replit Vite plugins
- [ ] Update all `REPLIT_*` environment variable usage
- [ ] Update database pool configuration
- [ ] Update CSP security policy
- [ ] Update diagnostic scripts

---

## Post-Migration Testing

### Authentication
- [ ] User registration
- [ ] User login
- [ ] Password reset email
- [ ] Session management

### File Operations
- [ ] Upload company logo
- [ ] Upload documents
- [ ] View/download uploaded files
- [ ] Delete files

### E-Signatures
- [ ] Create e-signature template
- [ ] Send document for signature
- [ ] Signing link works
- [ ] Signed PDF generation and storage

### CRM Features
- [ ] Create/edit deals
- [ ] Create/edit contacts
- [ ] Create/edit companies
- [ ] Task management

### Payments (Stripe)
- [ ] Checkout flow redirects correctly
- [ ] Webhook endpoints accessible
- [ ] Subscription management

### Email
- [ ] Outbound emails send correctly
- [ ] Inbound email webhooks work
- [ ] Email links point to correct domain

### General
- [ ] All API endpoints respond
- [ ] Frontend builds and loads
- [ ] No console errors
- [ ] Performance acceptable

---

## Summary

### What's Safe (No Replit Dependency)
- **Authentication system** - Fully custom, no Replit Auth
- **Database** - Uses Neon PostgreSQL (works anywhere)
- **Email** - Uses SendGrid (portable)
- **Payments** - Uses Stripe (portable)
- **Frontend** - Standard React/Vite (portable)

### What Needs Work
1. **Object Storage** - Only critical dependency, requires rewrite
2. **Environment Variables** - Simple find/replace with `BASE_URL`
3. **Dev Tooling** - Remove Replit plugins (optional, dev-only)

### Estimated Total Migration Effort
- **Minimum:** 4-6 hours (experienced developer)
- **Comfortable:** 1-2 days (including testing)
- **With data migration:** 2-3 days (if large file library)

---

*Document generated: January 2025*
