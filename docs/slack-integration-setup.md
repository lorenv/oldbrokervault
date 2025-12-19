# Slack Integration Setup

## Current Status: Pending Environment Variables

The Slack integration code is fully implemented but needs environment variables to be loaded.

## Required Environment Variables

Add these to Replit Secrets (or `.env` file):

```
SLACK_CLIENT_ID=<your-slack-client-id>
SLACK_CLIENT_SECRET=<your-slack-client-secret>
SLACK_SIGNING_SECRET=<your-slack-signing-secret>
```

## Slack App Configuration

### 1. OAuth & Permissions (in Slack App settings)

**Bot Token Scopes needed:**
- `chat:write` - Post messages to channels
- `channels:read` - View basic channel info
- `groups:read` - View private channels the bot is in
- `files:write` - Upload files (for PDF attachments)

**Redirect URL:**
```
https://cimshare.com/api/integrations/oauth/callback/slack
```

### 2. Where to find credentials (Slack App → Basic Information)
- **Client ID** - Under "App Credentials"
- **Client Secret** - Under "App Credentials"
- **Signing Secret** - Under "App Credentials"

## Issue: Secrets Not Loading

Replit secrets added via the Secrets tab may require a **full Repl restart** (Stop → Run) to take effect in the environment.

### To verify secrets are loaded:
```bash
node -e "console.log('SLACK_CLIENT_ID:', process.env.SLACK_CLIENT_ID ? 'SET' : 'NOT SET')"
```

### Alternative: Add to .env file
If secrets still don't load, add them directly to `.env` file (less secure but works immediately).

## Files Modified

- `/server/integrations/providers/slack.ts` - Updated redirect URI fallback to use Replit public URL
- Added `files:write` scope for PDF uploads

## Next Steps

1. Restart the entire Repl (Stop → Run)
2. Verify environment variables are loaded
3. Go to Integrations page and click "Connect" on Slack
4. Complete OAuth flow
5. Create an automation with Slack as destination

## Testing the Integration

Once connected, you can create an automation like:
- **Trigger:** NDA Signed
- **Destination:** Slack Message
- **Channel:** Select a channel
- **Message:** Will include signer details and optionally attach the signed PDF
