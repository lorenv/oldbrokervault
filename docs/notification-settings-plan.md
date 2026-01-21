# Notification Settings - Implementation Plan

## Overview
Allow users to control which notifications they receive via email and in-app, organized by category.

---

## Database Schema

### New Table: `user_notification_preferences`

```sql
CREATE TABLE user_notification_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE,

  -- Email Notification Toggles (per category)
  email_mentions BOOLEAN DEFAULT true,          -- @mentions in notes
  email_task_assigned BOOLEAN DEFAULT true,     -- Task assigned to you
  email_task_reminder BOOLEAN DEFAULT true,     -- Task due date reminders
  email_deal_updates BOOLEAN DEFAULT false,     -- Deal stage changes (you own)
  email_team_invites BOOLEAN DEFAULT true,      -- Team invitation
  email_esign_requests BOOLEAN DEFAULT true,    -- Signature requested
  email_esign_completed BOOLEAN DEFAULT true,   -- Document signed
  email_weekly_digest BOOLEAN DEFAULT false,    -- Weekly summary email

  -- In-App Notification Toggles
  inapp_mentions BOOLEAN DEFAULT true,
  inapp_task_assigned BOOLEAN DEFAULT true,
  inapp_task_reminder BOOLEAN DEFAULT true,
  inapp_deal_updates BOOLEAN DEFAULT true,
  inapp_esign_requests BOOLEAN DEFAULT true,
  inapp_esign_completed BOOLEAN DEFAULT true,

  -- Quiet Hours (optional future feature)
  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_hours_start TIME,                       -- e.g., 22:00
  quiet_hours_end TIME,                         -- e.g., 08:00

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## UI Design

### Page Structure

```
Notification Settings Page
├── Email Notifications Section
│   ├── Team & Collaboration
│   │   ├── @Mentions in notes [Toggle]
│   │   ├── Team invitations [Toggle]
│   │   └── Task assignments [Toggle]
│   │
│   ├── Deals & Pipeline
│   │   ├── Deal stage changes [Toggle]
│   │   └── Task reminders [Toggle]
│   │
│   ├── E-Signatures
│   │   ├── Signature requests [Toggle]
│   │   └── Document completed [Toggle]
│   │
│   └── Digests
│       └── Weekly activity summary [Toggle]
│
├── In-App Notifications Section
│   ├── @Mentions [Toggle]
│   ├── Task assignments [Toggle]
│   ├── Task reminders [Toggle]
│   ├── Deal updates [Toggle]
│   └── E-Signature activity [Toggle]
│
└── Quiet Hours (Future)
    ├── Enable quiet hours [Toggle]
    ├── Start time [Time picker]
    └── End time [Time picker]
```

---

## API Endpoints

### `GET /api/user/notification-preferences`
Returns current user's notification preferences

### `PUT /api/user/notification-preferences`
Updates user's notification preferences
```json
{
  "email_mentions": true,
  "email_task_assigned": true,
  "inapp_mentions": true,
  ...
}
```

---

## Implementation Notes

1. **Default Behavior**: All notifications ON by default (except weekly digest)
2. **Check Before Sending**: All email-sending code must check user preferences before sending
3. **In-App Always Stored**: Even if in-app notification is off, still create the notification record (just don't push/show it)
4. **Unsubscribe Links**: Each email should have quick-unsubscribe link for that category
5. **Migration**: Run migration to set defaults for existing users

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `shared/schema.ts` | Add `userNotificationPreferences` table |
| `server/storage.ts` | Add preference get/set methods |
| `server/routes.ts` | Add preference API endpoints |
| `client/src/pages/settings/notifications-page.tsx` | Build full UI |
| `server/email.ts` | Check preferences before sending |

---

## UI Component Layout

```tsx
<SettingsLayout title="Notifications" description="...">
  {/* Email Notifications */}
  <Card>
    <CardHeader>
      <CardTitle>Email Notifications</CardTitle>
      <CardDescription>Choose which emails you receive</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="space-y-6">
        {/* Team & Collaboration Section */}
        <div>
          <h4 className="font-medium mb-3">Team & Collaboration</h4>
          <div className="space-y-4">
            <NotificationRow
              title="@Mentions"
              description="When someone mentions you in a note"
              checked={prefs.email_mentions}
              onChange={...}
            />
            {/* More rows... */}
          </div>
        </div>
        {/* More sections... */}
      </div>
    </CardContent>
  </Card>

  {/* In-App Notifications */}
  <Card>
    <CardHeader>
      <CardTitle>In-App Notifications</CardTitle>
      <CardDescription>Control notification bell alerts</CardDescription>
    </CardHeader>
    <CardContent>
      {/* Similar toggle rows */}
    </CardContent>
  </Card>
</SettingsLayout>
```

---

## NotificationRow Component

```tsx
function NotificationRow({ title, description, checked, onChange }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="font-medium text-gray-900">{title}</p>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
```

---

## Priority Order

1. **Phase 1**: Basic toggle UI with email preferences (mentions, tasks, esign)
2. **Phase 2**: In-app notification preferences
3. **Phase 3**: Weekly digest email functionality
4. **Phase 4**: Quiet hours feature
