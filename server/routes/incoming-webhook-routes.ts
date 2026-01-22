import { Router } from 'express';
import { db } from '../db';
import {
  incomingWebhooks,
  incomingWebhookLogs,
  INCOMING_WEBHOOK_ACTIONS,
  insertIncomingWebhookSchema,
  updateIncomingWebhookSchema,
  organizationMembers,
  organizations,
} from '@shared/schema';
import { eq, and, desc, count } from 'drizzle-orm';
import * as crypto from 'crypto';

const router = Router();

// Generate a secure token for incoming webhooks
function generateWebhookToken(): string {
  return `iwh_${crypto.randomBytes(24).toString('hex')}`;
}

// Helper: Get user's organization
async function getUserOrganization(userId: number) {
  const [membership] = await db
    .select({
      organization: organizations,
      membership: organizationMembers,
    })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
    .where(eq(organizationMembers.userId, userId))
    .limit(1);

  return membership;
}

// Get all incoming webhooks for the current user
router.get('/', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const webhooks = await db
      .select()
      .from(incomingWebhooks)
      .where(eq(incomingWebhooks.organizationId, orgData.organization.id))
      .orderBy(desc(incomingWebhooks.createdAt));

    res.json(webhooks);
  } catch (error) {
    console.error('Error fetching incoming webhooks:', error);
    res.status(500).json({ error: 'Failed to fetch incoming webhooks' });
  }
});

// Get a single incoming webhook with details
router.get('/:id', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const webhookId = parseInt(req.params.id);
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const [webhook] = await db
      .select()
      .from(incomingWebhooks)
      .where(and(
        eq(incomingWebhooks.id, webhookId),
        eq(incomingWebhooks.organizationId, orgData.organization.id)
      ));

    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    // Get recent logs
    const recentLogs = await db
      .select()
      .from(incomingWebhookLogs)
      .where(eq(incomingWebhookLogs.webhookId, webhookId))
      .orderBy(desc(incomingWebhookLogs.receivedAt))
      .limit(20);

    res.json({
      ...webhook,
      recentLogs
    });
  } catch (error) {
    console.error('Error fetching incoming webhook:', error);
    res.status(500).json({ error: 'Failed to fetch incoming webhook' });
  }
});

// Create a new incoming webhook
router.post('/', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const validation = insertIncomingWebhookSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid webhook data',
        details: validation.error.errors
      });
    }

    const { name, actionType, fieldMappings, actionConfig, secret } = validation.data;
    const token = generateWebhookToken();

    const [newWebhook] = await db
      .insert(incomingWebhooks)
      .values({
        userId: req.user!.id,
        organizationId: orgData.organization.id,
        name,
        token,
        actionType,
        fieldMappings: fieldMappings as any,
        actionConfig: actionConfig as any,
        secret: secret || null,
        isActive: true
      })
      .returning();

    res.status(201).json(newWebhook);
  } catch (error) {
    console.error('Error creating incoming webhook:', error);
    res.status(500).json({ error: 'Failed to create incoming webhook' });
  }
});

// Update an incoming webhook
router.patch('/:id', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const webhookId = parseInt(req.params.id);
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Verify ownership
    const [existing] = await db
      .select()
      .from(incomingWebhooks)
      .where(and(
        eq(incomingWebhooks.id, webhookId),
        eq(incomingWebhooks.organizationId, orgData.organization.id)
      ));

    if (!existing) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    const validation = updateIncomingWebhookSchema.safeParse(req.body);
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
    if (validation.data.actionType !== undefined) updateData.actionType = validation.data.actionType;
    if (validation.data.fieldMappings !== undefined) updateData.fieldMappings = validation.data.fieldMappings;
    if (validation.data.actionConfig !== undefined) updateData.actionConfig = validation.data.actionConfig;
    if (validation.data.secret !== undefined) updateData.secret = validation.data.secret;
    if (validation.data.isActive !== undefined) updateData.isActive = validation.data.isActive;

    const [updated] = await db
      .update(incomingWebhooks)
      .set(updateData)
      .where(eq(incomingWebhooks.id, webhookId))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Error updating incoming webhook:', error);
    res.status(500).json({ error: 'Failed to update incoming webhook' });
  }
});

// Regenerate token for incoming webhook
router.post('/:id/regenerate-token', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const webhookId = parseInt(req.params.id);
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Verify ownership
    const [existing] = await db
      .select()
      .from(incomingWebhooks)
      .where(and(
        eq(incomingWebhooks.id, webhookId),
        eq(incomingWebhooks.organizationId, orgData.organization.id)
      ));

    if (!existing) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    const newToken = generateWebhookToken();

    const [updated] = await db
      .update(incomingWebhooks)
      .set({
        token: newToken,
        updatedAt: new Date()
      })
      .where(eq(incomingWebhooks.id, webhookId))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Error regenerating token:', error);
    res.status(500).json({ error: 'Failed to regenerate token' });
  }
});

// Delete an incoming webhook
router.delete('/:id', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const webhookId = parseInt(req.params.id);
    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Verify ownership and delete
    const result = await db
      .delete(incomingWebhooks)
      .where(and(
        eq(incomingWebhooks.id, webhookId),
        eq(incomingWebhooks.organizationId, orgData.organization.id)
      ))
      .returning();

    if (result.length === 0) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    // Also delete logs
    await db
      .delete(incomingWebhookLogs)
      .where(eq(incomingWebhookLogs.webhookId, webhookId));

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting incoming webhook:', error);
    res.status(500).json({ error: 'Failed to delete incoming webhook' });
  }
});

// Get logs for an incoming webhook with pagination
router.get('/:id/logs', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const webhookId = parseInt(req.params.id);
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as string | undefined;

    const orgData = await getUserOrganization(req.user!.id);
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Verify ownership
    const [webhook] = await db
      .select()
      .from(incomingWebhooks)
      .where(and(
        eq(incomingWebhooks.id, webhookId),
        eq(incomingWebhooks.organizationId, orgData.organization.id)
      ));

    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    // Build filter conditions
    const conditions = [eq(incomingWebhookLogs.webhookId, webhookId)];

    if (status && ['pending', 'success', 'failed'].includes(status)) {
      conditions.push(eq(incomingWebhookLogs.status, status));
    }

    // Get total count for pagination
    const [countResult] = await db
      .select({ total: count() })
      .from(incomingWebhookLogs)
      .where(and(...conditions));

    const logs = await db
      .select()
      .from(incomingWebhookLogs)
      .where(and(...conditions))
      .orderBy(desc(incomingWebhookLogs.receivedAt))
      .limit(limit)
      .offset(offset);

    res.json({
      logs,
      pagination: {
        total: countResult?.total || 0,
        limit,
        offset,
        hasMore: offset + logs.length < (countResult?.total || 0)
      }
    });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// Get available action types for incoming webhooks
router.get('/meta/action-types', async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  res.json({
    actionTypes: INCOMING_WEBHOOK_ACTIONS.map(action => ({
      value: action,
      label: action.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())
    }))
  });
});

export default router;
