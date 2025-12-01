# SendGrid Inbound Parse Email - Issue & Fix Documentation

## Overview

This document describes the issues encountered with SendGrid's Inbound Parse webhook and the fixes implemented to properly receive and process inbound email replies.

**Last Updated:** December 1, 2025
**Status:** ✅ FIXED - Local testing confirmed working. Requires production deployment.

---

## How SendGrid Inbound Parse Works

### The Flow

1. **User sends email** to `thread-XXX@reply.cimshare.com`
2. **DNS MX record** routes the email to SendGrid's mail servers (`mx.sendgrid.net`)
3. **SendGrid receives** the email and processes it
4. **SendGrid sends HTTP POST** to your webhook URL with the email data
5. **Your server processes** the email and adds it to the message thread

### SendGrid Configuration

In SendGrid Inbound Parse settings (`https://app.sendgrid.com/settings/parse`):

- **Receiving Domain**: `reply.cimshare.com`
- **Destination URL**: `https://your-app.com/api/webhook/sendgrid/inbound`
- **POST the raw, full MIME message**: Can be checked or unchecked (we handle both)
- **Check incoming emails for spam**: Optional

### Two Modes of Operation

SendGrid can send data in two formats:

#### 1. Parsed Format (Default)
When "POST the raw, full MIME message" is **unchecked**, SendGrid parses the email and sends individual fields:

```
Content-Type: multipart/form-data

to=thread-abc123@reply.cimshare.com
from=user@example.com
subject=Re: Your message
text=The reply content...
html=<html>...</html>
envelope={"to":["thread-abc123@reply.cimshare.com"],"from":"user@example.com"}
```

#### 2. Raw MIME Format
When "POST the raw, full MIME message" is **checked**, SendGrid sends the complete raw email:

```
Content-Type: multipart/form-data

email=<raw MIME content>
envelope={"to":["thread-abc123@reply.cimshare.com"],"from":"user@example.com"}
```

The raw MIME content looks like:
```
From: user@example.com
To: thread-abc123@reply.cimshare.com
Subject: Re: Your message
Content-Type: multipart/alternative; boundary="----=_Part_123"

------=_Part_123
Content-Type: text/plain; charset=UTF-8

The reply content...
------=_Part_123--
```

---

## The Problem

### Error Symptoms

The server logs showed:
```
All fields: --xYzZY\r\nContent-Disposition: form-data; name, verified for correct information...
Inbound email: ->
No 'to' email found in webhook data
```

### Root Cause

The issue was a **multipart/form-data parsing failure**. When the email contained complex content (HTML signatures, images, quoted replies), the multipart boundaries were being incorrectly parsed by multer.

Specifically:
1. The raw MIME email content included multipart boundaries (`--xYzZY`)
2. These boundaries within the email content were confusing the multer parser
3. Instead of proper field names like `to`, `from`, `subject`, the parser was treating parts of the MIME content as field names
4. Result: `webhookData.to` was undefined, causing the email processing to fail

### What the Malformed Data Looked Like

```javascript
// Instead of:
{
  to: "thread-abc123@reply.cimshare.com",
  from: "user@example.com",
  subject: "Re: Test",
  text: "Hello..."
}

// We got:
{
  "--xYzZY\r\nContent-Disposition: form-data; name": "some value",
  " verified for correct information...": "more value",
  // ... garbage data
}
```

---

## The Fix

### Solution Overview

The fix required two main changes:

1. **Bypass Express body parsers** - Skip `express.json()` and `express.urlencoded()` for the SendGrid webhook endpoint
2. **Manual multipart parsing** - Parse the raw request body manually to correctly extract form fields
3. **MIME email parsing** - Use `mailparser` to parse raw MIME emails when "Send Raw" is enabled

### Code Changes

#### 1. Added mailparser dependency

```bash
npm install mailparser @types/mailparser
```

#### 2. Skip body parsers for SendGrid webhook (server/index.ts)

```typescript
app.use((req, res, next) => {
  // Skip JSON parsing for webhooks that need raw body
  if (req.path === '/api/webhook/stripe' || req.path === '/api/webhook/sendgrid/inbound') {
    return next();
  }
  express.json({ ... })(req, res, next);
});

app.use((req, res, next) => {
  // Skip urlencoded parsing for SendGrid inbound
  if (req.path === '/api/webhook/sendgrid/inbound') {
    return next();
  }
  express.urlencoded({ ... })(req, res, next);
});
```

#### 3. Manual multipart parsing (server/routes.ts)

```typescript
app.post('/api/webhook/sendgrid/inbound', async (req, res) => {
  // Capture raw body manually
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const rawBody = Buffer.concat(chunks);

  // Parse multipart manually
  const contentType = req.headers['content-type'] || '';
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^\s;]+))/);
  const boundary = boundaryMatch ? (boundaryMatch[1] || boundaryMatch[2]) : null;

  let webhookData: any = {};

  if (boundary) {
    const bodyStr = rawBody.toString('utf-8');
    const parts = bodyStr.split('--' + boundary);

    for (const part of parts) {
      // Find header/body separator
      const separatorIndex = part.indexOf('\r\n\r\n');
      if (separatorIndex === -1) continue;

      const headers = part.substring(0, separatorIndex);
      const body = part.substring(separatorIndex + 4);

      // Extract field name
      const nameMatch = headers.match(/name="([^"]+)"/i);
      if (nameMatch) {
        webhookData[nameMatch[1]] = body;
      }
    }
  }

  // If raw email field exists, parse with mailparser
  if (webhookData.email) {
    const parsed = await simpleParser(webhookData.email);
    webhookData = {
      to: parsed.to?.text,
      from: parsed.from?.text,
      subject: parsed.subject,
      text: parsed.text,
      html: parsed.html,
      // ...
    };
  }
});
```

---

## Files Modified

1. **server/index.ts** - Skip body parsers for SendGrid inbound webhook
2. **server/routes.ts** - Manual multipart parsing and MIME email parsing
3. **package.json** - Added `mailparser` and `@types/mailparser` dependencies

---

## Testing

### Test the webhook manually

```bash
curl -X POST https://your-app.com/api/webhook/sendgrid/test \
  -H "Content-Type: application/json" \
  -d '{
    "to": "thread-abc123@reply.cimshare.com",
    "from": "test@example.com",
    "subject": "Test reply",
    "text": "This is a test email reply"
  }'
```

### Check webhook status

```bash
curl https://your-app.com/api/webhook/sendgrid/info
```

### Send a real test email

Send an email to `thread-XXX@reply.cimshare.com` where XXX is a valid message thread ID, and check the server logs for:

```
📨 SENDGRID INBOUND WEBHOOK HIT!
🔄 Parsing raw MIME email...
✅ Successfully parsed raw MIME email
  Parsed To: thread-abc123@reply.cimshare.com
  Parsed From: user@example.com
```

---

## DNS Requirements

For inbound email to work, ensure your DNS has:

### Required Records

1. **MX Record** for `reply.cimshare.com`:
   ```
   Type: MX
   Host: reply
   Priority: 10
   Value: mx.sendgrid.net
   ```

2. **A or CNAME Record** for the subdomain (required for the domain to resolve):
   ```
   Type: A
   Host: reply
   Value: <any valid IP, e.g., your server IP>
   ```
   OR
   ```
   Type: CNAME
   Host: reply
   Value: cimshare.com
   ```

### Verify DNS

```bash
# Check if domain resolves
dig reply.cimshare.com

# Check MX records
dig MX reply.cimshare.com
```

---

## Troubleshooting

### Issue: "Domain couldn't be found" when sending email

**Cause**: Missing A or CNAME record for the subdomain
**Fix**: Add an A record for `reply` pointing to any valid IP

### Issue: Webhook receives empty/malformed data

**Cause**: "Send Raw" enabled but server not parsing MIME
**Fix**: The updated code now handles both parsed and raw formats

### Issue: No webhook requests reaching server

**Cause**: Wrong webhook URL in SendGrid or firewall blocking
**Fix**:
1. Verify URL in SendGrid matches your deployment
2. Check server logs for any incoming requests
3. Ensure your server accepts POST requests on that endpoint

### Issue: Thread ID not found

**Cause**: Email address doesn't match `thread-XXX@reply.cimshare.com` pattern
**Fix**: Ensure outgoing emails use the correct reply-to format

---

## Summary

The fix ensures robust handling of SendGrid inbound emails by:

1. Supporting both parsed and raw MIME formats
2. Using `mailparser` for reliable MIME parsing
3. Detecting and recovering from malformed multipart data
4. Providing detailed logging for debugging

This makes the email reply system resilient to various email formats, HTML signatures, and complex email content.
