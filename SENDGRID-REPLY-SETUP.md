# SendGrid Reply-To Email Implementation Guide

## 🎯 Overview
This guide explains how to configure SendGrid and your domain to enable bidirectional email replies for the CIM Share messaging system. Users can reply directly to email notifications and have their replies automatically sync to the message threads.

## 🔧 Current Implementation Status

✅ **Completed in Code:**
- Thread-specific reply addresses: `thread-{id}@reply.cimshare.com`
- Inbound webhook processing at `/api/webhook/sendgrid/inbound`
- Email content cleaning and thread mapping
- Outbound email notifications with proper reply-to headers
- Rich content support for TipTap editor messages

## 📋 Required SendGrid Configuration

### 1. Domain Authentication
First, authenticate your domain with SendGrid:

1. Go to **Settings > Sender Authentication** in SendGrid dashboard
2. Click **Authenticate Your Domain**
3. Add `cimshare.com` as your domain
4. Follow the DNS record setup instructions

### 2. Inbound Parse Webhook Setup
Configure inbound parsing for the reply subdomain:

1. Go to **Settings > Inbound Parse** in SendGrid dashboard
2. Click **Add Host & URL**
3. Configure as follows:
   - **Subdomain**: `reply`
   - **Domain**: `cimshare.com` 
   - **Full hostname**: `reply.cimshare.com`
   - **Destination URL**: `https://your-deployed-app.replit.app/api/webhook/sendgrid/inbound`
   - **POST the raw, full MIME message**: ✅ Checked
   - **POST the parsed data**: ✅ Checked

### 3. MX Record Configuration
Add these MX records to your domain's DNS settings:

```
Type: MX
Host: reply.cimshare.com
Priority: 10
Value: mx.sendgrid.net

Type: MX  
Host: reply.cimshare.com
Priority: 20
Value: mx2.sendgrid.net

Type: MX
Host: reply.cimshare.com
Priority: 30
Value: mx3.sendgrid.net
```

**CRITICAL DNS ISSUE SOLUTION:**
The error "DNS type 'mx' lookup of reply.cimshare.com responded with code NXDOMAIN" means your DNS doesn't have MX records for the reply subdomain. You must add MX records with the **full subdomain** `reply.cimshare.com`, not just `reply`.

### 4. Event Webhook (Optional but Recommended)
Set up delivery tracking:

1. Go to **Settings > Mail Settings > Event Webhook**
2. Set **HTTP POST URL**: `https://your-deployed-app.replit.app/api/webhook/sendgrid/events`
3. Select these events:
   - ✅ Delivered
   - ✅ Bounced
   - ✅ Dropped
   - ✅ Deferred

## 🌐 DNS Configuration Summary

Add these DNS records to your domain (`cimshare.com`):

### MX Records for Inbound Email
```
reply.cimshare.com    MX    10    mx.sendgrid.net
reply.cimshare.com    MX    20    mx2.sendgrid.net  
reply.cimshare.com    MX    30    mx3.sendgrid.net
```

### CNAME Records for Domain Authentication
(SendGrid will provide these specific records during domain setup)

## 🔄 How It Works

### Outbound Flow:
1. User fills contact form → creates thread
2. Thread gets unique email: `thread-123@reply.cimshare.com`
3. Owner receives notification with reply-to address set to thread email
4. Owner replies from app → inquirer gets email with same reply-to address

### Inbound Flow:
1. User replies to any email in the thread
2. Email sent to `thread-123@reply.cimshare.com`
3. SendGrid receives email and POSTs to webhook
4. App extracts thread ID from email address
5. Creates new message in correct thread
6. Sends notification to other party

## 🧪 Testing the Setup

### 1. Test Outbound Emails
Send a test message from the app and verify:
- Email arrives with correct `reply-to` header
- Reply-to address follows pattern: `thread-{id}@reply.cimshare.com`

### 2. Test Inbound Processing  
Reply to a notification email and check:
- Webhook receives the email data
- Message appears in app message thread
- Content is properly cleaned and formatted

### 3. Verify DNS Propagation
```bash
# Check MX records
nslookup -type=MX reply.cimshare.com

# Should return SendGrid MX servers
```

## 🚨 Troubleshooting

### Common Issues:

**1. Emails not reaching webhook:**
- Verify MX records are correctly configured
- Check webhook URL is publicly accessible
- Ensure inbound parse is enabled for subdomain

**2. Thread ID not found:**
- Check email address pattern in logs
- Verify thread exists in database
- Ensure regex pattern matches address format

**3. Webhook returning errors:**
- Check application logs for detailed error messages
- Verify SendGrid data format matches expected structure
- Test webhook endpoint manually

### Debug Commands:
```bash
# Check if webhook is receiving requests
curl -X POST https://your-app.replit.app/api/webhook/sendgrid/inbound \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "to=thread-123@reply.cimshare.com&from=test@example.com&subject=Test&text=Hello"
```

## 📝 Implementation Notes

- **Security**: Thread IDs are incrementing integers, not sensitive data
- **Scalability**: Pattern supports unlimited threads with unique addresses
- **Reliability**: Multiple MX records provide failover redundancy
- **Content**: HTML and text emails both supported with content cleaning

## ✅ Verification Checklist

- [ ] Domain authenticated in SendGrid
- [ ] Inbound parse configured for `reply.cimshare.com`
- [ ] MX records added to DNS
- [ ] Webhook URL is accessible
- [ ] Test email sent and received
- [ ] Reply processed correctly in app
- [ ] Message appears in correct thread

---

**Next Steps:** Once DNS propagation completes (usually 24-48 hours), test the full email flow end-to-end.