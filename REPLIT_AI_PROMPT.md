# Replit AI Agent - Analytics API Endpoints

Please create the following API endpoints for the analytics dashboard feature. Add these to `/home/runner/workspace/server/routes.ts`.

## IMPORTANT CLARIFICATIONS:

1. **Dynamic Range Support is REQUIRED**: The `/api/analytics/overview` endpoint MUST accept a `range` query parameter and return data for that specific time period.

2. **Signatures Count Must Be Time-Period Specific**: The `totalSignatures` in the overview endpoint should count ONLY the signatures that occurred within the selected time range, NOT all-time signatures. This is crucial for user understanding.

3. **The frontend is already implemented** and expects these endpoints to work with the specified query parameters and response formats.

## Required Endpoints:

### 1. GET /api/analytics/overview?range=30d
Returns aggregate analytics across all user's documents for the specified time range.

**Query params:**
- `range`: one of `7d`, `30d`, `90d`, `all` (defaults to `30d`)

**Response format:**
```json
{
  "totalViews": number,
  "totalSignatures": number,
  "pendingApprovals": number,
  "activeDocuments": number,
  "viewsTrend": number,  // percentage change from previous period (e.g., 15 for +15%, -10 for -10%)
  "signaturesTrend": number  // percentage change from previous period
}
```

**Implementation notes:**
- Get all CIM documents for the authenticated user
- **IMPORTANT**: Filter views and signatures by the time range specified in the `range` parameter
  - For `7d`: Count views/signatures from last 7 days only
  - For `30d`: Count views/signatures from last 30 days only
  - For `90d`: Count views/signatures from last 90 days only
  - For `all`: Count all views/signatures ever
- Count total views from `documentViews` table where:
  - `cimDocumentId` matches user's documents
  - **AND `viewedAt` is within the selected time range**
- Count total signatures from `ndaSignatures` table where:
  - `cimDocumentId` matches user's documents
  - **AND `signedAt` is within the selected time range**
- Count pending approvals: signatures where `ndaApprovalRequired = true` AND `approved = false` (NOT time-filtered, always show all pending)
- Count active documents: documents where `shareEnabled = true` (NOT time-filtered, always show all active)
- Calculate trends by comparing current period vs previous period of same length:
  - Example for `30d`: Compare last 30 days vs 30 days before that
  - Formula: `((current - previous) / previous) * 100`
  - Handle division by zero: if previous === 0, set trend to 0

### 2. GET /api/analytics/timeline?range=30d
Returns time-series data for views and signatures.

**Query params:**
- `range`: one of `7d`, `30d`, `90d`, `all` (defaults to `30d`)

**Response format:**
```json
[
  {
    "date": "2025-01-01",
    "views": 12,
    "signatures": 3
  },
  {
    "date": "2025-01-02",
    "views": 8,
    "signatures": 1
  }
  // ... more days
]
```

**Implementation notes:**
- Parse range parameter to determine date range
- Query `documentViews` grouped by date
- Query `ndaSignatures` grouped by `signedAt` date
- Join the data by date
- Return array of objects with date, views, signatures

### 3. GET /api/analytics/documents
Returns per-document analytics for table display.

**Response format:**
```json
[
  {
    "id": number,
    "title": string,
    "views": number,
    "signatures": number,
    "shareEnabled": boolean,
    "lastActivity": string  // ISO date of most recent view or signature
  }
  // ... more documents
]
```

**Implementation notes:**
- Get all user's CIM documents
- For each document:
  - Count views from `documentViews` table
  - Count signatures from `ndaSignatures` table
  - Get most recent activity from latest view or signature timestamp
- Sort by views descending
- Return array of document analytics

### 4. GET /api/analytics/pending-approvals
Returns all pending NDA approvals across all user's documents.

**Response format:**
```json
[
  {
    "id": number,  // signature ID
    "documentId": number,
    "documentTitle": string,
    "signerName": string,
    "signerEmail": string,
    "signerLocation": string,
    "signedAt": string  // ISO date
  }
  // ... more pending approvals
]
```

**Implementation notes:**
- Get all user's CIM documents
- Query `ndaSignatures` table where:
  - `cimDocumentId` matches user's documents
  - `approved = false`
  - The document has `ndaApprovalRequired = true`
- Join with `cimDocuments` to get document title
- Sort by `signedAt` descending (most recent first)
- Return array of pending approvals

### 5. GET /api/analytics/all-signatures
Returns all NDA signatures across all user's documents (for location map).

**Response format:**
```json
[
  {
    "id": number,  // signature ID
    "documentId": number,
    "documentTitle": string,
    "signerName": string,
    "signerEmail": string,
    "signerLocation": string,
    "signedAt": string  // ISO date
  }
  // ... more signatures
]
```

**Implementation notes:**
- Get all user's CIM documents
- Query ALL `ndaSignatures` (approved and unapproved) where `cimDocumentId` matches user's documents
- Join with `cimDocuments` to get document title
- Sort by `signedAt` descending (most recent first)
- Return array of all signatures

## Database Tables to Use:

**cimDocuments** - user's documents
- id, userId, title, shareEnabled, etc.

**documentViews** - tracks page views
- id, cimDocumentId, viewerIdentifier, viewedAt, etc.

**ndaSignatures** - NDA signatures
- id, cimDocumentId, signerEmail, signedAt, approved, etc.

## Authentication:
- All endpoints require authenticated user (`req.user` must exist)
- Only return data for documents owned by the authenticated user
- Return 401 if not authenticated

## Error Handling:
- Wrap in try/catch blocks
- Return 500 with error message on failure
- Log errors to console for debugging

## Example Route Structure:
```typescript
app.get("/api/analytics/overview", async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    // Implementation here
    // ...

    res.json({
      totalViews,
      totalSignatures,
      pendingApprovals,
      activeDocuments,
      viewsTrend,
      signaturesTrend
    });
  } catch (error) {
    console.error('Error fetching analytics overview:', error);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});
```

## Important Notes on Analytics Stats and Time Range:

For the `/api/analytics/overview` endpoint, the stats should be **dynamic based on the `range` query parameter**:

**Query param:**
- `range`: one of `7d`, `30d`, `90d`, `all` (defaults to `30d`)

**How to calculate stats for selected range:**
- **totalViews**: Count views within the selected date range
- **totalSignatures**: Count signatures within the selected date range
- **viewsTrend**: Compare current range vs previous range of same length
  - Example for `30d`: Compare last 30 days vs 30 days before that
  - Formula: `((current - previous) / previous) * 100`
- **signaturesTrend**: Same logic as viewsTrend
- **pendingApprovals**: Always show total pending (not affected by date range)
- **activeDocuments**: Always show total active (not affected by date range)

Please implement all five endpoints with proper SQL queries using Drizzle ORM. Make sure to handle edge cases like:
- Users with no documents
- Documents with no views/signatures
- Division by zero when calculating conversion rates
- Empty date ranges

The frontend is already built and expects these exact endpoint paths and response formats.
