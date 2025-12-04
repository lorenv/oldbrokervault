# E-Signature Feature Implementation

## Overview

The e-signature feature allows users to send documents for digital signature, similar to DocuSign. It supports both template-based workflows and direct document uploads.

## Architecture

### Frontend Components

| File | Purpose |
|------|---------|
| `client/src/pages/esign/esign-dashboard.tsx` | Main dashboard showing envelope status (sent, completed, voided) |
| `client/src/pages/esign/esign-send.tsx` | Multi-step wizard for sending documents for signature |
| `client/src/pages/esign/esign-templates.tsx` | Template management listing page |
| `client/src/pages/esign/esign-template-editor.tsx` | Template editor with drag-and-drop field placement |
| `client/src/pages/esign/esign-settings.tsx` | Branding settings for e-signature emails |

### Backend Routes

All routes are in `server/routes/esign-routes.ts`:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/esign/branding` | GET/PUT | User branding settings |
| `/api/esign/branding/logo` | POST | Upload branding logo |
| `/api/esign/templates` | GET/POST | List/create templates |
| `/api/esign/templates/:id` | GET/PUT/DELETE | Single template operations |
| `/api/esign/templates/upload` | POST | Upload document for template |
| `/api/esign/templates/:id/duplicate` | POST | Duplicate a template |
| `/api/esign/envelopes` | GET/POST | List/create envelopes |
| `/api/esign/envelopes/:id` | GET/DELETE | Single envelope operations |
| `/api/esign/envelopes/:id/send` | POST | Send envelope to recipients |
| `/api/esign/envelopes/:id/void` | POST | Void an envelope |
| `/api/esign/envelopes/:id/remind` | POST | Send reminder to recipients |
| `/api/esign/envelopes/:id/audit` | GET | Get audit log |
| `/api/esign/envelopes/:id/download` | GET | Download signed document |
| `/api/esign/sign/:token` | GET | Get signing session (guest) |
| `/api/esign/sign/:token/field/:fieldId` | POST | Complete a field |
| `/api/esign/sign/:token/complete` | POST | Complete signing |
| `/api/esign/sign/:token/decline` | POST | Decline to sign |
| `/api/esign/verify/:envelopeId` | GET | Public verification |

### Database Schema

Tables (defined in `shared/schema.ts`):

- `esign_templates` - Reusable document templates with pre-placed fields
- `esign_envelopes` - Individual signing sessions/documents
- `esign_recipients` - Recipients for each envelope (signers + CC)
- `esign_fields` - Signature fields placed on documents
- `esign_audit_log` - Audit trail for compliance
- `user_branding` - Custom branding for emails

## User Flows

### Flow 1: Send Document (Direct Upload)

1. **Step 1 - Document**: Upload PDF/Word document OR select existing template
2. **Step 2 - Recipients**: Add signers and CC recipients, set signing order
3. **Step 3 - Place Fields**: Drag-and-drop signature fields onto document pages
4. **Step 4 - Review & Send**: Review details and send

### Flow 2: Create Template

1. Navigate to `/esign/templates/new`
2. Upload PDF/Word document
3. Add placeholder recipients (roles like "Signer 1", "Signer 2")
4. Drag-and-drop fields assigned to each recipient
5. Save template for reuse

### Flow 3: Sign Document (Recipient)

1. Recipient receives email with unique signing link
2. Link opens signing interface at `/esign/sign/:token`
3. Recipient completes all required fields
4. Recipient clicks "Finish" to complete signing
5. When all signers complete, envelope is marked complete

## Technical Implementation Details

### Drag-and-Drop System

Two different implementations exist:

1. **Template Editor** (`esign-template-editor.tsx`): Uses `@dnd-kit/core`
2. **Send Flow** (`esign-send.tsx`): Uses `react-dnd` with `HTML5Backend`

Both use percentage-based coordinates for field positions to maintain accuracy across different display sizes.

### Field Coordinate System

- Fields are stored with percentage-based coordinates (0-100)
- `x`, `y` = top-left corner position as percentage
- `width`, `height` = field dimensions as percentage
- `page` = 1-indexed page number

### Document Processing

1. Upload document (PDF or Word)
2. If Word, convert to PDF using LibreOffice (`convertWordToPdf`)
3. Process PDF to page images using `processPDFToImages`
4. Store original PDF and page images in object storage
5. Return URLs for display

### Signing Security

- Each recipient gets a unique `accessToken` (secure random token)
- Token is used in signing URL: `/esign/sign/:token`
- IP address, user agent, and location are captured for audit
- Signing completion generates timestamped audit entries

### Email Notifications

Emails sent via SendGrid:
- `sendEsignInvitationEmail` - Initial signing request
- `sendEsignReminderEmail` - Reminder to sign
- `sendEsignCompletedEmail` - Document completed notification
- `sendEsignDeclinedEmail` - Signer declined notification
- `sendEsignVoidedEmail` - Document voided notification

## Known Issues

### Issue 1: Image Aspect Ratio / Scrunching

**Status**: Partially fixed, may still have issues

**Symptoms**:
- Document page images appear warped/scrunched
- Images appear more square than portrait orientation
- Proportions don't match original document

**Location**: `esign-send.tsx` - `DocumentPageCanvas` component

**Current Implementation**:
```typescript
// Calculate display dimensions maintaining aspect ratio
const baseWidth = 612; // Standard letter width in points
const displayWidth = baseWidth * zoom;
const aspectRatio = imageDimensions.height / imageDimensions.width;
const displayHeight = displayWidth * aspectRatio;
```

**Root Cause Analysis**:
- Initial `imageDimensions` state defaults to `{ width: 612, height: 792 }`
- Actual dimensions are set on image `onLoad` event
- If image loads slowly or dimensions differ significantly, display may be incorrect
- The aspect ratio calculation depends on accurate `imageDimensions`

**Potential Fix**:
- Wait for image to load before rendering canvas
- Use actual image natural dimensions consistently
- Consider using CSS `object-fit: contain` without manual dimension calculation

### Issue 2: Container Overflow / Bleeding

**Status**: Partially fixed, may still have issues

**Symptoms**:
- Document pages overflow their container
- Content bleeds over the footer
- No proper scrolling containment

**Location**: `esign-send.tsx` - Step 3 "Place Fields" section

**Current Implementation**:
```tsx
<div className="grid grid-cols-12 gap-6" style={{ height: 'calc(100vh - 280px)', maxHeight: 'calc(100vh - 280px)' }}>
  {/* Left sidebar */}
  <div className="col-span-3 space-y-4 overflow-y-auto max-h-full">

  {/* Document canvas */}
  <div className="col-span-9 flex flex-col max-h-full overflow-hidden">
    {/* Toolbar - flex-shrink-0 */}
    {/* Scrollable area - flex-1 overflow-auto min-h-0 */}
  </div>
</div>
```

**Key CSS Properties for Scroll Containment**:
- Parent needs explicit height (`height: calc(...)`)
- Flex children need `min-h-0` to allow shrinking below content size
- Scrollable container needs `overflow-auto`
- Non-scrolling siblings need `flex-shrink-0`

### Issue 3: Field Placement Accuracy

**Status**: Fixed

**Previous Issue**: Fields didn't drop where cursor was positioned

**Fix Applied**:
- Proper coordinate conversion accounting for zoom level
- Using `monitor.getClientOffset()` for drop position
- Converting pixel coordinates to percentage relative to display dimensions

## File Upload Implementation

### Template Upload (`/api/esign/templates/upload`)

```typescript
// 1. Accept PDF or Word document
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ];
    // ...
  },
});

// 2. Convert Word to PDF if needed
if (req.file.mimetype !== 'application/pdf') {
  pdfBuffer = await convertWordToPdf(req.file.buffer, req.file.originalname);
}

// 3. Process PDF to images
const processedDocument = await processPDFToImages(/* ... */);

// 4. Store in object storage
const pdfUploadResult = await objectStorage.uploadBuffer(/* ... */);

// 5. Return URLs
res.json({
  pageCount: processedDocument.pageCount,
  pageImages: processedDocument.imageUrls,
  documentUrl: pdfUploadResult.url,
});
```

## Component Props Reference

### DocumentPageCanvas (esign-send.tsx)

```typescript
interface DocumentPageCanvasProps {
  pageImage: string;          // URL of page image
  pageNumber: number;         // 1-indexed page number
  pageWidth: number;          // Intended width (unused currently)
  pageHeight: number;         // Intended height (unused currently)
  fields: SignatureField[];   // All fields (filtered by page internally)
  selectedFieldId: string | null;
  onFieldsChange: (fields: SignatureField[]) => void;
  onSelectField: (id: string | null) => void;
  zoom: number;               // Zoom level (0.5 - 1.5)
  getRecipientColor: (index: number) => string;
}
```

### SignatureField

```typescript
interface SignatureField {
  id: string;
  type: 'signature' | 'initials' | 'name' | 'email' | 'date' | 'text';
  x: number;           // Left position as percentage (0-100)
  y: number;           // Top position as percentage (0-100)
  width: number;       // Width as percentage
  height: number;      // Height as percentage
  page: number;        // 1-indexed page number
  recipientIndex: number;
  required: boolean;
}
```

## Testing Checklist

- [ ] Upload PDF document - verify page images render correctly
- [ ] Upload Word document - verify conversion and rendering
- [ ] Add multiple recipients with different roles
- [ ] Place signature fields on different pages
- [ ] Drag existing fields to new positions
- [ ] Delete fields
- [ ] Send envelope and verify emails received
- [ ] Complete signing flow as recipient
- [ ] Verify audit log captures all events
- [ ] Test sequential vs parallel signing order
- [ ] Test reminder functionality
- [ ] Test void functionality
- [ ] Verify completed document download

## Future Improvements

1. **Image Loading State**: Show loading indicator while page images load
2. **Field Resize**: Allow resizing fields after placement
3. **Field Copy/Paste**: Duplicate fields across pages
4. **Bulk Field Placement**: Place same field on all pages
5. **Mobile Signing**: Optimize signing interface for mobile
6. **In-Person Signing**: Support for in-person signing mode
7. **Conditional Fields**: Fields that appear based on other field values
8. **Custom Field Types**: User-defined field types
9. **Signing Order Groups**: More complex signing workflows
10. **API Integration**: Webhook notifications for envelope events
