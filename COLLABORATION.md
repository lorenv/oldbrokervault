# CIM Document Collaboration

This document explains how the collaboration feature works in CIMShare, including permissions, document locking, and activity tracking.

## Table of Contents

- [Overview](#overview)
- [Permission Levels](#permission-levels)
- [Document Locking](#document-locking)
- [Inviting Collaborators](#inviting-collaborators)
- [Managing Collaborators](#managing-collaborators)
- [Activity Log](#activity-log)
- [NDA Bypass](#nda-bypass)
- [Subscription Limits](#subscription-limits)
- [Technical Implementation](#technical-implementation)

---

## Overview

The collaboration feature allows document owners to invite team members to help manage their CIM documents. Collaborators can be granted different permission levels to control what actions they can perform.

**Key Features:**
- Individual collaborator invitations (no team entity)
- Two permission levels: Edit and Assist
- Document locking to prevent concurrent editing conflicts
- Activity logging for audit trail
- Email notifications for collaboration events
- NDA requirement bypass for collaborators
- Subscription-based limits

---

## Permission Levels

There are three access levels for CIM documents:

### Owner (Full Control)
- All permissions
- Can manage collaborators (invite, remove, change permissions)
- Can delete the document
- Can transfer ownership (future feature)

### Edit (High Permissions)
- ✅ Can edit document content
- ✅ Can manage sharing settings
- ✅ Can approve NDA signatures
- ✅ Can view analytics
- ✅ Bypasses NDA requirements
- ❌ Cannot manage collaborators
- ❌ Cannot delete document

### Assist (Limited Permissions)
- ✅ Can manage sharing settings
- ✅ Can approve NDA signatures
- ✅ Can view analytics
- ✅ Bypasses NDA requirements
- ❌ Cannot edit document content
- ❌ Cannot manage collaborators
- ❌ Cannot delete document

**Use Cases:**
- **Edit**: For team members who need to modify the document content (e.g., analysts, writers)
- **Assist**: For team members who only need to manage document distribution and approvals (e.g., sales team, admins)

---

## Document Locking

To prevent concurrent editing conflicts, the system implements a document locking mechanism.

### How It Works

1. **Lock Acquisition**: When a user with Edit permissions enters the Edit tab, they automatically acquire a lock on the document
2. **Heartbeat**: Every 30 seconds, the client sends a heartbeat to maintain the lock
3. **Auto-Release**: Locks are automatically released when:
   - User leaves the Edit tab
   - No heartbeat received for 15 minutes (stale lock cleanup)
   - User closes the browser (via `navigator.sendBeacon`)

### Lock Status Indicator

When another user is editing:
- An amber alert banner appears showing who is editing
- Displays how long ago they started editing
- Provides a "Take Over & Edit" button

### Taking Over a Lock

If you need to edit while someone else has the lock:

1. Click "Take Over & Edit" button
2. A confirmation dialog appears warning about potential data loss
3. If confirmed:
   - Your lock is acquired
   - The previous editor's lock is released
   - They receive an email notification
   - Activity is logged

**Warning**: Taking over a lock may cause the previous editor to lose unsaved changes. Use this feature responsibly.

### Lock Cleanup

A background job runs every 15 minutes to release stale locks (no heartbeat for 15+ minutes).

---

## Inviting Collaborators

### Step 1: Navigate to Share Tab
Go to your document and click on the "Share CIM" tab.

### Step 2: Scroll to Collaborators Section
The Collaborators section shows:
- Current collaborators (if any)
- Number of collaborator slots used vs. available
- Invite form

### Step 3: Invite via Email
1. Enter the collaborator's email address
2. Select permission level (Edit or Assist)
3. Click "Invite"

### What Happens Next
1. An invitation email is sent to the collaborator
2. The email contains a unique acceptance link
3. Collaborator appears in your list with "Pending" status
4. When they click the acceptance link, status changes to "Active"
5. Activity is logged

### Invitation Email Contents
- Who invited them
- Document title
- Their permission level (Edit or Assist)
- Explanation of what they can do
- Secure acceptance link
- Link expires after acceptance or if removed

---

## Managing Collaborators

### View Collaborators
In the Share tab, the Collaborators section lists all collaborators with:
- Email address
- Status (Pending or Active)
- Permission level
- Invitation date

### Change Permissions
1. Use the permission dropdown next to a collaborator
2. Select new permission (Edit or Assist)
3. Change is applied immediately
4. Collaborator receives email notification
5. Activity is logged

### Remove Collaborators
1. Click the trash icon next to a collaborator
2. Confirm removal in the dialog
3. Collaborator loses all access immediately
4. They receive an email notification
5. Activity is logged

### Collaborator Self-Removal
Collaborators can remove themselves:
1. They see a "Leave Document" option
2. Upon leaving, they lose access
3. Owner is notified
4. Activity is logged

---

## Activity Log

The Activity Log provides a complete audit trail of all collaboration activities.

### Location
Share tab → Activity Log section (below Collaborators)

### Tracked Events
- **Collaborator Invited**: Who invited whom, with what permission
- **Collaborator Accepted**: When invitation was accepted
- **Collaborator Removed**: Who removed whom
- **Collaborator Left**: When someone left voluntarily
- **Permission Changed**: Permission level changes
- **Lock Acquired**: When editing started
- **Lock Released**: When editing stopped
- **Lock Taken Over**: When someone took over editing
- **Document Edited**: General edit events

### Activity Display
Each entry shows:
- Icon (color-coded by activity type)
- Description (human-readable)
- Timestamp (relative, e.g., "5 minutes ago")

### Data Retention
- Last 50 activities are displayed
- Full history is stored in database
- Can be queried via API with pagination

---

## NDA Bypass

Collaborators and owners automatically bypass NDA requirements for documents they have access to.

### Why?
Since collaborators are helping to work on the document, they shouldn't need to sign an NDA to access it.

### How It Works
1. When a collaborator/owner accesses an NDA-protected document via share link
2. System checks if they are the owner or an active collaborator
3. If yes, NDA requirement is skipped
4. A toast notification appears: "As a [owner/collaborator], you can access this NDA-protected document without signing."
5. They proceed directly to the document

### Security
- Only active collaborators can bypass (not "pending" or "removed")
- Must be authenticated user
- Email must match collaboration record

---

## Subscription Limits

Collaborator limits are based on subscription tier:

| Plan | Collaborators per Document |
|------|----------------------------|
| **Free** | 0 (no collaboration) |
| **Starter** | 1 collaborator |
| **Standard/Pro** | 3 collaborators |
| **Enterprise** | Unlimited |
| **Admin** | Unlimited |

### Enforcement
- Invite button is disabled when limit is reached
- Error message shown if limit exceeded
- Limit applies per document (not account-wide)
- Upgrading plan immediately increases limit

### Count Calculation
Only **active** collaborators count toward the limit. Pending or removed collaborators do not count.

---

## Technical Implementation

### Database Schema

#### `collaborators` Table
```sql
- id: Primary key
- cimDocumentId: Foreign key to cim_documents
- email: Collaborator's email
- userId: Foreign key to users (null until accepted)
- permission: 'Edit' | 'Assist'
- invitedBy: Foreign key to users (who sent invite)
- invitedAt: Timestamp
- acceptedAt: Timestamp (null until accepted)
- status: 'pending' | 'active' | 'removed'
- inviteToken: Unique token for acceptance link
```

#### `documentLocks` Table
```sql
- id: Primary key
- documentId: Unique per document
- userId: Who holds the lock
- userName: Display name
- userEmail: Email
- lockedAt: When lock was acquired
- lastActivityAt: Last heartbeat timestamp
- takenOverFrom: Previous lock holder (if taken over)
```

#### `documentActivityLog` Table
```sql
- id: Primary key
- documentId: Which document
- userId: Who performed action (null for system)
- userName: Display name
- userEmail: Email
- action: Activity type string
- metadata: JSONB (additional data)
- createdAt: Timestamp
```

### API Endpoints

#### Collaborator Management
- `POST /api/cim/:id/invite` - Invite collaborator
- `GET /api/cim/:id/collaborators` - List collaborators
- `PATCH /api/cim/:docId/collaborators/:collaboratorId` - Update permission
- `DELETE /api/cim/:docId/collaborators/:collaboratorId` - Remove collaborator
- `POST /api/collaborator/accept/:token` - Accept invitation
- `POST /api/cim/:docId/collaborators/:collaboratorId/leave` - Self-remove

#### Document Locking
- `GET /api/cim/:docId/lock/status` - Check lock status
- `POST /api/cim/:docId/lock` - Acquire lock
- `POST /api/cim/:docId/lock/takeover` - Take over lock
- `DELETE /api/cim/:docId/lock` - Release lock
- `POST /api/cim/:docId/lock/heartbeat` - Update activity timestamp

#### Activity Log
- `GET /api/cim/:docId/activity?limit=50&offset=0` - Get activity log

### Frontend Components

#### `/client/src/components/document-tabs/collaborators-section.tsx`
- Collaborator list UI
- Invite form
- Permission management
- Remove functionality

#### `/client/src/components/document-lock-indicator.tsx`
- Lock status banner
- Take over dialog
- `useDocumentLock` hook for automatic lock management

#### `/client/src/components/document-activity-log.tsx`
- Activity timeline display
- Icon mapping
- Human-readable descriptions

### Email Templates

Located in `/server/email.ts`:

1. **Collaboration Invitation Email**
   - Sent when collaborator is invited
   - Contains acceptance link
   - Explains permission level

2. **Collaborator Removed Email**
   - Sent when access is revoked
   - Explains who removed them

3. **Edit Lock Taken Over Email**
   - Sent when lock is taken over
   - Warns about potential data loss
   - Shows who took over

### Background Jobs

#### Stale Lock Cleanup
- Runs every 15 minutes (via cron or similar)
- Releases locks with no heartbeat for 15+ minutes
- Prevents abandoned locks from blocking editing

### Security Considerations

1. **Authorization Checks**: Every API endpoint verifies user has appropriate permission
2. **Token Security**: Invite tokens are cryptographically random (32 bytes)
3. **Email Verification**: Collaborator email must match user email when accepting
4. **Subscription Enforcement**: Limits checked before allowing invitations
5. **Lock Validation**: Heartbeat required to maintain lock
6. **Activity Logging**: All actions logged for audit trail

### Performance Optimizations

1. **Polling Intervals**:
   - Lock status: 10 seconds
   - Lock heartbeat: 30 seconds

2. **Caching**: React Query caches collaborator lists and activity logs

3. **Optimistic Updates**: UI updates immediately before server confirmation

4. **Batch Operations**: Activity logs fetched with pagination (50 at a time)

---

## Common Workflows

### Scenario 1: Inviting an Analyst to Edit Content

1. Owner navigates to Share tab
2. Clicks "Invite Collaborator"
3. Enters analyst's email: `analyst@company.com`
4. Selects "Edit" permission
5. Clicks "Invite"
6. Analyst receives email
7. Clicks acceptance link
8. Analyst can now edit the document

### Scenario 2: Sales Team Member Needs to Approve NDAs

1. Owner invites sales team member with "Assist" permission
2. Sales member accepts invitation
3. When viewing the document, sales member sees NDA tab
4. They can approve or reject NDAs
5. They can manage sharing settings
6. They **cannot** edit document content

### Scenario 3: Two Editors Need to Work on Same Document

1. Editor A starts editing (acquires lock automatically)
2. Editor B tries to enter Edit tab
3. Editor B sees: "Editor A is currently editing this document"
4. Editor B has two options:
   - Wait for Editor A to finish
   - Click "Take Over & Edit" to forcibly acquire lock
5. If Editor B takes over:
   - Editor A receives email notification
   - Editor B can now edit
   - Activity log records the takeover

### Scenario 4: Document Owner Wants to Review Collaboration History

1. Owner navigates to Share tab
2. Scrolls to Activity Log section
3. Reviews timeline of all events:
   - Who was invited and when
   - When invitations were accepted
   - Permission changes
   - Lock acquisitions and releases
   - Document edits
4. Owner can identify who did what and when

---

## Best Practices

### For Document Owners

1. **Choose Permissions Carefully**: Give Edit only to those who truly need to modify content
2. **Regular Reviews**: Periodically review collaborator list and remove inactive members
3. **Communication**: Let collaborators know when you make permission changes
4. **Monitor Activity Log**: Check for unusual activity or unauthorized changes

### For Collaborators

1. **Respect Locks**: Don't take over locks unnecessarily
2. **Communicate**: Coordinate with other editors before starting work
3. **Save Frequently**: Auto-save helps, but manual saves ensure data safety
4. **Release Locks**: Close Edit tab when done to release lock
5. **Leave When Done**: If you no longer need access, use "Leave Document" feature

### For Development Teams

1. **Background Jobs**: Ensure stale lock cleanup job is running
2. **Email Service**: Verify SendGrid is configured for notifications
3. **Database Indexes**: Index `documentId` and `userId` columns for performance
4. **Monitoring**: Track lock acquisition failures and timeouts
5. **Rate Limiting**: Consider rate limiting invitation emails to prevent abuse

---

## Troubleshooting

### "Failed to acquire lock"

**Cause**: Another user currently has the lock

**Solution**:
- Wait for them to finish
- Contact them directly
- Use "Take Over" feature if urgent

### "Invitation failed to send"

**Cause**: Email service error or invalid email

**Solution**:
- Verify email address is correct
- Check SendGrid configuration
- Review server logs for errors

### "Collaborator can't accept invitation"

**Cause**: Token expired, already used, or user not logged in

**Solution**:
- Remove old invitation and send new one
- Ensure user is logged in with matching email
- Check if invitation already accepted

### "Lock not releasing"

**Cause**: Browser crashed or network error

**Solution**:
- Wait 15 minutes for auto-cleanup
- Admin can manually release via database
- Check heartbeat endpoint logs

### "Activity log not updating"

**Cause**: API endpoint error or React Query cache

**Solution**:
- Refresh page
- Check browser console for errors
- Verify API endpoint is accessible

---

## Future Enhancements

Potential features for future development:

1. **Real-time Collaboration**: WebSocket-based live editing (like Google Docs)
2. **Version History**: Track document changes over time
3. **Comment System**: Allow collaborators to leave comments
4. **Role Templates**: Predefined permission sets
5. **Team Entity**: Group collaborators into teams
6. **Advanced Locking**: Section-level locks instead of document-level
7. **Conflict Resolution**: UI for resolving edit conflicts
8. **Notification Preferences**: Let users customize email notifications
9. **Collaboration Analytics**: Track collaborator contribution metrics
10. **External Collaborators**: Allow non-registered users to collaborate

---

## API Reference

### GET /api/cim/:docId/collaborators

**Description**: List all collaborators for a document

**Authorization**: Owner or collaborator with any permission

**Response**:
```json
[
  {
    "id": 123,
    "email": "user@example.com",
    "permission": "Edit",
    "status": "active",
    "invitedAt": "2025-10-06T10:00:00Z",
    "acceptedAt": "2025-10-06T10:30:00Z"
  }
]
```

### POST /api/cim/:docId/invite

**Description**: Invite a new collaborator

**Authorization**: Owner only

**Request Body**:
```json
{
  "email": "newuser@example.com",
  "permission": "Edit"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Invitation sent",
  "collaborator": { ... }
}
```

### POST /api/cim/:docId/lock

**Description**: Acquire edit lock on document

**Authorization**: Owner or Edit collaborator

**Response**:
```json
{
  "success": true,
  "lock": {
    "documentId": 456,
    "userId": 789,
    "userName": "John Doe",
    "lockedAt": "2025-10-06T11:00:00Z"
  }
}
```

### GET /api/cim/:docId/lock/status

**Description**: Check if document is locked

**Authorization**: Any authenticated user

**Response**:
```json
{
  "locked": true,
  "user": {
    "name": "Jane Smith",
    "email": "jane@example.com",
    "lockedAt": "2025-10-06T11:00:00Z",
    "duration": 300000
  }
}
```

---

## Conclusion

The collaboration feature enables teams to work together efficiently on CIM documents while maintaining security and preventing conflicts. By understanding permissions, document locking, and activity tracking, users can collaborate effectively while maintaining full visibility into document changes.

For technical support or questions, please refer to the main documentation or contact the development team.
