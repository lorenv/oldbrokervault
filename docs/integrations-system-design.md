# Integrations System Design Specification

> **Document Version:** 1.0
> **Created:** December 2024
> **Status:** Planning Phase - Ready for Implementation

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Information Architecture & Terminology](#2-information-architecture--terminology)
3. [Database Schema Design](#3-database-schema-design)
4. [User Flows](#4-user-flows)
5. [Field Mapping UX Specification](#5-field-mapping-ux-specification)
6. [API Design](#6-api-design)
7. [Runtime Behavior & Reliability](#7-runtime-behavior--reliability)
8. [Security & Credential Management](#8-security--credential-management)
9. [Migration Strategy](#9-migration-strategy)
10. [Extensibility Approach](#10-extensibility-approach)
11. [Implementation Roadmap](#11-implementation-roadmap)
12. [Appendices](#12-appendices)

---

## 1. Executive Summary

### 1.1 Overview

Transform the existing webhooks feature into a comprehensive **Integrations** system that enables users to connect external tools (HubSpot, Slack, Zapier, Make) and create automated workflows triggered by app events.

### 1.2 Scope for v1

| Feature | In Scope | Notes |
|---------|----------|-------|
| Custom Webhooks | Yes | Migration from existing system |
| HubSpot Integration | Yes | OAuth + Contacts, Deals, Companies, Notes, Files |
| Slack Integration | Yes | OAuth + Channel notifications |
| Zapier | Yes | Webhook-based (no OAuth) |
| Make (Integromat) | Yes | Webhook-based (no OAuth) |
| Field Mapping UI | Yes | Source fields → Destination fields |
| Simple Conditions | Yes | Single condition per automation |
| File Attachments | Yes | PDF uploads to HubSpot records |
| Multi-step Workflows | No | Deferred to v2 |
| Complex Conditions | No | AND/OR logic deferred to v2 |

### 1.3 Key Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| OAuth Token Storage | AES-256 encrypted in database | Simple, secure, self-contained |
| URL Location | `/integrations` (replaces `/webhooks`) | Clean migration path |
| Zapier/Make Approach | Webhook-based, no OAuth | Industry standard, simpler |
| HubSpot Objects | All (Contact, Deal, Company, Note, File) | Maximum flexibility |
| Conditions | Simple single-condition | Sufficient for v1 use cases |
| HubSpot Custom Props | User pre-creates in HubSpot | Fewer API permissions needed |
| File Inclusion | Always include when relevant | Consistent user experience |

### 1.4 New Event Type

Adding `esign.envelope_completed` to the existing 17 event types:

```
esign.envelope_completed - Triggered when all recipients have signed
```

---

## 2. Information Architecture & Terminology

### 2.1 User-Facing Terminology

| Technical Term | User-Facing Term | Definition |
|---------------|------------------|------------|
| Integration | **Connection** | A linked external app (HubSpot, Slack) |
| Workflow | **Automation** | A rule: "When X happens, do Y" |
| Trigger | **"When this happens"** | The event that starts an automation |
| Destination | **"Send to"** | Where data goes (HubSpot, Slack, webhook) |
| Field Mapping | **"Match fields"** | Connecting source data to destination fields |
| Workflow Run | **"Run"** | A single execution of an automation |
| Delivery Log | **"Run History"** | Record of all automation executions |

### 2.2 Navigation Structure

```
/integrations
├── Connections (tab)
│   ├── Connected apps list
│   ├── Add new connection
│   └── Manage/disconnect existing
│
├── Automations (tab)
│   ├── Automations list
│   ├── Create new automation (wizard)
│   └── Edit existing automation
│
└── Run History (tab)
    ├── All runs across all automations
    ├── Filter by automation, status, date
    └── Run details with payload preview
```

### 2.3 Visual Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│  Integrations                                    [+ New Auto.]  │
├─────────────────────────────────────────────────────────────────┤
│  [Connections]    [Automations]    [Run History]                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Tab content here...                                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Database Schema Design

### 3.1 New Tables

#### `integration_connections`

Stores OAuth credentials and connection status for external apps.

```sql
CREATE TABLE integration_connections (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),

  -- Provider identification
  provider TEXT NOT NULL, -- 'hubspot', 'slack', 'zapier', 'make', 'webhook'
  provider_account_id TEXT, -- External account identifier (e.g., HubSpot portal ID)
  provider_account_name TEXT, -- Display name (e.g., "Acme Corp HubSpot")

  -- OAuth credentials (encrypted)
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMP,
  scopes TEXT[], -- Granted OAuth scopes

  -- For webhook-based integrations (Zapier, Make, custom)
  webhook_url TEXT,
  webhook_secret TEXT, -- HMAC signing secret

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'expired', 'error', 'disconnected'
  last_used_at TIMESTAMP,
  last_error TEXT,
  error_count INTEGER DEFAULT 0,

  -- Metadata
  settings JSONB DEFAULT '{}', -- Provider-specific settings
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,

  -- Constraints
  UNIQUE(user_id, provider, provider_account_id)
);
```

#### `integration_automations`

Stores automation configurations (trigger → destination mappings).

```sql
CREATE TABLE integration_automations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  connection_id INTEGER REFERENCES integration_connections(id), -- NULL for webhooks

  -- Basic info
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,

  -- Trigger configuration
  trigger_event TEXT NOT NULL, -- Event type (e.g., 'nda.signed')
  trigger_condition JSONB, -- Optional filter condition

  -- Destination configuration
  destination_type TEXT NOT NULL, -- 'hubspot_contact', 'hubspot_deal', 'slack_message', 'webhook', etc.
  destination_config JSONB NOT NULL, -- Type-specific config (channel ID, object type, etc.)

  -- Behavior configuration
  behavior TEXT DEFAULT 'upsert', -- 'create', 'update', 'upsert' (where applicable)
  match_field TEXT, -- Field to match on for update/upsert (e.g., 'email')

  -- Field mappings
  field_mappings JSONB NOT NULL DEFAULT '[]',
  -- Format: [{ sourceField: "data.signer_email", destField: "email", type: "field" },
  --          { value: "NDA Signed", destField: "nda_status", type: "constant" }]

  -- File attachment config (when applicable)
  include_file BOOLEAN DEFAULT false,
  file_source TEXT, -- 'signed_document', 'cim_pdf', etc.
  file_destination TEXT, -- 'contact_attachment', 'deal_attachment', etc.

  -- Statistics
  total_runs INTEGER DEFAULT 0 NOT NULL,
  successful_runs INTEGER DEFAULT 0 NOT NULL,
  failed_runs INTEGER DEFAULT 0 NOT NULL,
  last_run_at TIMESTAMP,
  last_success_at TIMESTAMP,
  last_failure_at TIMESTAMP,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
```

#### `integration_automation_runs`

Stores execution history for each automation run.

```sql
CREATE TABLE integration_automation_runs (
  id SERIAL PRIMARY KEY,
  automation_id INTEGER NOT NULL REFERENCES integration_automations(id),
  connection_id INTEGER REFERENCES integration_connections(id),

  -- Event that triggered this run
  event_type TEXT NOT NULL,
  event_id TEXT NOT NULL, -- Unique event identifier for idempotency
  event_payload JSONB NOT NULL,

  -- Execution details
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'success', 'failed', 'skipped'
  skipped_reason TEXT, -- If skipped due to condition not met

  -- Request/Response details
  request_payload JSONB, -- What was sent to destination (after field mapping)
  response_status INTEGER, -- HTTP status code
  response_body TEXT, -- Truncated response
  error_message TEXT,

  -- External references
  external_id TEXT, -- ID from destination (e.g., HubSpot contact ID)
  external_url TEXT, -- Link to record in destination system

  -- File handling
  file_uploaded BOOLEAN DEFAULT false,
  file_name TEXT,
  file_size INTEGER,

  -- Retry tracking
  attempt_count INTEGER DEFAULT 0 NOT NULL,
  next_retry_at TIMESTAMP,

  -- Timing
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Index for efficient queries
CREATE INDEX idx_automation_runs_automation_id ON integration_automation_runs(automation_id);
CREATE INDEX idx_automation_runs_status ON integration_automation_runs(status);
CREATE INDEX idx_automation_runs_created_at ON integration_automation_runs(created_at);
```

### 3.2 Migration: Existing Webhooks

Existing `webhooks` and `webhook_deliveries` tables will be migrated to the new schema:

```sql
-- Migration script (pseudo-code)
INSERT INTO integration_connections (user_id, provider, webhook_url, webhook_secret, status)
SELECT user_id, 'webhook', url, secret, CASE WHEN is_active THEN 'active' ELSE 'disconnected' END
FROM webhooks;

INSERT INTO integration_automations (user_id, connection_id, name, trigger_event, destination_type, ...)
SELECT ... FROM webhooks JOIN integration_connections ...;

-- Preserve delivery history
INSERT INTO integration_automation_runs (...)
SELECT ... FROM webhook_deliveries ...;
```

### 3.3 Schema Diagram

```
┌─────────────────────┐     ┌─────────────────────────┐
│       users         │     │ integration_connections │
├─────────────────────┤     ├─────────────────────────┤
│ id (PK)             │────<│ user_id (FK)            │
│ email               │     │ provider                │
│ ...                 │     │ access_token_encrypted  │
└─────────────────────┘     │ status                  │
                            └───────────┬─────────────┘
                                        │
                                        │ 1:N
                                        ▼
                            ┌─────────────────────────┐
                            │ integration_automations │
                            ├─────────────────────────┤
                            │ connection_id (FK)      │
                            │ trigger_event           │
                            │ destination_type        │
                            │ field_mappings          │
                            └───────────┬─────────────┘
                                        │
                                        │ 1:N
                                        ▼
                            ┌─────────────────────────┐
                            │ integration_auto_runs   │
                            ├─────────────────────────┤
                            │ automation_id (FK)      │
                            │ event_payload           │
                            │ status                  │
                            │ external_id             │
                            └─────────────────────────┘
```

---

## 4. User Flows

### 4.1 Connecting HubSpot (OAuth Flow)

```
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: User clicks "Connect HubSpot"                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Connect to HubSpot                                      │   │
│  │                                                          │   │
│  │  Connect your HubSpot account to sync contacts,          │   │
│  │  deals, and documents automatically.                     │   │
│  │                                                          │   │
│  │  What we'll access:                                      │   │
│  │  • Read and write contacts                               │   │
│  │  • Read and write deals                                  │   │
│  │  • Read and write companies                              │   │
│  │  • Upload files and attachments                          │   │
│  │                                                          │   │
│  │  [Connect HubSpot]                                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: OAuth redirect to HubSpot                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  User is redirected to HubSpot's OAuth consent screen           │
│  URL: https://app.hubspot.com/oauth/authorize?...               │
│                                                                 │
│  HubSpot shows:                                                 │
│  "CIMShare wants to access your HubSpot account"                │
│  [Allow] [Deny]                                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 3: Callback & Success                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ✓ HubSpot Connected                                     │   │
│  │                                                          │   │
│  │  Successfully connected to:                              │   │
│  │  Acme Corp (Portal ID: 12345678)                         │   │
│  │                                                          │   │
│  │  [Create Your First Automation]    [Done]                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Connecting Slack (OAuth Flow)

```
Similar to HubSpot:
1. User clicks "Connect Slack"
2. OAuth redirect to Slack
3. User selects workspace and grants permissions
4. Callback saves tokens, shows success
5. User can select default channel or configure per-automation
```

### 4.3 Creating an Automation (Wizard Flow)

```
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: When this happens...                               1/4  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Choose what triggers this automation:                          │
│                                                                 │
│  Documents                          NDAs                        │
│  ┌────────────────────────┐        ┌────────────────────────┐  │
│  │ ○ Document created     │        │ ○ NDA sent             │  │
│  │ ○ Document published   │        │ ● NDA signed      ←────│──│─ Selected
│  │ ○ Document viewed      │        │ ○ NDA declined         │  │
│  │ ○ Document downloaded  │        └────────────────────────┘  │
│  └────────────────────────┘                                     │
│                                                                 │
│  E-Signatures                       Contacts                    │
│  ┌────────────────────────┐        ┌────────────────────────┐  │
│  │ ○ Envelope completed   │        │ ○ Contact created      │  │
│  └────────────────────────┘        │ ○ Contact updated      │  │
│                                     └────────────────────────┘  │
│                                                                 │
│  [Cancel]                                            [Next →]   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: Add a condition (optional)                         2/4  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Only run this automation when:                                 │
│                                                                 │
│  ☑ Add a condition                                              │
│                                                                 │
│  ┌──────────────────┐  ┌─────────┐  ┌────────────────────┐     │
│  │ Document Title ▼ │  │ contains│  │ NDA                │     │
│  └──────────────────┘  └─────────┘  └────────────────────┘     │
│                                                                 │
│  Available conditions:                                          │
│  • equals, not equals, contains, starts with, ends with         │
│  • is empty, is not empty                                       │
│                                                                 │
│  [← Back]                                            [Next →]   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ STEP 3: Send to...                                         3/4  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Where should the data go?                                      │
│                                                                 │
│  Your Connections                                               │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ [HubSpot icon] HubSpot - Acme Corp          [Select ▼] │    │
│  │                                                         │    │
│  │   Send to:  ● Contact                                   │    │
│  │             ○ Deal                                      │    │
│  │             ○ Company                                   │    │
│  │                                                         │    │
│  │   Behavior: ○ Create new record                         │    │
│  │             ○ Update existing (match by email)          │    │
│  │             ● Create or update (recommended)            │    │
│  │                                                         │    │
│  │   ☑ Attach signed NDA PDF to contact record             │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ─── OR ───                                                     │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ [Slack icon] Slack - Acme Workspace                     │    │
│  │ [Zapier icon] Zapier                                    │    │
│  │ [Make icon] Make                                        │    │
│  │ [Webhook icon] Custom Webhook                           │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                 │
│  [← Back]                                            [Next →]   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ STEP 4: Match fields                                       4/4  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Map data from the event to HubSpot Contact fields:             │
│                                                                 │
│  YOUR DATA                          HUBSPOT CONTACT             │
│  ┌─────────────────────────┐       ┌─────────────────────────┐ │
│  │ Signer Email        ────│───────│─→ Email *               │ │
│  │ data.signer_email       │       │   (required)            │ │
│  └─────────────────────────┘       └─────────────────────────┘ │
│                                                                 │
│  ┌─────────────────────────┐       ┌─────────────────────────┐ │
│  │ Signer Name         ────│───────│─→ First Name            │ │
│  │ data.signer_name        │       │                         │ │
│  └─────────────────────────┘       └─────────────────────────┘ │
│                                                                 │
│  ┌─────────────────────────┐       ┌─────────────────────────┐ │
│  │ [Use constant value] ───│───────│─→ NDA Status            │ │
│  │ "Signed"                │       │   (custom property)     │ │
│  └─────────────────────────┘       └─────────────────────────┘ │
│                                                                 │
│  ┌─────────────────────────┐       ┌─────────────────────────┐ │
│  │ Document Title      ────│───────│─→ NDA Document Name     │ │
│  │ data.cim_title          │       │   (custom property)     │ │
│  └─────────────────────────┘       └─────────────────────────┘ │
│                                                                 │
│  [+ Add another field]                                          │
│                                                                 │
│  ───────────────────────────────────────────────────────────── │
│                                                                 │
│  Automation Name: NDA Signed → HubSpot Contact                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ NDA Signed → HubSpot Contact                            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [← Back]            [Test Automation]    [Save & Enable]       │
└─────────────────────────────────────────────────────────────────┘
```

### 4.4 Testing an Automation

```
┌─────────────────────────────────────────────────────────────────┐
│ Test Automation                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Choose a sample event to test with:                            │
│                                                                 │
│  ○ Use sample data (recommended for first test)                 │
│  ● Use a recent real event:                                     │
│                                                                 │
│    ┌────────────────────────────────────────────────────────┐  │
│    │ NDA Signed - John Smith (john@example.com)             │  │
│    │ December 10, 2024 at 3:45 PM                           │  │
│    └────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Preview what will be sent to HubSpot:                          │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ {                                                       │    │
│  │   "email": "john@example.com",                          │    │
│  │   "firstname": "John Smith",                            │    │
│  │   "nda_status": "Signed",                               │    │
│  │   "nda_document_name": "Acme Corp NDA"                  │    │
│  │ }                                                       │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ☑ Actually send to HubSpot (uncheck for preview only)          │
│                                                                 │
│  [Cancel]                                    [Run Test]         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Test Result                                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ✓ Test successful!                                             │
│                                                                 │
│  Contact created in HubSpot:                                    │
│  John Smith (john@example.com)                                  │
│                                                                 │
│  [View in HubSpot ↗]                                            │
│                                                                 │
│  File attachment: ✓ NDA_John_Smith.pdf uploaded                 │
│                                                                 │
│  [Close]                              [Save & Enable Automation]│
└─────────────────────────────────────────────────────────────────┘
```

### 4.5 Slack Automation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ Send to Slack                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Channel: [#deals ▼]                                            │
│                                                                 │
│  Message template:                                              │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ 📝 *NDA Signed*                                         │    │
│  │                                                         │    │
│  │ *Signer:* {{data.signer_name}}                          │    │
│  │ *Email:* {{data.signer_email}}                          │    │
│  │ *Document:* {{data.cim_title}}                          │    │
│  │ *Signed at:* {{timestamp}}                              │    │
│  │                                                         │    │
│  │ [View Document]({{data.document_url}})                  │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                 │
│  Preview:                                                       │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ 📝 *NDA Signed*                                         │    │
│  │                                                         │    │
│  │ *Signer:* John Smith                                    │    │
│  │ *Email:* john@example.com                               │    │
│  │ *Document:* Acme Corp Acquisition                       │    │
│  │ *Signed at:* Dec 10, 2024 3:45 PM                       │    │
│  │                                                         │    │
│  │ View Document                                           │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.6 Custom Webhook Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ Custom Webhook                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Endpoint URL *                                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ https://hooks.example.com/webhook                       │    │
│  └────────────────────────────────────────────────────────┘    │
│  Must use HTTPS                                                 │
│                                                                 │
│  Signing Secret                                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ whsec_••••••••••••••••                    [Regenerate] │    │
│  └────────────────────────────────────────────────────────┘    │
│  Use this to verify webhook payloads. View documentation →      │
│                                                                 │
│  Payload format:                                                │
│  ○ Full event payload (includes all event data)                 │
│  ● Custom field mapping (select specific fields)                │
│                                                                 │
│  [View sample payload]                                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Field Mapping UX Specification

### 5.1 Source Fields (Event Payload)

Display event fields in a user-friendly format:

| Raw Path | Display Name | Type |
|----------|--------------|------|
| `data.signer_email` | Signer Email | Email |
| `data.signer_name` | Signer Name | Text |
| `data.cim_id` | Document ID | ID |
| `data.cim_title` | Document Title | Text |
| `data.signed_at` | Signed At | Date |
| `timestamp` | Event Time | Date |

### 5.2 Destination Fields (HubSpot Contact Example)

Fetch from HubSpot API and display:

| Field Name | Internal Name | Type | Required |
|------------|---------------|------|----------|
| Email | `email` | Email | Yes |
| First Name | `firstname` | Text | No |
| Last Name | `lastname` | Text | No |
| Phone | `phone` | Phone | No |
| Company | `company` | Text | No |
| *Custom: NDA Status* | `nda_status` | Text | No |

### 5.3 Mapping Types

```typescript
type FieldMapping = {
  type: 'field' | 'constant' | 'template';
  sourceField?: string;      // For type: 'field'
  constantValue?: string;    // For type: 'constant'
  template?: string;         // For type: 'template' (e.g., "Signed: {{data.signer_name}}")
  destField: string;
  destFieldLabel: string;
  required: boolean;
};
```

### 5.4 Auto-Mapping Suggestions

When user selects a trigger and destination, suggest mappings:

| Source Field | Suggested Destination | Confidence |
|--------------|----------------------|------------|
| `data.signer_email` | Email | High (exact match) |
| `data.signer_name` | First Name | Medium (partial) |
| `data.cim_title` | — | No suggestion |

### 5.5 Validation Rules

1. **Required fields must be mapped** - Show error if required destination field has no mapping
2. **Type compatibility** - Warn if mapping text to number field
3. **Constant validation** - Validate constant values match expected format
4. **Duplicate detection** - Warn if same source mapped to multiple destinations

### 5.6 Field Mapping UI Component

```
┌─────────────────────────────────────────────────────────────────┐
│ Source                              Destination                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌─────────────────────┐    →    ┌─────────────────────┐        │
│ │ [Search fields...] ▼│         │ Email *              │        │
│ ├─────────────────────┤         │ (required)           │        │
│ │ Event Data          │         └─────────────────────┘        │
│ │  • Signer Email  ←──│─────────────────────────────────        │
│ │  • Signer Name      │                                         │
│ │  • Document Title   │                                         │
│ │  • Document ID      │                                         │
│ │──────────────────── │                                         │
│ │ Constants           │                                         │
│ │  [Enter value...]   │                                         │
│ └─────────────────────┘                                         │
│                                                                 │
│ [+ Add Field Mapping]                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. API Design

### 6.1 Connection Endpoints

```
GET    /api/integrations/connections
       List all connections for user
       Response: { connections: Connection[] }

POST   /api/integrations/connections
       Create connection (for webhooks) or initiate OAuth
       Body: { provider: string, webhookUrl?: string }
       Response: { connection: Connection, oauthUrl?: string }

GET    /api/integrations/connections/:id
       Get connection details
       Response: { connection: Connection }

DELETE /api/integrations/connections/:id
       Disconnect/delete connection
       Response: { success: true }

POST   /api/integrations/connections/:id/refresh
       Refresh OAuth token
       Response: { connection: Connection }

GET    /api/integrations/oauth/callback/:provider
       OAuth callback handler
       Query: { code, state }
       Redirect: /integrations?connected=hubspot
```

### 6.2 Automation Endpoints

```
GET    /api/integrations/automations
       List all automations for user
       Query: { connectionId?, isActive?, limit?, offset? }
       Response: { automations: Automation[], total: number }

POST   /api/integrations/automations
       Create new automation
       Body: {
         name, triggerEvent, connectionId, destinationType,
         destinationConfig, behavior, fieldMappings, triggerCondition?
       }
       Response: { automation: Automation }

GET    /api/integrations/automations/:id
       Get automation details with recent runs
       Response: { automation: Automation, recentRuns: Run[] }

PATCH  /api/integrations/automations/:id
       Update automation
       Body: Partial<Automation>
       Response: { automation: Automation }

DELETE /api/integrations/automations/:id
       Delete automation and its run history
       Response: { success: true }

POST   /api/integrations/automations/:id/toggle
       Enable/disable automation
       Body: { isActive: boolean }
       Response: { automation: Automation }

POST   /api/integrations/automations/:id/test
       Test automation with sample or real event
       Body: { eventId?: string, useSample?: boolean, dryRun?: boolean }
       Response: { success: boolean, result: RunResult, preview?: object }
```

### 6.3 Run History Endpoints

```
GET    /api/integrations/runs
       List runs across all automations
       Query: { automationId?, status?, eventType?, limit?, offset? }
       Response: { runs: Run[], total: number, pagination: {...} }

GET    /api/integrations/runs/:id
       Get run details including full payload
       Response: { run: Run }

POST   /api/integrations/runs/:id/retry
       Retry a failed run
       Response: { run: Run }
```

### 6.4 Metadata Endpoints

```
GET    /api/integrations/event-types
       List available event types (grouped by category)
       Response: { categories: { [key]: { label, events: Event[] } } }

GET    /api/integrations/providers
       List available integration providers
       Response: { providers: Provider[] }

GET    /api/integrations/hubspot/objects
       List HubSpot object types for connected account
       Response: { objects: ['contact', 'deal', 'company', 'note'] }

GET    /api/integrations/hubspot/properties/:objectType
       Get properties/fields for HubSpot object
       Response: { properties: Property[] }

GET    /api/integrations/slack/channels
       List Slack channels for connected workspace
       Response: { channels: Channel[] }
```

---

## 7. Runtime Behavior & Reliability

### 7.1 Event Processing Flow

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────────┐
│ App Event   │────▶│ Automation      │────▶│ Destination      │
│ (e.g., NDA  │     │ Engine          │     │ Provider         │
│  signed)    │     │                 │     │ (HubSpot, Slack) │
└─────────────┘     └─────────────────┘     └──────────────────┘
                            │
                            ▼
                    ┌─────────────────┐
                    │ Run History     │
                    │ (logged)        │
                    └─────────────────┘
```

### 7.2 Processing Steps

```typescript
async function processEvent(userId: number, eventType: string, payload: object) {
  // 1. Find matching automations
  const automations = await findActiveAutomations(userId, eventType);

  for (const automation of automations) {
    // 2. Check condition (if any)
    if (automation.triggerCondition && !evaluateCondition(automation.triggerCondition, payload)) {
      await logSkippedRun(automation.id, payload, 'Condition not met');
      continue;
    }

    // 3. Apply field mappings
    const mappedPayload = applyFieldMappings(automation.fieldMappings, payload);

    // 4. Execute destination action
    const run = await createRun(automation.id, eventType, payload);

    try {
      const result = await executeDestination(automation, mappedPayload);
      await markRunSuccess(run.id, result);
    } catch (error) {
      await markRunFailed(run.id, error);
      await scheduleRetry(run.id);
    }
  }
}
```

### 7.3 Retry Strategy

| Attempt | Delay | Notes |
|---------|-------|-------|
| 1 | Immediate | First attempt |
| 2 | 1 minute | First retry |
| 3 | 5 minutes | |
| 4 | 30 minutes | |
| 5 | 2 hours | |
| 6 | 24 hours | Final attempt |

After 6 failures: Mark as permanently failed, notify user via email.

### 7.4 Rate Limiting

| Limit Type | Threshold | Action |
|------------|-----------|--------|
| Per automation | 100/minute | Queue excess |
| Per user (all automations) | 500/minute | Queue excess |
| Per destination connection | 50/minute | Respect API limits |

### 7.5 Idempotency

Each event gets a unique `event_id`. Before processing:

```typescript
// Check if already processed
const existing = await findRunByEventId(automation.id, eventId);
if (existing && existing.status === 'success') {
  return; // Skip duplicate
}
```

### 7.6 Error Categories & User Messages

| Technical Error | User-Facing Message |
|-----------------|---------------------|
| `401 Unauthorized` | "Your HubSpot connection has expired. Please reconnect." |
| `404 Not Found` (HubSpot) | "The contact couldn't be found in HubSpot. It may have been deleted." |
| `429 Too Many Requests` | "HubSpot rate limit reached. We'll retry automatically." |
| `ECONNREFUSED` | "Unable to reach your webhook URL. Please check it's accessible." |
| `Timeout` | "The request timed out. We'll retry automatically." |

### 7.7 File Upload Handling

For automations with file attachments:

```typescript
async function uploadFileToHubSpot(automation: Automation, payload: EventPayload) {
  // 1. Generate signed URL for file (24-hour expiry)
  const fileUrl = await generateSignedFileUrl(payload.fileId);

  // 2. Download file temporarily
  const fileBuffer = await downloadFile(fileUrl);

  // 3. Upload to HubSpot Files API
  const hubspotFileId = await hubspotClient.files.upload(fileBuffer, {
    name: payload.fileName,
    folder: 'CIMShare Uploads'
  });

  // 4. Attach to record (Contact, Deal, etc.)
  await hubspotClient.engagements.create({
    type: 'NOTE',
    associations: { contactIds: [contactId] },
    attachments: [{ id: hubspotFileId }]
  });
}
```

---

## 8. Security & Credential Management

### 8.1 OAuth Token Encryption

```typescript
import * as crypto from 'crypto';

const ENCRYPTION_KEY = process.env.INTEGRATION_ENCRYPTION_KEY; // 32-byte key in Replit secrets
const ALGORITHM = 'aes-256-gcm';

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

function decrypt(encryptedText: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedText.split(':');

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);

  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
```

### 8.2 Replit Secrets Required

```
INTEGRATION_ENCRYPTION_KEY=<32-byte hex string for AES-256>

# HubSpot OAuth
HUBSPOT_CLIENT_ID=<from HubSpot developer portal>
HUBSPOT_CLIENT_SECRET=<from HubSpot developer portal>

# Slack OAuth
SLACK_CLIENT_ID=<from Slack app settings>
SLACK_CLIENT_SECRET=<from Slack app settings>
```

### 8.3 OAuth Scopes Required

**HubSpot:**
```
crm.objects.contacts.read
crm.objects.contacts.write
crm.objects.deals.read
crm.objects.deals.write
crm.objects.companies.read
crm.objects.companies.write
files.ui_hidden.read
files.ui_hidden.write
```

**Slack:**
```
chat:write
channels:read
```

### 8.4 Webhook Signature Verification

(Same as existing implementation)

```typescript
function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const [timestamp, hash] = parseSignature(signature);
  const expectedHash = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(expectedHash));
}
```

---

## 9. Migration Strategy

### 9.1 Database Migration

```sql
-- Phase 1: Create new tables (non-destructive)
CREATE TABLE integration_connections (...);
CREATE TABLE integration_automations (...);
CREATE TABLE integration_automation_runs (...);

-- Phase 2: Migrate existing webhooks
INSERT INTO integration_connections (...)
SELECT ... FROM webhooks ...;

INSERT INTO integration_automations (...)
SELECT ... FROM webhooks ...;

INSERT INTO integration_automation_runs (...)
SELECT ... FROM webhook_deliveries ...;

-- Phase 3: After verification, archive old tables
ALTER TABLE webhooks RENAME TO webhooks_archived;
ALTER TABLE webhook_deliveries RENAME TO webhook_deliveries_archived;
```

### 9.2 API Migration

| Old Endpoint | New Endpoint | Behavior |
|--------------|--------------|----------|
| `GET /api/webhooks` | `GET /api/integrations/automations?type=webhook` | Redirect |
| `POST /api/webhooks` | `POST /api/integrations/automations` | Redirect |
| `GET /api/webhooks/:id/deliveries` | `GET /api/integrations/runs?automationId=:id` | Redirect |

### 9.3 Frontend Migration

```tsx
// Old route (temporary redirect)
<Route path="/webhooks">
  <Redirect to="/integrations" />
</Route>

// New route
<Route path="/integrations" component={IntegrationsPage} />
```

### 9.4 User Communication

1. **In-app banner** (1 week before):
   > "Webhooks is getting an upgrade! Soon you'll be able to connect HubSpot, Slack, and more."

2. **Migration notice** (on launch):
   > "Welcome to Integrations! Your existing webhooks have been migrated automatically."

3. **Email notification** to users with active webhooks

---

## 10. Extensibility Approach

### 10.1 Provider Interface

```typescript
interface IntegrationProvider {
  // Metadata
  id: string;                    // 'hubspot', 'slack', etc.
  name: string;                  // 'HubSpot'
  icon: string;                  // Icon URL or component name
  description: string;
  authType: 'oauth' | 'webhook' | 'api_key';

  // OAuth (if applicable)
  getAuthUrl?(state: string): string;
  handleCallback?(code: string): Promise<OAuthTokens>;
  refreshToken?(refreshToken: string): Promise<OAuthTokens>;

  // Destination types this provider supports
  destinationTypes: DestinationType[];

  // Schema/field fetching
  getDestinationSchema?(connection: Connection, destType: string): Promise<FieldSchema[]>;

  // Execution
  execute(
    connection: Connection,
    destType: string,
    config: DestinationConfig,
    payload: MappedPayload
  ): Promise<ExecutionResult>;
}
```

### 10.2 Adding a New Provider

To add a new provider (e.g., Salesforce):

1. Create `server/integrations/providers/salesforce.ts`
2. Implement `IntegrationProvider` interface
3. Register in `server/integrations/providers/index.ts`
4. Add OAuth credentials to Replit secrets
5. Add UI components for Salesforce-specific config

### 10.3 Adding New Event Types

To add a new event type:

1. Add to `WEBHOOK_EVENT_TYPES` in `shared/schema.ts`
2. Add dispatch call in relevant route handler
3. Define test payload in `webhook-dispatcher.ts`
4. Add to event category in frontend

### 10.4 Adding New Destination Types

To add a new destination type (e.g., HubSpot Ticket):

1. Add to provider's `destinationTypes` array
2. Implement schema fetching for new type
3. Implement execution logic
4. Add UI for type-specific configuration

---

## 11. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

**Goal:** Core infrastructure + Custom Webhooks migration

| Task | Priority | Estimate |
|------|----------|----------|
| Create database schema + migrations | P0 | 1 day |
| Build provider abstraction layer | P0 | 1 day |
| Migrate webhooks to new schema | P0 | 1 day |
| Build automation engine (event processing) | P0 | 2 days |
| Create basic Integrations page UI (tabs) | P0 | 1 day |
| Migrate Connections tab (webhook list) | P0 | 1 day |
| Migrate Automations tab (webhook configs) | P0 | 1 day |
| Migrate Run History tab (delivery logs) | P0 | 1 day |
| Add `esign.envelope_completed` event dispatch | P1 | 0.5 days |

**Deliverable:** Existing webhooks work in new UI

### Phase 2: Slack Integration (Week 3)

**Goal:** First OAuth-based integration

| Task | Priority | Estimate |
|------|----------|----------|
| Implement Slack OAuth flow | P0 | 1 day |
| Build Slack provider | P0 | 1 day |
| Add channel selection UI | P0 | 0.5 days |
| Add message template builder | P0 | 1 day |
| Test end-to-end | P0 | 0.5 days |

**Deliverable:** Users can send Slack notifications on events

### Phase 3: HubSpot Integration (Week 4-5)

**Goal:** Full CRM integration with field mapping

| Task | Priority | Estimate |
|------|----------|----------|
| Implement HubSpot OAuth flow | P0 | 1 day |
| Build HubSpot provider (base) | P0 | 1 day |
| Implement Contact create/update/upsert | P0 | 1 day |
| Implement Deal support | P1 | 0.5 days |
| Implement Company support | P1 | 0.5 days |
| Implement Note/engagement support | P1 | 0.5 days |
| Build field mapping UI | P0 | 2 days |
| Implement file upload to HubSpot | P0 | 1 day |
| Add auto-mapping suggestions | P2 | 0.5 days |
| Test all HubSpot scenarios | P0 | 1 day |

**Deliverable:** Full HubSpot integration with field mapping

### Phase 4: Zapier & Make (Week 6)

**Goal:** Webhook-based platform integrations

| Task | Priority | Estimate |
|------|----------|----------|
| Add Zapier as destination type | P0 | 0.5 days |
| Add Make as destination type | P0 | 0.5 days |
| Add branded setup flows | P1 | 0.5 days |
| Documentation for Zapier/Make setup | P1 | 0.5 days |

**Deliverable:** Users can trigger Zapier/Make automations

### Phase 5: Polish & Launch (Week 7)

**Goal:** Production-ready release

| Task | Priority | Estimate |
|------|----------|----------|
| Error message improvements | P0 | 1 day |
| Connection health monitoring | P0 | 0.5 days |
| Automation test preview feature | P1 | 1 day |
| Email notifications for failures | P1 | 0.5 days |
| User documentation | P0 | 1 day |
| Performance testing | P0 | 0.5 days |
| Bug fixes and polish | P0 | 1 day |

**Deliverable:** Production launch

---

## 12. Appendices

### Appendix A: Complete Event Types

```typescript
export const INTEGRATION_EVENT_TYPES = [
  // CIM Events
  'cim.created',
  'cim.updated',
  'cim.published',
  'cim.viewed',
  'cim.downloaded',

  // NDA Events
  'nda.sent',
  'nda.signed',
  'nda.declined',

  // E-Signature Events (NEW)
  'esign.envelope_completed',

  // Contact Events
  'contact.created',
  'contact.updated',
  'contact.deleted',

  // Message Events
  'message.received',
  'message.sent',

  // Data Room Events
  'dataroom.file_uploaded',
  'dataroom.file_viewed',
  'dataroom.access_granted',
] as const;
```

### Appendix B: Event Payload Schemas

#### `nda.signed`
```json
{
  "event": "nda.signed",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "data": {
    "nda_id": 123,
    "cim_id": 456,
    "cim_title": "Acme Corp Acquisition",
    "signer_name": "John Smith",
    "signer_email": "john@example.com",
    "signer_ip": "192.168.1.1",
    "signer_location": "New York, NY",
    "signed_at": "2025-01-15T10:30:00.000Z",
    "signed_document_url": "https://..."
  }
}
```

#### `esign.envelope_completed`
```json
{
  "event": "esign.envelope_completed",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "data": {
    "envelope_id": "env_abc123",
    "title": "Sales Agreement - Acme Corp",
    "completed_at": "2025-01-15T10:30:00.000Z",
    "signed_document_url": "https://...",
    "certificate_url": "https://...",
    "recipients": [
      {
        "name": "John Smith",
        "email": "john@example.com",
        "role": "signer",
        "signed_at": "2025-01-15T10:25:00.000Z"
      },
      {
        "name": "Jane Doe",
        "email": "jane@acme.com",
        "role": "signer",
        "signed_at": "2025-01-15T10:30:00.000Z"
      }
    ]
  }
}
```

#### `contact.created`
```json
{
  "event": "contact.created",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "data": {
    "contact_id": 789,
    "email": "contact@example.com",
    "name": "Jane Smith",
    "status": "new",
    "source": "nda_signature",
    "source_document_id": 456
  }
}
```

### Appendix C: HubSpot API Reference

**Create/Update Contact:**
```
POST /crm/v3/objects/contacts
{
  "properties": {
    "email": "john@example.com",
    "firstname": "John",
    "lastname": "Smith",
    "custom_property": "value"
  }
}
```

**Upload File:**
```
POST /files/v3/files
Content-Type: multipart/form-data
{
  "file": <binary>,
  "options": {
    "access": "PRIVATE",
    "folderPath": "/CIMShare"
  }
}
```

**Create Engagement (Attach File):**
```
POST /engagements/v1/engagements
{
  "engagement": { "type": "NOTE" },
  "associations": { "contactIds": [123] },
  "attachments": [{ "id": 456 }],
  "metadata": { "body": "Document attached by CIMShare" }
}
```

### Appendix D: Slack API Reference

**Post Message:**
```
POST /api/chat.postMessage
{
  "channel": "C1234567890",
  "text": "NDA Signed by John Smith",
  "blocks": [...]
}
```

### Appendix E: Simple Condition Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `equals` | Exact match | `title equals "NDA"` |
| `not_equals` | Not equal | `status not_equals "draft"` |
| `contains` | Substring match | `title contains "Acme"` |
| `not_contains` | No substring | `email not_contains "@test"` |
| `starts_with` | Prefix match | `name starts_with "John"` |
| `ends_with` | Suffix match | `email ends_with "@acme.com"` |
| `is_empty` | Null/empty check | `notes is_empty` |
| `is_not_empty` | Has value | `email is_not_empty` |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Dec 2024 | Claude | Initial specification |

---

*End of Document*
