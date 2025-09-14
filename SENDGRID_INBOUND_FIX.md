# SendGrid Inbound Email Configuration Fix

## The Problem
You're getting "domain reply.cimshare.com couldn't be found" errors because the subdomain doesn't have proper DNS records.

## The Issue
Your MX records are configured, but the subdomain `reply.cimshare.com` itself doesn't exist in DNS. Email servers need to first resolve the domain before they can check MX records.

## Required DNS Configuration

You need to add these DNS records to your domain registrar/DNS provider:

### 1. A Record or CNAME for the subdomain (REQUIRED)
**This is what's missing!** Add one of these:

**Option A - A Record (if you want the subdomain to point somewhere):**
```
Type: A
Host: reply
Value: Your server IP (or any valid IP like 192.0.2.1)
TTL: 3600
```

**Option B - CNAME Record (recommended if using a service):**
```
Type: CNAME
Host: reply
Value: cimshare.com (or any valid domain)
TTL: 3600
```

### 2. MX Record (you already have this)
```
Type: MX
Host: reply (or reply.cimshare.com depending on your DNS provider)
Priority: 10
Value: mx.sendgrid.net
TTL: 3600
```

### 3. SPF Record (optional but recommended)
```
Type: TXT
Host: reply
Value: "v=spf1 include:sendgrid.net ~all"
TTL: 3600
```

## Step-by-Step Fix

### Step 1: Add the A or CNAME record
1. Log into your DNS provider (GoDaddy, Cloudflare, Route53, etc.)
2. Add an A record for `reply` subdomain pointing to any valid IP
   - The IP doesn't matter for receiving email, it just needs to exist
   - You can use your main server's IP

### Step 2: Verify DNS propagation
After adding the records, wait 5-30 minutes for DNS to propagate, then test:
```bash
# Test if domain resolves
ping reply.cimshare.com

# Test MX records
nslookup -type=mx reply.cimshare.com
```

### Step 3: Verify SendGrid Configuration
1. Go to https://app.sendgrid.com/settings/parse
2. Ensure you have:
   - **Receiving Domain:** reply.cimshare.com
   - **Destination URL:** https://cimshare.replit.app/api/webhook/sendgrid/inbound
   - **Spam Check:** Can be checked or unchecked
   - **Send Raw:** ✅ CHECKED (you have this correct)

### Step 4: Update webhook URL if needed
Based on your Replit deployment, make sure the webhook URL is:
- For Replit dev: `https://YOUR-REPL-NAME.YOUR-USERNAME.repl.co/api/webhook/sendgrid/inbound`
- For production: `https://cimshare.com/api/webhook/sendgrid/inbound`

## Testing

### 1. Test DNS Resolution
Send a test email to: `test@reply.cimshare.com`
- If you get "domain not found" - DNS A/CNAME record is missing
- If you get "mailbox not found" - DNS is working, SendGrid will receive it

### 2. Test Webhook
```bash
curl -X POST https://cimshare.replit.app/api/webhook/sendgrid/test \
  -H "Content-Type: application/json" \
  -d '{
    "to": "thread-17@reply.cimshare.com",
    "from": "test@example.com",
    "subject": "Test Reply",
    "text": "This is a test reply"
  }'
```

### 3. Check Server Logs
Look for these log messages:
- "🔍 Parsed webhook data"
- "📨 Processing inbound email"

## Common Issues and Solutions

### Issue 1: "Domain couldn't be found"
**Cause:** Missing A or CNAME record for subdomain
**Fix:** Add A record for `reply` subdomain

### Issue 2: "550 No Such User Here"
**Cause:** SendGrid is receiving the email but webhook isn't processing it
**Fix:** Check webhook URL and server logs

### Issue 3: Webhook receives empty data
**Cause:** "Send Raw" not checked in SendGrid
**Fix:** Enable "POST the raw, full MIME message" in SendGrid settings

### Issue 4: 404 on webhook
**Cause:** Wrong webhook URL
**Fix:** Ensure URL matches your deployment environment

## Quick DNS Check Commands
```bash
# Check if domain exists
host reply.cimshare.com

# Check MX records
dig MX reply.cimshare.com

# Check all DNS records
dig ANY reply.cimshare.com
```

## Summary
The main issue is that `reply.cimshare.com` needs an A or CNAME record to exist in DNS before email servers can use the MX records. Add the A record first, wait for propagation, then test.