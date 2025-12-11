/**
 * Integration API Routes
 *
 * RESTful API endpoints for managing connections, automations, and runs.
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import {
  integrationConnections,
  integrationAutomations,
  integrationAutomationRuns,
  WEBHOOK_EVENT_TYPES,
  INTEGRATION_PROVIDERS,
  DESTINATION_TYPES,
  insertIntegrationConnectionSchema,
  insertIntegrationAutomationSchema,
  updateIntegrationAutomationSchema,
} from '@shared/schema';
import { eq, and, desc, sql, count } from 'drizzle-orm';
import * as crypto from 'crypto';
import {
  getProvider,
  getProviderInfo,
  providerRequiresOAuth,
  encrypt,
  decrypt,
  generateWebhookSecret,
  retryRun,
  testAutomation,
} from '../integrations';
import { slackProvider } from '../integrations/providers/slack';
import { hubspotProvider } from '../integrations/providers/hubspot';

const router = Router();

// Middleware to ensure user is authenticated
function requireAuth(req: Request, res: Response, next: Function) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

// Apply auth middleware to all routes
router.use(requireAuth);

// ============================================================================
// METADATA ENDPOINTS
// ============================================================================

/**
 * GET /api/integrations/providers
 * List available integration providers
 */
router.get('/providers', async (req: Request, res: Response) => {
  try {
    const providers = getProviderInfo();
    res.json(providers);
  } catch (error: any) {
    console.error('Error fetching providers:', error);
    res.status(500).json({ error: 'Failed to fetch providers' });
  }
});

/**
 * GET /api/integrations/event-types
 * List available event types grouped by category
 */
router.get('/event-types', async (req: Request, res: Response) => {
  try {
    const categories = {
      documents: {
        label: 'Documents',
        events: [
          { type: 'cim.created', label: 'Document Created' },
          { type: 'cim.updated', label: 'Document Updated' },
          { type: 'cim.published', label: 'Document Published' },
          { type: 'cim.viewed', label: 'Document Viewed' },
          { type: 'cim.downloaded', label: 'Document Downloaded' },
        ]
      },
      ndas: {
        label: 'NDAs',
        events: [
          { type: 'nda.sent', label: 'NDA Sent' },
          { type: 'nda.signed', label: 'NDA Signed' },
          { type: 'nda.declined', label: 'NDA Declined' },
        ]
      },
      esignatures: {
        label: 'E-Signatures',
        events: [
          { type: 'esign.envelope_completed', label: 'Envelope Completed' },
        ]
      },
      contacts: {
        label: 'Contacts',
        events: [
          { type: 'contact.created', label: 'Contact Created' },
          { type: 'contact.updated', label: 'Contact Updated' },
          { type: 'contact.deleted', label: 'Contact Deleted' },
        ]
      },
      messages: {
        label: 'Messages',
        events: [
          { type: 'message.received', label: 'Message Received' },
          { type: 'message.sent', label: 'Message Sent' },
        ]
      },
      dataroom: {
        label: 'Data Room',
        events: [
          { type: 'dataroom.file_uploaded', label: 'File Uploaded' },
          { type: 'dataroom.file_viewed', label: 'File Viewed' },
          { type: 'dataroom.access_granted', label: 'Access Granted' },
        ]
      }
    };

    res.json({ categories });
  } catch (error: any) {
    console.error('Error fetching event types:', error);
    res.status(500).json({ error: 'Failed to fetch event types' });
  }
});

// ============================================================================
// CONNECTION ENDPOINTS
// ============================================================================

/**
 * GET /api/integrations/connections
 * List all connections for the current user
 */
router.get('/connections', async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;

    const connections = await db
      .select({
        id: integrationConnections.id,
        provider: integrationConnections.provider,
        providerAccountId: integrationConnections.providerAccountId,
        providerAccountName: integrationConnections.providerAccountName,
        status: integrationConnections.status,
        lastUsedAt: integrationConnections.lastUsedAt,
        lastError: integrationConnections.lastError,
        createdAt: integrationConnections.createdAt,
      })
      .from(integrationConnections)
      .where(eq(integrationConnections.userId, userId))
      .orderBy(desc(integrationConnections.createdAt));

    res.json(connections);
  } catch (error: any) {
    console.error('Error fetching connections:', error);
    res.status(500).json({ error: 'Failed to fetch connections' });
  }
});

/**
 * POST /api/integrations/connections
 * Create a new connection (webhook-based) or initiate OAuth
 */
router.post('/connections', async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const { provider, webhookUrl, name } = req.body;

    if (!provider || !INTEGRATION_PROVIDERS.includes(provider)) {
      return res.status(400).json({ error: 'Invalid provider' });
    }

    // For OAuth providers, return the auth URL
    if (providerRequiresOAuth(provider)) {
      const providerInstance = getProvider(provider);
      if (!providerInstance?.getAuthUrl) {
        return res.status(400).json({ error: 'OAuth not supported for this provider' });
      }

      // Generate state for CSRF protection
      const state = crypto.randomBytes(32).toString('hex');

      // Store state in session for verification
      (req.session as any).oauthState = state;
      (req.session as any).oauthProvider = provider;

      const authUrl = providerInstance.getAuthUrl(userId, state);
      return res.json({ oauthUrl: authUrl });
    }

    // For webhook-based providers, create the connection directly
    if (!webhookUrl) {
      return res.status(400).json({ error: 'Webhook URL is required' });
    }

    // Validate URL
    try {
      new URL(webhookUrl);
    } catch {
      return res.status(400).json({ error: 'Invalid webhook URL' });
    }

    // Generate webhook secret
    const secret = generateWebhookSecret();

    const [connection] = await db
      .insert(integrationConnections)
      .values({
        userId,
        provider,
        providerAccountName: name || `${provider} Webhook`,
        webhookUrl,
        webhookSecret: secret,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    res.json({
      connection: {
        ...connection,
        webhookSecret: undefined, // Don't expose in list
      },
      secretOnce: secret, // Only shown once
    });
  } catch (error: any) {
    console.error('Error creating connection:', error);
    res.status(500).json({ error: 'Failed to create connection' });
  }
});

/**
 * GET /api/integrations/connections/:id
 * Get connection details
 */
router.get('/connections/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const connectionId = parseInt(req.params.id);

    const [connection] = await db
      .select()
      .from(integrationConnections)
      .where(and(
        eq(integrationConnections.id, connectionId),
        eq(integrationConnections.userId, userId)
      ));

    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    res.json({
      connection: {
        ...connection,
        accessTokenEncrypted: undefined,
        refreshTokenEncrypted: undefined,
        webhookSecret: connection.webhookSecret ? '••••••••' : undefined,
      }
    });
  } catch (error: any) {
    console.error('Error fetching connection:', error);
    res.status(500).json({ error: 'Failed to fetch connection' });
  }
});

/**
 * DELETE /api/integrations/connections/:id
 * Delete a connection
 */
router.delete('/connections/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const connectionId = parseInt(req.params.id);

    // Verify ownership
    const [connection] = await db
      .select()
      .from(integrationConnections)
      .where(and(
        eq(integrationConnections.id, connectionId),
        eq(integrationConnections.userId, userId)
      ));

    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    // Delete associated automations first
    await db
      .delete(integrationAutomations)
      .where(eq(integrationAutomations.connectionId, connectionId));

    // Delete the connection
    await db
      .delete(integrationConnections)
      .where(eq(integrationConnections.id, connectionId));

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting connection:', error);
    res.status(500).json({ error: 'Failed to delete connection' });
  }
});

/**
 * POST /api/integrations/connections/:id/test
 * Test a connection
 */
router.post('/connections/:id/test', async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const connectionId = parseInt(req.params.id);

    const [connection] = await db
      .select()
      .from(integrationConnections)
      .where(and(
        eq(integrationConnections.id, connectionId),
        eq(integrationConnections.userId, userId)
      ));

    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    const provider = getProvider(connection.provider as any);
    if (!provider?.testConnection) {
      return res.json({ success: true, message: 'Connection test not available for this provider' });
    }

    const result = await provider.testConnection(connection);
    res.json(result);
  } catch (error: any) {
    console.error('Error testing connection:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// OAUTH CALLBACK ENDPOINTS
// ============================================================================

/**
 * GET /api/integrations/oauth/callback/:provider
 * Handle OAuth callback
 */
router.get('/oauth/callback/:provider', async (req: Request, res: Response) => {
  try {
    const { provider } = req.params;
    const { code, state, error } = req.query;

    // Verify state
    const expectedState = (req.session as any).oauthState;
    const expectedProvider = (req.session as any).oauthProvider;

    if (error) {
      return res.redirect(`/integrations?error=${encodeURIComponent(error as string)}`);
    }

    if (!code || state !== expectedState || provider !== expectedProvider) {
      return res.redirect('/integrations?error=invalid_state');
    }

    // Clear session state
    delete (req.session as any).oauthState;
    delete (req.session as any).oauthProvider;

    const userId = (req.user as any).id;
    const providerInstance = getProvider(provider as any);

    if (!providerInstance?.handleCallback) {
      return res.redirect('/integrations?error=oauth_not_supported');
    }

    // Exchange code for tokens
    const result = await providerInstance.handleCallback(code as string, userId);

    // Check if connection already exists
    const [existing] = await db
      .select()
      .from(integrationConnections)
      .where(and(
        eq(integrationConnections.userId, userId),
        eq(integrationConnections.provider, provider),
        eq(integrationConnections.providerAccountId, result.accountId)
      ));

    if (existing) {
      // Update existing connection
      await db
        .update(integrationConnections)
        .set({
          accessTokenEncrypted: encrypt(result.tokens.accessToken),
          refreshTokenEncrypted: result.tokens.refreshToken ? encrypt(result.tokens.refreshToken) : null,
          tokenExpiresAt: result.tokens.expiresAt,
          scopes: result.tokens.scopes,
          providerAccountName: result.accountName,
          status: 'active',
          lastError: null,
          errorCount: 0,
          updatedAt: new Date(),
        })
        .where(eq(integrationConnections.id, existing.id));

      return res.redirect(`/integrations?connected=${provider}&reconnected=true`);
    }

    // Create new connection
    await db
      .insert(integrationConnections)
      .values({
        userId,
        provider,
        providerAccountId: result.accountId,
        providerAccountName: result.accountName,
        accessTokenEncrypted: encrypt(result.tokens.accessToken),
        refreshTokenEncrypted: result.tokens.refreshToken ? encrypt(result.tokens.refreshToken) : null,
        tokenExpiresAt: result.tokens.expiresAt,
        scopes: result.tokens.scopes,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

    res.redirect(`/integrations?connected=${provider}`);
  } catch (error: any) {
    console.error('OAuth callback error:', error);
    res.redirect(`/integrations?error=${encodeURIComponent(error.message || 'oauth_failed')}`);
  }
});

// ============================================================================
// PROVIDER-SPECIFIC ENDPOINTS
// ============================================================================

/**
 * GET /api/integrations/slack/channels
 * Get Slack channels for a connection
 */
router.get('/slack/channels', async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const connectionId = parseInt(req.query.connectionId as string);

    if (!connectionId) {
      return res.status(400).json({ error: 'Connection ID required' });
    }

    const [connection] = await db
      .select()
      .from(integrationConnections)
      .where(and(
        eq(integrationConnections.id, connectionId),
        eq(integrationConnections.userId, userId),
        eq(integrationConnections.provider, 'slack')
      ));

    if (!connection) {
      return res.status(404).json({ error: 'Slack connection not found' });
    }

    const channels = await slackProvider.getChannels(connection);
    res.json({ channels });
  } catch (error: any) {
    console.error('Error fetching Slack channels:', error);
    res.status(500).json({ error: 'Failed to fetch channels' });
  }
});

/**
 * GET /api/integrations/hubspot/properties/:objectType
 * Get HubSpot properties for an object type
 */
router.get('/hubspot/properties/:objectType', async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const { objectType } = req.params;
    const connectionId = parseInt(req.query.connectionId as string);

    if (!connectionId) {
      return res.status(400).json({ error: 'Connection ID required' });
    }

    const destinationType = `hubspot_${objectType}` as any;

    const [connection] = await db
      .select()
      .from(integrationConnections)
      .where(and(
        eq(integrationConnections.id, connectionId),
        eq(integrationConnections.userId, userId),
        eq(integrationConnections.provider, 'hubspot')
      ));

    if (!connection) {
      return res.status(404).json({ error: 'HubSpot connection not found' });
    }

    const properties = await hubspotProvider.getDestinationSchema(connection, destinationType);
    res.json({ properties });
  } catch (error: any) {
    console.error('Error fetching HubSpot properties:', error);
    res.status(500).json({ error: 'Failed to fetch properties' });
  }
});

// ============================================================================
// AUTOMATION ENDPOINTS
// ============================================================================

/**
 * GET /api/integrations/automations
 * List all automations for the current user
 */
router.get('/automations', async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const { connectionId, isActive, limit = 50, offset = 0 } = req.query;

    let query = db
      .select({
        automation: integrationAutomations,
        connection: {
          id: integrationConnections.id,
          provider: integrationConnections.provider,
          providerAccountName: integrationConnections.providerAccountName,
          status: integrationConnections.status,
        }
      })
      .from(integrationAutomations)
      .leftJoin(integrationConnections, eq(integrationAutomations.connectionId, integrationConnections.id))
      .where(eq(integrationAutomations.userId, userId))
      .orderBy(desc(integrationAutomations.createdAt))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    const results = await query;

    const automations = results.map(r => ({
      ...r.automation,
      connection: r.connection,
    }));

    // Get total count
    const [{ total }] = await db
      .select({ total: count() })
      .from(integrationAutomations)
      .where(eq(integrationAutomations.userId, userId));

    res.json({
      automations,
      total,
      pagination: {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: parseInt(offset as string) + automations.length < total,
      }
    });
  } catch (error: any) {
    console.error('Error fetching automations:', error);
    res.status(500).json({ error: 'Failed to fetch automations' });
  }
});

/**
 * POST /api/integrations/automations
 * Create a new automation
 */
router.post('/automations', async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;

    // Validate input
    const validationResult = insertIntegrationAutomationSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationResult.error.flatten()
      });
    }

    const data = validationResult.data;

    // Verify connection ownership if connectionId provided
    if (data.connectionId) {
      const [connection] = await db
        .select()
        .from(integrationConnections)
        .where(and(
          eq(integrationConnections.id, data.connectionId),
          eq(integrationConnections.userId, userId)
        ));

      if (!connection) {
        return res.status(400).json({ error: 'Connection not found' });
      }
    }

    const [automation] = await db
      .insert(integrationAutomations)
      .values({
        userId,
        connectionId: data.connectionId || null,
        name: data.name,
        description: data.description,
        triggerEvent: data.triggerEvent,
        triggerCondition: data.triggerCondition as any,
        destinationType: data.destinationType,
        destinationConfig: data.destinationConfig as any,
        behavior: data.behavior,
        matchField: data.matchField,
        fieldMappings: data.fieldMappings as any,
        includeFile: data.includeFile || false,
        fileSource: data.fileSource,
        fileDestination: data.fileDestination,
        isActive: data.isActive ?? true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    res.json({ automation });
  } catch (error: any) {
    console.error('Error creating automation:', error);
    res.status(500).json({ error: 'Failed to create automation' });
  }
});

/**
 * GET /api/integrations/automations/:id
 * Get automation details with recent runs
 */
router.get('/automations/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const automationId = parseInt(req.params.id);

    const [result] = await db
      .select({
        automation: integrationAutomations,
        connection: {
          id: integrationConnections.id,
          provider: integrationConnections.provider,
          providerAccountName: integrationConnections.providerAccountName,
          status: integrationConnections.status,
        }
      })
      .from(integrationAutomations)
      .leftJoin(integrationConnections, eq(integrationAutomations.connectionId, integrationConnections.id))
      .where(and(
        eq(integrationAutomations.id, automationId),
        eq(integrationAutomations.userId, userId)
      ));

    if (!result) {
      return res.status(404).json({ error: 'Automation not found' });
    }

    // Get recent runs
    const recentRuns = await db
      .select()
      .from(integrationAutomationRuns)
      .where(eq(integrationAutomationRuns.automationId, automationId))
      .orderBy(desc(integrationAutomationRuns.createdAt))
      .limit(20);

    res.json({
      automation: {
        ...result.automation,
        connection: result.connection,
      },
      recentRuns,
    });
  } catch (error: any) {
    console.error('Error fetching automation:', error);
    res.status(500).json({ error: 'Failed to fetch automation' });
  }
});

/**
 * PATCH /api/integrations/automations/:id
 * Update an automation
 */
router.patch('/automations/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const automationId = parseInt(req.params.id);

    // Verify ownership
    const [existing] = await db
      .select()
      .from(integrationAutomations)
      .where(and(
        eq(integrationAutomations.id, automationId),
        eq(integrationAutomations.userId, userId)
      ));

    if (!existing) {
      return res.status(404).json({ error: 'Automation not found' });
    }

    // Validate input
    const validationResult = updateIntegrationAutomationSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationResult.error.flatten()
      });
    }

    const data = validationResult.data;

    const [automation] = await db
      .update(integrationAutomations)
      .set({
        ...data,
        triggerCondition: data.triggerCondition as any,
        destinationConfig: data.destinationConfig as any,
        fieldMappings: data.fieldMappings as any,
        updatedAt: new Date(),
      })
      .where(eq(integrationAutomations.id, automationId))
      .returning();

    res.json({ automation });
  } catch (error: any) {
    console.error('Error updating automation:', error);
    res.status(500).json({ error: 'Failed to update automation' });
  }
});

/**
 * DELETE /api/integrations/automations/:id
 * Delete an automation
 */
router.delete('/automations/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const automationId = parseInt(req.params.id);

    // Verify ownership
    const [existing] = await db
      .select()
      .from(integrationAutomations)
      .where(and(
        eq(integrationAutomations.id, automationId),
        eq(integrationAutomations.userId, userId)
      ));

    if (!existing) {
      return res.status(404).json({ error: 'Automation not found' });
    }

    // Delete runs first
    await db
      .delete(integrationAutomationRuns)
      .where(eq(integrationAutomationRuns.automationId, automationId));

    // Delete automation
    await db
      .delete(integrationAutomations)
      .where(eq(integrationAutomations.id, automationId));

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting automation:', error);
    res.status(500).json({ error: 'Failed to delete automation' });
  }
});

/**
 * POST /api/integrations/automations/:id/toggle
 * Enable/disable an automation
 */
router.post('/automations/:id/toggle', async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const automationId = parseInt(req.params.id);
    const { isActive } = req.body;

    const [automation] = await db
      .update(integrationAutomations)
      .set({
        isActive: isActive,
        updatedAt: new Date(),
      })
      .where(and(
        eq(integrationAutomations.id, automationId),
        eq(integrationAutomations.userId, userId)
      ))
      .returning();

    if (!automation) {
      return res.status(404).json({ error: 'Automation not found' });
    }

    res.json({ automation });
  } catch (error: any) {
    console.error('Error toggling automation:', error);
    res.status(500).json({ error: 'Failed to toggle automation' });
  }
});

/**
 * POST /api/integrations/automations/:id/test
 * Test an automation
 */
router.post('/automations/:id/test', async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const automationId = parseInt(req.params.id);
    const { eventId, useSample, dryRun } = req.body;

    // Verify ownership
    const [existing] = await db
      .select()
      .from(integrationAutomations)
      .where(and(
        eq(integrationAutomations.id, automationId),
        eq(integrationAutomations.userId, userId)
      ));

    if (!existing) {
      return res.status(404).json({ error: 'Automation not found' });
    }

    const result = await testAutomation(automationId, {
      eventId,
      useSample: useSample ?? true,
      dryRun: dryRun ?? false,
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error testing automation:', error);
    res.status(500).json({ error: 'Failed to test automation' });
  }
});

// ============================================================================
// RUN HISTORY ENDPOINTS
// ============================================================================

/**
 * GET /api/integrations/runs
 * List runs across all automations
 */
router.get('/runs', async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const {
      automationId,
      status,
      eventType,
      limit = 50,
      offset = 0
    } = req.query;

    // Build query with filters
    const conditions = [eq(integrationAutomations.userId, userId)];

    if (automationId) {
      conditions.push(eq(integrationAutomationRuns.automationId, parseInt(automationId as string)));
    }

    const runs = await db
      .select({
        run: integrationAutomationRuns,
        automation: {
          id: integrationAutomations.id,
          name: integrationAutomations.name,
          destinationType: integrationAutomations.destinationType,
        }
      })
      .from(integrationAutomationRuns)
      .innerJoin(integrationAutomations, eq(integrationAutomationRuns.automationId, integrationAutomations.id))
      .where(and(...conditions))
      .orderBy(desc(integrationAutomationRuns.createdAt))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    // Apply additional filters (status, eventType) in memory for simplicity
    let filteredRuns = runs.map(r => ({
      ...r.run,
      automation: r.automation,
    }));

    if (status && status !== 'all') {
      filteredRuns = filteredRuns.filter(r => r.status === status);
    }

    if (eventType && eventType !== 'all') {
      filteredRuns = filteredRuns.filter(r => r.eventType === eventType);
    }

    res.json({
      runs: filteredRuns,
      pagination: {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      }
    });
  } catch (error: any) {
    console.error('Error fetching runs:', error);
    res.status(500).json({ error: 'Failed to fetch runs' });
  }
});

/**
 * GET /api/integrations/runs/:id
 * Get run details
 */
router.get('/runs/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const runId = parseInt(req.params.id);

    const [result] = await db
      .select({
        run: integrationAutomationRuns,
        automation: {
          id: integrationAutomations.id,
          name: integrationAutomations.name,
          userId: integrationAutomations.userId,
        }
      })
      .from(integrationAutomationRuns)
      .innerJoin(integrationAutomations, eq(integrationAutomationRuns.automationId, integrationAutomations.id))
      .where(eq(integrationAutomationRuns.id, runId));

    if (!result || result.automation.userId !== userId) {
      return res.status(404).json({ error: 'Run not found' });
    }

    res.json({ run: result.run });
  } catch (error: any) {
    console.error('Error fetching run:', error);
    res.status(500).json({ error: 'Failed to fetch run' });
  }
});

/**
 * POST /api/integrations/runs/:id/retry
 * Retry a failed run
 */
router.post('/runs/:id/retry', async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const runId = parseInt(req.params.id);

    // Verify ownership
    const [result] = await db
      .select({
        run: integrationAutomationRuns,
        automation: {
          userId: integrationAutomations.userId,
        }
      })
      .from(integrationAutomationRuns)
      .innerJoin(integrationAutomations, eq(integrationAutomationRuns.automationId, integrationAutomations.id))
      .where(eq(integrationAutomationRuns.id, runId));

    if (!result || result.automation.userId !== userId) {
      return res.status(404).json({ error: 'Run not found' });
    }

    const retryResult = await retryRun(runId);
    res.json(retryResult);
  } catch (error: any) {
    console.error('Error retrying run:', error);
    res.status(500).json({ error: 'Failed to retry run' });
  }
});

export default router;
