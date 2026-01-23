/**
 * Task Actions
 *
 * Handles internal actions related to tasks:
 * - create_task: Create a new task
 */

import { db } from '../../../../db';
import { crmActivities } from '@shared/schema';
import type { ExecutionResult } from '../../../types';
import type { DestinationType } from '@shared/schema';
import type { ActionContext, CreateTaskConfig } from '../types';
import { resolveTemplate, getNestedValue } from '../types';

export async function executeTaskActions(
  destinationType: DestinationType,
  config: Record<string, any>,
  mappedPayload: Record<string, any>,
  eventPayload: Record<string, any>,
  context: ActionContext
): Promise<ExecutionResult> {
  switch (destinationType) {
    case 'internal_create_task':
      return executeCreateTask(config as CreateTaskConfig, mappedPayload, eventPayload, context);
    default:
      return { success: false, error: `Unknown task action: ${destinationType}` };
  }
}

/**
 * Create a new task
 * Tasks are stored as CRM activities with type 'task'
 */
async function executeCreateTask(
  config: CreateTaskConfig,
  mappedPayload: Record<string, any>,
  eventPayload: Record<string, any>,
  context: ActionContext
): Promise<ExecutionResult> {
  // Resolve template variables in title and description
  const title = resolveTemplate(config.title, eventPayload);
  const description = config.description ? resolveTemplate(config.description, eventPayload) : null;

  if (!title) {
    return { success: false, error: 'Task title is required' };
  }

  // Determine what entity to link the task to
  let objectType = 'contact';
  let objectId: number | null = null;

  if (config.linkToContact !== false) {
    objectId = getNestedValue(eventPayload, 'data.contact_id') ||
               getNestedValue(mappedPayload, 'contact_id');
  }

  if (config.linkToEntity) {
    objectType = config.linkToEntity.type;
    if (config.linkToEntity.idField) {
      objectId = getNestedValue(eventPayload, config.linkToEntity.idField);
    }
  }

  // Calculate due date
  let dueDate: Date | null = null;
  if (config.dueInDays) {
    dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + config.dueInDays);
  }

  try {
    const [activity] = await db.insert(crmActivities)
      .values({
        organizationId: context.organizationId,
        activityType: 'task',
        objectType: objectType,
        objectId: objectId || 0,
        performedBy: config.assigneeId || context.userId,
        title,
        description,
        metadata: {
          priority: config.priority || 'medium',
          status: 'pending',
          dueDate: dueDate?.toISOString(),
          assigneeId: config.assigneeId,
          assigneeName: config.assigneeName,
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
        taskId: activity.id,
        title,
        dueDate: dueDate?.toISOString(),
      }),
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
