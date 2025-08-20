# Email Reply System Debug Summary

## Current Status
The bi-directional email sync system for thread replies (thread-XX@reply.cimshare.com) has been debugged and improved with the following changes:

## Code Improvements Made

### 1. Enhanced Email Parsing (message-service.ts)
- Added robust email extraction that handles multiple formats:
  - Plain email addresses: `user@example.com`
  - Formatted addresses: `Name <user@example.com>`
- Improved thread ID matching with fallback checks:
  - Primary check in `to` field
  - Fallback to `envelope.to` array
  - Support for comma-separated recipients

### 2. Better Sender Type Detection
- Added database lookup to correctly identify if sender is owner or inquirer
- Compares sender email against both thread owner and inquirer emails
- Defaults to "inquirer" if sender cannot be determined

### 3. Test Endpoints Added
- **POST /api/webhook/sendgrid/test** - Test webhook processing with sample data
- **GET /api/webhook/sendgrid/info** - Get webhook configuration and instructions

## Configuration Requirements

### SendGrid Setup
1. **Inbound Parse Configuration**
   - Go to: https://app.sendgrid.com/settings/parse
   - Host: `reply.cimshare.com`
   - URL: `https://YOUR_DOMAIN/api/webhook/sendgrid/inbound`
   - Check "POST the raw, full MIME message"

2. **DNS Configuration Required**
   - MX Record for `reply.cimshare.com` should point to: `mx.sendgrid.net`
   - Priority: 10

### Testing the Webhook

1. **Using the test endpoint:**
```bash
curl -X POST https://YOUR_DOMAIN/api/webhook/sendgrid/test \
  -H "Content-Type: application/json" \
  -d '{
    "to": "thread-22@reply.cimshare.com",
    "from": "test@example.com",
    "text": "Test reply message"
  }'
```

2. **Check configuration:**
```bash
curl https://YOUR_DOMAIN/api/webhook/sendgrid/info
```

## Troubleshooting Checklist

### If emails aren't being processed:

1. **Verify MX Records**
   - Check that `reply.cimshare.com` MX records point to `mx.sendgrid.net`
   - Use: `dig MX reply.cimshare.com` or online DNS checker

2. **Verify SendGrid Configuration**
   - Inbound Parse webhook URL is correct
   - Domain is verified in SendGrid
   - Webhook is active (not paused)

3. **Check Server Logs**
   - Look for "📧 Processing inbound email webhook" messages
   - Check for thread ID extraction: "Found thread ID: XX"
   - Verify sender type detection

4. **Common Issues**
   - **No MX records**: Email won't reach SendGrid
   - **Wrong webhook URL**: SendGrid can't deliver the webhook
   - **Thread doesn't exist**: Email received but no matching thread in database
   - **Parsing failure**: Check if email format matches expected pattern

## Email Flow

1. User sends email to `thread-XX@reply.cimshare.com`
2. Email routed to SendGrid via MX records
3. SendGrid parses email and sends webhook to your server
4. Server extracts thread ID from recipient address
5. Server determines sender type (owner/inquirer)
6. Message created in database
7. Notification sent to appropriate party

## Code Files Modified
- `/server/message-service.ts` - Enhanced webhook processing
- `/server/routes.ts` - Added test endpoints
- `/test-webhook.js` - Standalone test script

## Next Steps
1. Verify MX records are configured for `reply.cimshare.com`
2. Confirm SendGrid Inbound Parse settings
3. Test with actual email to a valid thread address
4. Monitor server logs for webhook processing