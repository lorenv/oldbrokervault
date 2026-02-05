# Chrome Extension Bug Fixes

## Issue 1: Sign-in fails after successful login — "Sign in failed. Please try again."

**Symptom:** The extension opens the login window via `chrome.identity.launchWebAuthFlow`, the user logs in successfully, but the extension popup shows "Sign in failed. Please try again."

**Root cause:** The server sends the auth token back in the URL **fragment** (hash) for security — fragments are never sent to servers or recorded in logs:

```
https://<id>.chromiumapp.org/#token=ext_abc...&user_id=1&email=foo@bar.com
```

But the extension was reading **query parameters** instead:

```js
// BEFORE (broken) — searchParams reads ?key=value, not #key=value
const token = url.searchParams.get('token'); // always null
```

Since `token` was always `null`, the code hit `throw new Error('No token received')`, caught by the generic error handler which displayed "Sign in failed."

**Fix (`chrome-extension/popup/popup.js`):** Parse the URL hash fragment instead of query parameters:

```js
// AFTER (fixed) — parse the hash fragment
const hashParams = new URLSearchParams(url.hash.substring(1));
const token = hashParams.get('token');
const userId = hashParams.get('user_id');
const email = hashParams.get('email');
```

---

## Issue 2: "Invalid token format" when generating a CIM

**Symptom:** After appearing to sign in, attempting to generate a CIM returned "Invalid token format" from the server's `extensionTokenAuth` middleware, which validates tokens against the pattern `ext_[a-f0-9]{48}`.

**Root cause:** This was a downstream consequence of Issue 1 and Issue 3. Because the auth flow never fully completed (login redirected to `/dashboard` instead of the extension callback), a valid `ext_*` token was never generated or stored. Any token the extension held was either `null`, stale, or malformed.

**Fix:** Resolved by fixing Issues 1 and 3. Once the auth flow completes end-to-end, the extension receives and stores a properly formatted `ext_*` token.

---

## Issue 3: Login page ignores redirect parameter — breaks extension auth flow

**Symptom:** The extension auth flow opens a login page at `/login?redirect=/api/extension/auth/callback?redirect_uri=...&extension=true`. The user logs in, but instead of redirecting back to the extension auth callback, the app always navigates to `/dashboard`. The `launchWebAuthFlow` window gets stuck on the dashboard, and the extension never receives a token.

**Root cause:** Both the `useAuth` hook and the login page had hardcoded post-login redirects to `/dashboard`:

```tsx
// use-auth.tsx — onSuccess handler
setLocation("/dashboard");

// login-page.tsx — useEffect watching user state
if (user) {
  setLocation("/dashboard");
}
```

Neither read the `redirect` query parameter that the server sets when initiating the extension auth flow. The extension callback URL (`/api/extension/auth/callback`) is a **server-side route**, so it requires a full page navigation (`window.location.href`), not a client-side route change (`setLocation`).

**Fix (`client/src/hooks/use-auth.tsx` and `client/src/pages/login-page.tsx`):** Check for a `redirect` query parameter after login. If present and valid (starts with `/`, not `//` to prevent open redirects), perform a full page navigation to it:

```tsx
// Added to both useAuth onSuccess and login page useEffect
const urlParams = new URLSearchParams(window.location.search);
const redirect = urlParams.get('redirect');
if (redirect && redirect.startsWith('/') && !redirect.startsWith('//')) {
  window.location.href = redirect;
  return;
}
setLocation("/dashboard");
```

The redirect is validated in both places to cover two scenarios:
- **`useAuth` onSuccess** — fires immediately after login mutation succeeds
- **Login page `useEffect`** — fires when an already-authenticated user visits the login page with a redirect param (e.g., the `launchWebAuthFlow` session already has a valid cookie)

---

## Complete Auth Flow (after fixes)

```
1. User clicks "Sign In" in extension popup
2. Extension calls chrome.identity.launchWebAuthFlow({
     url: "https://app.brokervault.ai/api/extension/auth?redirect_uri=<chromiumapp_url>"
   })
3. Server checks auth → not authenticated → redirects to:
     /login?redirect=%2Fapi%2Fextension%2Fauth%2Fcallback%3Fredirect_uri%3D...&extension=true
4. User enters credentials and submits login form
5. Login succeeds → onSuccess reads redirect param → window.location.href navigates to:
     /api/extension/auth/callback?redirect_uri=https://<id>.chromiumapp.org/
6. Server generates ext_* token, stores in DB, redirects to:
     https://<id>.chromiumapp.org/#token=ext_...&user_id=1&email=user@example.com
7. Chrome intercepts the chromiumapp.org redirect, returns URL to launchWebAuthFlow
8. Extension parses hash fragment → extracts token → stores in chrome.storage.sync
9. Extension is now authenticated and ready to generate CIMs
```

## Files Changed

| File | Change |
|------|--------|
| `chrome-extension/popup/popup.js` | Parse auth token from URL hash fragment instead of query parameters |
| `client/src/hooks/use-auth.tsx` | Respect `redirect` query param in login `onSuccess` handler |
| `client/src/pages/login-page.tsx` | Respect `redirect` query param in authenticated-user redirect `useEffect` |
