import { Router } from 'express';
import { db } from '../db';
import { webhooks, webhookDeliveries, WEBHOOK_EVENT_TYPES, insertWebhookSchema, updateWebhookSchema } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import * as crypto from 'crypto';

const router = Router();

// Generate a secure random secret for HMAC signing
function generateWebhookSecret(): string {
  return `whsec_${crypto.randomBytes(32).toString('hex')}`;
}

// Get all webhooks for the current user
router.get('/', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const userWebhooks = await db
      .select()
      .from(webhooks)
      .where(eq(webhooks.userId, req.user!.id))
      .orderBy(desc(webhooks.createdAt));

    // Don't expose the full secret, just show if it exists
    const sanitizedWebhooks = userWebhooks.map(wh => ({
      ...wh,
      secret: wh.secret ? '••••••••' + wh.secret.slice(-8) : null
    }));

    res.json(sanitizedWebhooks);
  } catch (error) {
    console.error('Error fetching webhooks:', error);
    res.status(500).json({ error: 'Failed to fetch webhooks' });
  }
});

// Get available event types
router.get('/event-types', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  // Group events by category for better UI
  const eventCategories = {
    cim: {
      label: 'CIM Events',
      events: WEBHOOK_EVENT_TYPES.filter(e => e.startsWith('cim.'))
    },
    nda: {
      label: 'NDA Events',
      events: WEBHOOK_EVENT_TYPES.filter(e => e.startsWith('nda.'))
    },
    contact: {
      label: 'Contact Events',
      events: WEBHOOK_EVENT_TYPES.filter(e => e.startsWith('contact.'))
    },
    message: {
      label: 'Message Events',
      events: WEBHOOK_EVENT_TYPES.filter(e => e.startsWith('message.'))
    },
    dataroom: {
      label: 'Data Room Events',
      events: WEBHOOK_EVENT_TYPES.filter(e => e.startsWith('dataroom.'))
    }
  };

  res.json(eventCategories);
});

// Get a single webhook with delivery stats
router.get('/:id', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const webhookId = parseInt(req.params.id);

    const [webhook] = await db
      .select()
      .from(webhooks)
      .where(and(
        eq(webhooks.id, webhookId),
        eq(webhooks.userId, req.user!.id)
      ));

    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    // Get recent deliveries
    const recentDeliveries = await db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.webhookId, webhookId))
      .orderBy(desc(webhookDeliveries.createdAt))
      .limit(20);

    res.json({
      ...webhook,
      secret: webhook.secret ? '••••••••' + webhook.secret.slice(-8) : null,
      recentDeliveries
    });
  } catch (error) {
    console.error('Error fetching webhook:', error);
    res.status(500).json({ error: 'Failed to fetch webhook' });
  }
});

// Create a new webhook
router.post('/', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const validation = insertWebhookSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid webhook data',
        details: validation.error.errors
      });
    }

    const { name, url, events } = validation.data;
    const secret = generateWebhookSecret();

    const [newWebhook] = await db
      .insert(webhooks)
      .values({
        userId: req.user!.id,
        name,
        url,
        secret,
        events,
        isActive: true
      })
      .returning();

    // Return the secret only on creation so user can save it
    res.status(201).json({
      ...newWebhook,
      secretOnce: secret // Only shown this one time
    });
  } catch (error) {
    console.error('Error creating webhook:', error);
    res.status(500).json({ error: 'Failed to create webhook' });
  }
});

// Update a webhook
router.patch('/:id', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const webhookId = parseInt(req.params.id);

    // Verify ownership
    const [existing] = await db
      .select()
      .from(webhooks)
      .where(and(
        eq(webhooks.id, webhookId),
        eq(webhooks.userId, req.user!.id)
      ));

    if (!existing) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    const validation = updateWebhookSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid webhook data',
        details: validation.error.errors
      });
    }

    const updateData: any = {
      updatedAt: new Date()
    };

    if (validation.data.name !== undefined) updateData.name = validation.data.name;
    if (validation.data.url !== undefined) updateData.url = validation.data.url;
    if (validation.data.events !== undefined) updateData.events = validation.data.events;
    if (validation.data.isActive !== undefined) updateData.isActive = validation.data.isActive;

    const [updated] = await db
      .update(webhooks)
      .set(updateData)
      .where(eq(webhooks.id, webhookId))
      .returning();

    res.json({
      ...updated,
      secret: updated.secret ? '••••••••' + updated.secret.slice(-8) : null
    });
  } catch (error) {
    console.error('Error updating webhook:', error);
    res.status(500).json({ error: 'Failed to update webhook' });
  }
});

// Regenerate webhook secret
router.post('/:id/regenerate-secret', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const webhookId = parseInt(req.params.id);

    // Verify ownership
    const [existing] = await db
      .select()
      .from(webhooks)
      .where(and(
        eq(webhooks.id, webhookId),
        eq(webhooks.userId, req.user!.id)
      ));

    if (!existing) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    const newSecret = generateWebhookSecret();

    const [updated] = await db
      .update(webhooks)
      .set({
        secret: newSecret,
        updatedAt: new Date()
      })
      .where(eq(webhooks.id, webhookId))
      .returning();

    res.json({
      ...updated,
      secretOnce: newSecret // Only shown this one time
    });
  } catch (error) {
    console.error('Error regenerating secret:', error);
    res.status(500).json({ error: 'Failed to regenerate secret' });
  }
});

// Delete a webhook
router.delete('/:id', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const webhookId = parseInt(req.params.id);

    // Verify ownership and delete
    const result = await db
      .delete(webhooks)
      .where(and(
        eq(webhooks.id, webhookId),
        eq(webhooks.userId, req.user!.id)
      ))
      .returning();

    if (result.length === 0) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    // Also delete delivery logs
    await db
      .delete(webhookDeliveries)
      .where(eq(webhookDeliveries.webhookId, webhookId));

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting webhook:', error);
    res.status(500).json({ error: 'Failed to delete webhook' });
  }
});

// Test a webhook by sending a test payload
router.post('/:id/test', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const webhookId = parseInt(req.params.id);
    const { eventType } = req.body;

    if (!eventType || !WEBHOOK_EVENT_TYPES.includes(eventType)) {
      return res.status(400).json({ error: 'Invalid event type' });
    }

    // Verify ownership
    const [webhook] = await db
      .select()
      .from(webhooks)
      .where(and(
        eq(webhooks.id, webhookId),
        eq(webhooks.userId, req.user!.id)
      ));

    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    // Import and use the dispatcher to send test event
    const { webhookDispatcher } = await import('../webhook-dispatcher');
    const result = await webhookDispatcher.sendTestEvent(webhook, eventType);

    res.json(result);
  } catch (error) {
    console.error('Error testing webhook:', error);
    res.status(500).json({ error: 'Failed to test webhook' });
  }
});

// Get delivery logs for a webhook
router.get('/:id/deliveries', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const webhookId = parseInt(req.params.id);
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    // Verify ownership
    const [webhook] = await db
      .select()
      .from(webhooks)
      .where(and(
        eq(webhooks.id, webhookId),
        eq(webhooks.userId, req.user!.id)
      ));

    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    const deliveries = await db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.webhookId, webhookId))
      .orderBy(desc(webhookDeliveries.createdAt))
      .limit(limit)
      .offset(offset);

    res.json(deliveries);
  } catch (error) {
    console.error('Error fetching deliveries:', error);
    res.status(500).json({ error: 'Failed to fetch deliveries' });
  }
});

// Retry a failed delivery
router.post('/deliveries/:deliveryId/retry', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const deliveryId = parseInt(req.params.deliveryId);

    // Get delivery and verify ownership via webhook
    const [delivery] = await db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.id, deliveryId));

    if (!delivery) {
      return res.status(404).json({ error: 'Delivery not found' });
    }

    const [webhook] = await db
      .select()
      .from(webhooks)
      .where(and(
        eq(webhooks.id, delivery.webhookId),
        eq(webhooks.userId, req.user!.id)
      ));

    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    // Import and use the dispatcher to retry
    const { webhookDispatcher } = await import('../webhook-dispatcher');
    const result = await webhookDispatcher.retryDelivery(delivery, webhook);

    res.json(result);
  } catch (error) {
    console.error('Error retrying delivery:', error);
    res.status(500).json({ error: 'Failed to retry delivery' });
  }
});

export default router;
