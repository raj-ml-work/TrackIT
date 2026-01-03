## Backend Auth + Data Setup

This guide covers running the new backend auth flow and switching DB providers.

### Backend (Fastify) setup
1) Install deps:
   - `cd TrackIT_inventory_management/server`
   - `npm install`
2) Configure env (examples):
   - `JWT_ACCESS_SECRET=change_me`
   - `JWT_REFRESH_SECRET=change_me`
   - `JWT_ACCESS_TTL=15m`
   - `JWT_REFRESH_TTL=1d`
   - `CORS_ORIGIN=http://localhost:5173`
   - `DB_PROVIDER=sqlite`
   - `SQLITE_PATH=../data/inventory.db`
3) Run:
   - `npm run dev`

### SQLite (default for testing)
- `DB_PROVIDER=sqlite`
- Ensure `SQLITE_PATH` points to a writable location.
- On first boot, schema is applied from `database/schema_sqlite.sql` and the default admin is created.

### Postgres (for deployment)
1) Set env:
   - `DB_PROVIDER=postgres`
   - `PG_URL=postgres://user:pass@host:5432/dbname`
2) Apply schema:
   - `cd TrackIT_inventory_management/server`
   - `npm run apply-schema`
3) Run server:
   - `npm run dev`

### Supabase (existing option)
- Keep the current frontend Supabase flow. Backend providers do not replace Supabase yet.
- Use Supabase for data access in the frontend by leaving `VITE_API_URL` unset.

### Frontend auth configuration
- `VITE_API_URL=http://localhost:4000` enables backend auth flow.
- Access token stays in memory; refresh token is stored in an httpOnly cookie.
- The login form still accepts `rememberMe`, but backend auth does not use local storage.

### Verification checklist
1) Login succeeds and `POST /auth/login` returns `accessToken`.
2) Refresh token cookie is set after login.
3) App refresh keeps user logged in (`POST /auth/refresh` + `GET /auth/me`).
4) Access token expiry triggers refresh and retry.
5) Refresh token expiry logs out.
6) Manual logout clears session (`POST /auth/logout`).
