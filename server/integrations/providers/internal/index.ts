/**
 * Internal Actions Provider
 *
 * Provider for executing internal CRM actions as automation destinations.
 * This provider doesn't require external connections - all actions operate
 * within the CRM system itself.
 */

import { BaseProvider } from '../base';
import type { ExecutionResult, FieldSchema } from '../../types';
import type {
  IntegrationConnection,
  IntegrationAutomation,
  IntegrationProvider,
  DestinationType
} from '@shared/schema';

// Import action handlers
import { executeContactActions } from './actions/contact-actions';
import { executeTaskActions } from './actions/task-actions';
import { executeNoteActions } from './actions/note-actions';
import { executeNotificationActions } from './actions/notification-actions';
import { executeEmailActions } from './actions/email-actions';
import { executeDealActions } from './actions/deal-actions';
import { executeActivityActions } from './actions/activity-actions';
import { executeDataRoomActions } from './actions/dataroom-actions';
import type { ActionContext } from './types';

// Internal destination types
const INTERNAL_DESTINATION_TYPES: DestinationType[] = [
  'internal_update_stage',
  'internal_create_task',
  'internal_assign_owner',
  'internal_add_tag',
  'internal_remove_tag',
  'internal_update_field',
  'internal_send_notification',
  'internal_add_note',
  'internal_send_email',
  'internal_create_contact',
  'internal_create_deal',
  'internal_move_deal_stage',
  'internal_log_activity',
  'internal_grant_dataroom_access',
  'internal_send_nda',
];

export class InternalProvider extends BaseProvider {
  id: IntegrationProvider = 'internal';
  name = 'Internal Actions';
  icon = 'internal';
  description = 'Execute actions within the CRM (update stages, create tasks, send notifications, etc.)';
  authType: 'oauth' | 'webhook' | 'api_key' = 'api_key'; // No auth required for internal actions
  destinationTypes: DestinationType[] = INTERNAL_DESTINATION_TYPES;

  /**
   * Check if provider is configured (always true for internal)
   */
  isConfigured(): boolean {
    return true;
  }

  /**
   * Execute an internal action based on destination type
   */
  async execute(
    connection: IntegrationConnection | null,
    automation: IntegrationAutomation,
    mappedPayload: Record<string, any>,
    eventPayload: Record<string, any>
  ): Promise<ExecutionResult> {
    const destinationType = automation.destinationType as DestinationType;
    const config = automation.destinationConfig as Record<string, any>;

    // Build the action context
    // Note: organizationId comes from the event payload since automations are user-scoped
    const context: ActionContext = {
      organizationId: eventPayload.organizationId || eventPayload.data?.organizationId || 0,
      userId: automation.userId,
      triggeredByEvent: eventPayload.event || 'unknown',
      triggeredAt: new Date(),
    };

    try {
      // Route to appropriate action handler based on destination type
      switch (destinationType) {
        // Contact actions
        case 'internal_update_stage':
        case 'internal_assign_owner':
        case 'internal_add_tag':
        case 'internal_remove_tag':
        case 'internal_update_field':
        case 'internal_create_contact':
          return await executeContactActions(
            destinationType,
            config,
            mappedPayload,
            eventPayload,
            context
          );

        // Task actions
        case 'internal_create_task':
          return await executeTaskActions(
            destinationType,
            config,
            mappedPayload,
            eventPayload,
            context
          );

        // Note actions
        case 'internal_add_note':
          return await executeNoteActions(
            destinationType,
            config,
            mappedPayload,
            eventPayload,
            context
          );

        // Notification actions
        case 'internal_send_notification':
          return await executeNotificationActions(
            destinationType,
            config,
            mappedPayload,
            eventPayload,
            context
          );

        // Email actions
        case 'internal_send_email':
          return await executeEmailActions(
            destinationType,
            config,
            mappedPayload,
            eventPayload,
            context
          );

        // Deal actions
        case 'internal_create_deal':
        case 'internal_move_deal_stage':
          return await executeDealActions(
            destinationType,
            config,
            mappedPayload,
            eventPayload,
            context
          );

        // Activity actions
        case 'internal_log_activity':
          return await executeActivityActions(
            destinationType,
            config,
            mappedPayload,
            eventPayload,
            context
          );

        // Data room actions
        case 'internal_grant_dataroom_access':
        case 'internal_send_nda':
          return await executeDataRoomActions(
            destinationType,
            config,
            mappedPayload,
            eventPayload,
            context
          );

        default:
          return {
            success: false,
            error: `Unknown internal action type: ${destinationType}`
          };
      }
    } catch (error: any) {
      console.error(`[InternalProvider] Action execution error:`, error);
      return {
        success: false,
        error: error.message || 'Internal action execution failed'
      };
    }
  }

  /**
   * Get schema for internal action configuration
   * Used by the UI to show what fields can be configured
   */
  async getDestinationSchema(
    connection: IntegrationConnection,
    destinationType: DestinationType
  ): Promise<FieldSchema[]> {
    // Return appropriate schema based on destination type
    switch (destinationType) {
      case 'internal_update_stage':
        return [
          { name: 'stageId', label: 'Stage', type: 'select', required: true, description: 'The stage to move the contact to' },
        ];

      case 'internal_assign_owner':
        return [
          { name: 'userId', label: 'Owner', type: 'select', required: true, description: 'The user to assign as owner' },
        ];

      case 'internal_add_tag':
      case 'internal_remove_tag':
        return [
          { name: 'tagName', label: 'Tag', type: 'string', required: true, description: 'The tag to add/remove' },
        ];

      case 'internal_update_field':
        return [
          { name: 'fieldId', label: 'Field', type: 'select', required: true, description: 'The custom field to update' },
          { name: 'value', label: 'Value', type: 'string', required: true, description: 'The new value (supports {{variables}})' },
        ];

      case 'internal_create_task':
        return [
          { name: 'title', label: 'Title', type: 'string', required: true, description: 'Task title (supports {{variables}})' },
          { name: 'description', label: 'Description', type: 'textarea', required: false, description: 'Task description' },
          { name: 'assigneeId', label: 'Assignee', type: 'select', required: false, description: 'User to assign the task to' },
          { name: 'dueInDays', label: 'Due in Days', type: 'number', required: false, description: 'Days until due date' },
          { name: 'priority', label: 'Priority', type: 'select', required: false, description: 'Task priority' },
        ];

      case 'internal_add_note':
        return [
          { name: 'content', label: 'Note Content', type: 'textarea', required: true, description: 'Note content (supports {{variables}})' },
        ];

      case 'internal_send_notification':
        return [
          { name: 'title', label: 'Title', type: 'string', required: true, description: 'Notification title' },
          { name: 'message', label: 'Message', type: 'textarea', required: true, description: 'Notification message' },
          { name: 'recipientType', label: 'Recipient Type', type: 'select', required: true, description: 'Who receives the notification' },
        ];

      case 'internal_send_email':
        return [
          { name: 'to', label: 'To', type: 'email', required: true, description: 'Recipient email' },
          { name: 'subject', label: 'Subject', type: 'string', required: true, description: 'Email subject' },
          { name: 'body', label: 'Body', type: 'textarea', required: true, description: 'Email body (supports {{variables}})' },
        ];

      case 'internal_create_contact':
        return [
          { name: 'email', label: 'Email', type: 'email', required: true, description: 'Contact email' },
          { name: 'firstName', label: 'First Name', type: 'string', required: false },
          { name: 'lastName', label: 'Last Name', type: 'string', required: false },
          { name: 'company', label: 'Company', type: 'string', required: false },
        ];

      case 'internal_create_deal':
        return [
          { name: 'name', label: 'Deal Name', type: 'string', required: true, description: 'Deal name (supports {{variables}})' },
          { name: 'pipelineId', label: 'Pipeline', type: 'select', required: true },
          { name: 'stageId', label: 'Stage', type: 'select', required: true },
          { name: 'value', label: 'Value', type: 'number', required: false },
        ];

      case 'internal_move_deal_stage':
        return [
          { name: 'stageId', label: 'Stage', type: 'select', required: true, description: 'The stage to move the deal to' },
        ];

      case 'internal_log_activity':
        return [
          { name: 'activityType', label: 'Type', type: 'select', required: true },
          { name: 'subject', label: 'Subject', type: 'string', required: true },
          { name: 'description', label: 'Description', type: 'textarea', required: false },
        ];

      case 'internal_grant_dataroom_access':
        return [
          { name: 'dataRoomId', label: 'Data Room', type: 'select', required: true },
          { name: 'email', label: 'Email', type: 'email', required: true },
          { name: 'accessLevel', label: 'Access Level', type: 'select', required: true },
        ];

      case 'internal_send_nda':
        return [
          { name: 'templateId', label: 'NDA Template', type: 'select', required: true },
          { name: 'recipientEmail', label: 'Recipient Email', type: 'email', required: true },
        ];

      default:
        return [];
    }
  }
}

// Export singleton instance
export const internalProvider = new InternalProvider();
