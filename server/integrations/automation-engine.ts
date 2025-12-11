/**
 * Automation Engine
 *
 * Core engine that processes events and executes automations.
 * Handles condition evaluation, field mapping, and execution routing.
 */

import * as crypto from 'crypto';
import { db } from '../db';
import {
  integrationConnections,
  integrationAutomations,
  integrationAutomationRuns,
  type IntegrationConnection,
  type IntegrationAutomation,
  type WebhookEventType,
  type FieldMapping,
  type TriggerCondition
} from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { getProvider, getProviderForDestination } from './providers';
import { encrypt, decrypt } from './encryption';
import type { ExecutionResult, EventPayload, ConditionOperator } from './types';

// Retry configuration
const MAX_RETRIES = 5;
const RETRY_DELAYS = [
  60 * 1000,        // 1 minute
  5 * 60 * 1000,    // 5 minutes
  30 * 60 * 1000,   // 30 minutes
  2 * 60 * 60 * 1000, // 2 hours
  24 * 60 * 60 * 1000 // 24 hours
];

// Rate limiting
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_PER_AUTOMATION = 100;
const RATE_LIMIT_MAX_PER_USER = 500;

// In-memory rate limit cache
const rateLimitCache: Map<string, { count: number; resetAt: number }> = new Map();

/**
 * Generate unique event ID for idempotency
 */
function generateEventId(): string {
  return `evt_${crypto.randomBytes(16).toString('hex')}`;
}

/**
 * Check if an automation is rate limited
 */
async function isRateLimited(automationId: number, userId: number): Promise<boolean> {
  const now = Date.now();

  // Check automation-level limit
  const automationKey = `automation:${automationId}`;
  const automationCache = rateLimitCache.get(automationKey);

  if (automationCache && automationCache.resetAt > now) {
    if (automationCache.count >= RATE_LIMIT_MAX_PER_AUTOMATION) {
      return true;
    }
    automationCache.count++;
  } else {
    rateLimitCache.set(automationKey, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
  }

  // Check user-level limit
  const userKey = `user:${userId}`;
  const userCache = rateLimitCache.get(userKey);

  if (userCache && userCache.resetAt > now) {
    if (userCache.count >= RATE_LIMIT_MAX_PER_USER) {
      return true;
    }
    userCache.count++;
  } else {
    rateLimitCache.set(userKey, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
  }

  return false;
}

/**
 * Evaluate a trigger condition against event payload
 */
function evaluateCondition(condition: TriggerCondition, payload: Record<string, any>): boolean {
  const { field, operator, value } = condition;

  // Get field value using dot notation
  const fieldValue = getNestedValue(payload, field);
  const fieldStr = fieldValue !== null && fieldValue !== undefined ? String(fieldValue) : '';

  switch (operator as ConditionOperator) {
    case 'equals':
      return fieldStr === value;

    case 'not_equals':
      return fieldStr !== value;

    case 'contains':
      return fieldStr.toLowerCase().includes((value || '').toLowerCase());

    case 'not_contains':
      return !fieldStr.toLowerCase().includes((value || '').toLowerCase());

    case 'starts_with':
      return fieldStr.toLowerCase().startsWith((value || '').toLowerCase());

    case 'ends_with':
      return fieldStr.toLowerCase().endsWith((value || '').toLowerCase());

    case 'is_empty':
      return fieldValue === null || fieldValue === undefined || fieldStr === '';

    case 'is_not_empty':
      return fieldValue !== null && fieldValue !== undefined && fieldStr !== '';

    default:
      return true;
  }
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: Record<string, any>, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Apply field mappings to transform event payload to destination format
 */
function applyFieldMappings(
  mappings: FieldMapping[],
  eventPayload: Record<string, any>
): Record<string, any> {
  const result: Record<string, any> = {};

  for (const mapping of mappings) {
    let value: any;

    switch (mapping.type) {
      case 'field':
        // Get value from event payload using dot notation
        value = getNestedValue(eventPayload, mapping.sourceField || '');
        break;

      case 'constant':
        // Use constant value
        value = mapping.value;
        break;

      case 'template':
        // Interpolate template
        value = interpolateTemplate(mapping.template || '', eventPayload);
        break;

      default:
        continue;
    }

    // Only set if value is not null/undefined (unless it's a constant)
    if (value !== null && value !== undefined) {
      result[mapping.destField] = value;
    } else if (mapping.type === 'constant') {
      result[mapping.destField] = mapping.value || '';
    }
  }

  return result;
}

/**
 * Interpolate template string with payload values
 */
function interpolateTemplate(template: string, payload: Record<string, any>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    const value = getNestedValue(payload, path.trim());
    return value !== null && value !== undefined ? String(value) : '';
  });
}

/**
 * Main function to dispatch an event to all matching automations
 */
export async function dispatchIntegrationEvent(
  userId: number,
  eventType: WebhookEventType,
  data: Record<string, any>
): Promise<void> {
  try {
    // Build full event payload
    const eventPayload: EventPayload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      data
    };

    // Find all active automations for this user and event type
    const automations = await db
      .select()
      .from(integrationAutomations)
      .where(and(
        eq(integrationAutomations.userId, userId),
        eq(integrationAutomations.triggerEvent, eventType),
        eq(integrationAutomations.isActive, true)
      ));

    if (automations.length === 0) {
      return; // No matching automations
    }

    // Process each automation
    await Promise.all(
      automations.map(automation => processAutomation(automation, eventPayload))
    );
  } catch (error) {
    console.error('Error dispatching integration event:', error);
    // Don't throw - integration failures shouldn't break the main flow
  }
}

/**
 * Process a single automation
 */
async function processAutomation(
  automation: IntegrationAutomation,
  eventPayload: EventPayload
): Promise<void> {
  const eventId = generateEventId();

  // Check rate limiting
  if (await isRateLimited(automation.id, automation.userId)) {
    console.warn(`Automation ${automation.id} rate limited`);
    return;
  }

  // Check condition if present
  if (automation.triggerCondition) {
    const condition = automation.triggerCondition as TriggerCondition;
    if (!evaluateCondition(condition, eventPayload)) {
      // Log skipped run
      await db.insert(integrationAutomationRuns).values({
        automationId: automation.id,
        connectionId: automation.connectionId,
        eventType: eventPayload.event,
        eventId,
        eventPayload: eventPayload as any,
        status: 'skipped',
        skippedReason: `Condition not met: ${condition.field} ${condition.operator} ${condition.value || ''}`,
        createdAt: new Date(),
      });
      return;
    }
  }

  // Get connection if needed
  let connection: IntegrationConnection | null = null;
  if (automation.connectionId) {
    const [conn] = await db
      .select()
      .from(integrationConnections)
      .where(eq(integrationConnections.id, automation.connectionId));
    connection = conn || null;

    // Check connection is active
    if (connection && connection.status !== 'active') {
      await db.insert(integrationAutomationRuns).values({
        automationId: automation.id,
        connectionId: automation.connectionId,
        eventType: eventPayload.event,
        eventId,
        eventPayload: eventPayload as any,
        status: 'failed',
        errorMessage: `Connection is ${connection.status}. Please reconnect.`,
        createdAt: new Date(),
      });
      return;
    }
  }

  // Apply field mappings
  const fieldMappings = (automation.fieldMappings || []) as FieldMapping[];
  const mappedPayload = applyFieldMappings(fieldMappings, eventPayload);

  // Create run record
  const [run] = await db.insert(integrationAutomationRuns).values({
    automationId: automation.id,
    connectionId: automation.connectionId,
    eventType: eventPayload.event,
    eventId,
    eventPayload: eventPayload as any,
    requestPayload: mappedPayload as any,
    status: 'running',
    attemptCount: 1,
    startedAt: new Date(),
    createdAt: new Date(),
  }).returning();

  // Execute the automation
  const startTime = Date.now();
  const result = await executeAutomation(connection, automation, mappedPayload, eventPayload);
  const durationMs = Date.now() - startTime;

  // Update run record with result
  if (result.success) {
    await db.update(integrationAutomationRuns)
      .set({
        status: 'success',
        responseStatus: result.statusCode,
        responseBody: result.responseBody,
        externalId: result.externalId,
        externalUrl: result.externalUrl,
        fileUploaded: result.fileUploaded || false,
        fileName: result.fileName,
        fileSize: result.fileSize,
        completedAt: new Date(),
        durationMs,
      })
      .where(eq(integrationAutomationRuns.id, run.id));

    // Update automation stats
    await db.update(integrationAutomations)
      .set({
        totalRuns: automation.totalRuns + 1,
        successfulRuns: automation.successfulRuns + 1,
        lastRunAt: new Date(),
        lastSuccessAt: new Date(),
      })
      .where(eq(integrationAutomations.id, automation.id));

    // Update connection last used
    if (connection) {
      await db.update(integrationConnections)
        .set({
          lastUsedAt: new Date(),
          errorCount: 0,
        })
        .where(eq(integrationConnections.id, connection.id));
    }
  } else {
    // Handle failure - schedule retry
    const nextRetryAt = new Date(Date.now() + RETRY_DELAYS[0]);

    await db.update(integrationAutomationRuns)
      .set({
        status: 'failed',
        responseStatus: result.statusCode,
        responseBody: result.responseBody,
        errorMessage: result.error,
        nextRetryAt,
        completedAt: new Date(),
        durationMs,
      })
      .where(eq(integrationAutomationRuns.id, run.id));

    // Update automation stats
    await db.update(integrationAutomations)
      .set({
        totalRuns: automation.totalRuns + 1,
        failedRuns: automation.failedRuns + 1,
        lastRunAt: new Date(),
        lastFailureAt: new Date(),
      })
      .where(eq(integrationAutomations.id, automation.id));

    // Update connection error count
    if (connection) {
      const newErrorCount = (connection.errorCount || 0) + 1;
      await db.update(integrationConnections)
        .set({
          lastError: result.error,
          errorCount: newErrorCount,
          status: newErrorCount >= 10 ? 'error' : connection.status,
        })
        .where(eq(integrationConnections.id, connection.id));
    }
  }
}

/**
 * Execute an automation using the appropriate provider
 */
async function executeAutomation(
  connection: IntegrationConnection | null,
  automation: IntegrationAutomation,
  mappedPayload: Record<string, any>,
  eventPayload: EventPayload
): Promise<ExecutionResult> {
  const provider = getProviderForDestination(automation.destinationType as any);

  if (!provider) {
    return {
      success: false,
      error: `No provider found for destination type: ${automation.destinationType}`
    };
  }

  try {
    return await provider.execute(connection, automation, mappedPayload, eventPayload as any);
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Unknown error during execution'
    };
  }
}

/**
 * Manually retry a failed run
 */
export async function retryRun(runId: number): Promise<ExecutionResult> {
  // Get the run
  const [run] = await db
    .select()
    .from(integrationAutomationRuns)
    .where(eq(integrationAutomationRuns.id, runId));

  if (!run) {
    return { success: false, error: 'Run not found' };
  }

  // Get the automation
  const [automation] = await db
    .select()
    .from(integrationAutomations)
    .where(eq(integrationAutomations.id, run.automationId));

  if (!automation) {
    return { success: false, error: 'Automation not found' };
  }

  // Get connection if needed
  let connection: IntegrationConnection | null = null;
  if (run.connectionId) {
    const [conn] = await db
      .select()
      .from(integrationConnections)
      .where(eq(integrationConnections.id, run.connectionId));
    connection = conn || null;
  }

  // Re-apply field mappings
  const eventPayload = run.eventPayload as EventPayload;
  const fieldMappings = (automation.fieldMappings || []) as FieldMapping[];
  const mappedPayload = applyFieldMappings(fieldMappings, eventPayload);

  // Update run to running
  await db.update(integrationAutomationRuns)
    .set({
      status: 'running',
      attemptCount: run.attemptCount + 1,
      startedAt: new Date(),
    })
    .where(eq(integrationAutomationRuns.id, runId));

  // Execute
  const startTime = Date.now();
  const result = await executeAutomation(connection, automation, mappedPayload, eventPayload);
  const durationMs = Date.now() - startTime;

  // Update run with result
  if (result.success) {
    await db.update(integrationAutomationRuns)
      .set({
        status: 'success',
        responseStatus: result.statusCode,
        responseBody: result.responseBody,
        externalId: result.externalId,
        externalUrl: result.externalUrl,
        fileUploaded: result.fileUploaded || false,
        fileName: result.fileName,
        fileSize: result.fileSize,
        errorMessage: null,
        nextRetryAt: null,
        completedAt: new Date(),
        durationMs,
      })
      .where(eq(integrationAutomationRuns.id, runId));

    // Update automation stats
    await db.update(integrationAutomations)
      .set({
        successfulRuns: automation.successfulRuns + 1,
        lastSuccessAt: new Date(),
      })
      .where(eq(integrationAutomations.id, automation.id));
  } else {
    // Calculate next retry
    const nextRetryIndex = Math.min(run.attemptCount, RETRY_DELAYS.length - 1);
    const shouldRetry = run.attemptCount < MAX_RETRIES;
    const nextRetryAt = shouldRetry ? new Date(Date.now() + RETRY_DELAYS[nextRetryIndex]) : null;

    await db.update(integrationAutomationRuns)
      .set({
        status: 'failed',
        responseStatus: result.statusCode,
        responseBody: result.responseBody,
        errorMessage: result.error,
        nextRetryAt,
        completedAt: new Date(),
        durationMs,
      })
      .where(eq(integrationAutomationRuns.id, runId));
  }

  return result;
}

/**
 * Test an automation with sample or real event data
 */
export async function testAutomation(
  automationId: number,
  options: {
    eventId?: string;      // Use a specific past event
    useSample?: boolean;   // Use sample test data
    dryRun?: boolean;      // Preview only, don't actually send
  } = {}
): Promise<{ success: boolean; result?: ExecutionResult; preview?: Record<string, any> }> {
  // Get the automation
  const [automation] = await db
    .select()
    .from(integrationAutomations)
    .where(eq(integrationAutomations.id, automationId));

  if (!automation) {
    return { success: false, result: { success: false, error: 'Automation not found' } };
  }

  // Build test event payload
  let eventPayload: EventPayload;

  if (options.eventId) {
    // Use a past event
    const [pastRun] = await db
      .select()
      .from(integrationAutomationRuns)
      .where(eq(integrationAutomationRuns.eventId, options.eventId));

    if (!pastRun) {
      return { success: false, result: { success: false, error: 'Event not found' } };
    }

    eventPayload = pastRun.eventPayload as EventPayload;
  } else {
    // Use sample data
    eventPayload = buildSamplePayload(automation.triggerEvent as WebhookEventType);
  }

  // Apply field mappings
  const fieldMappings = (automation.fieldMappings || []) as FieldMapping[];
  const mappedPayload = applyFieldMappings(fieldMappings, eventPayload);

  // If dry run, just return the preview
  if (options.dryRun) {
    return {
      success: true,
      preview: {
        event: eventPayload,
        mappedPayload,
        destinationType: automation.destinationType,
      }
    };
  }

  // Get connection if needed
  let connection: IntegrationConnection | null = null;
  if (automation.connectionId) {
    const [conn] = await db
      .select()
      .from(integrationConnections)
      .where(eq(integrationConnections.id, automation.connectionId));
    connection = conn || null;
  }

  // Execute
  const result = await executeAutomation(connection, automation, mappedPayload, eventPayload);

  // Log the test run
  await db.insert(integrationAutomationRuns).values({
    automationId: automation.id,
    connectionId: automation.connectionId,
    eventType: eventPayload.event,
    eventId: generateEventId(),
    eventPayload: { ...eventPayload, test: true } as any,
    requestPayload: mappedPayload as any,
    status: result.success ? 'success' : 'failed',
    responseStatus: result.statusCode,
    responseBody: result.responseBody,
    externalId: result.externalId,
    externalUrl: result.externalUrl,
    errorMessage: result.error,
    fileUploaded: result.fileUploaded || false,
    fileName: result.fileName,
    fileSize: result.fileSize,
    attemptCount: 1,
    startedAt: new Date(),
    completedAt: new Date(),
    createdAt: new Date(),
  });

  return { success: result.success, result };
}

/**
 * Build sample payload for testing
 */
function buildSamplePayload(eventType: WebhookEventType): EventPayload {
  const basePayload = {
    event: eventType,
    timestamp: new Date().toISOString(),
    test: true,
    data: {} as Record<string, any>
  };

  switch (eventType) {
    case 'cim.created':
    case 'cim.updated':
    case 'cim.published':
      basePayload.data = {
        cim_id: 'test_123',
        title: 'Sample Business CIM',
        created_at: new Date().toISOString()
      };
      break;

    case 'cim.viewed':
    case 'cim.downloaded':
      basePayload.data = {
        cim_id: 'test_123',
        title: 'Sample Business CIM',
        viewer_email: 'viewer@example.com',
        viewer_name: 'Jane Smith',
        viewed_at: new Date().toISOString()
      };
      break;

    case 'nda.sent':
    case 'nda.signed':
    case 'nda.declined':
      basePayload.data = {
        nda_id: 'test_nda_456',
        cim_id: 'test_123',
        cim_title: 'Sample Business CIM',
        signer_email: 'signer@example.com',
        signer_name: 'John Doe',
        signed_at: new Date().toISOString(),
        signed_document_url: 'https://example.com/sample-signed-nda.pdf'
      };
      break;

    case 'esign.envelope_completed':
      basePayload.data = {
        envelope_id: 'env_test_789',
        title: 'Sample Agreement',
        completed_at: new Date().toISOString(),
        signed_document_url: 'https://example.com/sample-signed-doc.pdf',
        recipients: [
          { name: 'John Doe', email: 'john@example.com', role: 'signer', signed_at: new Date().toISOString() },
          { name: 'Jane Smith', email: 'jane@example.com', role: 'signer', signed_at: new Date().toISOString() }
        ]
      };
      break;

    case 'contact.created':
    case 'contact.updated':
    case 'contact.deleted':
      basePayload.data = {
        contact_id: 'test_contact_101',
        email: 'contact@example.com',
        name: 'Sample Contact',
        status: 'interested'
      };
      break;

    case 'message.received':
    case 'message.sent':
      basePayload.data = {
        message_id: 'test_msg_202',
        thread_id: 'test_thread_303',
        sender_email: 'sender@example.com',
        sender_name: 'Test Sender',
        subject: 'Inquiry about your listing'
      };
      break;

    case 'dataroom.file_uploaded':
    case 'dataroom.file_viewed':
    case 'dataroom.access_granted':
      basePayload.data = {
        file_id: 'test_file_404',
        file_name: 'financial_summary.pdf',
        cim_id: 'test_123',
        user_email: 'user@example.com'
      };
      break;
  }

  return basePayload;
}

/**
 * Process pending retries (called by background job)
 */
export async function processRetries(): Promise<void> {
  // This would be called by a cron job or background worker
  // For now, we'll implement basic retry processing

  const pendingRetries = await db
    .select()
    .from(integrationAutomationRuns)
    .where(and(
      eq(integrationAutomationRuns.status, 'failed'),
      // nextRetryAt is in the past
    ))
    .limit(100);

  for (const run of pendingRetries) {
    if (run.nextRetryAt && new Date(run.nextRetryAt) <= new Date()) {
      await retryRun(run.id);
    }
  }
}
