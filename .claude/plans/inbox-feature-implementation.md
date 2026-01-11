# CRM Inbox Feature Implementation Plan

## Overview
Implement a full-featured email inbox within the CRM, allowing users to view, send, and manage emails without leaving the application. This builds on the existing OAuth email connection infrastructure.

---

## Phase 1: Enhanced Email on Contact/Deal Pages (Current)

### Goal
Allow users to view full email content and reply to emails directly from contact and deal detail pages.

### Features
1. **Email List Component**: Show emails associated with a contact/deal with:
   - Sender/recipient info
   - Subject line
   - Preview snippet (first 100 chars)
   - Date/time
   - Read/unread status indicator

2. **Email Detail View**: Expandable email view showing:
   - Full email body (HTML rendered safely)
   - Attachments list with download links
   - Full header info (from, to, cc, date)

3. **Reply Functionality**:
   - Reply button on each email
   - Compose dialog with:
     - Pre-filled recipient (reply-to address)
     - Subject with "Re:" prefix
     - Original email quoted below
   - Send via connected email account

4. **Compose New Email**:
   - Button to compose new email to contact
   - Rich text editor (basic formatting)
   - Send and log to activity feed

### API Endpoints Needed
- `GET /api/crm/emails/contact/:contactId` - Fetch emails for a contact
- `GET /api/crm/emails/deal/:dealId` - Fetch emails for contacts on a deal
- `GET /api/crm/emails/:emailId` - Fetch full email content
- `POST /api/crm/emails/send` - Send email via connected account
- `POST /api/crm/emails/:emailId/reply` - Reply to an email

### Files to Create/Modify
- `client/src/components/crm/email-list.tsx` - Email list component
- `client/src/components/crm/email-viewer.tsx` - Full email viewer
- `client/src/components/crm/email-composer.tsx` - Compose/reply dialog
- `server/routes/crm-routes.ts` - Add email endpoints
- `server/services/email-sync.ts` - Email fetching service

---

## Phase 2: Dedicated Inbox Page

### Goal
Create a standalone inbox page showing all emails across all connected accounts.

### Features
1. **Inbox List View**:
   - All received emails in reverse chronological order
   - Pagination (load more / infinite scroll)
   - Unread count badge in sidebar
   - Click to view full email

2. **Sent Folder**:
   - Tab/toggle to view sent emails
   - Same list format as inbox

3. **Search**:
   - Search by subject, sender, content
   - Date range filter
   - Contact/deal filter

4. **Bulk Actions**:
   - Mark as read/unread
   - Archive (hide from inbox)

5. **Email-Contact Linking**:
   - Auto-match emails to contacts by email address
   - Manual link option for unmatched emails
   - "View in CRM" link to contact/deal

### New Components
- `client/src/pages/crm/inbox-page.tsx` - Main inbox page
- `client/src/components/crm/inbox-sidebar.tsx` - Folders/filters sidebar

### Database Additions
- `crm_emails` table to cache email metadata
- `crm_email_sync_status` table for sync tracking

---

## Phase 3: Advanced Features

### Goal
Add power-user features for email management.

### Features
1. **Email Threading**:
   - Group related emails into conversations
   - Thread view with all messages
   - Reply within thread context

2. **Folders/Labels**:
   - View Gmail labels / Outlook folders
   - Filter by folder
   - Move emails between folders

3. **Email Templates**:
   - Save email templates
   - Insert template into composer
   - Variable substitution ({{firstName}}, etc.)

4. **Scheduled Send**:
   - Schedule email to send later
   - Queue management

5. **Email Tracking** (Optional):
   - Open tracking
   - Click tracking
   - Notification when email opened

6. **Multi-Account**:
   - Switch between connected accounts
   - Unified inbox view option

---

## Technical Architecture

### Email Sync Strategy
- **On-demand fetch**: Fetch emails when user views contact/inbox
- **Background sync**: Periodic sync for unread counts (every 5 min)
- **Webhook (future)**: Gmail/Microsoft push notifications for real-time

### Data Storage
- Store email metadata in database (subject, from, to, date, snippet)
- Fetch full body on-demand from provider
- Cache full body temporarily (1 hour) for performance

### Security
- Never store email bodies long-term
- Sanitize HTML before rendering (DOMPurify)
- Validate OAuth tokens before each request

---

## Phase 1 Implementation Steps

1. **Create email fetching service** (`server/services/email-sync.ts`)
   - Function to fetch emails from Gmail API
   - Function to fetch emails from Microsoft Graph API
   - Common interface for both providers

2. **Add API endpoints** (`server/routes/crm-routes.ts`)
   - GET emails by contact email address
   - GET single email full content
   - POST send email
   - POST reply to email

3. **Create EmailList component** (`client/src/components/crm/email-list.tsx`)
   - Fetches and displays emails for a contact
   - Expandable rows for full content
   - Loading/empty states

4. **Create EmailComposer component** (`client/src/components/crm/email-composer.tsx`)
   - Dialog for composing new emails
   - Reply mode with quoted content
   - Rich text editor (basic)

5. **Integrate into Contact Detail page**
   - Add "Emails" tab
   - Show EmailList component
   - Compose button

6. **Integrate into Deal Detail page**
   - Show emails from all contacts on deal
   - Same functionality as contact page

---

## Estimated Scope

| Phase | Complexity | Key Deliverables |
|-------|------------|------------------|
| Phase 1 | Medium | Email viewing + reply on contact/deal pages |
| Phase 2 | Medium-High | Standalone inbox page with search |
| Phase 3 | High | Threading, templates, tracking |

---

## Current Status
- OAuth email connection: Implemented (Gmail + Microsoft)
- Email send capability: Implemented
- Email activity logging: Implemented
- **Next**: Phase 1 implementation
