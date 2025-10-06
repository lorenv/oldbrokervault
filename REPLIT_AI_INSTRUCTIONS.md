# Instructions for Replit AI Agent - Team Collaboration Feature

## Database Schema Changes Needed

**IMPORTANT: This project uses PostgreSQL with Drizzle ORM, not SQLite**

### 1. Create `collaborators` table

Add to shared/schema.ts:

```typescript
export const collaborators = pgTable("collaborators", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull(),
  email: text("email").notNull(),
  userId: integer("user_id"),
  permission: text("permission").notNull().$type<"Edit" | "Assist">(),
  invitedBy: integer("invited_by").notNull(),
  invitedAt: timestamp("invited_at").defaultNow().notNull(),
  acceptedAt: timestamp("accepted_at"),
  status: text("status").notNull().default("pending").$type<"pending" | "active" | "removed">(),
  inviteToken: text("invite_token").notNull().unique(),
});
```

### 2. Create `document_locks` table

Add to shared/schema.ts:

```typescript
export const documentLocks = pgTable("document_locks", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull().unique(),
  userId: integer("user_id").notNull(),
  userName: text("user_name").notNull(),
  userEmail: text("user_email").notNull(),
  lockedAt: timestamp("locked_at").defaultNow().notNull(),
  lastActivityAt: timestamp("last_activity_at").defaultNow().notNull(),
  takenOverFrom: integer("taken_over_from"),
});
```

### 3. Create `document_activity_log` table

Add to shared/schema.ts:

```typescript
export const documentActivityLog = pgTable("document_activity_log", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull(),
  userId: integer("user_id"),
  userName: text("user_name"),
  userEmail: text("user_email"),
  action: text("action").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

## API Endpoints to Create

### Collaborator Management Endpoints

1. **GET /api/cim/:docId/collaborators**
   - Get all collaborators for a document
   - Access: Owner, Edit, Assist (all can view)
   - Returns: Array of collaborator objects with user details

2. **POST /api/cim/:docId/collaborators**
   - Invite new collaborator
   - Access: Owner only
   - Body: `{ email: string, permission: "Edit" | "Assist" }`
   - Check subscription limits before allowing
   - Generate unique inviteToken (use crypto.randomBytes)
   - Send invitation email
   - Log activity

3. **PATCH /api/cim/:docId/collaborators/:collaboratorId**
   - Update collaborator permission
   - Access: Owner only
   - Body: `{ permission: "Edit" | "Assist" }`
   - Log activity

4. **DELETE /api/cim/:docId/collaborators/:collaboratorId**
   - Remove collaborator
   - Access: Owner only
   - Send removal email to collaborator
   - Release any locks held by this user on this document
   - Log activity

5. **POST /api/collaborator/accept/:token**
   - Accept collaboration invitation
   - Access: Public (uses token)
   - Updates status to "active", sets acceptedAt, links userId
   - If user doesn't exist, they need to sign up first then accept
   - Log activity

6. **POST /api/cim/:docId/collaborators/:collaboratorId/leave**
   - Self-remove from document
   - Access: The collaborator themselves
   - Log activity

### Document Locking Endpoints

7. **GET /api/cim/:docId/lock/status**
   - Get current lock status
   - Access: Owner, Edit, Assist
   - Returns: `{ locked: boolean, user?: { name, email, lockedAt, duration } }`

8. **POST /api/cim/:docId/lock**
   - Acquire edit lock
   - Access: Owner, Edit only
   - Fails if already locked by someone else
   - Creates lock record with current timestamp
   - Log activity
   - Returns: `{ success: boolean, lock?: object }`

9. **POST /api/cim/:docId/lock/takeover**
   - Forcibly take over edit lock
   - Access: Owner, Edit only
   - Removes existing lock, creates new one
   - Send email notification to previous lock holder
   - Log activity with takenOverFrom
   - Returns: `{ success: boolean, previousUser: string }`

10. **DELETE /api/cim/:docId/lock**
    - Release edit lock
    - Access: Owner, Edit (must be current lock holder)
    - Deletes lock record
    - Log activity

11. **POST /api/cim/:docId/lock/heartbeat**
    - Update lastActivityAt timestamp
    - Access: Owner, Edit (must be current lock holder)
    - Updates lastActivityAt to current time
    - Returns: `{ success: boolean }`

### Activity Log Endpoints

12. **GET /api/cim/:docId/activity**
    - Get activity log for document
    - Access: Owner, Edit, Assist
    - Query params: ?limit=50&offset=0
    - Returns: Array of activity log entries

## Storage Functions to Add (server/storage.ts)

Add these functions to the storage interface and implementations:

```typescript
// Collaborator functions
async getCollaborators(documentId: number): Promise<Collaborator[]>
async getCollaboratorByToken(token: string): Promise<Collaborator | null>
async createCollaborator(data: { documentId, email, permission, invitedBy, inviteToken }): Promise<Collaborator>
async updateCollaborator(id: number, data: { permission?, status?, acceptedAt?, userId? }): Promise<void>
async deleteCollaborator(id: number): Promise<void>
async getCollaboratorCount(documentId: number): Promise<number>
async getUserCollaboration(documentId: number, userId: number): Promise<Collaborator | null>

// Document lock functions
async getLock(documentId: number): Promise<DocumentLock | null>
async createLock(data: { documentId, userId, userName, userEmail, takenOverFrom? }): Promise<DocumentLock>
async updateLockActivity(documentId: number): Promise<void>
async releaseLock(documentId: number): Promise<void>
async releaseUserLocks(userId: number, documentId: number): Promise<void>
async cleanupStaleLocks(minutesOld: number): Promise<number>

// Activity log functions
async logActivity(data: { documentId, userId, userName, userEmail, action, metadata? }): Promise<void>
async getActivityLog(documentId: number, limit: number, offset: number): Promise<ActivityLogEntry[]>
```

## Background Jobs Needed

Add a cron job or interval that runs every 5 minutes:

```typescript
// Clean up stale locks (15+ minutes old)
async function cleanupStaleLocks() {
  const staleLocks = await storage.cleanupStaleLocks(15);
  if (staleLocks > 0) {
    console.log(`Cleaned up ${staleLocks} stale document locks`);
  }
}
```

## Access Control Helper Function

Create a helper function to check if user can access document:

```typescript
async function getUserDocumentPermission(
  documentId: number,
  userId: number
): Promise<"owner" | "edit" | "assist" | null> {
  // Check if owner
  const document = await storage.getCim(documentId);
  if (document.userId === userId) return "owner";

  // Check if collaborator
  const collaboration = await storage.getUserCollaboration(documentId, userId);
  if (collaboration?.status === "active") {
    return collaboration.permission.toLowerCase() as "edit" | "assist";
  }

  return null;
}
```

## Subscription Limits

Collaborator limits by subscription tier:
- `starter`: 1 collaborator per document
- `standard` (Pro): 3 collaborators per document
- `enterprise` or `admin`: Unlimited (999 or no check)

Check in POST /api/cim/:docId/collaborators before allowing new invite.

## Notes

- All timestamps should be stored as Unix timestamps (integers)
- inviteToken should be generated using: `crypto.randomBytes(32).toString('hex')`
- When sending emails, reuse existing email infrastructure from server/email.ts
- Activity log actions: "collaborator_invited", "collaborator_accepted", "collaborator_removed", "collaborator_permission_changed", "lock_acquired", "lock_released", "lock_taken_over", "document_edited"
- Make sure to handle edge cases like user accepting invite after account creation
- NDA bypass: When checking NDA requirements, if user is owner/collaborator, bypass the NDA check but show a message to the user
