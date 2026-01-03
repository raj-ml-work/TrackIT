# JWT Authentication Plan

Goal: Implement JWT-based authentication with access-token expiry, refresh tokens, and session restoration on refresh, while keeping explicit logout behavior.

## Scope
- Target app: `TrackIT_inventory_management/App.tsx` (confirm if this is the runtime entry).
- Replace current "rememberMe-only localStorage session" with JWT access/refresh flow.

## Plan
1. **Finalize token model**
   - Access token TTL (e.g., 15 minutes).
   - Refresh token TTL (e.g., 7 days).
   - Decide storage: refresh token in `localStorage` (simple) vs `httpOnly` cookie (more secure).
   - Add expiry fields to `AuthSession` in `TrackIT_inventory_management/types.ts`.

2. **Update auth client API**
   - `login(credentials) -> { user, accessToken, refreshToken, expiresAt }`.
   - `restoreSession()` uses refresh token to fetch a new access token (or returns null).
   - `refreshAccessToken()` to handle expiry and 401s.
   - `logout()` clears stored refresh token and local session data.
   - Files: `TrackIT_inventory_management/services/authClient.ts`.

3. **Persist session and refresh on load**
   - Store refresh token and user in storage.
   - On app init, call `restoreSession()` and hydrate session.
   - Update `TrackIT_inventory_management/App.tsx` to handle async restore and loading state.

4. **Attach access token to API calls**
   - Centralize token attachment in request layer (e.g., `services/dataService.ts` or a new fetch wrapper).
   - Add a retry-once path for 401 that calls `refreshAccessToken()` and retries the request.

5. **Handle expiry + logout UX**
   - If refresh fails, clear session and send to login.
   - Ensure explicit logout always takes the user to login.
   - Keep current view on refresh when session is valid.

6. **Verification**
   - Refresh with valid session keeps you on current page.
   - Access token expiry triggers refresh flow without logging out.
   - Refresh token expiry logs out.
   - Manual logout clears session and redirects to login.

## Questions to Resolve
- Which entry app is active: `TrackIT_inventory_management/App.tsx` or `TrackIT_inventory_management/src/App.tsx`?
- Preferred refresh token storage: `localStorage` or server-set `httpOnly` cookie?
- Confirm TTLs for access/refresh tokens.
