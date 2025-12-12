# Database Setup Guide

This guide will help you set up the database for Auralis Inventory Management.

## Supabase Setup (Recommended for Initial Testing)

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign up or log in
3. Click "New Project"
4. Fill in project details:
   - Name: `auralis-inventory`
   - Database Password: (save this securely)
   - Region: Choose closest to you
5. Wait for project to be created (~2 minutes)

### 2. Get Your Supabase Credentials

1. In your Supabase project dashboard, go to **Settings** → **API**
2. Copy the following:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)

### 3. Run the Database Schema

1. In Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Copy and paste the contents of `database/schema.sql`
4. Click **Run** (or press Cmd/Ctrl + Enter)
5. Verify tables are created in **Table Editor**
   - You should see: `users`, `employees`, `locations`, `assets`, `asset_comments`

**Note**: If you encounter any errors, make sure you're running the entire schema file. The schema includes:
- Table definitions
- Indexes
- Row Level Security (RLS) policies
- Helper functions
- Triggers for automatic timestamps

### 4. Create Initial Admin User

The application will automatically attempt to create a default admin user on first launch. However, due to Row Level Security (RLS) policies, you may need to complete the setup manually. Here are your options:

#### Option 1: Automatic Creation (Recommended)

The app will automatically try to create a default admin when you first launch it:

1. Start the app: `npm run dev`
2. Check the browser console for messages
3. If successful, you'll see:
   - ✅ Default admin user created
   - Email: `admin@auralis.inc`
   - Password: `Admin@123`
4. **Important**: Change the password after first login!

If automatic creation fails (due to RLS), use Option 2 or 3 below.

#### Option 2: Using Database Function (Easiest)

After running the schema, use the built-in function:

1. Go to **SQL Editor** in Supabase Dashboard
2. Run:
   ```sql
   SELECT initialize_default_admin();
   ```
3. This will create the admin user in the `users` table
4. Then create the user in **Authentication** → **Users**:
   - Email: `admin@auralis.inc`
   - Password: `Admin@123` (or your preferred password)
   - **Auto Confirm User**: Enable this

#### Option 3: Manual Creation

1. **Create in Supabase Auth**:
   - Go to **Authentication** → **Users** → **Add User**
   - Email: `admin@auralis.inc`
   - Password: Set a secure password
   - **Auto Confirm User**: Enable this

2. **Create in Users Table**:
   - Go to **SQL Editor** and run:
   ```sql
   INSERT INTO users (name, email, role, status) 
   VALUES ('System Administrator', 'admin@auralis.inc', 'Admin', 'Active')
   ON CONFLICT (email) DO NOTHING;
   ```

**Important**: 
- The email in the `users` table must match the email in Supabase Auth.
- **Enable "Auto Confirm User"** when creating users in Supabase Dashboard to avoid email confirmation issues.

### 4a. Disable Email Confirmation (Recommended for Development)

To avoid email confirmation issues during development:

1. Go to **Authentication** → **Settings** → **Email Auth**
2. Scroll down to **Email Confirmation**
3. **Disable** "Enable email confirmations"
4. Save changes

**Note**: For production, you may want to keep email confirmation enabled for security.

### 5. Configure Environment Variables

1. Create a `.env` file in the project root (or copy from `.env.example` if it exists)
2. Fill in your Supabase credentials:

```env
VITE_DB_TYPE=supabase
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### 6. Install Dependencies

```bash
npm install @supabase/supabase-js
```

### 7. Test the Connection

Start your development server:

```bash
npm run dev
```

The app should now connect to Supabase. If you see errors, check:
- Environment variables are set correctly
- Supabase project is active
- Database schema has been run successfully

## Local PostgreSQL Setup (Future)

For local development with PostgreSQL:

1. Install PostgreSQL locally
2. Create a database: `createdb auralis_inventory`
3. Run the schema: `psql auralis_inventory < database/schema.sql`
4. Update `.env`:

```env
VITE_DB_TYPE=postgres
VITE_DB_HOST=localhost
VITE_DB_PORT=5432
VITE_DB_NAME=auralis_inventory
VITE_DB_USER=postgres
VITE_DB_PASSWORD=your_password
```

## Database Schema Overview

### Tables

- **users**: System users (admins/IT staff who can log in)
- **employees**: Organization employees (who can be assigned assets)
- **locations**: Office locations
- **assets**: IT and office assets
- **asset_comments**: Comments and audit trail for assets

### Key Features

- UUID primary keys
- Row Level Security (RLS) enabled
- Automatic `updated_at` timestamps
- Indexes for performance
- Foreign key constraints
- Cascade deletes for comments

## Security Notes

- Row Level Security (RLS) is enabled on all tables
- Policies restrict access based on user roles
- Only admins can delete users, employees, locations, and assets
- All authenticated users can read/write most data
- Passwords are managed by Supabase Auth (automatically hashed)
- The `is_admin()` helper function checks user roles securely

## Troubleshooting

### Error: "only WITH CHECK expression allowed for INSERT"

This error occurs when INSERT policies incorrectly use `USING` instead of `WITH CHECK`. The schema has been fixed, but if you see this error:

1. Make sure you're using the latest version of `schema.sql`
2. If you've already run an older version, drop and recreate the policies:
   ```sql
   DROP POLICY IF EXISTS "Authenticated users can insert employees" ON employees;
   DROP POLICY IF EXISTS "Authenticated users can insert locations" ON locations;
   DROP POLICY IF EXISTS "Authenticated users can insert assets" ON assets;
   DROP POLICY IF EXISTS "Authenticated users can insert comments" ON asset_comments;
   DROP POLICY IF EXISTS "Only admins can insert users" ON users;
   ```
3. Then re-run the schema file

### Error: "Cannot insert user - policy violation"

This happens when trying to create the first admin user. Solutions:

1. **Use the database function** (easiest):
   ```sql
   SELECT initialize_default_admin();
   ```

2. **Temporarily disable RLS** (if function doesn't work):
   ```sql
   ALTER TABLE users DISABLE ROW LEVEL SECURITY;
   INSERT INTO users (name, email, role, status) 
   VALUES ('System Administrator', 'admin@auralis.inc', 'Admin', 'Active');
   ALTER TABLE users ENABLE ROW LEVEL SECURITY;
   ```

3. **Create through Supabase Dashboard** (see Step 4 above)

### App shows "Cannot check for admin users due to RLS policies"

This is normal on first launch. The app will guide you to:
1. Create the admin user in Supabase Auth (Dashboard → Authentication → Users)
2. Run `SELECT initialize_default_admin();` in SQL Editor

After this, the app will work normally.

### Login fails with "Email not confirmed" or "Invalid login credentials"

**Solutions**:

1. **Confirm the user's email**:
   - Go to Supabase Dashboard → **Authentication** → **Users**
   - Find the user (e.g., `admin@auralis.inc`)
   - Click the three dots (⋮) → **"Confirm email"**

2. **Or disable email confirmation** (for development):
   - Go to **Authentication** → **Settings** → **Email Auth**
   - Disable **"Enable email confirmations"**
   - Save changes

3. **Verify user exists in both places**:
   - Check **Authentication** → **Users** (Supabase Auth)
   - Check **Table Editor** → **users** table (your custom table)
   - Both must have the same email address

4. **Reset password if needed**:
   - In Supabase Dashboard → **Authentication** → **Users**
   - Click the user → **"Reset password"**
   - Or manually set password when creating user

### Login fails - "password_hash is empty" or user not found in Auth

**Important**: The `password_hash` field in the `users` table is **NOT used for authentication**. Supabase Auth handles all password authentication separately.

**The Real Issue**: If login fails, it's because the user doesn't exist in **Supabase Auth**, not because `password_hash` is empty.

**Solutions**:

1. **For existing users created before the fix**:
   - Go to Supabase Dashboard → **Authentication** → **Users** → **Add User**
   - Create the user with the same email as in your `users` table
   - Set the password
   - Enable **"Auto Confirm User"**
   - The user should now be able to log in

2. **For new users**:
   - The app now automatically creates users in both Supabase Auth and the `users` table
   - When an admin creates a user through the UI, it will be created in both places

3. **Verify user exists in Supabase Auth**:
   - Go to **Authentication** → **Users**
   - Search for the user's email
   - If not found, create it manually (see step 1)

4. **Sync existing users** (if you have many):
   - You can create a script to sync users from the `users` table to Supabase Auth
   - Or manually create each user in Supabase Dashboard

**Note**: The `password_hash` field in the `users` table is only stored for reference and is not used for authentication. You can safely ignore it being empty - what matters is that the user exists in Supabase Auth.

## Migration Notes

When switching from mock data to Supabase:

1. Export your mock data (if any)
2. Run the schema
3. Import data using Supabase dashboard or API
4. Update environment variables
5. Test all CRUD operations


