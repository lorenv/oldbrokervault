/**
 * Contact Actions
 *
 * Handles internal actions related to contacts:
 * - update_stage: Move contact to a different stage
 * - assign_owner: Assign a user as the contact owner
 * - add_tag: Add a tag to a contact (stores in customProperties)
 * - remove_tag: Remove a tag from a contact
 * - update_field: Update a custom field value
 * - create_contact: Create a new contact
 */

import { db } from '../../../../db';
import { crmContacts } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import type { ExecutionResult } from '../../../types';
import type { DestinationType } from '@shared/schema';
import type {
  ActionContext,
  UpdateStageConfig,
  AssignOwnerConfig,
  AddTagConfig,
  RemoveTagConfig,
  UpdateFieldConfig,
  CreateContactConfig,
} from '../types';
import { resolveTemplate, getNestedValue } from '../types';

export async function executeContactActions(
  destinationType: DestinationType,
  config: Record<string, any>,
  mappedPayload: Record<string, any>,
  eventPayload: Record<string, any>,
  context: ActionContext
): Promise<ExecutionResult> {
  switch (destinationType) {
    case 'internal_update_stage':
      return executeUpdateStage(config as UpdateStageConfig, mappedPayload, eventPayload, context);
    case 'internal_assign_owner':
      return executeAssignOwner(config as AssignOwnerConfig, mappedPayload, eventPayload, context);
    case 'internal_add_tag':
      return executeAddTag(config as AddTagConfig, mappedPayload, eventPayload, context);
    case 'internal_remove_tag':
      return executeRemoveTag(config as RemoveTagConfig, mappedPayload, eventPayload, context);
    case 'internal_update_field':
      return executeUpdateField(config as UpdateFieldConfig, mappedPayload, eventPayload, context);
    case 'internal_create_contact':
      return executeCreateContact(config as CreateContactConfig, mappedPayload, eventPayload, context);
    default:
      return { success: false, error: `Unknown contact action: ${destinationType}` };
  }
}

/**
 * Update a contact's stage
 */
async function executeUpdateStage(
  config: UpdateStageConfig,
  mappedPayload: Record<string, any>,
  eventPayload: Record<string, any>,
  context: ActionContext
): Promise<ExecutionResult> {
  const contactId = getNestedValue(eventPayload, 'data.contact_id') ||
                    getNestedValue(mappedPayload, 'contact_id');

  if (!contactId) {
    return { success: false, error: 'No contact_id found in event payload' };
  }

  if (!config.stageId) {
    return { success: false, error: 'Stage ID is required' };
  }

  try {
    // CRM contacts use lifecycleStage instead of stageId
    // Convert stage ID to stage name if needed
    const stageName = config.stageName || `stage_${config.stageId}`;

    const result = await db.update(crmContacts)
      .set({
        lifecycleStage: stageName,
        updatedAt: new Date(),
      })
      .where(and(
        eq(crmContacts.id, contactId),
        eq(crmContacts.organizationId, context.organizationId)
      ))
      .returning({ id: crmContacts.id });

    if (result.length === 0) {
      return { success: false, error: 'Contact not found or access denied' };
    }

    return {
      success: true,
      externalId: String(contactId),
      responseBody: JSON.stringify({ updated: true, lifecycleStage: stageName }),
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Assign an owner to a contact
 */
async function executeAssignOwner(
  config: AssignOwnerConfig,
  mappedPayload: Record<string, any>,
  eventPayload: Record<string, any>,
  context: ActionContext
): Promise<ExecutionResult> {
  const contactId = getNestedValue(eventPayload, 'data.contact_id') ||
                    getNestedValue(mappedPayload, 'contact_id');

  if (!contactId) {
    return { success: false, error: 'No contact_id found in event payload' };
  }

  if (!config.userId) {
    return { success: false, error: 'User ID is required' };
  }

  try {
    const result = await db.update(crmContacts)
      .set({
        ownerId: config.userId,
        updatedAt: new Date(),
      })
      .where(and(
        eq(crmContacts.id, contactId),
        eq(crmContacts.organizationId, context.organizationId)
      ))
      .returning({ id: crmContacts.id });

    if (result.length === 0) {
      return { success: false, error: 'Contact not found or access denied' };
    }

    return {
      success: true,
      externalId: String(contactId),
      responseBody: JSON.stringify({ updated: true, ownerId: config.userId }),
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Add a tag to a contact
 * Note: CRM contacts have a native tags array field
 */
async function executeAddTag(
  config: AddTagConfig,
  mappedPayload: Record<string, any>,
  eventPayload: Record<string, any>,
  context: ActionContext
): Promise<ExecutionResult> {
  const contactId = getNestedValue(eventPayload, 'data.contact_id') ||
                    getNestedValue(mappedPayload, 'contact_id');

  if (!contactId) {
    return { success: false, error: 'No contact_id found in event payload' };
  }

  const tagName = resolveTemplate(config.tagName, eventPayload);
  if (!tagName) {
    return { success: false, error: 'Tag name is required' };
  }

  try {
    // Get current contact to access tags array
    const contact = await db.query.crmContacts.findFirst({
      where: and(
        eq(crmContacts.id, contactId),
        eq(crmContacts.organizationId, context.organizationId)
      ),
    });

    if (!contact) {
      return { success: false, error: 'Contact not found or access denied' };
    }

    // Use the native tags array field
    const currentTags = contact.tags || [];

    if (!currentTags.includes(tagName)) {
      const newTags = [...currentTags, tagName];

      await db.update(crmContacts)
        .set({
          tags: newTags,
          updatedAt: new Date(),
        })
        .where(eq(crmContacts.id, contactId));
    }

    return {
      success: true,
      externalId: String(contactId),
      responseBody: JSON.stringify({ tagAdded: tagName }),
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Remove a tag from a contact
 */
async function executeRemoveTag(
  config: RemoveTagConfig,
  mappedPayload: Record<string, any>,
  eventPayload: Record<string, any>,
  context: ActionContext
): Promise<ExecutionResult> {
  const contactId = getNestedValue(eventPayload, 'data.contact_id') ||
                    getNestedValue(mappedPayload, 'contact_id');

  if (!contactId) {
    return { success: false, error: 'No contact_id found in event payload' };
  }

  const tagName = resolveTemplate(config.tagName, eventPayload);
  if (!tagName) {
    return { success: false, error: 'Tag name is required' };
  }

  try {
    // Get current contact
    const contact = await db.query.crmContacts.findFirst({
      where: and(
        eq(crmContacts.id, contactId),
        eq(crmContacts.organizationId, context.organizationId)
      ),
    });

    if (!contact) {
      return { success: false, error: 'Contact not found or access denied' };
    }

    // Use the native tags array field
    const currentTags = contact.tags || [];
    const newTags = currentTags.filter((t: string) => t !== tagName);

    if (newTags.length !== currentTags.length) {
      await db.update(crmContacts)
        .set({
          tags: newTags,
          updatedAt: new Date(),
        })
        .where(eq(crmContacts.id, contactId));
    }

    return {
      success: true,
      externalId: String(contactId),
      responseBody: JSON.stringify({ tagRemoved: tagName }),
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Update a custom field value on a contact
 * Note: Custom fields are stored in the contact's customProperties JSON field
 */
async function executeUpdateField(
  config: UpdateFieldConfig,
  mappedPayload: Record<string, any>,
  eventPayload: Record<string, any>,
  context: ActionContext
): Promise<ExecutionResult> {
  const contactId = getNestedValue(eventPayload, 'data.contact_id') ||
                    getNestedValue(mappedPayload, 'contact_id');

  if (!contactId) {
    return { success: false, error: 'No contact_id found in event payload' };
  }

  if (!config.fieldId && !config.fieldName) {
    return { success: false, error: 'Field ID or name is required' };
  }

  // Resolve the value based on valueType
  let value: string;
  switch (config.valueType) {
    case 'template':
      value = resolveTemplate(config.value, eventPayload);
      break;
    case 'from_event':
      value = String(getNestedValue(eventPayload, config.eventField || '') || '');
      break;
    case 'static':
    default:
      value = config.value;
  }

  try {
    // Get current contact
    const contact = await db.query.crmContacts.findFirst({
      where: and(
        eq(crmContacts.id, contactId),
        eq(crmContacts.organizationId, context.organizationId)
      ),
    });

    if (!contact) {
      return { success: false, error: 'Contact not found or access denied' };
    }

    // Update field in customProperties
    const customProperties = (contact.customProperties as Record<string, any>) || {};
    const fieldKey = config.fieldName || `field_${config.fieldId}`;
    customProperties[fieldKey] = value;

    await db.update(crmContacts)
      .set({
        customProperties,
        updatedAt: new Date(),
      })
      .where(eq(crmContacts.id, contactId));

    return {
      success: true,
      externalId: String(contactId),
      responseBody: JSON.stringify({ fieldUpdated: fieldKey, value }),
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Create a new contact
 */
async function executeCreateContact(
  config: CreateContactConfig,
  mappedPayload: Record<string, any>,
  eventPayload: Record<string, any>,
  context: ActionContext
): Promise<ExecutionResult> {
  // Resolve field values
  const resolveField = (fieldName: string): string | undefined => {
    const source = config.fieldSources?.[fieldName];
    if (!source) {
      return (config as any)[fieldName];
    }

    switch (source.type) {
      case 'template':
        return resolveTemplate(source.value, eventPayload);
      case 'from_event':
        return String(getNestedValue(eventPayload, source.value) || '');
      case 'static':
      default:
        return source.value;
    }
  };

  const email = resolveField('email');
  if (!email) {
    return { success: false, error: 'Email is required to create a contact' };
  }

  try {
    // Check if contact already exists
    const existingContact = await db.query.crmContacts.findFirst({
      where: and(
        eq(crmContacts.email, email),
        eq(crmContacts.organizationId, context.organizationId)
      ),
    });

    if (existingContact) {
      return {
        success: true,
        externalId: String(existingContact.id),
        responseBody: JSON.stringify({ message: 'Contact already exists', contactId: existingContact.id }),
      };
    }

    // Create new contact
    const firstName = resolveField('firstName') || null;
    const lastName = resolveField('lastName') || null;

    // Prepare values for insert
    const insertValues: any = {
      email,
      firstName,
      lastName,
      organizationId: context.organizationId,
      source: 'automation',
      customProperties: config.customFields || {},
    };

    // Add optional fields if provided
    if (config.ownerId) {
      insertValues.ownerId = config.ownerId;
    }
    if (config.stageId) {
      // Map stageId to lifecycleStage name
      insertValues.lifecycleStage = `stage_${config.stageId}`;
    }
    if (config.tags && config.tags.length > 0) {
      insertValues.tags = config.tags;
    }

    const [newContact] = await db.insert(crmContacts)
      .values(insertValues)
      .returning({ id: crmContacts.id });

    return {
      success: true,
      externalId: String(newContact.id),
      responseBody: JSON.stringify({ created: true, contactId: newContact.id }),
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
