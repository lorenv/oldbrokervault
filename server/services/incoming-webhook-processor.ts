/**
 * Incoming Webhook Processor
 *
 * Processes incoming webhook payloads and creates CRM entities
 * based on configured field mappings.
 */

import * as crypto from 'crypto';
import { db } from '../db';
import {
  incomingWebhooks,
  incomingWebhookLogs,
  crmContacts,
  crmTasks,
  crmNotes,
  companies,
  deals,
  pipelines,
  pipelineStages,
  type IncomingWebhook,
  type IncomingWebhookFieldMapping,
} from '@shared/schema';
import { eq, and } from 'drizzle-orm';

// Generate unique request ID
export function generateRequestId(): string {
  return `req_${crypto.randomBytes(16).toString('hex')}`;
}

// Verify HMAC signature if secret is configured
export function verifySignature(
  payload: string,
  signature: string | undefined,
  secret: string
): boolean {
  if (!signature) return false;

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  // Support both raw and prefixed signatures
  const providedSig = signature.replace(/^sha256=/, '');

  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(providedSig)
  );
}

// Get nested value from object using dot notation (e.g., "contact.email")
function getNestedValue(obj: Record<string, any>, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

// Interpolate template string with payload values (e.g., "Hello {{name}}")
function interpolateTemplate(template: string, payload: Record<string, any>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    const value = getNestedValue(payload, path.trim());
    return value !== null && value !== undefined ? String(value) : '';
  });
}

// Apply field mappings to transform incoming payload
export function applyFieldMappings(
  mappings: IncomingWebhookFieldMapping[],
  payload: Record<string, any>
): Record<string, any> {
  const result: Record<string, any> = {};

  for (const mapping of mappings) {
    let value: any;

    switch (mapping.type) {
      case 'field':
        // Get value from payload using dot notation
        value = getNestedValue(payload, mapping.sourceField || '');
        break;

      case 'constant':
        // Use constant value
        value = mapping.value;
        break;

      case 'template':
        // Interpolate template
        value = interpolateTemplate(mapping.template || '', payload);
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

// Process incoming webhook
export async function processIncomingWebhook(
  webhook: IncomingWebhook,
  payload: Record<string, any>,
  requestId: string,
  sourceIp?: string
): Promise<{
  success: boolean;
  entityType?: string;
  entityId?: number;
  error?: string;
}> {
  const startTime = Date.now();

  // Create log entry
  const [logEntry] = await db.insert(incomingWebhookLogs).values({
    webhookId: webhook.id,
    requestId,
    sourceIp,
    rawPayload: payload as any,
    status: 'pending',
    receivedAt: new Date(),
  }).returning();

  try {
    // Apply field mappings
    const fieldMappings = (webhook.fieldMappings || []) as IncomingWebhookFieldMapping[];
    const mappedData = applyFieldMappings(fieldMappings, payload);

    // Update log with mapped data
    await db.update(incomingWebhookLogs)
      .set({ mappedData: mappedData as any })
      .where(eq(incomingWebhookLogs.id, logEntry.id));

    // Execute the action
    let result: { entityType: string; entityId: number };

    switch (webhook.actionType) {
      case 'create_contact':
        result = await createContact(webhook.organizationId, mappedData);
        break;

      case 'create_deal':
        result = await createDeal(webhook.organizationId, mappedData);
        break;

      case 'create_task':
        result = await createTask(webhook.organizationId, webhook.userId, mappedData);
        break;

      case 'add_note':
        result = await addNote(webhook.organizationId, webhook.userId, mappedData);
        break;

      case 'create_company':
        result = await createCompany(webhook.organizationId, mappedData);
        break;

      default:
        throw new Error(`Unknown action type: ${webhook.actionType}`);
    }

    const processingTimeMs = Date.now() - startTime;

    // Update log entry with success
    await db.update(incomingWebhookLogs)
      .set({
        status: 'success',
        createdEntityType: result.entityType,
        createdEntityId: result.entityId,
        processingTimeMs,
        processedAt: new Date(),
      })
      .where(eq(incomingWebhookLogs.id, logEntry.id));

    // Update webhook stats
    await db.update(incomingWebhooks)
      .set({
        totalReceived: webhook.totalReceived + 1,
        successCount: webhook.successCount + 1,
        lastReceivedAt: new Date(),
        lastSuccessAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(incomingWebhooks.id, webhook.id));

    return {
      success: true,
      entityType: result.entityType,
      entityId: result.entityId,
    };
  } catch (error: any) {
    const processingTimeMs = Date.now() - startTime;

    // Update log entry with failure
    await db.update(incomingWebhookLogs)
      .set({
        status: 'failed',
        errorMessage: error.message || 'Unknown error',
        processingTimeMs,
        processedAt: new Date(),
      })
      .where(eq(incomingWebhookLogs.id, logEntry.id));

    // Update webhook stats
    await db.update(incomingWebhooks)
      .set({
        totalReceived: webhook.totalReceived + 1,
        errorCount: webhook.errorCount + 1,
        lastReceivedAt: new Date(),
        lastErrorAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(incomingWebhooks.id, webhook.id));

    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

// Create a contact
async function createContact(
  organizationId: number,
  data: Record<string, any>
): Promise<{ entityType: string; entityId: number }> {
  // Validate required fields
  if (!data.email) {
    throw new Error('Email is required to create a contact');
  }

  // Parse name if provided as full name
  let firstName = data.firstName || '';
  let lastName = data.lastName || '';

  if (!firstName && !lastName && data.name) {
    const nameParts = data.name.split(' ');
    firstName = nameParts[0] || '';
    lastName = nameParts.slice(1).join(' ') || '';
  }

  const [newContact] = await db.insert(crmContacts).values({
    organizationId,
    email: data.email,
    firstName,
    lastName,
    phone: data.phone || null,
    title: data.title || null,
    notes: data.notes || null,
    source: 'incoming_webhook',
    leadStatus: 'new',
    contactType: 'buyer',
  }).returning();

  return { entityType: 'contact', entityId: newContact.id };
}

// Create a deal
async function createDeal(
  organizationId: number,
  data: Record<string, any>
): Promise<{ entityType: string; entityId: number }> {
  // Validate required fields
  if (!data.name) {
    throw new Error('Name is required to create a deal');
  }

  // Get default pipeline and stage if not specified
  let pipelineId = data.pipelineId;
  let stageId = data.stageId;

  if (!pipelineId) {
    const [defaultPipeline] = await db
      .select()
      .from(pipelines)
      .where(and(
        eq(pipelines.organizationId, organizationId),
        eq(pipelines.isDefault, true)
      ));

    if (defaultPipeline) {
      pipelineId = defaultPipeline.id;

      if (!stageId) {
        const [firstStage] = await db
          .select()
          .from(pipelineStages)
          .where(eq(pipelineStages.pipelineId, defaultPipeline.id))
          .orderBy(pipelineStages.order);

        if (firstStage) {
          stageId = firstStage.id;
        }
      }
    }
  }

  if (!pipelineId || !stageId) {
    throw new Error('Could not find default pipeline/stage. Please configure a default pipeline.');
  }

  // Parse amount if provided
  let amount = null;
  if (data.amount) {
    amount = typeof data.amount === 'number' ? data.amount : parseFloat(data.amount);
    if (isNaN(amount)) amount = null;
  }

  // Parse close date if provided
  let closeDate = null;
  if (data.closeDate) {
    const parsed = new Date(data.closeDate);
    if (!isNaN(parsed.getTime())) {
      closeDate = parsed;
    }
  }

  const [newDeal] = await db.insert(deals).values({
    organizationId,
    name: data.name,
    pipelineId,
    stageId,
    amount,
    closeDate,
    description: data.description || null,
    source: 'incoming_webhook',
  }).returning();

  return { entityType: 'deal', entityId: newDeal.id };
}

// Create a task
async function createTask(
  organizationId: number,
  userId: number,
  data: Record<string, any>
): Promise<{ entityType: string; entityId: number }> {
  // Validate required fields
  if (!data.title) {
    throw new Error('Title is required to create a task');
  }

  // Parse due date if provided
  let dueDate = null;
  if (data.dueDate) {
    const parsed = new Date(data.dueDate);
    if (!isNaN(parsed.getTime())) {
      dueDate = parsed;
    }
  }

  const [newTask] = await db.insert(crmTasks).values({
    organizationId,
    createdBy: userId,
    assignedTo: userId, // Assign to webhook owner by default
    title: data.title,
    description: data.description || null,
    dueDate,
    status: 'pending',
    priority: data.priority || 'medium',
    objectType: data.objectType || null,
    objectId: data.objectId ? parseInt(data.objectId) : null,
  }).returning();

  return { entityType: 'task', entityId: newTask.id };
}

// Add a note
async function addNote(
  organizationId: number,
  userId: number,
  data: Record<string, any>
): Promise<{ entityType: string; entityId: number }> {
  // Validate required fields
  if (!data.content) {
    throw new Error('Content is required to add a note');
  }
  if (!data.objectType) {
    throw new Error('Object type is required to add a note');
  }
  if (!data.objectId) {
    throw new Error('Object ID is required to add a note');
  }

  const validObjectTypes = ['contact', 'deal', 'company'];
  if (!validObjectTypes.includes(data.objectType)) {
    throw new Error(`Object type must be one of: ${validObjectTypes.join(', ')}`);
  }

  const [newNote] = await db.insert(crmNotes).values({
    organizationId,
    authorId: userId,
    content: data.content,
    objectType: data.objectType,
    objectId: parseInt(data.objectId),
  }).returning();

  return { entityType: 'note', entityId: newNote.id };
}

// Create a company
async function createCompany(
  organizationId: number,
  data: Record<string, any>
): Promise<{ entityType: string; entityId: number }> {
  // Validate required fields
  if (!data.name) {
    throw new Error('Name is required to create a company');
  }

  const [newCompany] = await db.insert(companies).values({
    organizationId,
    name: data.name,
    domain: data.domain || null,
    website: data.website || null,
    industry: data.industry || null,
    description: data.description || null,
  }).returning();

  return { entityType: 'company', entityId: newCompany.id };
}
