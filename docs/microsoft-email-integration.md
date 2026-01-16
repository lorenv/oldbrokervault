# Microsoft Email Integration - Known Issues and Solutions

This document covers issues encountered with Microsoft Graph API email integration and their solutions.

## Issue 1: "Email not connected" shown when email IS connected

### Symptoms
- Deal/Company emails tab shows "Email not connected" even when Microsoft email is connected
- Settings page shows email as connected

### Root Causes

1. **Missing `connected` flag in API response**: When a deal had no contacts with email addresses, the endpoint returned early without including `connected: true` in the response.

2. **Connection status filtering**: The `getUserEmailConnection()` helper only returned connections with `status: 'active'`. If a connection existed with status `'expired'` or `'error'`, the settings page would show it (no status filter), but the email endpoints would treat it as not connected.

### Solution
- Reordered logic to check email connection status BEFORE checking for contacts
- Modified `getUserEmailConnection()` to return connections regardless of status
- Added explicit handling for non-active connection statuses with appropriate messaging
- Always include `connected: true/false` and `provider` in all response paths

**File**: `server/routes/crm-routes.ts`

---

## Issue 2: Microsoft Graph API OData filter errors

### Symptoms
```
ErrorInvalidUrlQueryFilter: The query filter contains one or more invalid nodes.
```

### Root Cause
The OData `$filter` with lambda expressions for searching recipients is not supported on Microsoft Graph's `/me/messages` endpoint:
```javascript
// This does NOT work:
const filter = `from/emailAddress/address eq '${email}' or toRecipients/any(r: r/emailAddress/address eq '${email}')`;
```

### Solution
Use `$search` with KQL syntax instead of `$filter`:
```javascript
// This works:
params.append('$search', `"participants:${email}"`);
```

The `participants:` KQL keyword searches both sender and recipients.

**File**: `server/integrations/providers/microsoft.ts`

---

## Issue 3: $orderby not supported with $search

### Symptoms
```
SearchWithOrderBy: The query parameter '$orderBy' is not supported with '$search'.
```

### Root Cause
Microsoft Graph API does not allow `$orderby` parameter when using `$search`.

### Solution
Only include `$orderby` when NOT using `$search`. Sort results in application code instead:

```javascript
// In provider - only add $orderby when not using $search
if (query) {
  params.append('$search', `"participants:${query}"`);
} else {
  params.append('$orderby', 'receivedDateTime desc');
  // ... $filter logic
}

// In route - sort results in code
allEmails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
```

**File**: `server/integrations/providers/microsoft.ts`

---

## Microsoft Graph API Best Practices

### Searching Emails by Contact

**DO use `$search` with KQL:**
```javascript
// Search for emails involving a specific email address
params.append('$search', `"participants:user@example.com"`);
```

**DON'T use complex `$filter` with lambda expressions:**
```javascript
// This will fail on /me/messages endpoint
const filter = `toRecipients/any(r: r/emailAddress/address eq '${email}')`;
```

### Sorting Results

- `$orderby` works with `$filter` but NOT with `$search`
- When using `$search`, fetch results and sort in application code
- Always sort by `receivedDateTime` for email lists

### Error Handling

- Wrap individual email fetches in try-catch when looping through multiple contacts
- Continue processing other contacts if one fails
- Log detailed error messages from Microsoft Graph API for debugging:
```javascript
if (!response.ok) {
  const errorText = await response.text();
  console.error('[Microsoft] Email fetch failed:', response.status, errorText);
  throw new Error(`Failed to fetch emails: ${response.status} - ${errorText}`);
}
```

---

## Files Modified

- `server/routes/crm-routes.ts` - Email endpoints for contacts, deals, companies
- `server/integrations/providers/microsoft.ts` - Microsoft Graph API provider
