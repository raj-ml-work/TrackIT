## Backend + Auth + Data Provider Plan

Goal: Add a backend that issues JWT access tokens (15 min) and refresh tokens (1 day, httpOnly cookie), while supporting pluggable data providers (Supabase, SQLite, Postgres). SQLite is default for testing; Postgres for deployment.

### Phase 0: Decisions + Contracts
- Backend stack: Node.js + Fastify.
- Auth endpoints (JSON):
  - `POST /auth/login` -> `{ user, accessToken, expiresAt }` + `Set-Cookie: refresh_token=...; HttpOnly; Secure; SameSite=Lax; Path=/auth/refresh`
  - `POST /auth/refresh` -> `{ accessToken, expiresAt }` (refresh cookie required)
  - `POST /auth/logout` -> clears refresh cookie + `{ ok: true }`
  - `GET /auth/me` -> `{ user }` (access token required)
- Token TTLs:
  - access: 15 minutes
  - refresh: 1 day
- Storage rules:
  - client stores access token in memory only (no localStorage).
  - refresh token only in httpOnly cookie (backend-set).

### Phase 1: Backend Foundation (Auth + Providers)
1) Create backend service (e.g., `TrackIT_inventory_management/server`).
2) Add config:
   - `DB_PROVIDER` = `supabase|sqlite|postgres`
   - `JWT_ACCESS_TTL=15m`, `JWT_REFRESH_TTL=1d`
   - `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
   - `SQLITE_PATH` (default dev)
   - `PG_URL` (prod)
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY` (if using Supabase provider)
3) Implement auth routes and cookie handling.
4) Build a provider interface (see Phase 2) and implement SQLite provider first.

### Phase 2: Data Provider Interface + SQLite Provider
Define an internal interface (one file) that matches the operations used by the frontend services:
- Assets: list, get, create, update, delete, comments, serial checks
- Users: list, get, create, update, delete, update password, reset password, update last login
- Locations: list, get, create, update, delete
- Employees: list, get, create, update, delete
- Departments: list, get, create, update, delete
Implement SQLite provider with schema + migrations.

### Phase 3: Postgres Provider
1) Implement provider using the same interface.
2) Add migrations for Postgres (same schema).
3) Switch via `DB_PROVIDER=postgres`.

### Phase 4: Supabase Provider (keep current support)
1) Wrap existing Supabase calls behind the provider interface.
2) Keep existing client-side Supabase logic until the backend is fully proven.

### Phase 5: Frontend Auth + Request Wrapper
1) Update `services/authClient.ts` to call backend auth endpoints.
2) Keep access token in memory and attach to requests.
3) Implement refresh flow on 401 (retry once after `POST /auth/refresh`).
4) Restore session on load via `GET /auth/me` (if refresh succeeds).

### Phase 6: Verification + Docs
- Verify:
  - refresh keeps user logged in
  - access token refreshes automatically
  - refresh token expiry logs out
  - explicit logout clears session
- Document env vars and switching providers.
