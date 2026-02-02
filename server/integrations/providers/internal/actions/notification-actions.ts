/**
 * Notification Actions
 *
 * Handles internal actions related to notifications:
 * - send_notification: Send an in-app notification to users
 */

import { db } from '../../../../db';
import { notifications, organizationMembers, users } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import type { ExecutionResult } from '../../../types';
import type { DestinationType } from '@shared/schema';
import type { ActionContext, SendNotificationConfig } from '../types';
import { resolveTemplate, getNestedValue } from '../types';

export async function executeNotificationActions(
  destinationType: DestinationType,
  config: Record<string, any>,
  mappedPayload: Record<string, any>,
  eventPayload: Record<string, any>,
  context: ActionContext
): Promise<ExecutionResult> {
  switch (destinationType) {
    case 'internal_send_notification':
      return executeSendNotification(config as SendNotificationConfig, mappedPayload, eventPayload, context);
    default:
      return { success: false, error: `Unknown notification action: ${destinationType}` };
  }
}

/**
 * Send an in-app notification
 */
async function executeSendNotification(
  config: SendNotificationConfig,
  mappedPayload: Record<string, any>,
  eventPayload: Record<string, any>,
  context: ActionContext
): Promise<ExecutionResult> {
  // Resolve template variables
  const title = resolveTemplate(config.title, eventPayload);
  const message = resolveTemplate(config.message, eventPayload);
  const link = config.link ? resolveTemplate(config.link, eventPayload) : undefined;

  if (!title || !message) {
    return { success: false, error: 'Title and message are required' };
  }

  // Determine recipients based on recipientType
  let recipientUserIds: number[] = [];

  try {
    switch (config.recipientType) {
      case 'user':
        if (config.recipientUserId) {
          recipientUserIds = [config.recipientUserId];
        }
        break;

      case 'owner':
        // Get the contact's assigned owner
        const ownerId = getNestedValue(eventPayload, 'data.assigned_user_id') ||
                       getNestedValue(eventPayload, 'data.owner_id');
        if (ownerId) {
          recipientUserIds = [ownerId];
        }
        break;

      case 'role':
        // Get all users with the specified role in the organization
        if (config.recipientRole) {
          const members = await db.query.organizationMembers.findMany({
            where: and(
              eq(organizationMembers.organizationId, context.organizationId),
              eq(organizationMembers.role, config.recipientRole)
            ),
          });
          recipientUserIds = members.map(m => m.userId);
        }
        break;

      case 'all_admins':
        // Get all admin users in the organization
        const admins = await db.query.organizationMembers.findMany({
          where: and(
            eq(organizationMembers.organizationId, context.organizationId),
            eq(organizationMembers.role, 'admin')
          ),
        });
        recipientUserIds = admins.map(m => m.userId);
        break;
    }

    if (recipientUserIds.length === 0) {
      return {
        success: true,
        responseBody: JSON.stringify({ message: 'No recipients found for notification' }),
      };
    }

    // Determine entity type and ID for linking
    let entityType: string | undefined;
    let entityId: number | undefined;

    if (config.linkToEntity) {
      // Try to extract entity info from event payload
      if (getNestedValue(eventPayload, 'data.contact_id')) {
        entityType = 'contact';
        entityId = getNestedValue(eventPayload, 'data.contact_id');
      } else if (getNestedValue(eventPayload, 'data.deal_id')) {
        entityType = 'deal';
        entityId = getNestedValue(eventPayload, 'data.deal_id');
      }
    }

    // Create notifications for each recipient
    const notificationRecords = recipientUserIds.map(userId => ({
      organizationId: context.organizationId,
      userId,
      type: 'automation',
      title,
      message,
      entityType,
      entityId,
      actorId: context.userId,
      isRead: false,
      emailSent: false,
      createdAt: new Date(),
    }));

    const created = await db.insert(notifications)
      .values(notificationRecords)
      .returning({ id: notifications.id });

    return {
      success: true,
      externalId: created.map(n => n.id).join(','),
      responseBody: JSON.stringify({
        sent: true,
        recipientCount: recipientUserIds.length,
        notificationIds: created.map(n => n.id),
      }),
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
