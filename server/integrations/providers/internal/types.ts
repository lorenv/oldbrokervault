/**
 * Internal Action Configuration Types
 *
 * Configuration interfaces for each internal automation action type.
 * These define what settings users can configure when setting up an internal action.
 */

// ============================================================================
// Contact Actions
// ============================================================================

/**
 * Config for updating a contact's stage
 */
export interface UpdateStageConfig {
  stageId: number;
  stageName?: string; // For display purposes
}

/**
 * Config for assigning an owner to a contact
 */
export interface AssignOwnerConfig {
  userId: number;
  userName?: string; // For display purposes
}

/**
 * Config for adding a tag to a contact
 */
export interface AddTagConfig {
  tagId?: number;
  tagName: string;
  createIfNotExists?: boolean;
}

/**
 * Config for removing a tag from a contact
 */
export interface RemoveTagConfig {
  tagId?: number;
  tagName: string;
}

/**
 * Config for updating a custom field on a contact
 */
export interface UpdateFieldConfig {
  fieldId: number;
  fieldName?: string;
  value: string; // Can contain template variables like {{contact.email}}
  valueType: 'static' | 'template' | 'from_event';
  eventField?: string; // Path to field in event payload
}

/**
 * Config for creating a new contact
 */
export interface CreateContactConfig {
  firstName?: string;
  lastName?: string;
  email?: string;
  company?: string;
  stageId?: number;
  ownerId?: number;
  tags?: string[];
  customFields?: Record<string, string>;
  // Field sources - can be 'static', 'template', or 'from_event'
  fieldSources?: Record<string, {
    type: 'static' | 'template' | 'from_event';
    value: string;
  }>;
}

// ============================================================================
// Task Actions
// ============================================================================

/**
 * Config for creating a task
 */
export interface CreateTaskConfig {
  title: string; // Can contain template variables
  description?: string; // Can contain template variables
  assigneeId?: number;
  assigneeName?: string;
  dueInDays?: number; // Create due date X days from now
  priority?: 'low' | 'medium' | 'high';
  linkToContact?: boolean; // Link task to the triggering contact
  linkToEntity?: {
    type: 'contact' | 'deal' | 'association';
    idField?: string; // Event field to get entity ID from
  };
}

// ============================================================================
// Note Actions
// ============================================================================

/**
 * Config for adding a note to a contact
 */
export interface AddNoteConfig {
  content: string; // Can contain template variables
  linkToContact?: boolean;
  contactIdField?: string; // Event field to get contact ID from
}

// ============================================================================
// Notification Actions
// ============================================================================

/**
 * Config for sending an in-app notification
 */
export interface SendNotificationConfig {
  title: string; // Can contain template variables
  message: string; // Can contain template variables
  recipientType: 'user' | 'owner' | 'role' | 'all_admins';
  recipientUserId?: number;
  recipientRole?: string;
  link?: string; // Optional deep link
  linkToEntity?: boolean;
}

// ============================================================================
// Email Actions
// ============================================================================

/**
 * Config for sending an email
 */
export interface SendEmailConfig {
  to: string; // Can be email or template variable like {{contact.email}}
  toType: 'static' | 'template' | 'contact_email' | 'user_email';
  subject: string; // Can contain template variables
  body: string; // HTML body, can contain template variables
  bodyType: 'plain' | 'html';
  fromName?: string;
  replyTo?: string;
}

// ============================================================================
// Deal Actions
// ============================================================================

/**
 * Config for creating a deal
 */
export interface CreateDealConfig {
  name: string; // Can contain template variables
  pipelineId: number;
  stageId: number;
  value?: number;
  valueField?: string; // Event field to get value from
  ownerId?: number;
  linkToContact?: boolean;
  contactIdField?: string;
  customFields?: Record<string, string>;
}

/**
 * Config for moving a deal to a different stage
 */
export interface MoveDealStageConfig {
  dealIdField: string; // Event field to get deal ID from
  stageId: number;
  stageName?: string;
  pipelineId?: number;
}

// ============================================================================
// Activity Actions
// ============================================================================

/**
 * Config for logging an activity
 */
export interface LogActivityConfig {
  activityType: 'call' | 'email' | 'meeting' | 'note' | 'task' | 'other';
  subject: string; // Can contain template variables
  description?: string; // Can contain template variables
  outcome?: string;
  linkToContact?: boolean;
  contactIdField?: string;
}

// ============================================================================
// Data Room Actions
// ============================================================================

/**
 * Config for granting data room access
 */
export interface GrantDataRoomAccessConfig {
  dataRoomId?: number;
  dataRoomIdField?: string; // Event field to get data room ID
  email: string; // Can be template variable
  emailType: 'static' | 'template' | 'contact_email';
  accessLevel: 'view' | 'download' | 'upload' | 'admin';
  expiresInDays?: number;
  sendInviteEmail?: boolean;
}

/**
 * Config for sending an NDA
 */
export interface SendNdaConfig {
  templateId: number;
  recipientEmail: string; // Can be template variable
  recipientEmailType: 'static' | 'template' | 'contact_email';
  recipientName?: string;
  linkToContact?: boolean;
  contactIdField?: string;
  customFields?: Record<string, string>;
}

// ============================================================================
// Union Type for All Configs
// ============================================================================

export type InternalActionConfig =
  | UpdateStageConfig
  | AssignOwnerConfig
  | AddTagConfig
  | RemoveTagConfig
  | UpdateFieldConfig
  | CreateContactConfig
  | CreateTaskConfig
  | AddNoteConfig
  | SendNotificationConfig
  | SendEmailConfig
  | CreateDealConfig
  | MoveDealStageConfig
  | LogActivityConfig
  | GrantDataRoomAccessConfig
  | SendNdaConfig;

// ============================================================================
// Action Execution Context
// ============================================================================

export interface ActionContext {
  organizationId: number;
  userId: number;
  triggeredByEvent: string;
  triggeredAt: Date;
}

// ============================================================================
// Template Variable Resolution
// ============================================================================

/**
 * Standard event payload fields available for templates
 */
export interface EventPayloadFields {
  event: string;
  timestamp: string;
  data: {
    contact_id?: number;
    contact_email?: string;
    contact_name?: string;
    deal_id?: number;
    deal_name?: string;
    user_id?: number;
    user_name?: string;
    document_id?: number;
    document_name?: string;
    [key: string]: any;
  };
}

/**
 * Resolve template variables in a string
 * Supports {{field.path}} syntax
 */
export function resolveTemplate(
  template: string,
  eventPayload: Record<string, any>,
  additionalContext?: Record<string, any>
): string {
  const context = { ...eventPayload, ...additionalContext };

  return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    const parts = path.trim().split('.');
    let value: any = context;

    for (const part of parts) {
      if (value == null) return match;
      value = value[part];
    }

    return value != null ? String(value) : match;
  });
}

/**
 * Get a nested value from an object using dot notation
 */
export function getNestedValue(obj: Record<string, any>, path: string): any {
  const parts = path.split('.');
  let value: any = obj;

  for (const part of parts) {
    if (value == null) return undefined;
    value = value[part];
  }

  return value;
}
