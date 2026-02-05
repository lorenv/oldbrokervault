# CIM Generation Flow

## Overview

When a user generates a CIM (Confidential Information Memorandum), the document is created as a placeholder with `generationStatus: 'generating'`, then AI fills it in asynchronously in the background. The user is never shown the blank placeholder - they only see/receive notifications when the document is fully ready.

## Architecture

### Server-Side Flow

1. **Document Creation** (`server/routes.ts:2112-2141`)
   - User submits CIM generation request
   - Server creates placeholder document with:
     - `generationStatus: 'generating'`
     - `analysis: { sections: [], title, generatingPlaceholder: true }`
   - Server returns immediately with document ID

2. **Background Generation** (`server/routes.ts:1767-1920`)
   - `generateCimInBackground()` runs asynchronously (fire-and-forget)
   - Performs website analysis, logo extraction, image extraction in parallel
   - Calls AI to generate the CIM content
   - On success: saves `analysis` AND sets `generationStatus: 'ready'` atomically
   - On failure: sets `generationStatus: 'failed'` with error message

3. **Status Endpoint** (`server/routes.ts:3383-3420`)
   - `GET /api/cim/:id/status` returns current generation status
   - Used by frontend for polling
   - Defaults to 'ready' for legacy documents without the field

4. **Cancellation Endpoint** (`server/routes.ts:3422-3449`)
   - `DELETE /api/cim/:id/generation` cancels in-progress generation
   - Deletes the placeholder document

### Frontend Flow

1. **CIM Generator** (`client/src/components/cim-generator.tsx`)
   - User fills form and submits
   - On success, registers with `CimGenerationContext`
   - Stays on form page showing local progress animation
   - Does NOT redirect to document page

2. **CIM Generation Context** (`client/src/contexts/cim-generation-context.tsx`)
   - Global state management for active generation
   - Persists to `localStorage` (survives page refresh)
   - Polls `/api/cim/:id/status` every 3 seconds
   - Shows toast notification only when `generationStatus === 'ready'`
   - Invalidates React Query cache when complete

3. **CIM Generation Overlay** (`client/src/components/cim-generation-overlay.tsx`)
   - Full-screen overlay with progress animation
   - Auto-shows when user navigates away from dashboard during generation
   - "Continue in Background" dismisses overlay (generation continues)
   - "Cancel Generation" deletes the placeholder document

4. **Documents Page** (`client/src/pages/documents-page.tsx`)
   - Documents with `generationStatus === 'generating'` show:
     - Spinner overlay
     - "Generating..." badge
     - Not clickable (no navigation)

5. **Document Detail Page** (`client/src/pages/document-detail-page.tsx`)
   - If `generationStatus === 'generating'`: shows "Generating Your CIM" screen
   - If `generationStatus === 'failed'`: shows error state with retry option
   - If `generationStatus === 'ready'`: shows full document

## User Experience

### Happy Path

1. User fills CIM form and clicks "Generate"
2. Progress animation shows on the form page
3. User can:
   - Wait and watch the animation
   - Navigate away (overlay auto-shows with options)
   - Click "Continue in Background" to dismiss overlay
4. When generation completes:
   - Toast notification: "CIM Ready!" with "View Document" link
   - Document lists refresh automatically
5. Clicking the link shows the fully-generated document

### Navigation During Generation

1. User starts generation, then navigates to /documents
2. Overlay auto-appears showing progress
3. User can dismiss overlay to browse documents
4. Generating document shows in list with spinner (not clickable)
5. Toast appears when ready

### Page Refresh During Generation

1. On page load, context checks `localStorage` for active generation
2. Verifies with server if generation is still active
3. If still generating: restores state, shows overlay
4. If already complete: shows toast with link

### Cancellation

1. User clicks "Cancel Generation" in overlay
2. Confirmation dialog appears
3. On confirm: `DELETE /api/cim/:id/generation` deletes placeholder
4. Toast confirms cancellation

## Database Schema

```typescript
// In shared/schema.ts
generationStatus: text("generation_status").default("ready"), // 'generating' | 'ready' | 'failed'
generationError: text("generation_error"),
generationStartedAt: timestamp("generation_started_at"),
```

## Key Files

| File | Purpose |
|------|---------|
| `server/routes.ts` | API endpoints, background generation logic |
| `client/src/contexts/cim-generation-context.tsx` | Global state, polling, notifications |
| `client/src/components/cim-generation-overlay.tsx` | Progress overlay UI |
| `client/src/components/cim-generator.tsx` | Form and initial generation trigger |
| `client/src/pages/documents-page.tsx` | Document list with generating states |
| `client/src/pages/document-detail-page.tsx` | Document view with generating/failed states |

## Cache Invalidation

When generation completes, these queries are invalidated to ensure fresh data:

```typescript
queryClient.invalidateQueries({ queryKey: ["/api/cim"] });
queryClient.invalidateQueries({ queryKey: ["/api/dashboard/recent"] });
queryClient.invalidateQueries({ queryKey: [`/api/cim/${docId}`] });
```

## Error Handling

- **Network errors during polling**: Logged, polling continues
- **AI generation failure**: Status set to 'failed', error message stored
- **Cancellation failure**: Toast shows error, state cleared anyway
- **Document not found**: Storage cleared, no notification

## Status Values

| Status | Meaning | User Experience |
|--------|---------|-----------------|
| `generating` | AI is working | Spinner, overlay, not clickable |
| `ready` | Complete | Normal document view |
| `failed` | Error occurred | Error state with retry option |
| `null` | Legacy document | Treated as 'ready' |
