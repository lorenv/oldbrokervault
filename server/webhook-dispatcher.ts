import { db } from './db';
import { webhooks, webhookDeliveries, Webhook, WebhookDelivery, WebhookEventType } from '@shared/schema';
import { eq, and, lte, inArray } from 'drizzle-orm';
import * as crypto from 'crypto';

// Retry configuration
const MAX_RETRIES = 5;
const RETRY_DELAYS = [
  60 * 1000,        // 1 minute
  5 * 60 * 1000,    // 5 minutes
  30 * 60 * 1000,   // 30 minutes
  2 * 60 * 60 * 1000, // 2 hours
  24 * 60 * 60 * 1000 // 24 hours
];

// Generate HMAC signature for payload verification
function generateSignature(payload: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payload}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

// Generate unique event ID for idempotency
function generateEventId(): string {
  return `evt_${crypto.randomBytes(16).toString('hex')}`;
}

// Build test payload for different event types
function buildTestPayload(eventType: WebhookEventType): Record<string, any> {
  const basePayload = {
    event: eventType,
    timestamp: new Date().toISOString(),
    test: true
  };

  switch (eventType) {
    case 'cim.created':
    case 'cim.updated':
    case 'cim.published':
      return {
        ...basePayload,
        data: {
          cim_id: 'test_123',
          title: 'Test Business CIM',
          created_at: new Date().toISOString()
        }
      };

    case 'cim.viewed':
    case 'cim.downloaded':
      return {
        ...basePayload,
        data: {
          cim_id: 'test_123',
          title: 'Test Business CIM',
          viewer_email: 'viewer@example.com',
          viewed_at: new Date().toISOString()
        }
      };

    case 'nda.sent':
    case 'nda.signed':
    case 'nda.declined':
      return {
        ...basePayload,
        data: {
          nda_id: 'test_nda_456',
          cim_id: 'test_123',
          signer_email: 'signer@example.com',
          signer_name: 'John Doe'
        }
      };

    case 'contact.created':
    case 'contact.updated':
    case 'contact.deleted':
      return {
        ...basePayload,
        data: {
          contact_id: 'test_contact_789',
          email: 'contact@example.com',
          name: 'Jane Smith',
          status: 'interested'
        }
      };

    case 'message.received':
    case 'message.sent':
      return {
        ...basePayload,
        data: {
          message_id: 'test_msg_101',
          thread_id: 'test_thread_202',
          sender_email: 'sender@example.com',
          subject: 'Inquiry about listing'
        }
      };

    case 'dataroom.file_uploaded':
    case 'dataroom.file_viewed':
    case 'dataroom.access_granted':
      return {
        ...basePayload,
        data: {
          file_id: 'test_file_303',
          file_name: 'financial_summary.pdf',
          cim_id: 'test_123',
          user_email: 'user@example.com'
        }
      };

    default:
      return basePayload;
  }
}

class WebhookDispatcher {
  // Dispatch an event to all subscribed webhooks for a user
  async dispatch(
    userId: number,
    eventType: WebhookEventType,
    data: Record<string, any>
  ): Promise<void> {
    try {
      // Find all active webhooks for this user that subscribe to this event
      const userWebhooks = await db
        .select()
        .from(webhooks)
        .where(and(
          eq(webhooks.userId, userId),
          eq(webhooks.isActive, true)
        ));

      // Filter to webhooks that have this event in their subscribed events
      const subscribedWebhooks = userWebhooks.filter(wh =>
        wh.events.includes(eventType)
      );

      if (subscribedWebhooks.length === 0) {
        return; // No webhooks to notify
      }

      // Build payload
      const payload = {
        event: eventType,
        timestamp: new Date().toISOString(),
        data
      };

      // Queue deliveries for all subscribed webhooks
      await Promise.all(
        subscribedWebhooks.map(webhook => this.queueDelivery(webhook, eventType, payload))
      );
    } catch (error) {
      console.error('Error dispatching webhook:', error);
      // Don't throw - webhook failures shouldn't break the main flow
    }
  }

  // Queue a delivery for a single webhook
  private async queueDelivery(
    webhook: Webhook,
    eventType: string,
    payload: Record<string, any>
  ): Promise<void> {
    const eventId = generateEventId();

    // Create delivery record
    const [delivery] = await db
      .insert(webhookDeliveries)
      .values({
        webhookId: webhook.id,
        eventType,
        eventId,
        payload,
        status: 'pending',
        attemptCount: 0
      })
      .returning();

    // Attempt immediate delivery
    await this.attemptDelivery(delivery, webhook);
  }

  // Attempt to deliver a webhook
  private async attemptDelivery(
    delivery: WebhookDelivery,
    webhook: Webhook
  ): Promise<{ success: boolean; statusCode?: number; error?: string }> {
    const startTime = Date.now();
    const payloadString = JSON.stringify(delivery.payload);
    const signature = generateSignature(payloadString, webhook.secret);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': delivery.eventType,
          'X-Webhook-Event-Id': delivery.eventId,
          'User-Agent': 'CIMShare-Webhooks/1.0'
        },
        body: payloadString,
        signal: controller.signal
      });

      clearTimeout(timeout);

      const durationMs = Date.now() - startTime;
      const responseBody = await response.text().catch(() => '');

      if (response.ok) {
        // Success!
        await db
          .update(webhookDeliveries)
          .set({
            status: 'success',
            statusCode: response.status,
            responseBody: responseBody.substring(0, 1000), // Truncate
            attemptCount: delivery.attemptCount + 1,
            deliveredAt: new Date(),
            durationMs
          })
          .where(eq(webhookDeliveries.id, delivery.id));

        // Update webhook health
        await db
          .update(webhooks)
          .set({
            lastTriggeredAt: new Date(),
            lastSuccessAt: new Date(),
            consecutiveFailures: 0
          })
          .where(eq(webhooks.id, webhook.id));

        return { success: true, statusCode: response.status };
      } else {
        // HTTP error - schedule retry
        return await this.handleDeliveryFailure(
          delivery,
          webhook,
          response.status,
          `HTTP ${response.status}: ${responseBody.substring(0, 200)}`,
          durationMs
        );
      }
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error.name === 'AbortError'
        ? 'Request timeout (30s)'
        : error.message || 'Unknown error';

      return await this.handleDeliveryFailure(
        delivery,
        webhook,
        undefined,
        errorMessage,
        durationMs
      );
    }
  }

  // Handle delivery failure and schedule retry if appropriate
  private async handleDeliveryFailure(
    delivery: WebhookDelivery,
    webhook: Webhook,
    statusCode: number | undefined,
    errorMessage: string,
    durationMs: number
  ): Promise<{ success: false; statusCode?: number; error: string }> {
    const newAttemptCount = delivery.attemptCount + 1;
    const shouldRetry = newAttemptCount < MAX_RETRIES;

    const nextRetryAt = shouldRetry
      ? new Date(Date.now() + RETRY_DELAYS[newAttemptCount - 1])
      : null;

    await db
      .update(webhookDeliveries)
      .set({
        status: shouldRetry ? 'retrying' : 'failed',
        statusCode,
        errorMessage,
        attemptCount: newAttemptCount,
        nextRetryAt,
        durationMs
      })
      .where(eq(webhookDeliveries.id, delivery.id));

    // Update webhook health
    await db
      .update(webhooks)
      .set({
        lastTriggeredAt: new Date(),
        lastFailureAt: new Date(),
        consecutiveFailures: webhook.consecutiveFailures + 1
      })
      .where(eq(webhooks.id, webhook.id));

    // Auto-disable webhook after too many consecutive failures
    if (webhook.consecutiveFailures + 1 >= 10) {
      await db
        .update(webhooks)
        .set({ isActive: false })
        .where(eq(webhooks.id, webhook.id));

      console.log(`Webhook ${webhook.id} auto-disabled due to consecutive failures`);
    }

    return { success: false, statusCode, error: errorMessage };
  }

  // Send a test event to a webhook
  async sendTestEvent(
    webhook: Webhook,
    eventType: WebhookEventType
  ): Promise<{ success: boolean; statusCode?: number; error?: string; deliveryId?: number }> {
    const payload = buildTestPayload(eventType);
    const eventId = generateEventId();

    // Create delivery record for test
    const [delivery] = await db
      .insert(webhookDeliveries)
      .values({
        webhookId: webhook.id,
        eventType,
        eventId,
        payload,
        status: 'pending',
        attemptCount: 0
      })
      .returning();

    const result = await this.attemptDelivery(delivery, webhook);
    return { ...result, deliveryId: delivery.id };
  }

  // Retry a specific delivery
  async retryDelivery(
    delivery: WebhookDelivery,
    webhook: Webhook
  ): Promise<{ success: boolean; statusCode?: number; error?: string }> {
    // Reset attempt count to allow manual retry
    await db
      .update(webhookDeliveries)
      .set({
        status: 'pending',
        attemptCount: delivery.attemptCount // Keep existing count but allow retry
      })
      .where(eq(webhookDeliveries.id, delivery.id));

    return await this.attemptDelivery(
      { ...delivery, status: 'pending' },
      webhook
    );
  }

  // Process pending retries (called by background job)
  async processRetries(): Promise<void> {
    try {
      // Find deliveries that are due for retry
      const pendingRetries = await db
        .select()
        .from(webhookDeliveries)
        .where(and(
          eq(webhookDeliveries.status, 'retrying'),
          lte(webhookDeliveries.nextRetryAt, new Date())
        ))
        .limit(100); // Process in batches

      for (const delivery of pendingRetries) {
        const [webhook] = await db
          .select()
          .from(webhooks)
          .where(eq(webhooks.id, delivery.webhookId));

        if (webhook && webhook.isActive) {
          await this.attemptDelivery(delivery, webhook);
        } else {
          // Webhook deleted or disabled, mark as failed
          await db
            .update(webhookDeliveries)
            .set({
              status: 'failed',
              errorMessage: 'Webhook disabled or deleted'
            })
            .where(eq(webhookDeliveries.id, delivery.id));
        }
      }
    } catch (error) {
      console.error('Error processing webhook retries:', error);
    }
  }
}

// Export singleton instance
export const webhookDispatcher = new WebhookDispatcher();

// Helper function to dispatch events from anywhere in the codebase
export async function dispatchWebhookEvent(
  userId: number,
  eventType: WebhookEventType,
  data: Record<string, any>
): Promise<void> {
  return webhookDispatcher.dispatch(userId, eventType, data);
}
