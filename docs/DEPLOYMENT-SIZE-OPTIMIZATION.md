# Deployment Size Optimization Guide

**Date:** February 2026
**Issue:** Docker image exceeding 8 GiB limit for Replit Auto-scale (Cloud Run) deployments

---

## Problem Summary

Deployment to Replit Auto-scale was failing with the error:

```
Promotion failed
Your deployment attempt had the following errors:
- The Docker image size exceeds the 8 GiB limit for Cloud Run deployments
- The node_modules directory is 1.1GB and dist directory is 1.1GB, totaling ~2.2GB before compression
- Large dependencies like Puppeteer, canvas, and sharp are contributing to image bloat
```

---

## Root Causes Identified

### 1. Unused `canvas` Package (~100MB)

**Location:** `package.json` direct dependency

**Finding:** The npm `canvas` package (server-side Canvas API for Node.js) was listed as a dependency but was **not imported or used anywhere** in the server code.

**Confusion Point:** The client-side code uses `document.createElement('canvas')` for drag-and-drop signature overlays, but this is the **browser's built-in Canvas API** - it does NOT require the npm `canvas` package.

**Files checked:**
- `client/src/lib/image-utils.ts` - Uses browser Canvas (no npm package needed)
- `client/src/lib/canvas-utils.ts` - Uses browser Canvas (no npm package needed)
- All server files - No imports of `canvas` found

### 2. `geoip-lite` Package (~154MB)

**Location:** `package.json` direct dependency

**Finding:** The `geoip-lite` package contains a full offline IP-to-location database (154MB). It was used only for looking up signer IP addresses to record location in e-signature audit trails.

**Usage locations:**
- `server/services/esignature-service.ts`
- `server/routes.ts`
- `server/routes/esign-routes.ts`

### 3. Other Large Dependencies (Not Removed - Still Needed)

| Package | Size | Purpose | Status |
|---------|------|---------|--------|
| `sharp` | ~50-100MB | Image optimization in PDF processing | **Required** |
| `pdf2pic` | Uses `gm` | PDF to image conversion | **Required** |
| `pdfjs-dist` | ~70MB | PDF rendering | **Required** |
| `colorthief` | ~17MB | Brand color extraction from logos | **Required** |

### 4. Puppeteer - Not Actually Installed

**Finding:** Despite error messages mentioning Puppeteer, it was **not in package.json or package-lock.json**. References only existed in archived code (`attached_assets/` folder) which is excluded from builds.

---

## Fixes Implemented

### Fix 1: Remove Unused `canvas` Package

**Change:** Removed `"canvas": "^3.1.0"` from `package.json`

**Result:** Removed 27 related packages

**Verification:** Searched entire codebase for canvas imports - none found in server code

```bash
# Verification command
grep -r "from ['\"]canvas['\"]" server/
# Result: No matches
```

### Fix 2: Replace `geoip-lite` with Cloud API

**Change:** Created a lightweight geo-IP service using the free ip-api.com API

**New file:** `server/services/geo-ip-service.ts`

**Features:**
- Uses ip-api.com (free, no API key required, 45 req/min limit)
- 24-hour in-memory caching to minimize API calls
- Skips private/local IP addresses
- 5-second timeout to prevent blocking
- Graceful fallback on errors

**Updated files:**
1. `server/services/esignature-service.ts` - Changed import and usage
2. `server/routes.ts` - Changed dynamic import
3. `server/routes/esign-routes.ts` - Changed helper function

**Audit trail functionality:** Fully preserved - IP addresses and locations are still recorded in the same format

---

## Results

### Size Reduction

| Metric | Before | After | Saved |
|--------|--------|-------|-------|
| `dist/` directory | 1.1GB | 938MB | **~162MB** |
| `node_modules` | 1.1GB | 875MB | **~225MB** |
| Packages removed | - | 48 | - |

### Packages Removed

1. `canvas` and 27 related packages
2. `geoip-lite` and 21 related packages (IP database files)

---

## Remaining Large Dependencies

If further size reduction is needed, consider these options:

### Option A: Move PDF Processing to External Service
- `sharp`, `pdf2pic`, `pdfjs-dist` are needed for PDF-to-image conversion
- Could be moved to a serverless function (Cloud Function, Lambda)
- Main app would call the external service for PDF processing

### Option B: Client-Side PDF Rendering
- Use `pdfjs-dist` in the browser instead of server-side
- Render PDFs directly in client using canvas
- Only send final signature data to server

### Option C: Use External Image Service
- Replace `sharp` with Cloudinary or similar
- Upload images to CDN, resize via URL parameters

---

## Build Script Optimizations

The `build-autoscale.sh` script already includes these optimizations:

1. **Production-only dependencies:** `npm install --omit=dev`
2. **Platform-specific cleanup:** Removes unused sharp/canvas binaries for darwin, win32, arm
3. **Test directory cleanup:** Removes `__tests__`, `coverage`, `examples` from node_modules
4. **Puppeteer cache cleanup:** Removes any Chromium downloads (precautionary)

---

## Verification Commands

```bash
# Check dist size after build
du -sh dist/

# Find largest packages in production build
du -sh dist/node_modules/* | sort -hr | head -20

# Verify canvas is not imported
grep -r "from ['\"]canvas['\"]" server/

# Verify geoip-lite is not imported
grep -r "geoip-lite" server/
```

---

## Deployment Checklist

1. [ ] Run `npm install` to ensure lock file is updated
2. [ ] Run `./build-autoscale.sh` to create optimized build
3. [ ] Verify `dist/` size is under 1GB
4. [ ] Force a clean rebuild on Replit (clear cache if needed)
5. [ ] Deploy to Auto-scale

---

## Notes

- **ip-api.com rate limit:** 45 requests per minute on free tier. The 24-hour cache should keep usage well under this limit for typical e-signature workflows.
- **Browser Canvas vs npm canvas:** These are completely different. Browser Canvas is built-in and free. The npm `canvas` package is only needed for server-side rendering in Node.js.
- **Replit caching:** If changes don't seem to take effect, the deployment may be using a cached Docker layer. Force a clean rebuild.
