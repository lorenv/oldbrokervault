/**
 * Activity Actions
 *
 * Handles internal actions related to activity logging:
 * - log_activity: Log an activity (call, email, meeting, etc.)
 */

import { db } from '../../../../db';
import { crmActivities } from '@shared/schema';
import type { ExecutionResult } from '../../../types';
import type { DestinationType } from '@shared/schema';
import type { ActionContext, LogActivityConfig } from '../types';
import { resolveTemplate, getNestedValue } from '../types';

export async function executeActivityActions(
  destinationType: DestinationType,
  config: Record<string, any>,
  mappedPayload: Record<string, any>,
  eventPayload: Record<string, any>,
  context: ActionContext
): Promise<ExecutionResult> {
  switch (destinationType) {
    case 'internal_log_activity':
      return executeLogActivity(config as LogActivityConfig, mappedPayload, eventPayload, context);
    default:
      return { success: false, error: `Unknown activity action: ${destinationType}` };
  }
}

/**
 * Log an activity
 */
async function executeLogActivity(
  config: LogActivityConfig,
  mappedPayload: Record<string, any>,
  eventPayload: Record<string, any>,
  context: ActionContext
): Promise<ExecutionResult> {
  // Resolve template variables
  const subject = resolveTemplate(config.subject, eventPayload);
  const description = config.description ? resolveTemplate(config.description, eventPayload) : undefined;

  if (!subject) {
    return { success: false, error: 'Activity subject is required' };
  }

  if (!config.activityType) {
    return { success: false, error: 'Activity type is required' };
  }

  // Determine which entity to link the activity to
  let objectType = 'contact';
  let objectId: number | null = null;

  if (config.contactIdField) {
    objectId = getNestedValue(eventPayload, config.contactIdField);
  } else if (config.linkToContact !== false) {
    objectId = getNestedValue(eventPayload, 'data.contact_id') ||
               getNestedValue(mappedPayload, 'contact_id');
  }

  // If no contact, try to link to a deal
  if (!objectId) {
    const dealId = getNestedValue(eventPayload, 'data.deal_id') ||
                   getNestedValue(mappedPayload, 'deal_id');
    if (dealId) {
      objectType = 'deal';
      objectId = dealId;
    }
  }

  try {
    const [activity] = await db.insert(crmActivities)
      .values({
        organizationId: context.organizationId,
        activityType: config.activityType,
        objectType,
        objectId: objectId || 0,
        performedBy: context.userId,
        title: subject,
        description,
        metadata: {
          outcome: config.outcome,
          createdByAutomation: true,
          automationEvent: context.triggeredByEvent,
        },
      })
      .returning({ id: crmActivities.id });

    return {
      success: true,
      externalId: String(activity.id),
      responseBody: JSON.stringify({
        logged: true,
        activityId: activity.id,
        activityType: config.activityType,
        subject,
        objectType,
        objectId,
      }),
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
