# CIM Background Generation Plan

## Overview
Allow users to navigate away from the CIM generation page while their document is being generated. The system will create a placeholder document immediately and update it when generation completes.

## Current Architecture
- Client sends POST to `/api/cim/generate` or `/api/cim/upload`
- Server performs AI generation synchronously (15-30 seconds)
- Server saves document to database AFTER generation completes
- Server returns document ID
- Client redirects to document page

**Problem**: If user navigates away, request may be aborted and they lose the result.

---

## Proposed Architecture

### Phase 1: Database Changes

Add `generationStatus` field to `cim_documents` table:

```sql
ALTER TABLE cim_documents ADD COLUMN generation_status text DEFAULT 'ready';
-- Values: 'generating', 'ready', 'failed'

ALTER TABLE cim_documents ADD COLUMN generation_error text;
-- Stores error message if generation fails

ALTER TABLE cim_documents ADD COLUMN generation_started_at timestamp;
-- Track when generation began (for timeout detection)
```

**Schema changes** (`shared/schema.ts`):
```typescript
// In cimDocuments table definition
generationStatus: text("generation_status").default("ready"), // 'generating', 'ready', 'failed'
generationError: text("generation_error"),
generationStartedAt: timestamp("generation_started_at"),
```

---

### Phase 2: Server Changes

#### 2.1 Modify `/api/cim/generate` and `/api/cim/upload`

**New flow**:
1. Validate inputs
2. Create document immediately with:
   - `generationStatus: 'generating'`
   - `generationStartedAt: new Date()`
   - `analysis: {}` (empty placeholder)
   - All input fields (title, transcript, directions, etc.)
3. Return document ID to client immediately
4. Continue AI generation in background (don't await)
5. On success: Update document with `generationStatus: 'ready'` and actual analysis
6. On failure: Update document with `generationStatus: 'failed'` and error message

```typescript
// Pseudo-code for the new flow
app.post("/api/cim/generate", async (req, res) => {
  // 1. Validate inputs (existing code)

  // 2. Create placeholder document
  const doc = await storage.createCimDocument(req.user!.id, {
    ...data,
    analysis: {}, // Empty placeholder
    generationStatus: 'generating',
    generationStartedAt: new Date(),
  });

  // 3. Return immediately
  res.json({
    id: doc.id,
    generationStatus: 'generating',
    message: 'CIM generation started. You can navigate away safely.'
  });

  // 4. Generate in background (fire and forget)
  generateCimInBackground(doc.id, data, req.user!.id).catch(err => {
    console.error('Background CIM generation failed:', err);
  });
});

async function generateCimInBackground(docId: number, data: any, userId: number) {
  try {
    const analysis = await generateCimWithWebsiteAnalysis(...);

    await storage.updateCimDocument(docId, {
      analysis,
      generationStatus: 'ready',
    });

    // Optional: Send notification via WebSocket or store for polling
  } catch (error) {
    await storage.updateCimDocument(docId, {
      generationStatus: 'failed',
      generationError: error.message,
    });
  }
}
```

#### 2.2 Add Status Polling Endpoint

```typescript
app.get("/api/cim/:id/status", async (req, res) => {
  const doc = await storage.getCimDocument(parseInt(req.params.id));
  if (!doc || doc.userId !== req.user!.id) {
    return res.status(404).json({ error: "Not found" });
  }

  res.json({
    id: doc.id,
    generationStatus: doc.generationStatus,
    generationError: doc.generationError,
    // Include analysis only if ready
    ...(doc.generationStatus === 'ready' && { analysis: doc.analysis }),
  });
});
```

---

### Phase 3: Client Changes

#### 3.1 Update CIM Generator Component

After form submission:
```typescript
const generateMutation = useMutation({
  mutationFn: async (data) => {
    const response = await apiRequest("POST", "/api/cim/generate", { body: data });
    return response.json();
  },
  onSuccess: (result) => {
    // Redirect immediately to document page
    // Document page will handle the "generating" state
    navigate(`/documents/${result.id}`);
  },
});
```

#### 3.2 Update Document Detail Page

Add polling logic when `generationStatus === 'generating'`:

```typescript
const { data: document, refetch } = useQuery({
  queryKey: ['/api/cim', documentId],
  // ... existing config
});

// Poll for status updates while generating
useEffect(() => {
  if (document?.generationStatus === 'generating') {
    const interval = setInterval(() => {
      refetch();
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }
}, [document?.generationStatus]);

// Render generating state
if (document?.generationStatus === 'generating') {
  return (
    <div className="flex flex-col items-center justify-center p-12">
      <CimGenerationProgress stage="generating_document" />
      <p className="text-gray-600 mt-4">
        Your CIM is being generated. You can safely navigate to other
        parts of the app - we'll notify you when it's ready.
      </p>
    </div>
  );
}

// Handle failed state
if (document?.generationStatus === 'failed') {
  return (
    <div className="text-center p-12">
      <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
      <h2>Generation Failed</h2>
      <p>{document.generationError}</p>
      <Button onClick={() => navigate('/documents')}>
        Back to Documents
      </Button>
    </div>
  );
}
```

#### 3.3 Add Global Notification (Optional Enhancement)

In the app layout or header, poll for any documents with `generationStatus === 'generating'`:

```typescript
const { data: pendingDocs } = useQuery({
  queryKey: ['/api/cim/pending'],
  refetchInterval: 5000,
});

// Show toast when a doc transitions from generating to ready
useEffect(() => {
  // Compare with previous state, show toast on completion
}, [pendingDocs]);
```

---

### Phase 4: UI Feedback Text

Update the generate button area to show:

```tsx
{generateMutation.isPending ? (
  <div className="text-center">
    <Loader2 className="animate-spin" />
    <p className="text-sm text-gray-500 mt-2">
      Starting generation... You'll be redirected to your document where
      you can safely navigate away while it completes.
    </p>
  </div>
) : (
  // Normal button
)}
```

On the document page while generating:
```
"Your CIM is being generated. Feel free to explore other parts of
BrokerVault - we'll keep this page updated automatically, or you
can check back anytime."
```

---

## Migration Considerations

1. **Existing documents**: All existing documents have `analysis` populated, so they're implicitly `status: 'ready'`. The default value handles this.

2. **Timeout handling**: Add a background job or check to mark documents as `failed` if `generationStartedAt` is > 5 minutes ago and status is still `generating`.

3. **Cleanup**: Consider deleting failed documents after 24 hours, or allow users to retry.

---

## Files to Modify

### Schema
- `shared/schema.ts` - Add generationStatus, generationError, generationStartedAt fields

### Server
- `server/routes.ts` - Modify `/api/cim/generate` and `/api/cim/upload` endpoints
- `server/storage.ts` - Ensure updateCimDocument supports new fields

### Client
- `client/src/components/cim-generator.tsx` - Update mutation to redirect immediately
- `client/src/pages/document-detail-page.tsx` - Add generating/failed states with polling
- `client/src/components/ui/cim-generation-progress.tsx` - Ensure it works standalone

---

## Testing Checklist

- [ ] Generate CIM, stay on page - works as before
- [ ] Generate CIM, navigate away mid-generation - document completes
- [ ] Generate CIM, close browser - document completes
- [ ] Generation failure - shows error state on document page
- [ ] Polling stops when generation completes
- [ ] Old documents without status field work correctly
