# Supabase Integration Guide

This guide explains how to integrate the Auralis Inventory Management system with Supabase.

## Quick Start

### 1. Install Dependencies

```bash
npm install @supabase/supabase-js
```

### 2. Set Up Supabase Project

1. Create a project at [supabase.com](https://supabase.com)
2. Get your project URL and anon key from Settings → API
3. Run the SQL schema from `database/schema.sql` in the Supabase SQL Editor

### 3. Configure Environment Variables

Create a `.env` file in the project root:

```env
VITE_DB_TYPE=supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Update App.tsx to Use Services

The services are ready to use. You'll need to update `App.tsx` to:
- Load data from services instead of mock data
- Save changes to database instead of local state
- Handle loading and error states

## Service Architecture

### Database Layer (`services/database.ts`)
- Configurable database type (Supabase, PostgreSQL, SQL)
- Environment variable configuration
- Easy switching between database types

### Service Layer
- `assetService.ts` - Asset CRUD operations
- `employeeService.ts` - Employee CRUD operations
- `locationService.ts` - Location CRUD operations
- `userService.ts` - User management operations
- `authClient.ts` - Authentication (updated for Supabase)
- `dataService.ts` - Unified service interface

### Supabase Client (`services/supabaseClient.ts`)
- Initializes Supabase client
- Handles authentication
- Provides database connection

## Database Schema

See `database/schema.sql` for complete schema including:
- Tables: users, employees, locations, assets, asset_comments
- Indexes for performance
- Row Level Security (RLS) policies
- Triggers for automatic timestamps

## Migration Path

### Phase 1: Setup (Current)
- ✅ Service layer created
- ✅ Database schema defined
- ✅ Supabase client configured
- ⏳ Frontend integration (next step)

### Phase 2: Integration
- Update App.tsx to use services
- Replace mock data with database calls
- Add loading states
- Add error handling

### Phase 3: Testing
- Test all CRUD operations
- Verify RLS policies
- Test authentication flow
- Performance testing

## Usage Example

```typescript
import { getAssets, createAsset } from './services/dataService';

// Load assets
const assets = await getAssets();

// Create asset
const newAsset = await createAsset({
  name: 'MacBook Pro',
  type: 'Laptop',
  // ... other fields
});
```

## Error Handling

All services throw errors that should be caught:

```typescript
try {
  const assets = await getAssets();
} catch (error) {
  console.error('Failed to load assets:', error);
  // Show user-friendly error message
}
```

## Future: Local Database Support

To switch to local PostgreSQL:

1. Update `.env`:
```env
VITE_DB_TYPE=postgres
VITE_DB_HOST=localhost
VITE_DB_PORT=5432
VITE_DB_NAME=auralis_inventory
VITE_DB_USER=postgres
VITE_DB_PASSWORD=your_password
```

2. Implement local database client in `services/supabaseClient.ts` or create `services/postgresClient.ts`

3. Update service functions to use the appropriate client based on `dbConfig.type`

## Security Notes

- Row Level Security (RLS) is enabled
- Policies restrict access based on user roles
- Passwords should be hashed (Supabase Auth handles this)
- Never commit `.env` file to version control




