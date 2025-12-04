# E-Signature Feature Specification

## Overview

A DocuSign-like e-signature system that allows users to upload documents (PDF or Word), assign signers and CC recipients, place signature fields via drag-and-drop, and track document completion with full audit trails and certificates of completion.

---

## Core Concepts

### Envelope
The container for a signing transaction. Contains:
- The document (PDF)
- Recipients (signers and CC)
- Field assignments
- Status and audit trail

### Template
A reusable document with pre-placed fields assigned to placeholder recipients (roles). When using a template, users map placeholder recipients to actual email addresses.

### Placeholder Recipients (Roles)
Template-level recipient definitions that are not tied to specific people. Examples:
- "Client"
- "Seller"
- "Buyer"
- "Witness"
- "Legal Team" (CC)

Users can type any role name they want (no predefined list).

### Completion Logic
**A document is complete when all SIGNERS have signed.** CC recipients do not block completion. Once all signers complete, the system:
1. Generates the final signed PDF
2. Creates the certificate of completion
3. Sends completion emails to ALL recipients (signers and CC)

---

## Document Handling

### Supported Formats
- **PDF** (.pdf) - processed directly
- **Word** (.docx) - converted to PDF before processing

### Word to PDF Conversion
**Primary method:** LibreOffice headless (server-side)
**Fallback:** CloudConvert API (for complex documents)

#### LibreOffice Installation

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install -y libreoffice-writer libreoffice-calc --no-install-recommends
```

**Alpine (Docker):**
```dockerfile
RUN apk add --no-cache libreoffice
```

**Verify installation:**
```bash
libreoffice --version
```

#### Conversion Command
```bash
libreoffice --headless --convert-to pdf --outdir /output/path /input/path/document.docx
```

#### Node.js Integration
```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function convertDocxToPdf(inputPath: string, outputDir: string): Promise<string> {
  const command = `libreoffice --headless --convert-to pdf --outdir "${outputDir}" "${inputPath}"`;
  await execAsync(command, { timeout: 60000 }); // 60 second timeout

  // LibreOffice outputs to same filename with .pdf extension
  const pdfFilename = inputPath.replace(/\.docx?$/i, '.pdf').split('/').pop();
  return `${outputDir}/${pdfFilename}`;
}
```

#### Resource Considerations
- LibreOffice conversion can be memory-intensive (~200-500MB per conversion)
- Consider queuing conversions if handling many concurrent uploads
- Set appropriate timeouts (60 seconds recommended for large documents)

### Processing Pipeline
```
Upload (PDF or DOCX)
    ↓
[If DOCX] Convert to PDF via LibreOffice
    ↓
Store original PDF in object storage
    ↓
Convert PDF pages to images (for field placement UI)
    ↓
Store page images in object storage
    ↓
Return template/envelope ID + page image URLs
```

### Storage Locations
- Original PDFs: `private/esign/documents/{id}/original.pdf`
- Page images: `private/esign/documents/{id}/pages/page-{n}.png`
- Signed PDFs: `private/esign/envelopes/{id}/signed.pdf`
- Certificates: `private/esign/envelopes/{id}/certificate.pdf`

---

## Templates

### Template Structure
```typescript
interface EsignTemplate {
  id: number;
  userId: number;
  name: string;
  description?: string;
  documentUrl: string;           // Original PDF in object storage
  pageImages: string[];          // Array of page image URLs
  totalPages: number;
  placeholderRecipients: PlaceholderRecipient[];
  fields: TemplateField[];
  createdAt: Date;
  updatedAt: Date;
}

interface PlaceholderRecipient {
  id: string;                    // UUID
  label: string;                 // User-defined: "Client", "Seller", etc.
  role: 'signer' | 'cc';
  color: string;                 // Hex color for visual distinction
  order: number;                 // Signing order (for sequential)
}

interface TemplateField {
  id: string;                    // UUID
  type: 'signature' | 'name' | 'email' | 'date' | 'text' | 'initials';
  x: number;                     // Percentage (0-100)
  y: number;                     // Percentage (0-100)
  width: number;                 // Percentage
  height: number;                // Percentage
  page: number;                  // 1-indexed
  assignedTo: string;            // PlaceholderRecipient ID
  required: boolean;
}
```

### Placeholder Recipient Colors
Consistent color palette for visual distinction (DocuSign-style):
```typescript
const RECIPIENT_COLORS = [
  '#0072CE',  // Blue (Signer 1)
  '#FF6B00',  // Orange (Signer 2)
  '#00A651',  // Green (Signer 3)
  '#9B59B6',  // Purple (Signer 4)
  '#E91E63',  // Pink (Signer 5)
  '#00BCD4',  // Cyan (Signer 6)
  '#795548',  // Brown (Signer 7)
  '#607D8B',  // Gray (Signer 8)
];
```

Colors are auto-assigned in order as recipients are added. CC recipients use a muted gray (#9CA3AF).

### Template Creation Flow
1. User uploads PDF or Word document
2. System converts to PDF (if Word) and generates page images
3. User adds placeholder recipients with labels and roles
4. User drags fields onto document pages
5. User assigns each field to a placeholder recipient
6. User saves template

### Using a Template
1. User selects template
2. System shows placeholder recipients requiring mapping
3. User enters actual name + email for each placeholder
4. User can optionally modify message
5. User sends envelope

---

## Envelopes

### Envelope Structure
```typescript
interface EsignEnvelope {
  id: number;
  userId: number;
  title: string;
  message?: string;              // Custom message to recipients
  status: 'draft' | 'sent' | 'completed' | 'voided' | 'declined';
  signingOrder: 'parallel' | 'sequential';
  documentUrl: string;           // Original PDF
  pageImages: string[];          // Page image URLs
  totalPages: number;
  templateId?: number;           // If created from template
  signedDocumentUrl?: string;    // Final signed PDF
  certificateUrl?: string;       // Certificate of completion
  completedAt?: Date;
  voidedAt?: Date;
  voidReason?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Envelope Recipients
```typescript
interface EsignRecipient {
  id: number;
  envelopeId: number;
  name: string;
  email: string;
  role: 'signer' | 'cc';
  placeholderLabel?: string;     // Original template role label
  color: string;                 // For UI consistency
  signingOrder: number;          // 1, 2, 3... (for sequential)
  status: 'pending' | 'sent' | 'delivered' | 'viewed' | 'signed' | 'declined';
  accessToken: string;           // Unique signing URL token
  declineReason?: string;
  sentAt?: Date;
  deliveredAt?: Date;            // Email delivery confirmation
  viewedAt?: Date;
  signedAt?: Date;
  declinedAt?: Date;
  ipAddress?: string;
  location?: string;
  userAgent?: string;
  reminderCount: number;
  lastReminderAt?: Date;
}
```

### Envelope Fields
```typescript
interface EsignField {
  id: number;
  envelopeId: number;
  recipientId: number;
  type: 'signature' | 'name' | 'email' | 'date' | 'text' | 'initials';
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  required: boolean;
  value?: string;                // Filled value (base64 for signatures)
  completedAt?: Date;
}
```

### Signing Order Logic

**Parallel Signing:**
- All signers receive emails simultaneously when envelope is sent
- Any signer can sign at any time
- Envelope completes when all signers finish

**Sequential Signing:**
- Order determined by `signingOrder` field on recipients
- Only the current signer receives email/can access document
- When signer N completes, signer N+1 is notified
- CC recipients receive notification only after all signers complete

### Envelope Status Flow
```
draft → sent → completed
              ↘ voided
              ↘ declined (if any signer declines)
```

### Decline Behavior
**When any signer declines, the entire envelope is marked as declined.**
- All other pending signers are notified that the document was declined
- The sender receives a decline notification with the reason
- No further signing is possible on the envelope
- The sender must create a new envelope if they want to try again

---

## Signing Experience

### Guest Signing Flow
1. Recipient receives email with unique signing link
2. Click link → signing page (no account required)
3. View document with their assigned fields highlighted
4. Complete all required fields
5. Click "Finish" to submit
6. Confirmation page with option to download signed doc (if complete)

### Signing Page Features
- Document viewer with zoom (50-200%)
- Clear indication of which fields belong to current signer
- Field validation (required fields highlighted)
- Signature pad modal for signature/initials fields
- Auto-populate name/email fields with recipient info
- Progress indicator ("2 of 4 fields completed")
- Decline option with reason
- **No download option** - recipients can only download after all signers complete

### Field Auto-Population
- **Name field:** Pre-filled with recipient's name
- **Email field:** Pre-filled with recipient's email
- **Date field:** Auto-filled with current date on completion
- **Signature/Initials:** Must be manually signed
- **Text:** Must be manually entered

---

## Audit Trail

### Audit Log Structure
```typescript
interface EsignAuditLog {
  id: number;
  envelopeId: number;
  recipientId?: number;
  action: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  location?: string;
  timestamp: Date;
}
```

### Tracked Events
| Action | Description | Details |
|--------|-------------|---------|
| `envelope_created` | Envelope created | `{ fromTemplate: boolean, templateId?: number }` |
| `envelope_sent` | Envelope sent to recipients | `{ recipientCount: number }` |
| `recipient_sent` | Email sent to specific recipient | `{ recipientEmail: string }` |
| `recipient_delivered` | Email delivery confirmed | `{ recipientEmail: string }` |
| `recipient_viewed` | Recipient opened document | `{ recipientEmail: string }` |
| `field_completed` | Recipient completed a field | `{ fieldId: number, fieldType: string }` |
| `recipient_signed` | Recipient completed all fields | `{ recipientEmail: string, fieldsCompleted: number }` |
| `recipient_declined` | Recipient declined to sign | `{ recipientEmail: string, reason: string }` |
| `envelope_completed` | All signers finished | `{ signerCount: number }` |
| `envelope_voided` | Sender voided envelope | `{ reason: string }` |
| `reminder_sent` | Reminder email sent | `{ recipientEmail: string }` |
| `envelope_declined` | Envelope declined by a signer | `{ declinedBy: string, reason: string }` |
| `document_downloaded` | Someone downloaded the doc | `{ downloadedBy: string }` |

---

## Certificate of Completion

### Certificate Contents
Generated as the final page(s) of the signed PDF and as a standalone document.

**Header:**
- Company logo (from branding)
- "Certificate of Completion"
- Unique Envelope ID

**Document Information:**
- Document title
- Document hash (SHA-256 fingerprint)
- Total pages (excluding certificate)
- Created date

**Timeline:**
Chronological list of all events:
```
Dec 3, 2024 10:30 AM PST - Envelope created by sender@company.com
Dec 3, 2024 10:31 AM PST - Sent to john@example.com (Client)
Dec 3, 2024 10:31 AM PST - Sent to jane@example.com (Seller)
Dec 3, 2024 11:45 AM PST - Viewed by john@example.com (192.168.1.1, San Francisco, CA)
Dec 3, 2024 11:47 AM PST - Signed by john@example.com (192.168.1.1, San Francisco, CA)
Dec 3, 2024 2:30 PM PST - Viewed by jane@example.com (10.0.0.1, New York, NY)
Dec 3, 2024 2:32 PM PST - Signed by jane@example.com (10.0.0.1, New York, NY)
Dec 3, 2024 2:32 PM PST - Envelope completed
```

**Recipient Summary Table:**
| Recipient | Role | Status | Signed At | IP Address | Location |
|-----------|------|--------|-----------|------------|----------|
| John Smith (john@example.com) | Client (Signer) | Signed | Dec 3, 2024 11:47 AM | 192.168.1.1 | San Francisco, CA |
| Jane Doe (jane@example.com) | Seller (Signer) | Signed | Dec 3, 2024 2:32 PM | 10.0.0.1 | New York, NY |
| Legal Team (legal@company.com) | CC | N/A | - | - | - |

**Footer:**
- Verification QR code (links to verification page)
- Envelope ID for manual verification
- "Powered by [Your Platform Name]"

### Verification Page
Public page at `/verify/{envelopeId}` showing:
- Document title
- Completion status
- Signer summary (names, not emails for privacy)
- Completion date
- Option to verify document hash

---

## Status Dashboard

### Dashboard Views

**All Documents Tab:**
List view with columns:
- Document title
- Status (badge)
- Recipients (avatars/count)
- Created date
- Last activity
- Actions (view, remind, void, download)

**Filters:**
- Status: All, Pending, Completed, Voided, Declined
- Date range
- Search by title or recipient

### Document Detail View

**Header:**
- Document title
- Status badge
- Action buttons (Remind All, Void, Download)

**Timeline Panel:**
Visual timeline of all events with icons and timestamps

**Recipients Panel:**
Cards for each recipient showing:
- Name and email
- Role badge (Signer/CC) with color
- Status with icon
- Timestamps (Sent → Viewed → Signed)
- IP/Location on hover
- "Send Reminder" button (if pending)

**Document Preview:**
Thumbnail view of document pages with field indicators

**Actions:**
- Send reminder to specific recipient (max 1 per day per recipient)
- Send reminder to all pending (respects daily limit)
- Void envelope (with reason)
- Download original document
- Download signed document (if complete)
- Download certificate (if complete)
- Download audit log (CSV/PDF)

### Reminder Limits
- **Maximum 1 reminder per recipient per day**
- System tracks `lastReminderAt` timestamp per recipient
- UI disables reminder button if sent within last 24 hours
- "Remind All" only sends to recipients who haven't been reminded today

---

## Branding

### Branding Settings (Account-Level)
```typescript
interface UserBranding {
  userId: number;
  logoUrl?: string;              // Uploaded logo
  primaryColor: string;          // Hex color for buttons/accents
  companyName: string;           // Footer text
  emailFromName?: string;        // "John from Acme Corp"
  createdAt: Date;
  updatedAt: Date;
}
```

### Branding Application
- **Signing page:** Logo in header, primary color for buttons
- **Emails:** Logo in header, primary color accents, company name in footer
- **Certificate:** Logo in header

### Logo Requirements
- Formats: PNG, JPG, SVG
- Max size: 2MB
- Recommended dimensions: 200x50px (will be resized)
- Stored in: `private/branding/{userId}/logo.{ext}`

---

## Email Templates

### Email Types

**1. Signing Request**
```
Subject: [Sender Name] has sent you "{Document Title}" to sign

Body:
[Logo]

Hi {Recipient Name},

{Sender Name} has sent you a document to {sign/review}.

Document: {Document Title}

{Custom Message if provided}

[Review & Sign Button]

This document expires on {Expiry Date if set}.
```

**2. Reminder**
```
Subject: Reminder: Please sign "{Document Title}"

Body:
[Logo]

Hi {Recipient Name},

This is a reminder that {Sender Name} is waiting for you to sign "{Document Title}".

[Review & Sign Button]
```

**3. Next Signer Notification (Sequential)**
```
Subject: It's your turn to sign "{Document Title}"

Body:
[Logo]

Hi {Recipient Name},

{Previous Signer Name} has signed "{Document Title}". It's now your turn to review and sign.

[Review & Sign Button]
```

**4. Completion Notification**
```
Subject: Completed: "{Document Title}" has been signed by all parties

Body:
[Logo]

Hi {Recipient Name},

All parties have signed "{Document Title}".

[Download Signed Document Button]
[Download Certificate Button]

Attached:
- Signed document (PDF)
- Certificate of completion (PDF)
```

**5. Decline Notification**
```
Subject: "{Document Title}" was declined by {Decliner Name}

Body:
[Logo]

Hi {Sender Name},

{Decliner Name} has declined to sign "{Document Title}".

Reason: {Decline Reason}

You may want to reach out to discuss or send a new document.
```

**6. Void Notification**
```
Subject: "{Document Title}" has been voided

Body:
[Logo]

Hi {Recipient Name},

{Sender Name} has voided "{Document Title}".

Reason: {Void Reason}

No further action is required.
```

---

## Database Schema

### New Tables

```sql
-- User branding settings
CREATE TABLE user_branding (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  logo_url TEXT,
  primary_color VARCHAR(7) DEFAULT '#0072CE',
  company_name TEXT,
  email_from_name TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id)
);

-- E-signature templates
CREATE TABLE esign_templates (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  document_url TEXT NOT NULL,
  page_images JSONB NOT NULL DEFAULT '[]',
  total_pages INTEGER NOT NULL DEFAULT 1,
  placeholder_recipients JSONB NOT NULL DEFAULT '[]',
  fields JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- E-signature envelopes
CREATE TABLE esign_envelopes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  message TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  signing_order VARCHAR(20) NOT NULL DEFAULT 'parallel',
  document_url TEXT NOT NULL,
  page_images JSONB NOT NULL DEFAULT '[]',
  total_pages INTEGER NOT NULL DEFAULT 1,
  template_id INTEGER REFERENCES esign_templates(id),
  signed_document_url TEXT,
  certificate_url TEXT,
  completed_at TIMESTAMP,
  voided_at TIMESTAMP,
  void_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Envelope recipients
CREATE TABLE esign_recipients (
  id SERIAL PRIMARY KEY,
  envelope_id INTEGER NOT NULL REFERENCES esign_envelopes(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'signer',
  placeholder_label VARCHAR(255),
  color VARCHAR(7) NOT NULL,
  signing_order INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  access_token VARCHAR(64) NOT NULL UNIQUE,
  decline_reason TEXT,
  sent_at TIMESTAMP,
  delivered_at TIMESTAMP,
  viewed_at TIMESTAMP,
  signed_at TIMESTAMP,
  declined_at TIMESTAMP,
  ip_address VARCHAR(45),
  location TEXT,
  user_agent TEXT,
  reminder_count INTEGER DEFAULT 0,
  last_reminder_at TIMESTAMP
);

-- Envelope fields
CREATE TABLE esign_fields (
  id SERIAL PRIMARY KEY,
  envelope_id INTEGER NOT NULL REFERENCES esign_envelopes(id) ON DELETE CASCADE,
  recipient_id INTEGER NOT NULL REFERENCES esign_recipients(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL,
  x DECIMAL(5,2) NOT NULL,
  y DECIMAL(5,2) NOT NULL,
  width DECIMAL(5,2) NOT NULL,
  height DECIMAL(5,2) NOT NULL,
  page INTEGER NOT NULL DEFAULT 1,
  required BOOLEAN NOT NULL DEFAULT true,
  value TEXT,
  completed_at TIMESTAMP
);

-- Audit log
CREATE TABLE esign_audit_log (
  id SERIAL PRIMARY KEY,
  envelope_id INTEGER NOT NULL REFERENCES esign_envelopes(id) ON DELETE CASCADE,
  recipient_id INTEGER REFERENCES esign_recipients(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  details JSONB DEFAULT '{}',
  ip_address VARCHAR(45),
  user_agent TEXT,
  location TEXT,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_esign_templates_user ON esign_templates(user_id);
CREATE INDEX idx_esign_envelopes_user ON esign_envelopes(user_id);
CREATE INDEX idx_esign_envelopes_status ON esign_envelopes(status);
CREATE INDEX idx_esign_recipients_envelope ON esign_recipients(envelope_id);
CREATE INDEX idx_esign_recipients_token ON esign_recipients(access_token);
CREATE INDEX idx_esign_fields_envelope ON esign_fields(envelope_id);
CREATE INDEX idx_esign_fields_recipient ON esign_fields(recipient_id);
CREATE INDEX idx_esign_audit_envelope ON esign_audit_log(envelope_id);
CREATE INDEX idx_esign_audit_timestamp ON esign_audit_log(timestamp);
```

---

## API Endpoints

### Templates
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/esign/templates` | List user's templates |
| POST | `/api/esign/templates` | Create template |
| GET | `/api/esign/templates/:id` | Get template details |
| PUT | `/api/esign/templates/:id` | Update template |
| DELETE | `/api/esign/templates/:id` | Delete template |
| POST | `/api/esign/templates/upload` | Upload document for template |

### Envelopes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/esign/envelopes` | List user's envelopes |
| POST | `/api/esign/envelopes` | Create envelope |
| POST | `/api/esign/envelopes/from-template/:templateId` | Create from template |
| GET | `/api/esign/envelopes/:id` | Get envelope details |
| PUT | `/api/esign/envelopes/:id` | Update draft envelope |
| POST | `/api/esign/envelopes/:id/send` | Send envelope |
| POST | `/api/esign/envelopes/:id/void` | Void envelope |
| POST | `/api/esign/envelopes/:id/remind` | Send reminders |
| POST | `/api/esign/envelopes/:id/remind/:recipientId` | Remind specific recipient |
| GET | `/api/esign/envelopes/:id/audit` | Get audit log |
| GET | `/api/esign/envelopes/:id/download/original` | Download original PDF |
| GET | `/api/esign/envelopes/:id/download/signed` | Download signed PDF |
| GET | `/api/esign/envelopes/:id/download/certificate` | Download certificate |

### Signing (Public/Guest)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/esign/sign/:token` | Get signing session data |
| POST | `/api/esign/sign/:token/view` | Mark as viewed |
| POST | `/api/esign/sign/:token/field/:fieldId` | Complete a field |
| POST | `/api/esign/sign/:token/complete` | Complete signing |
| POST | `/api/esign/sign/:token/decline` | Decline to sign |

### Branding
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/esign/branding` | Get user's branding |
| PUT | `/api/esign/branding` | Update branding |
| POST | `/api/esign/branding/logo` | Upload logo |

### Verification (Public)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/esign/verify/:envelopeId` | Verify envelope |

---

## Frontend Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/esign` | EsignDashboard | Main dashboard with document list |
| `/esign/send` | EsignSend | Upload and send new document |
| `/esign/send?template=:id` | EsignSend | Send from template |
| `/esign/templates` | EsignTemplates | Template list |
| `/esign/templates/new` | EsignTemplateEditor | Create template |
| `/esign/templates/:id/edit` | EsignTemplateEditor | Edit template |
| `/esign/envelope/:id` | EsignEnvelopeDetail | View envelope status |
| `/esign/settings` | EsignSettings | Branding settings |
| `/sign/:token` | EsignSigningPage | Guest signing page |
| `/verify/:envelopeId` | EsignVerify | Public verification page |

---

## Navigation

Add to main navigation bar:
```
[Logo] [Dashboard] [Documents] [E-Signatures ▼] [...]
                                    ├─ Send Document
                                    ├─ Templates
                                    ├─ All Documents
                                    └─ Settings
```

---

## Component Reuse from NDA System

### Fully Reusable
- `PdfSignatureProcessor` - PDF signature embedding
- `SignaturePadComponent` - Signature capture
- `geoip-lite` integration - Location tracking
- SendGrid email infrastructure
- Object storage service

### Adapt/Refactor
- `EnhancedNdaTemplateEditor` → `EsignTemplateEditor`
  - Add placeholder recipient management
  - Add color-coded field assignment
- `NdaFieldPalette` → `EsignFieldPalette`
  - Same field types, different recipient assignment
- `EnhancedNdaSigningPage` → `EsignSigningPage`
  - Different data source (envelope vs NDA session)
- `ImageDocumentViewer` → reuse directly

### New Components Needed
- `PlaceholderRecipientManager` - Add/edit/reorder template recipients
- `RecipientMapper` - Map placeholders to real emails when using template
- `EnvelopeStatusTimeline` - Visual event timeline
- `RecipientStatusCard` - Individual recipient status display
- `CertificateGenerator` - Generate PDF certificate
- `BrandingSettings` - Logo upload, color picker
- `EsignDashboard` - Main document list with filters

---

## Implementation Phases

### Phase 1: Foundation
- Database schema and migrations
- Basic API structure
- Document upload and processing (PDF + Word)
- Branding settings

### Phase 2: Templates
- Template CRUD
- Placeholder recipient management
- Field placement with drag-and-drop
- Field-to-recipient assignment with colors

### Phase 3: Envelopes & Sending
- Create envelope from scratch
- Create envelope from template
- Recipient mapping
- Send envelope (parallel signing)
- Email notifications

### Phase 4: Signing Experience
- Guest signing page
- Field completion flow
- Signature capture
- Signing completion

### Phase 5: Sequential Signing
- Signing order logic
- Next-signer notifications
- Order enforcement

### Phase 6: Completion & Audit
- Signed PDF generation
- Certificate of completion
- Audit log display
- Document downloads

### Phase 7: Dashboard & Management
- Document list with filters
- Envelope detail view
- Timeline visualization
- Reminder functionality
- Void functionality

### Phase 8: Verification & Polish
- Public verification page
- QR code generation
- UI polish
- Testing

---

## Open Questions / Future Considerations

Items explicitly deferred:
- [ ] Envelope expiration dates
- [ ] Template sharing across organization/team
- [ ] Additional field types (checkbox, dropdown, etc.)
- [ ] Bulk send to multiple recipient sets
- [ ] API access for integrations
- [ ] Mobile-optimized signing experience
- [ ] In-person signing mode
- [ ] Payment field integration
- [ ] Auto-reminders on a schedule (currently manual only)
