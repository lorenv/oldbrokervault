# Teaser Feature Implementation Plan

## Overview

The Teaser feature creates a public-facing, sanitized "one-pager" preview of a CIM that potential buyers/investors can view before signing an NDA. It serves as a marketing tool for deals while protecting confidential details.

## User Stories

1. As a broker, I want to auto-generate a sanitized teaser from my CIM so I can quickly create marketing materials
2. As a broker, I want to edit the generated teaser content to refine the messaging
3. As a broker, I want to control which financial information is shown on the teaser
4. As a broker, I want a public share link for my teaser that's separate from my NDA-protected CIM
5. As a broker, I want to embed my teaser on my website or share it on LinkedIn
6. As a buyer, I want to see a professional teaser before deciding to sign an NDA
7. As a buyer, I want to contact the broker or sign the NDA directly from the teaser

## Feature Components

### 1. Teaser Tab in Document Detail Page

**Location**: `/documents/:id?tab=teaser`

**UI Sections**:
- **Status Banner**: Draft / Published / Outdated (CIM changed since last refresh)
- **Cover Image Section**:
  - Display current cover image (from CIM or teaser-specific)
  - Options: Use CIM image, Upload new, Select from Unsplash
  - 16:9 aspect ratio
  - Allow "no image" state
- **Headline Section**:
  - Auto-generated headline with inline editing
- **Industry/Deal Type Tags**:
  - Predefined dropdown + custom tag option
  - Custom tags saved to user's tag library for reuse
- **Summary Section**:
  - AI-generated 1-4 paragraphs (formal/professional tone)
  - Editable rich text area
  - Character count indicator
- **Financial Highlights**:
  - Toggle: Include financials in teaser (on/off)
  - Fields: Revenue, Earnings, Asking Price
  - Values pulled from CIM or manually overridden
  - Currency included in text field (e.g., "$5.2M")
- **Share Settings**:
  - Custom slug input (SEO-friendly URL)
  - Password protection toggle + password field
  - Copy link button with "Copied!" feedback
- **Actions**:
  - Preview button (opens teaser in new tab)
  - Publish/Unpublish toggle
  - Refresh from CIM button (when outdated)
- **Export Options**:
  - Download as PDF
  - Get embed code (modal with iframe snippet)

### 2. Public Teaser Page

**URL**: `/teaser/:slug`

**Layout** (styled one-pager):
```
┌─────────────────────────────────────────┐
│           [Cover Image - 16:9]          │
│              (if present)               │
├─────────────────────────────────────────┤
│  [Broker Logo]                          │
│                                         │
│  HEADLINE                               │
│  [Industry Tag] [Deal Type Tag]         │
│                                         │
│  Summary paragraph 1...                 │
│  Summary paragraph 2...                 │
│                                         │
│  ┌─────────┬─────────┬─────────┐       │
│  │ Revenue │ Earnings│ Asking  │       │
│  │  $X.XM  │  $X.XM  │  $X.XM  │       │
│  └─────────┴─────────┴─────────┘       │
│        (if financials enabled)          │
│                                         │
│  [Sign NDA] [Contact Broker]            │
│                                         │
│  ─────────────────────────────────      │
│  Broker Name | email | phone            │
│           Confidential Teaser           │
└─────────────────────────────────────────┘
```

**Features**:
- Password gate (if enabled)
- Mobile responsive
- OG meta tags for social sharing previews
- View tracking (analytics)
- "Sign NDA" → redirects to CIM share link (existing e-sign flow)
- "Contact Broker" → opens contact modal or mailto link

### 3. Embed Functionality

**Iframe Embed**:
```html
<iframe
  src="https://app.cimshare.com/teaser/:slug/embed"
  width="100%"
  height="800"
  frameborder="0">
</iframe>
```

**Embed Page** (`/teaser/:slug/embed`):
- Minimal chrome version of teaser
- No header/footer
- Responsive to container width

### 4. PDF Export

**Contents**:
- Cover image (if present)
- Broker logo
- Headline and tags
- Summary paragraphs
- Financial highlights (if enabled)
- Broker contact info
- "Confidential Teaser" watermark (optional toggle)

**Styling**:
- Professional one-page layout
- Consistent with brand colors
- High-quality image rendering

---

## Technical Implementation

### Database Schema

**New Table: `teasers`**

```sql
CREATE TABLE teasers (
  id SERIAL PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES cim_documents(id) ON DELETE CASCADE,

  -- Content
  headline TEXT,
  summary TEXT,
  industry_tags TEXT[], -- e.g., ['Healthcare', 'SaaS']
  deal_type_tags TEXT[], -- e.g., ['Acquisition', 'Growth Equity']

  -- Cover Image (separate from CIM)
  cover_image_url TEXT,
  cover_image_attribution TEXT,
  use_cim_cover_image BOOLEAN DEFAULT true,

  -- Financials
  show_financials BOOLEAN DEFAULT false,
  revenue TEXT,
  earnings TEXT,
  asking_price TEXT,

  -- Share Settings
  share_slug TEXT UNIQUE,
  share_password TEXT,
  is_published BOOLEAN DEFAULT false,

  -- PDF Options
  include_watermark BOOLEAN DEFAULT true,

  -- Sync Tracking
  last_synced_at TIMESTAMP,
  cim_updated_since_sync BOOLEAN DEFAULT false,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_teasers_document_id ON teasers(document_id);
CREATE INDEX idx_teasers_share_slug ON teasers(share_slug);
```

**New Table: `teaser_views`**

```sql
CREATE TABLE teaser_views (
  id SERIAL PRIMARY KEY,
  teaser_id INTEGER NOT NULL REFERENCES teasers(id) ON DELETE CASCADE,
  viewer_ip TEXT,
  viewer_user_agent TEXT,
  referrer TEXT,
  session_id TEXT,
  time_spent_seconds INTEGER DEFAULT 0,
  clicked_sign_nda BOOLEAN DEFAULT false,
  clicked_contact BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_teaser_views_teaser_id ON teaser_views(teaser_id);
```

**New Table: `user_custom_tags`**

```sql
CREATE TABLE user_custom_tags (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tag_type TEXT NOT NULL, -- 'industry' or 'deal_type'
  tag_value TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, tag_type, tag_value)
);
```

### API Endpoints

**Teaser CRUD** (`server/routes/teaser-routes.ts`):

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cim/:id/teaser` | Get teaser for a CIM (or null if not created) |
| POST | `/api/cim/:id/teaser` | Create teaser with AI generation |
| PUT | `/api/cim/:id/teaser` | Update teaser settings/content |
| DELETE | `/api/cim/:id/teaser` | Delete teaser |
| POST | `/api/cim/:id/teaser/refresh` | Re-sync from CIM (regenerate AI content) |
| GET | `/api/cim/:id/teaser/preview` | Get preview data (for preview mode) |

**Public Teaser Access**:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/teaser/:slug` | Get public teaser data (respects password) |
| GET | `/api/teaser/:slug/check` | Quick check: exists, needs password, is published |
| POST | `/api/teaser/:slug/view` | Track view event |
| POST | `/api/teaser/:slug/heartbeat` | Update time spent |
| GET | `/api/teaser/:slug/export/pdf` | Download PDF |

**Tags**:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/user/tags` | Get user's custom tags |
| POST | `/api/user/tags` | Add custom tag |

### AI Integration

**Teaser Generation Prompt** (added to `server/openai.ts` or similar):

```typescript
async function generateTeaserContent(cimContent: string): Promise<{
  headline: string;
  summary: string;
  suggestedIndustryTags: string[];
  suggestedDealTypeTags: string[];
}> {
  const prompt = `
    You are creating a teaser for a confidential business sale listing.

    IMPORTANT RULES:
    - Do NOT include any specific company names, owner names, or employee names
    - Do NOT include specific numbers, revenue figures, or financial data
    - Do NOT include proprietary information, trade secrets, or competitive advantages in detail
    - Write in a formal, professional tone suitable for M&A transactions
    - Keep the summary between 1-4 paragraphs
    - The headline should be compelling but generic enough to not identify the business

    Based on the following CIM content, generate:
    1. A compelling headline (10-15 words max)
    2. A summary (1-4 paragraphs) that describes the business opportunity generically
    3. Suggested industry tags (1-3)
    4. Suggested deal type tags (1-2)

    CIM Content:
    ${cimContent}
  `;

  // Call OpenAI API and parse response
}
```

### Frontend Components

**New Files**:

```
client/src/pages/document/
  └── teaser-tab.tsx          # Main teaser editor tab

client/src/pages/
  └── teaser-page.tsx         # Public teaser view
  └── teaser-embed-page.tsx   # Embeddable version

client/src/components/teaser/
  ├── teaser-preview.tsx      # Preview component
  ├── teaser-cover-image.tsx  # Cover image selector
  ├── teaser-financials.tsx   # Financial fields section
  ├── teaser-tags.tsx         # Tag selector with custom option
  ├── teaser-share.tsx        # Share settings section
  └── embed-code-modal.tsx    # Modal with embed code
```

**Predefined Tags**:

```typescript
const INDUSTRY_TAGS = [
  'Healthcare', 'Technology', 'SaaS', 'Manufacturing',
  'Retail', 'E-commerce', 'Professional Services',
  'Construction', 'Food & Beverage', 'Transportation',
  'Financial Services', 'Real Estate', 'Education',
  'Energy', 'Agriculture', 'Media & Entertainment'
];

const DEAL_TYPE_TAGS = [
  'Acquisition', 'Merger', 'Growth Equity',
  'Buyout', 'Recapitalization', 'Divestiture',
  'Management Buyout', 'Strategic Sale'
];
```

### Routes (React Router)

```typescript
// Add to client/src/App.tsx or routes config
<Route path="/teaser/:slug" element={<TeaserPage />} />
<Route path="/teaser/:slug/embed" element={<TeaserEmbedPage />} />
```

### PDF Generation

**Extend** `server/document-export.ts`:

```typescript
async function generateTeaserPdf(teaser: Teaser, user: User): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'LETTER', margin: 50 });

  // Add cover image (16:9, full width)
  if (teaser.coverImageUrl) {
    // Add image with proper scaling
  }

  // Add broker logo (top right or below cover)
  if (user.businessLogo) {
    // Add logo
  }

  // Add headline
  doc.fontSize(24).font('Helvetica-Bold').text(teaser.headline);

  // Add tags as badges
  // ...

  // Add summary
  doc.fontSize(12).font('Helvetica').text(teaser.summary);

  // Add financials if enabled
  if (teaser.showFinancials) {
    // Three-column financial cards
  }

  // Add broker contact info
  doc.fontSize(10).text(`${user.businessName} | ${user.email}`);

  // Add watermark if enabled
  if (teaser.includeWatermark) {
    doc.opacity(0.1).fontSize(48).text('CONFIDENTIAL TEASER', ...);
  }

  return doc;
}
```

### OG Meta Tags

**For social sharing** (in teaser-page.tsx):

```typescript
// Use react-helmet or similar
<Helmet>
  <title>{teaser.headline}</title>
  <meta property="og:title" content={teaser.headline} />
  <meta property="og:description" content={truncate(teaser.summary, 160)} />
  <meta property="og:image" content={teaser.coverImageUrl} />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary_large_image" />
</Helmet>
```

---

## Implementation Phases

### Phase 1: Database & API Foundation
1. Create database migrations for `teasers`, `teaser_views`, `user_custom_tags`
2. Add Drizzle schema definitions
3. Create `teaser-routes.ts` with CRUD endpoints
4. Implement AI teaser generation function

### Phase 2: Teaser Tab UI
1. Add "Teaser" tab to document detail page
2. Build teaser editor form with all sections
3. Implement cover image selector (CIM image, upload, Unsplash)
4. Build tag selector with custom tag support
5. Add share settings (slug, password, publish toggle)
6. Implement preview functionality

### Phase 3: Public Teaser Page
1. Create public teaser page component
2. Implement password gate
3. Add view tracking and analytics
4. Implement "Sign NDA" and "Contact Broker" actions
5. Add OG meta tags for social sharing

### Phase 4: Export & Embed
1. Implement PDF generation for teasers
2. Create embed page variant
3. Build embed code modal with copy functionality

### Phase 5: Polish & Analytics
1. Add status indicator (Draft/Published/Outdated)
2. Implement "Refresh from CIM" functionality
3. Add teaser analytics to document analytics tab
4. Mobile responsiveness testing

---

## Predefined Industry Tags

```typescript
export const PREDEFINED_INDUSTRY_TAGS = [
  'Aerospace & Defense',
  'Agriculture',
  'Automotive',
  'Business Services',
  'Construction',
  'Consumer Products',
  'E-commerce',
  'Education',
  'Energy & Utilities',
  'Financial Services',
  'Food & Beverage',
  'Healthcare',
  'Hospitality',
  'Insurance',
  'Logistics & Transportation',
  'Manufacturing',
  'Media & Entertainment',
  'Professional Services',
  'Real Estate',
  'Retail',
  'SaaS / Software',
  'Technology',
  'Telecommunications',
];

export const PREDEFINED_DEAL_TYPE_TAGS = [
  'Acquisition',
  'Asset Sale',
  'Buyout',
  'Divestiture',
  'Growth Equity',
  'Management Buyout (MBO)',
  'Merger',
  'Minority Investment',
  'Recapitalization',
  'Strategic Sale',
];
```

---

## Open Questions (Resolved)

| Question | Resolution |
|----------|------------|
| Cover image aspect ratio | 16:9 |
| Allow no image | Yes |
| AI regenerate button | No (not for MVP) |
| Summary tone | Formal/professional |
| Financial field currency | Text field (user types currency) |
| Headline generation | Auto-generated with edit option |
| Tags | Predefined + custom (saved per user) |
| Branding | Broker logo only (for now) |
| PDF watermark | Optional toggle ("Confidential Teaser") |
| Contact button | Include on teaser |
| URL structure | SEO-friendly: `/teaser/profitable-healthcare-saas` |
| Embed format | Iframe |
| Teaser per CIM | One teaser per CIM |
| Unpublished access | Strictly private until published |

---

## Future Enhancements (Not in Scope)

- Aggregated teaser listing page (broker's deal board)
- Multiple teaser versions per CIM
- QR code generation
- Email teaser link directly from app
- A/B testing different teaser versions
- Advanced analytics dashboard
- Custom branding colors/fonts
