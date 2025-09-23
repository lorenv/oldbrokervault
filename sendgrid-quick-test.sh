#!/bin/bash

echo "🔍 SENDGRID QUICK TEST SCRIPT"
echo "=============================="
echo ""

# Test 1: Check MX Records
echo "1. Checking MX Records for reply.cimshare.com..."
echo "----------------------------------------"
dig MX reply.cimshare.com +short
echo ""

# Test 2: Check webhook endpoint
echo "2. Testing webhook endpoint..."
echo "----------------------------------------"
curl -s https://cimshare.com/api/webhook/sendgrid/info | python3 -m json.tool 2>/dev/null || echo "Failed to fetch webhook info"
echo ""

# Test 3: Send test webhook
echo "3. Sending test webhook..."
echo "----------------------------------------"
THREAD_ID=${1:-test123}
echo "Using thread ID: $THREAD_ID"
echo ""

curl -X POST https://cimshare.com/api/webhook/sendgrid/inbound \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "User-Agent: SendGrid-Test" \
  -d "to=thread-${THREAD_ID}@reply.cimshare.com" \
  -d "from=quicktest@example.com" \
  -d "subject=Quick Test" \
  -d "text=Testing webhook at $(date)" \
  -d "envelope={\"to\":[\"thread-${THREAD_ID}@reply.cimshare.com\"],\"from\":\"quicktest@example.com\"}" \
  -s -w "\nHTTP Status: %{http_code}\n"

echo ""
echo "✅ Test complete!"
echo ""
echo "NEXT STEPS:"
echo "1. Check server logs to see if webhook was received"
echo "2. Send a real email to: thread-${THREAD_ID}@reply.cimshare.com"
echo "3. Check SendGrid Activity Feed after 1-2 minutes"
echo "4. If email shows in Activity Feed but webhook doesn't fire,"
echo "   verify the webhook URL in SendGrid dashboard is exactly:"
echo "   https://cimshare.com/api/webhook/sendgrid/inbound"