# Internal Automations System

This document describes the internal automation actions system, which allows users to create automated workflows that execute actions within the CRM itself, without requiring external integrations.

## Overview

Internal automations extend the existing integration automation framework to support actions that operate entirely within the CRM. Unlike external integrations (HubSpot, Slack, Zapier, etc.), internal actions don't require OAuth connections or webhook URLs - they execute directly against the CRM database.

### Key Benefits

1. **No External Dependencies**: Actions execute locally without network calls to external services
2. **Faster Execution**: Direct database operations are faster than HTTP requests
3. **Simpler Setup**: No need to configure OAuth or manage API keys
4. **Full CRM Access**: Can leverage all CRM data and relationships

## Phase 1 Scope

Phase 1 introduces 15 internal action types organized into categories:

### Contact Actions
| Action | Description |
|--------|-------------|
| `internal_update_stage` | Move a contact to a different pipeline stage |
| `internal_assign_owner` | Assign a user as the contact's owner |
| `internal_add_tag` | Add a tag to a contact (optionally create if not exists) |
| `internal_remove_tag` | Remove a tag from a contact |
| `internal_update_field` | Update a custom field value on a contact |
| `internal_create_contact` | Create a new contact from event data |

### Task Actions
| Action | Description |
|--------|-------------|
| `internal_create_task` | Create a task linked to a contact/deal |

### Communication Actions
| Action | Description |
|--------|-------------|
| `internal_add_note` | Add a note to a contact |
| `internal_send_notification` | Send an in-app notification to users |
| `internal_send_email` | Send an email (requires email service configuration) |

### Deal Actions
| Action | Description |
|--------|-------------|
| `internal_create_deal` | Create a new deal in a pipeline |
| `internal_move_deal_stage` | Move a deal to a different stage |

### Activity Actions
| Action | Description |
|--------|-------------|
| `internal_log_activity` | Log an activity (call, email, meeting, etc.) |

### Data Room Actions
| Action | Description |
|--------|-------------|
| `internal_grant_dataroom_access` | Grant access to a data room |
| `internal_send_nda` | Send an NDA for signature |

## Architecture

### File Structure

```
server/integrations/providers/internal/
├── index.ts              # Main InternalProvider class
├── types.ts              # Config interfaces for each action
└── actions/
    ├── index.ts          # Action exports
    ├── contact-actions.ts    # Contact-related actions
    ├── task-actions.ts       # Task creation
    ├── note-actions.ts       # Note creation
    ├── notification-actions.ts # In-app notifications
    ├── email-actions.ts      # Email sending
    ├── deal-actions.ts       # Deal management
    ├── activity-actions.ts   # Activity logging
    └── dataroom-actions.ts   # Data room & NDA actions
```

### Provider Registration

The internal provider is registered in `server/integrations/providers/index.ts`:

```typescript
import { internalProvider } from './internal';

const providers = new Map([
  // ... other providers
  ['internal', internalProvider],
]);
```

## Configuration Reference

### Common Patterns

All internal actions support **template variables** using the `{{path.to.value}}` syntax. Variables are resolved from the event payload at runtime.

Example:
```
Hello {{data.contact_name}}, your {{data.event}} has been processed.
```

### Action Configurations

#### internal_update_stage
```typescript
{
  stageId: number;      // Required: Target stage ID
  stageName?: string;   // Optional: For display purposes
}
```

#### internal_create_task
```typescript
{
  title: string;           // Required: Task title (supports templates)
  description?: string;    // Optional: Task description
  assigneeId?: number;     // Optional: User ID to assign task
  dueInDays?: number;      // Optional: Days until due date
  priority?: 'low' | 'medium' | 'high';
  linkToContact?: boolean; // Default: true
}
```

#### internal_add_tag / internal_remove_tag
```typescript
{
  tagName: string;           // Required: Tag name (supports templates)
  createIfNotExists?: boolean; // For add_tag only: create if missing
}
```

#### internal_send_notification
```typescript
{
  title: string;           // Required: Notification title
  message: string;         // Required: Notification body
  recipientType: 'user' | 'owner' | 'role' | 'all_admins';
  recipientUserId?: number;  // Required if recipientType is 'user'
  recipientRole?: string;    // Required if recipientType is 'role'
  link?: string;             // Optional: Deep link URL
}
```

#### internal_send_email
```typescript
{
  to: string;                // Email address or template
  toType: 'static' | 'template' | 'contact_email' | 'user_email';
  subject: string;           // Required: Email subject
  body: string;              // Required: Email body (HTML or plain)
  bodyType: 'plain' | 'html';
  fromName?: string;
  replyTo?: string;
}
```

#### internal_create_deal
```typescript
{
  name: string;          // Required: Deal name (supports templates)
  pipelineId: number;    // Required: Target pipeline
  stageId: number;       // Required: Initial stage
  value?: number;        // Optional: Deal value
  ownerId?: number;      // Optional: Deal owner
  linkToContact?: boolean; // Link to triggering contact
}
```

## Example Use Cases

### 1. Auto-Stage Contact After NDA Signature

**Trigger**: `nda.signed`
**Action**: `internal_update_stage`

When an NDA is signed, automatically move the contact to the "NDA Signed" stage.

```json
{
  "stageId": 5,
  "stageName": "NDA Signed"
}
```

### 2. Create Follow-up Task on Contact Creation

**Trigger**: `contact.created`
**Action**: `internal_create_task`

Create a task for the sales team to follow up with new contacts.

```json
{
  "title": "Follow up with {{data.contact_name}}",
  "description": "New contact created from {{data.source}}. Reach out within 24 hours.",
  "dueInDays": 1,
  "priority": "high"
}
```

### 3. Notify Team on High-Value Document View

**Trigger**: `cim.viewed`
**Action**: `internal_send_notification`

Alert all admins when someone views the CIM.

```json
{
  "title": "CIM Viewed",
  "message": "{{data.viewer_name}} ({{data.viewer_email}}) just viewed the CIM.",
  "recipientType": "all_admins",
  "linkToEntity": true
}
```

### 4. Tag Contacts Who Decline NDAs

**Trigger**: `nda.declined`
**Action**: `internal_add_tag`

Add a "Declined NDA" tag for tracking.

```json
{
  "tagName": "Declined NDA",
  "createIfNotExists": true
}
```

### 5. Log Activity on Document Download

**Trigger**: `cim.downloaded`
**Action**: `internal_log_activity`

Log the download as an activity for tracking.

```json
{
  "activityType": "other",
  "subject": "CIM Downloaded",
  "description": "{{data.document_name}} was downloaded by {{data.user_email}}"
}
```

## Phase 2 Considerations (Future)

Potential enhancements for Phase 2:

1. **Conditional Actions**: Execute actions based on field values or conditions
2. **Multi-Action Automations**: Chain multiple internal actions together
3. **Scheduled Actions**: Delay action execution (e.g., "send email in 2 days")
4. **Action Templates**: Pre-built automation templates for common workflows
5. **Bulk Actions**: Apply actions to multiple records at once
6. **Custom Actions**: Allow users to define custom action logic
7. **Action Analytics**: Track action execution metrics and success rates

## Testing

To test internal actions:

1. Create an automation with an internal action type
2. Configure the action settings
3. Trigger the source event (manually or via test)
4. Check the automation run history for success/failure
5. Verify the action was applied (check contact stage, task created, etc.)

### API Testing

```bash
# Create an automation with internal action
curl -X POST /api/integrations/automations \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Internal Action",
    "triggerEvent": "contact.created",
    "destinationType": "internal_add_tag",
    "destinationConfig": {
      "tagName": "New Contact",
      "createIfNotExists": true
    },
    "isActive": true
  }'
```

## Troubleshooting

### Common Issues

1. **"No contact_id found in event payload"**
   - The triggering event doesn't include a contact ID
   - Solution: Use a different trigger event or configure the action to not require a contact

2. **"Stage/User/Tag not found"**
   - The configured ID doesn't exist
   - Solution: Verify the ID exists in your organization

3. **"Action execution failed"**
   - Check the error message in the automation run history
   - Review server logs for detailed error information

### Debug Mode

Enable debug logging by setting the environment variable:
```bash
DEBUG=integrations:internal
```
