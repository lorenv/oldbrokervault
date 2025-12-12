# Integrations Documentation

This guide covers all available integrations, how to set them up, and how to create automations that connect your workflows to external services.

---

## Table of Contents

1. [Overview](#overview)
2. [Available Integrations](#available-integrations)
   - [HubSpot](#hubspot)
   - [Slack](#slack)
   - [Zapier](#zapier)
   - [Make (Integromat)](#make-integromat)
   - [Custom Webhook](#custom-webhook)
3. [Setting Up Connections](#setting-up-connections)
4. [Creating Automations](#creating-automations)
5. [Event Types](#event-types)
6. [Field Mappings](#field-mappings)
7. [Trigger Conditions](#trigger-conditions)
8. [Testing Automations](#testing-automations)
9. [Monitoring & Troubleshooting](#monitoring--troubleshooting)
10. [API Reference](#api-reference)

---

## Overview

The integrations system allows you to automatically send data to external services when specific events occur in your account. For example, you can:

- Create a HubSpot contact when an NDA is signed
- Send a Slack notification when a document is viewed
- Trigger a Zapier workflow when a new CIM is published
- Push data to your own systems via custom webhooks

### How It Works

1. **Connect** an external service (via OAuth or webhook URL)
2. **Create an automation** that defines:
   - Which event triggers it (e.g., "NDA signed")
   - Where to send the data (e.g., HubSpot contact)
   - How to map the event data to the destination fields
3. **Events fire automatically** as they occur in your account
4. **Monitor results** through the runs history

---

## Available Integrations

### HubSpot

HubSpot integration allows you to sync data with your CRM automatically.

**Authentication:** OAuth 2.0

**Supported Destinations:**
| Destination | Description |
|-------------|-------------|
| `hubspot_contact` | Create or update contacts in your CRM |
| `hubspot_deal` | Create or update deals |
| `hubspot_company` | Create or update company records |
| `hubspot_note` | Add notes to existing records |

**Features:**
- Automatic token refresh (no manual re-authentication needed)
- Create, update, or upsert (create if not exists, update if found)
- Match existing records by email or custom field
- File attachments supported

**Setup:**
1. Go to **Integrations** > **Connect New**
2. Select **HubSpot**
3. Click **Connect** to authorize via OAuth
4. Grant the requested permissions in HubSpot

**Configuration Options:**
- **Object Type:** Choose between contact, deal, or company
- **Behavior:**
  - `create` - Always create new records
  - `update` - Only update existing records (requires match field)
  - `upsert` - Create if not found, update if exists
- **Match Field:** Field used to find existing records (default: `email`)

---

### Slack

Send notifications and messages to your Slack workspace.

**Authentication:** OAuth 2.0

**Supported Destinations:**
| Destination | Description |
|-------------|-------------|
| `slack_message` | Send messages to channels |

**Features:**
- Post to public or private channels
- Customizable message templates
- Channel selection from your workspace

**Setup:**
1. Go to **Integrations** > **Connect New**
2. Select **Slack**
3. Click **Connect** to authorize
4. Select which channels the app can access

**Configuration Options:**
- **Channel:** Select the channel to post to
- **Message Template:** Customize the message format using template variables

**Example Message Template:**
```
New NDA signed by {{data.signer_name}} ({{data.signer_email}}) at {{data.signed_at}}
```

---

### Zapier

Connect to 5,000+ apps through Zapier's automation platform.

**Authentication:** Webhook URL

**Supported Destinations:**
| Destination | Description |
|-------------|-------------|
| `zapier_webhook` | Trigger Zapier Zaps |

**Features:**
- No OAuth required - just paste your webhook URL
- Flat payload structure optimized for Zapier's field mapping
- Works with any Zapier-supported destination

**Setup:**
1. In Zapier, create a new Zap with **Webhooks by Zapier** as the trigger
2. Select **Catch Hook** as the trigger event
3. Copy the webhook URL provided by Zapier
4. In our app, go to **Integrations** > **Connect New**
5. Select **Zapier** and paste the webhook URL
6. Test the connection to send sample data to Zapier

**URL Validation:** Only URLs from `hooks.zapier.com` are accepted.

---

### Make (Integromat)

Connect to Make's visual automation platform.

**Authentication:** Webhook URL

**Supported Destinations:**
| Destination | Description |
|-------------|-------------|
| `make_webhook` | Trigger Make scenarios |

**Features:**
- No OAuth required
- Nested payload structure with data wrapper
- Works with Make's extensive app library

**Setup:**
1. In Make, create a new scenario
2. Add a **Webhooks** module as the trigger
3. Select **Custom webhook** and create a new webhook
4. Copy the webhook URL
5. In our app, go to **Integrations** > **Connect New**
6. Select **Make** and paste the webhook URL

**URL Validation:** URLs from `hook.make.com` or `hook.integromat.com` are accepted.

---

### Custom Webhook

Send data to any HTTP endpoint you control.

**Authentication:** Webhook URL + HMAC Secret

**Supported Destinations:**
| Destination | Description |
|-------------|-------------|
| `custom_webhook` | POST data to any HTTPS endpoint |

**Features:**
- HMAC-SHA256 signature for payload verification
- Custom headers support
- Full control over your endpoint

**Setup:**
1. Go to **Integrations** > **Connect New**
2. Select **Custom Webhook**
3. Enter your HTTPS endpoint URL
4. Save the webhook secret (shown only once)

**URL Validation:** Must be a valid HTTPS URL.

**Security - Verifying Signatures:**

Each request includes an `X-Webhook-Signature` header containing an HMAC-SHA256 signature. Verify it on your server:

```javascript
const crypto = require('crypto');

function verifySignature(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}
```

```python
import hmac
import hashlib
import json

def verify_signature(payload, signature, secret):
    expected = hmac.new(
        secret.encode(),
        json.dumps(payload).encode(),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(signature, expected)
```

---

## Setting Up Connections

### OAuth Connections (HubSpot, Slack)

1. Navigate to **Integrations** page
2. Click **Connect New Integration**
3. Select the provider (HubSpot or Slack)
4. You'll be redirected to the provider's authorization page
5. Grant the requested permissions
6. You'll be redirected back with the connection active

### Webhook Connections (Zapier, Make, Custom)

1. Navigate to **Integrations** page
2. Click **Connect New Integration**
3. Select the provider
4. Enter the webhook URL
5. For custom webhooks, save the webhook secret securely (shown only once)
6. Test the connection to verify it works

### Connection Status

Connections can have the following statuses:

| Status | Description |
|--------|-------------|
| `active` | Connection is working normally |
| `expired` | OAuth token expired (will auto-refresh) |
| `error` | Multiple failures detected (auto-disabled after 10 consecutive errors) |
| `disconnected` | Manually disconnected by user |

---

## Creating Automations

Automations define what happens when specific events occur.

### Creating an Automation

1. Go to **Integrations** > **Automations**
2. Click **Create Automation**
3. Configure:
   - **Name:** A descriptive name for this automation
   - **Connection:** Select which integration to use
   - **Trigger Event:** Which event fires this automation
   - **Destination Type:** Where to send the data
   - **Field Mappings:** How to transform event data
4. Save and enable the automation

### Automation Behavior (CRM Destinations)

For HubSpot destinations, choose how records are handled:

| Behavior | Description |
|----------|-------------|
| `create` | Always create a new record |
| `update` | Update existing record only (fails if not found) |
| `upsert` | Create if not found, update if exists |

When using `update` or `upsert`, specify a **Match Field** (e.g., `email`) to identify existing records.

---

## Event Types

These events can trigger automations:

### Document Events

| Event | Description |
|-------|-------------|
| `cim.created` | A new CIM document was created |
| `cim.updated` | A CIM document was modified |
| `cim.published` | A CIM was published and is now accessible |
| `cim.viewed` | Someone viewed a CIM |
| `cim.downloaded` | Someone downloaded a CIM |

### NDA Events

| Event | Description |
|-------|-------------|
| `nda.signed` | An NDA was signed by a recipient |
| `nda.declined` | An NDA was declined |

### E-Signature Events

| Event | Description |
|-------|-------------|
| `esign.envelope_completed` | An e-signature envelope was completed |

### Contact Events

| Event | Description |
|-------|-------------|
| `contact.created` | A new contact was added |
| `contact.updated` | A contact's information was updated |

### Message Events

| Event | Description |
|-------|-------------|
| `message.received` | A new message was received |
| `message.sent` | A message was sent |

---

## Field Mappings

Field mappings transform event data into the format required by the destination.

### Mapping Types

**Field Mapping** - Extract a value from the event payload:
```json
{
  "type": "field",
  "sourceField": "data.signer_email",
  "destField": "email"
}
```

**Constant** - Use a fixed value:
```json
{
  "type": "constant",
  "value": "NDA Signed",
  "destField": "lead_status"
}
```

**Template** - Combine multiple values:
```json
{
  "type": "template",
  "template": "{{data.signer_name}} signed NDA on {{data.signed_at}}",
  "destField": "notes"
}
```

### Accessing Nested Data

Use dot notation to access nested fields in the event payload:

- `data.signer_email` - The signer's email
- `data.cim_id` - The CIM ID
- `data.signer_name` - The signer's full name

### Example Event Payload

Here's an example `nda.signed` event payload:

```json
{
  "event": "nda.signed",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "nda_id": "nda_abc123",
    "cim_id": "cim_xyz789",
    "signer_email": "john.doe@example.com",
    "signer_name": "John Doe",
    "signed_at": "2024-01-15T10:30:00Z",
    "signed_document_url": "https://..."
  }
}
```

### Example Mapping Configuration

To create a HubSpot contact from an NDA signing:

```json
[
  {
    "type": "field",
    "sourceField": "data.signer_email",
    "destField": "email",
    "required": true
  },
  {
    "type": "field",
    "sourceField": "data.signer_name",
    "destField": "firstname"
  },
  {
    "type": "constant",
    "value": "NDA Signed",
    "destField": "lifecyclestage"
  },
  {
    "type": "template",
    "template": "Signed NDA for CIM {{data.cim_id}} on {{data.signed_at}}",
    "destField": "notes"
  }
]
```

---

## Trigger Conditions

Add conditions to control when an automation fires. If the condition is not met, the automation is skipped.

### Condition Operators

| Operator | Description |
|----------|-------------|
| `equals` | Field equals the specified value |
| `not_equals` | Field does not equal the value |
| `contains` | Field contains the substring |
| `not_contains` | Field does not contain the substring |
| `starts_with` | Field starts with the value |
| `ends_with` | Field ends with the value |
| `is_empty` | Field is null, undefined, or empty string |
| `is_not_empty` | Field has a value |

### Example Conditions

Only trigger for specific email domains:
```json
{
  "field": "data.signer_email",
  "operator": "contains",
  "value": "@acme.com"
}
```

Only trigger when a specific field has a value:
```json
{
  "field": "data.company_name",
  "operator": "is_not_empty"
}
```

---

## Testing Automations

Before relying on automations in production, test them:

### Test Options

1. **Sample Data Test:** Uses built-in sample data for the trigger event type
2. **Historical Event Test:** Uses data from a past event
3. **Dry Run:** Previews the mapped payload without actually executing

### How to Test

1. Go to **Integrations** > **Automations**
2. Click on the automation you want to test
3. Click **Test Automation**
4. Choose test mode:
   - **Use sample data** - Built-in test payload
   - **Use past event** - Select from previous events
5. Optionally enable **Dry run** to preview without executing
6. Click **Run Test**

---

## Monitoring & Troubleshooting

### Viewing Run History

Each automation tracks all execution attempts:

1. Go to **Integrations** > **Automations**
2. Click on an automation
3. View the **Runs** tab

### Run Statuses

| Status | Description |
|--------|-------------|
| `pending` | Queued for execution |
| `running` | Currently executing |
| `success` | Completed successfully |
| `failed` | Execution failed (may retry) |
| `skipped` | Skipped due to condition not met |

### Run Details

Each run record includes:
- Event that triggered it
- Request payload sent to destination
- Response from destination
- Error message (if failed)
- Duration and timestamps
- External ID/URL (for created records)

### Automatic Retries

Failed runs are automatically retried with exponential backoff:

| Attempt | Delay |
|---------|-------|
| 1 | 1 minute |
| 2 | 5 minutes |
| 3 | 30 minutes |
| 4 | 2 hours |
| 5 | 24 hours |

After 5 failed attempts, the run is marked as permanently failed.

### Manual Retry

To manually retry a failed run:
1. Go to the run details
2. Click **Retry**

### Connection Auto-Disable

If a connection experiences 10 consecutive failures, it's automatically disabled to prevent spam. To re-enable:
1. Fix the underlying issue
2. Go to **Integrations** > **Connections**
3. Test the connection
4. Re-enable if the test succeeds

### Rate Limits

To prevent abuse, automations are rate-limited:

| Limit | Value |
|-------|-------|
| Per automation | 100 events/minute |
| Per user (all automations) | 500 events/minute |

Events exceeding these limits are silently skipped.

---

## API Reference

### Base URL

All API endpoints are prefixed with `/api/integrations/`

### Authentication

All endpoints require authentication via session cookie or API key.

### Endpoints

#### Providers & Metadata

```
GET /providers
```
Returns list of available integration providers with their capabilities.

```
GET /event-types
```
Returns available webhook event types grouped by category.

#### Connections

```
GET /connections
```
List all connections for the authenticated user.

```
POST /connections
```
Create a new connection. For OAuth providers, returns an authorization URL.

Request body:
```json
{
  "provider": "hubspot",
  "webhookUrl": "https://...",  // For webhook providers
  "name": "My Connection"       // Optional
}
```

```
GET /connections/:id
```
Get connection details (tokens are masked).

```
DELETE /connections/:id
```
Delete a connection and all associated automations.

```
POST /connections/:id/test
```
Test if a connection is valid and working.

#### OAuth

```
GET /auth/:provider
```
Initiate OAuth flow. Redirects to provider's authorization page.

```
GET /oauth/callback/:provider
```
OAuth callback handler. Creates/updates the connection.

#### Provider-Specific

```
GET /slack/channels?connectionId=:id
```
List available Slack channels for a connection.

```
GET /hubspot/properties/:objectType?connectionId=:id
```
Get HubSpot object properties for field mapping.

#### Automations

```
GET /automations
```
List automations with optional filters.

Query params:
- `connectionId` - Filter by connection
- `isActive` - Filter by active status
- `limit` - Results per page (default: 50)
- `offset` - Pagination offset

```
POST /automations
```
Create a new automation.

```
GET /automations/:id
```
Get automation details including recent runs.

```
PATCH /automations/:id
```
Update an automation (partial updates supported).

```
DELETE /automations/:id
```
Delete an automation and all run history.

```
POST /automations/:id/toggle
```
Enable or disable an automation.

Request body:
```json
{
  "isActive": true
}
```

```
POST /automations/:id/test
```
Test an automation with sample or historical data.

Request body:
```json
{
  "eventId": "evt_...",  // Optional: use specific past event
  "useSample": true,     // Use built-in sample data
  "dryRun": true         // Preview without executing
}
```

#### Run History

```
GET /runs
```
List automation runs with filters.

Query params:
- `automationId` - Filter by automation
- `status` - Filter by status
- `eventType` - Filter by event type
- `limit` - Results per page
- `offset` - Pagination offset

```
GET /runs/:id
```
Get detailed run information.

```
POST /runs/:id/retry
```
Manually retry a failed run.

---

## Security

### Data Encryption

- OAuth tokens are encrypted at rest using AES-256-GCM
- Webhook secrets are generated using cryptographically secure random bytes

### Webhook Signatures

Custom webhooks include HMAC-SHA256 signatures for payload verification. Always verify signatures on your server to ensure requests are legitimate.

### OAuth Scopes

We request only the minimum scopes needed:

**HubSpot:**
- CRM objects (contacts, companies, deals)
- Notes
- Files (for attachments)

**Slack:**
- Send messages to channels
- Read channel list
- Upload files

---

## Best Practices

1. **Test before enabling:** Always test automations with sample data before enabling them in production.

2. **Use conditions wisely:** Add trigger conditions to filter out unwanted events and reduce noise.

3. **Monitor run history:** Regularly check the runs tab to catch failures early.

4. **Handle duplicates:** Use `upsert` behavior with a match field to prevent duplicate records.

5. **Secure your webhooks:** Always verify HMAC signatures for custom webhooks.

6. **Keep secrets safe:** Webhook secrets are shown only once. Store them securely.

7. **Mind rate limits:** If you expect high volume, consider batching or using conditions to reduce event frequency.
