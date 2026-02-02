/**
 * Note Actions
 *
 * Handles internal actions related to notes:
 * - add_note: Add a note to a contact/deal
 */

import { db } from '../../../../db';
import { crmActivities } from '@shared/schema';
import type { ExecutionResult } from '../../../types';
import type { DestinationType } from '@shared/schema';
import type { ActionContext, AddNoteConfig } from '../types';
import { resolveTemplate, getNestedValue } from '../types';

export async function executeNoteActions(
  destinationType: DestinationType,
  config: Record<string, any>,
  mappedPayload: Record<string, any>,
  eventPayload: Record<string, any>,
  context: ActionContext
): Promise<ExecutionResult> {
  switch (destinationType) {
    case 'internal_add_note':
      return executeAddNote(config as AddNoteConfig, mappedPayload, eventPayload, context);
    default:
      return { success: false, error: `Unknown note action: ${destinationType}` };
  }
}

/**
 * Add a note to a contact
 */
async function executeAddNote(
  config: AddNoteConfig,
  mappedPayload: Record<string, any>,
  eventPayload: Record<string, any>,
  context: ActionContext
): Promise<ExecutionResult> {
  // Resolve template variables in content
  const content = resolveTemplate(config.content, eventPayload);

  if (!content) {
    return { success: false, error: 'Note content is required' };
  }

  // Get the contact ID to link the note to
  let contactId: number | null = null;

  if (config.contactIdField) {
    contactId = getNestedValue(eventPayload, config.contactIdField);
  } else if (config.linkToContact !== false) {
    contactId = getNestedValue(eventPayload, 'data.contact_id') ||
                getNestedValue(mappedPayload, 'contact_id');
  }

  try {
    const [activity] = await db.insert(crmActivities)
      .values({
        organizationId: context.organizationId,
        activityType: 'note',
        objectType: 'contact',
        objectId: contactId || 0,
        performedBy: context.userId,
        description: content,
        metadata: {
          createdByAutomation: true,
          automationEvent: context.triggeredByEvent,
        },
      })
      .returning({ id: crmActivities.id });

    return {
      success: true,
      externalId: String(activity.id),
      responseBody: JSON.stringify({
        created: true,
        noteId: activity.id,
        contactId,
      }),
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
