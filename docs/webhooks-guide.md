# CIM Share Webhooks Guide

Webhooks allow you to receive real-time notifications when events happen in CIM Share. Instead of polling for changes, webhooks push data to your application as events occur.

## Table of Contents

- [Getting Started](#getting-started)
- [Creating a Webhook](#creating-a-webhook)
- [Available Events](#available-events)
- [Payload Format](#payload-format)
- [Verifying Signatures](#verifying-signatures)
- [Handling Deliveries](#handling-deliveries)
- [Testing Webhooks](#testing-webhooks)
- [Integration Examples](#integration-examples)
- [Troubleshooting](#troubleshooting)

---

## Getting Started

### What are Webhooks?

Webhooks are HTTP callbacks that send data to your specified URL when specific events occur. For example, when someone signs an NDA on your CIM, CIM Share can immediately notify your CRM, Slack, or any other system.

### Common Use Cases

- **Sync contacts to your CRM** (HubSpot, Salesforce, Pipedrive)
- **Get Slack notifications** when NDAs are signed
- **Update your data warehouse** with engagement analytics
- **Trigger automated workflows** via Zapier or Make.com
- **Build custom integrations** with your internal systems

---

## Creating a Webhook

1. Navigate to **Account Menu → Webhooks** or go to `/webhooks`
2. Click **Add Webhook**
3. Configure your webhook:
   - **Name**: A friendly name (e.g., "HubSpot Sync")
   - **Endpoint URL**: Your HTTPS endpoint that will receive events
   - **Events**: Select which events you want to receive
4. Click **Create Webhook**
5. **Important**: Copy and save the signing secret - it's only shown once!

### Requirements

- Endpoint URL must use **HTTPS**
- Your endpoint must respond with a **2xx status code** within 30 seconds
- Your endpoint should be publicly accessible

---

## Available Events

### CIM Events

| Event | Description |
|-------|-------------|
| `cim.created` | A new CIM document was created |
| `cim.updated` | A CIM document was modified |
| `cim.published` | A CIM was published/shared |
| `cim.viewed` | Someone viewed a shared CIM |
| `cim.downloaded` | Someone downloaded a CIM |

### NDA Events

| Event | Description |
|-------|-------------|
| `nda.sent` | An NDA was sent to a recipient |
| `nda.signed` | Someone signed an NDA |
| `nda.declined` | Someone declined to sign an NDA |

### Contact Events

| Event | Description |
|-------|-------------|
| `contact.created` | A new contact was added to your CRM |
| `contact.updated` | A contact's information was updated |
| `contact.deleted` | A contact was removed |

### Message Events

| Event | Description |
|-------|-------------|
| `message.received` | You received a new message |
| `message.sent` | You sent a message |

### Data Room Events

| Event | Description |
|-------|-------------|
| `dataroom.file_uploaded` | A file was uploaded to a data room |
| `dataroom.file_viewed` | Someone viewed a data room file |
| `dataroom.access_granted` | Access was granted to a data room |

---

## Payload Format

All webhook payloads follow a consistent JSON structure:

```json
{
  "event": "nda.signed",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "data": {
    // Event-specific data
  }
}
```

### Example Payloads

#### cim.created

```json
{
  "event": "cim.created",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "data": {
    "cim_id": 123,
    "title": "Acme Manufacturing CIM",
    "share_url": "https://cimshare.com/share/cim-abc123",
    "created_at": "2025-01-15T10:30:00.000Z"
  }
}
```

#### nda.signed

```json
{
  "event": "nda.signed",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "data": {
    "nda_id": 456,
    "cim_id": 123,
    "cim_title": "Acme Manufacturing CIM",
    "signer_email": "investor@example.com",
    "signer_name": "John Smith",
    "signer_location": "New York, NY, USA",
    "signed_at": "2025-01-15T10:30:00.000Z"
  }
}
```

#### contact.created

```json
{
  "event": "contact.created",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "data": {
    "contact_id": 789,
    "email": "investor@example.com",
    "name": "John Smith",
    "status": "new",
    "created_at": "2025-01-15T10:30:00.000Z"
  }
}
```

#### message.sent

```json
{
  "event": "message.sent",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "data": {
    "message_id": 101,
    "thread_id": 202,
    "content_preview": "Thank you for your interest in...",
    "sent_at": "2025-01-15T10:30:00.000Z"
  }
}
```

---

## Verifying Signatures

Every webhook request includes a signature header that you should verify to ensure the request came from CIM Share.

### Signature Header

```
X-Webhook-Signature: t=1705312200,v1=5257a869e7ecebeda32affa62cdca3fa51cad7e77a0e56ff536d0ce8e108d8bd
```

The header contains:
- `t` - Unix timestamp when the signature was generated
- `v1` - HMAC-SHA256 signature

### Verification Steps

1. Extract the timestamp (`t`) and signature (`v1`) from the header
2. Construct the signed payload: `{timestamp}.{request_body}`
3. Compute HMAC-SHA256 using your webhook secret
4. Compare your computed signature with the `v1` value

### Code Examples

#### Node.js

```javascript
const crypto = require('crypto');

function verifyWebhookSignature(payload, signatureHeader, secret) {
  // Parse the signature header
  const parts = signatureHeader.split(',');
  const timestamp = parts.find(p => p.startsWith('t='))?.split('=')[1];
  const signature = parts.find(p => p.startsWith('v1='))?.split('=')[1];

  if (!timestamp || !signature) {
    return false;
  }

  // Check timestamp is recent (within 5 minutes)
  const currentTime = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTime - parseInt(timestamp)) > 300) {
    return false; // Replay attack protection
  }

  // Compute expected signature
  const signedPayload = `${timestamp}.${payload}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  // Compare signatures (timing-safe)
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Express.js example
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const payload = req.body.toString();

  if (!verifyWebhookSignature(payload, signature, process.env.WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature');
  }

  const event = JSON.parse(payload);
  console.log('Received event:', event.event);

  // Process the event...

  res.status(200).send('OK');
});
```

#### Python

```python
import hmac
import hashlib
import time

def verify_webhook_signature(payload: str, signature_header: str, secret: str) -> bool:
    # Parse the signature header
    parts = dict(p.split('=') for p in signature_header.split(','))
    timestamp = parts.get('t')
    signature = parts.get('v1')

    if not timestamp or not signature:
        return False

    # Check timestamp is recent (within 5 minutes)
    current_time = int(time.time())
    if abs(current_time - int(timestamp)) > 300:
        return False

    # Compute expected signature
    signed_payload = f"{timestamp}.{payload}"
    expected_signature = hmac.new(
        secret.encode(),
        signed_payload.encode(),
        hashlib.sha256
    ).hexdigest()

    # Compare signatures (timing-safe)
    return hmac.compare_digest(signature, expected_signature)

# Flask example
from flask import Flask, request

app = Flask(__name__)

@app.route('/webhook', methods=['POST'])
def webhook():
    signature = request.headers.get('X-Webhook-Signature')
    payload = request.get_data(as_text=True)

    if not verify_webhook_signature(payload, signature, WEBHOOK_SECRET):
        return 'Invalid signature', 401

    event = request.get_json()
    print(f"Received event: {event['event']}")

    # Process the event...

    return 'OK', 200
```

---

## Handling Deliveries

### Response Requirements

- Respond with a **2xx status code** (200, 201, 202, etc.)
- Respond within **30 seconds**
- Response body is optional (we don't process it)

### Retry Policy

If delivery fails, we'll retry with exponential backoff:

| Attempt | Delay |
|---------|-------|
| 1 | Immediate |
| 2 | 1 minute |
| 3 | 5 minutes |
| 4 | 30 minutes |
| 5 | 2 hours |
| 6 | 24 hours |

After 5 failed retries, the delivery is marked as failed.

### Auto-Disable

If a webhook fails **10 consecutive times**, it will be automatically disabled to prevent further issues. You can re-enable it from the webhooks settings page after fixing the endpoint.

### Idempotency

Each event includes a unique `X-Webhook-Event-Id` header. Store this ID and check for duplicates to ensure idempotent processing:

```javascript
app.post('/webhook', async (req, res) => {
  const eventId = req.headers['x-webhook-event-id'];

  // Check if we've already processed this event
  if (await hasProcessedEvent(eventId)) {
    return res.status(200).send('Already processed');
  }

  // Process the event...

  // Mark as processed
  await markEventProcessed(eventId);

  res.status(200).send('OK');
});
```

---

## Testing Webhooks

### Send Test Events

1. Go to your webhook's detail page
2. Select an event type from the dropdown
3. Click to send a test payload

Test payloads include `"test": true` so you can identify them:

```json
{
  "event": "nda.signed",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "test": true,
  "data": {
    "nda_id": "test_nda_456",
    "cim_id": "test_123",
    "signer_email": "signer@example.com",
    "signer_name": "John Doe"
  }
}
```

### Local Development

For local testing, use a tunnel service:

- [ngrok](https://ngrok.com) - `ngrok http 3000`
- [localtunnel](https://localtunnel.me) - `lt --port 3000`
- [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)

---

## Integration Examples

### Zapier

1. Create a new Zap with **Webhooks by Zapier** as the trigger
2. Choose **Catch Hook**
3. Copy the webhook URL provided by Zapier
4. Create a webhook in CIM Share with that URL
5. Send a test event to set up the data structure
6. Add your desired actions (create HubSpot contact, send Slack message, etc.)

### HubSpot (via Zapier)

```
Trigger: CIM Share webhook (nda.signed)
Action: HubSpot - Create Contact
  - Email: {{data.signer_email}}
  - First Name: {{data.signer_name}}
  - Lead Source: CIM Share NDA
```

### Slack Notifications

```
Trigger: CIM Share webhook (nda.signed)
Action: Slack - Send Channel Message
  - Channel: #deals
  - Message: "🎉 New NDA signed by {{data.signer_name}} ({{data.signer_email}}) for {{data.cim_title}}"
```

### Custom Node.js Integration

```javascript
const express = require('express');
const app = express();

app.post('/cimshare-webhook', express.json(), async (req, res) => {
  const { event, data } = req.body;

  switch (event) {
    case 'nda.signed':
      await createHubSpotContact({
        email: data.signer_email,
        name: data.signer_name,
        properties: {
          lead_source: 'CIM Share',
          cim_viewed: data.cim_title
        }
      });
      break;

    case 'contact.created':
      await syncToSalesforce(data);
      break;

    case 'message.received':
      await sendSlackNotification(`New message from ${data.sender_email}`);
      break;
  }

  res.status(200).send('OK');
});

app.listen(3000);
```

---

## Troubleshooting

### Webhook Not Receiving Events

1. **Check webhook is enabled** - Webhooks can be disabled manually or auto-disabled after failures
2. **Verify URL is correct** - Must be HTTPS and publicly accessible
3. **Check event subscriptions** - Make sure you've selected the events you want
4. **View delivery logs** - Check for error messages in the webhook detail page

### Signature Verification Failing

1. **Use the raw request body** - Don't parse JSON before verifying
2. **Check the secret** - Make sure you're using the correct webhook secret
3. **Verify timestamp** - Ensure your server clock is synchronized

### Frequent Failures

1. **Check endpoint health** - Is your server running and accessible?
2. **Verify response time** - Endpoints must respond within 30 seconds
3. **Check status codes** - Return 2xx for success
4. **Review error messages** - Check the delivery logs for specific errors

### Regenerating Your Secret

If your secret is compromised:

1. Go to the webhook detail page
2. Click the refresh icon next to the signing secret
3. Save the new secret immediately
4. Update your endpoint to use the new secret

---

## HTTP Headers

Every webhook request includes these headers:

| Header | Description |
|--------|-------------|
| `Content-Type` | `application/json` |
| `X-Webhook-Signature` | HMAC signature for verification |
| `X-Webhook-Event` | The event type (e.g., `nda.signed`) |
| `X-Webhook-Event-Id` | Unique event ID for idempotency |
| `User-Agent` | `CIMShare-Webhooks/1.0` |

---

## Rate Limits

- No rate limit on the number of webhooks you can create
- Events are dispatched in real-time as they occur
- Retry attempts are spread out according to the retry policy

---

## Support

If you need help with webhooks:

- Email: support@cimshare.com
- Documentation: https://cimshare.documentationai.com/
