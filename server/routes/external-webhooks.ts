/**
 * External Webhook Handlers
 * Handles incoming webhooks from external services (SendGrid, Stripe)
 *
 * IMPORTANT: These routes must be registered BEFORE authentication middleware
 * because external services cannot authenticate with our auth system.
 */

import { Express, Request, Response, NextFunction } from 'express';
import * as express from 'express';
import crypto from 'crypto';
import { handleStripeWebhook } from '../stripe';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// SendGrid Inbound Parse Webhook URL secret verification
// Since Inbound Parse doesn't support signature verification, we use a secret in the URL
export function verifySendGridInboundSecret(req: Request, res: Response, next: NextFunction) {
  const urlSecret = req.query.secret as string;
  const configuredSecret = process.env.SENDGRID_INBOUND_WEBHOOK_SECRET;

  // Skip verification in development if no secret configured
  if (!configuredSecret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('SENDGRID_INBOUND_WEBHOOK_SECRET not configured in production');
      console.warn('WARNING: SendGrid inbound webhook running without secret verification');
    }
    return next();
  }

  // Verify the secret matches
  if (!urlSecret) {
    console.error('SendGrid inbound webhook: Missing secret in URL');
    return res.status(401).json({ error: 'Unauthorized: Missing webhook secret' });
  }

  // Use timing-safe comparison to prevent timing attacks
  const secretBuffer = Buffer.from(configuredSecret);
  const providedBuffer = Buffer.from(urlSecret);

  if (secretBuffer.length !== providedBuffer.length || !crypto.timingSafeEqual(secretBuffer, providedBuffer)) {
    console.error('SendGrid inbound webhook: Invalid secret provided');
    return res.status(401).json({ error: 'Unauthorized: Invalid webhook secret' });
  }

  next();
}

// SendGrid Event Webhook signature verification (ECDSA)
export function verifySendGridEventSignature(req: Request, res: Response, next: NextFunction) {
  const signature = req.headers['x-twilio-email-event-webhook-signature'] as string;
  const timestamp = req.headers['x-twilio-email-event-webhook-timestamp'] as string;

  const webhookKey = process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY;

  // Skip verification in development if no key configured
  if (!webhookKey) {
    if (process.env.NODE_ENV === 'production') {
      console.error('SENDGRID_WEBHOOK_VERIFICATION_KEY not configured in production');
      console.warn('WARNING: SendGrid event webhook running without signature verification');
    }
    return next();
  }

  if (!signature || !timestamp) {
    console.error('SendGrid event webhook: Missing signature or timestamp headers');
    return res.status(401).json({ error: 'Unauthorized: Missing webhook signature' });
  }

  // Verify timestamp is recent (within 5 minutes) to prevent replay attacks
  const timestampDate = new Date(parseInt(timestamp) * 1000);
  const now = new Date();
  const fiveMinutes = 5 * 60 * 1000;
  if (Math.abs(now.getTime() - timestampDate.getTime()) > fiveMinutes) {
    console.error('SendGrid event webhook: Timestamp too old or in future');
    return res.status(401).json({ error: 'Unauthorized: Webhook timestamp expired' });
  }

  // Verify ECDSA signature
  try {
    const payload = timestamp + JSON.stringify(req.body);
    const verifier = crypto.createVerify('sha256');
    verifier.update(payload);
    const isValid = verifier.verify(webhookKey, signature, 'base64');

    if (!isValid) {
      console.error('SendGrid event webhook: Invalid signature');
      return res.status(401).json({ error: 'Unauthorized: Invalid webhook signature' });
    }

    next();
  } catch (error) {
    console.error('SendGrid event webhook verification error:', error);
    return res.status(401).json({ error: 'Unauthorized: Webhook verification failed' });
  }
}

/**
 * Register external webhook routes on the Express app.
 * Must be called BEFORE authentication middleware is set up.
 */
export async function registerExternalWebhooks(app: Express) {
  // Import message service for email webhook processing
  const { messageService } = await import('../message-service');
  const { simpleParser } = await import('mailparser');

  // SendGrid Inbound Email Webhook
  app.post('/api/webhook/sendgrid/inbound', verifySendGridInboundSecret, async (req, res) => {
    console.log('\n' + '='.repeat(80));
    console.log('📨 SENDGRID INBOUND WEBHOOK HIT!');
    console.log('Timestamp:', new Date().toISOString());
    console.log('='.repeat(80));

    console.log('\n📋 REQUEST DETAILS:');
    console.log('  Method:', req.method);
    console.log('  URL:', req.url);
    console.log('  IP:', req.ip);
    console.log('  Content-Type:', req.headers['content-type']);

    try {
      // Capture raw body manually to avoid multer corruption
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const rawBody = Buffer.concat(chunks);
      console.log('\n📦 Raw body size:', rawBody.length, 'bytes');

      // Parse multipart form data manually
      const contentType = req.headers['content-type'] || '';
      const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^\s;]+))/);
      const boundary = boundaryMatch ? (boundaryMatch[1] || boundaryMatch[2]) : null;

      console.log('  Boundary:', boundary);

      let webhookData: any = {};

      if (boundary) {
        const bodyStr = rawBody.toString('utf-8');
        console.log('  🔍 Parsing multipart with boundary:', boundary);

        const parts = bodyStr.split('--' + boundary);
        console.log('  🔍 Found', parts.length, 'parts');

        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          if (part.trim() === '' || part.trim() === '--') continue;

          let separatorIndex = part.indexOf('\r\n\r\n');
          let separatorLen = 4;

          if (separatorIndex === -1) {
            separatorIndex = part.indexOf('\n\n');
            separatorLen = 2;
          }

          if (separatorIndex === -1) {
            console.log(`  ⚠️ Part ${i}: No header separator found`);
            continue;
          }

          const headers = part.substring(0, separatorIndex);
          let body = part.substring(separatorIndex + separatorLen);
          body = body.replace(/\r?\n--$/, '').replace(/\r?\n$/, '').trim();

          const nameMatch = headers.match(/Content-Disposition:[^;]*;\s*name="([^"]+)"/i);
          if (nameMatch) {
            const fieldName = nameMatch[1];
            webhookData[fieldName] = body;
            console.log(`  📝 Parsed field: ${fieldName} (${body.length} chars)`);
          }
        }
      }

      console.log('\n🔍 PARSED FIELDS:', Object.keys(webhookData).join(', '));

      // Check if we have the raw email field
      if (webhookData.email) {
        console.log('\n🔄 Parsing raw MIME email from "email" field...');
        try {
          const parsed = await simpleParser(webhookData.email);
          webhookData = {
            to: parsed.to?.text || (parsed.to?.value ? parsed.to.value.map((a: any) => a.address).join(', ') : ''),
            from: parsed.from?.text || (parsed.from?.value ? parsed.from.value[0]?.address : ''),
            subject: parsed.subject || '',
            text: parsed.text || '',
            html: parsed.html || '',
            envelope: webhookData.envelope,
            messageId: parsed.messageId,
            date: parsed.date?.toISOString(),
            ...(!webhookData.envelope && parsed.to && parsed.from ? {
              envelope: JSON.stringify({
                to: parsed.to.value?.map((a: any) => a.address) || [],
                from: parsed.from.value?.[0]?.address || ''
              })
            } : {})
          };
          console.log('✅ Successfully parsed raw MIME email');
        } catch (parseError) {
          console.error('❌ Failed to parse raw MIME email:', parseError);
        }
      }

      console.log('\n⏳ Processing webhook data...');
      await messageService.processInboundEmailWebhook(webhookData);

      console.log('✅ Webhook processed successfully');
      console.log('='.repeat(80) + '\n');
      res.status(200).send('OK');
    } catch (error: any) {
      console.error('\n❌ ERROR PROCESSING WEBHOOK:');
      console.error('  Error message:', error.message);
      console.error('  Stack trace:', error.stack);
      console.log('='.repeat(80) + '\n');
      res.status(500).send('Error processing webhook');
    }
  });

  // SendGrid Event Webhook (for delivery tracking)
  app.post('/api/webhook/sendgrid/events', express.json(), verifySendGridEventSignature, async (req, res) => {
    console.log("📊 SendGrid event webhook received");

    try {
      const events = Array.isArray(req.body) ? req.body : [req.body];

      for (const event of events) {
        await messageService.processEmailEvent(event);
      }

      res.status(200).send('OK');
    } catch (error) {
      console.error("Failed to process email events:", error);
      res.status(500).send('Error processing events');
    }
  });

  // Test endpoint for debugging SendGrid webhook
  app.post('/api/webhook/sendgrid/test', express.json(), async (req, res) => {
    console.log("🧪 SendGrid webhook test endpoint");
    console.log("Request body keys:", Object.keys(req.body || {}));

    try {
      const testData = req.body || {
        to: "thread-abc12@reply.cimshare.com",
        from: "test@example.com",
        subject: "Test reply",
        text: "This is a test email reply",
        envelope: JSON.stringify({
          to: ["thread-abc12@reply.cimshare.com"],
          from: "test@example.com"
        })
      };

      await messageService.processInboundEmailWebhook(testData);

      res.json({
        success: true,
        message: "Test webhook processed",
        dataReceived: testData
      });
    } catch (error) {
      console.error("Test webhook error:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        dataReceived: req.body
      });
    }
  });

  // GET endpoint to check webhook configuration
  app.get('/api/webhook/sendgrid/info', (req, res) => {
    const baseUrl = process.env.REPLIT_DOMAINS
      ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
      : 'https://cimshare.com';

    const inboundSecretConfigured = !!process.env.SENDGRID_INBOUND_WEBHOOK_SECRET;
    const eventSignatureConfigured = !!process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY;

    res.json({
      status: "ready",
      security: {
        inboundWebhookSecretConfigured: inboundSecretConfigured,
        eventWebhookSignatureConfigured: eventSignatureConfigured,
      },
      inboundWebhookUrl: `${baseUrl}/api/webhook/sendgrid/inbound${inboundSecretConfigured ? '?secret=YOUR_SECRET' : ''}`,
      eventWebhookUrl: `${baseUrl}/api/webhook/sendgrid/events`,
      testEndpoint: `${baseUrl}/api/webhook/sendgrid/test`,
    });
  });

  // Stripe webhook endpoint with proper raw body handling
  app.post("/api/webhook/stripe", express.raw({ type: 'application/json' }), async (req, res) => {
    console.log('🔔 Stripe webhook received');

    const sig = req.headers["stripe-signature"];
    if (!sig) {
      console.error("❌ Stripe webhook: No signature found");
      return res.status(400).json({ error: "Missing Stripe signature" });
    }

    try {
      await handleStripeWebhook(req, res, stripe);
    } catch (error) {
      console.error("❌ Unexpected Stripe webhook error:", error);
      return res.status(200).json({
        received: true,
        warning: "Webhook received but encountered unexpected error - logged for review"
      });
    }
  });

  console.log('✅ External webhooks registered (SendGrid, Stripe)');
}
