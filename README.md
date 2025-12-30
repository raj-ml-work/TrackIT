<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# TrackIT Inventory Management

A modern, glassmorphic inventory management system with role-based access control, employee management, location tracking, and comprehensive asset management. Built with React, TypeScript, and Supabase.

## Features

- 🔐 **Authentication & Authorization**: Role-based access control (Admin/User)
- 📦 **Asset Management**: Complete CRUD operations with asset tracking
- 👥 **Employee Management**: Track employees and asset assignments
- 📍 **Location Management**: Organize assets by location and city
- 👤 **User Management**: Admin-controlled user account management
- 💬 **Audit Trail**: Comments and change tracking for assets
- 📊 **Dashboard Analytics**: Visual insights and distribution metrics
- 🎨 **Modern UI**: Glassmorphic design with smooth animations

## Tech Stack

- **Frontend**: React 19, Vite 6, TypeScript
- **Styling**: Tailwind CSS, Framer Motion
- **Charts**: Recharts
- **Icons**: Lucide React
- **Backend**: Supabase (PostgreSQL) or Local PostgreSQL
- **AI**: Google Gemini (optional, for insights)

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18+ and npm (or yarn/pnpm)
- **Git** for cloning the repository
- **Supabase account** (for cloud database) OR **PostgreSQL** (for local database)

## Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd TrackIT_inventory_management
```

### 2. Install Dependencies

```bash
npm install
```

This will install all required dependencies including:
- React and React DOM
- Vite and build tools
- Supabase client
- UI libraries (Framer Motion, Recharts, Lucide)

### 3. Configure Environment Variables

Create a `.env` file in the project root:

```bash
cp .env.example .env  # If you have an example file
# Or create .env manually
```

### 4. Choose Your Database Configuration

You can run the application with either:
- **Supabase** (cloud, recommended for initial setup)
- **Local PostgreSQL** (for local development)
- **Mock Data** (no database, for UI testing only)

See [Database Configuration](#database-configuration) below for details.

### 5. Start the Development Server

```bash
npm run dev
```

The application will be available at:
- **Local**: http://localhost:3000
- **Network**: http://0.0.0.0:3000 (accessible from other devices on your network)

### 6. Default Login Credentials

When using mock data (no database configured):
- **Admin**: `admin@trackit.inc` / `admin123`
- **User**: `liam@trackit.inc` / `user123`

## Database Configuration

### Option 1: Supabase (Recommended)

Supabase provides a managed PostgreSQL database with authentication, real-time subscriptions, and Row Level Security.

#### Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click **"New Project"**
3. Fill in project details:
   - **Name**: `trackit-inventory` (or your preferred name)
   - **Database Password**: Save this securely
   - **Region**: Choose the closest region to you
4. Wait for the project to be created (~2 minutes)

#### Step 2: Get Your Credentials

1. In your Supabase project dashboard, go to **Settings** → **API**
2. Copy the following:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)

#### Step 3: Run the Database Schema

1. In Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Open `database/schema.sql` from this project
4. Copy and paste the entire contents into the SQL Editor
5. Click **Run** (or press `Cmd/Ctrl + Enter`)
6. Verify tables are created in **Table Editor**:
   - `users`
   - `employees`
   - `locations`
   - `assets`
   - `asset_comments`

#### Step 4: Configure Environment Variables

Update your `.env` file:

```env
# Database Type
VITE_DB_TYPE=supabase

# Supabase Credentials
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

#### Step 5: Create Initial Admin User

The app will automatically attempt to create a default admin user on first launch:

1. Start the app: `npm run dev`
2. Check the browser console - you should see a message about admin creation
3. If successful, default credentials are:
   - **Email**: `admin@trackit.inc`
   - **Password**: `Admin@123`
4. **Important**: Change the password after first login!

**If automatic creation fails** (due to RLS policies), you'll see instructions in the console. You can also:
- Run `SELECT initialize_default_admin();` in Supabase SQL Editor
- Or manually create the user (see `database/README.md` for details)

### Option 2: Local PostgreSQL

For local development with PostgreSQL:

#### Step 1: Install PostgreSQL

- **macOS**: `brew install postgresql`
- **Ubuntu/Debian**: `sudo apt-get install postgresql`
- **Windows**: Download from [postgresql.org](https://www.postgresql.org/download/windows/)

#### Step 2: Create Database

```bash
createdb trackit_inventory
```

Or using psql:

```bash
psql postgres
CREATE DATABASE trackit_inventory;
\q
```

#### Step 3: Run Schema

```bash
psql trackit_inventory < database/schema.sql
```

#### Step 4: Configure Environment Variables

Update your `.env` file:

```env
# Database Type
VITE_DB_TYPE=postgres

# PostgreSQL Connection
VITE_DB_HOST=localhost
VITE_DB_PORT=5432
VITE_DB_NAME=trackit_inventory
VITE_DB_USER=postgres
VITE_DB_PASSWORD=your_password
```

**Note**: Local PostgreSQL support requires additional implementation in the service layer. Currently, only Supabase is fully implemented.

### Option 3: Mock Data (No Database)

If you don't configure a database, the app will run with in-memory mock data:

- No `.env` file needed (or set `VITE_DB_TYPE` to anything other than `supabase`)
- Data is stored in browser localStorage
- Data persists across page refreshes but not across browsers
- Perfect for UI testing and development

## Optional: Gemini AI Integration

To enable AI-powered insights on the dashboard:

1. Get a Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Add to your `.env` file:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

Without this key, the app still runs; the insight panel will simply ask for a key.

## Development

### Available Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Project Structure

```
TrackIT_inventory_management/
├── components/          # React components
│   ├── AssetManager.tsx
│   ├── Dashboard.tsx
│   ├── EmployeeManagement.tsx
│   ├── LocationManagement.tsx
│   ├── UserManagement.tsx
│   └── ...
├── services/            # Backend service layer
│   ├── assetService.ts
│   ├── employeeService.ts
│   ├── locationService.ts
│   ├── userService.ts
│   ├── authClient.ts
│   └── supabaseClient.ts
├── database/            # Database schema and docs
│   ├── schema.sql
│   └── README.md
├── types.ts             # TypeScript type definitions
├── App.tsx              # Main application component
└── package.json
```

### Key Files

- **`App.tsx`**: Main application logic, routing, and state management
- **`services/`**: Database service layer (Supabase/local DB abstraction)
- **`database/schema.sql`**: Complete database schema with RLS policies
- **`types.ts`**: TypeScript interfaces for all data models

## Production Build

### Build the Application

```bash
npm run build
```

This creates an optimized production build in the `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

### Deploy

The `dist/` folder contains static files that can be deployed to:
- **Vercel**: `vercel deploy`
- **Netlify**: Drag and drop `dist/` folder
- **GitHub Pages**: Configure in repository settings
- **Any static hosting**: Upload `dist/` contents

**Important**: For production, ensure:
1. Environment variables are set in your hosting platform
2. Supabase RLS policies are configured correctly
3. CORS is configured in Supabase (Settings → API → CORS)

## Troubleshooting

### Issue: "Failed to resolve import @supabase/supabase-js"

**Solution**: Install dependencies:
```bash
npm install
```

### Issue: "Cannot connect to Supabase"

**Solutions**:
1. Verify `.env` file has correct `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
2. Check Supabase project is active (not paused)
3. Verify database schema has been run
4. Check browser console for specific error messages

### Issue: "User not found" or authentication errors

**Solutions**:
1. Ensure user exists in Supabase Auth (not just the `users` table)
2. Check user status is `ACTIVE` in the `users` table
3. Verify RLS policies allow the user to read their own data

### Issue: Port 3000 already in use

**Solution**: Change the port in `vite.config.ts`:
```typescript
server: {
  port: 3001, // or any available port
}
```

### Issue: Data not persisting

**Solutions**:
1. Check if database is configured (not using mock data)
2. Verify Supabase connection is working
3. Check browser console for errors
4. Verify RLS policies allow write operations

## Security Notes

- **Row Level Security (RLS)**: Enabled on all Supabase tables
- **Environment Variables**: Never commit `.env` to version control
- **API Keys**: Store securely and rotate regularly
- **Passwords**: Supabase Auth handles password hashing automatically
- **CORS**: Configure allowed origins in Supabase dashboard

## Additional Documentation

- **Database Setup**: See `database/README.md` for detailed database setup
- **Integration Guide**: See `INTEGRATION_GUIDE.md` for service layer details
- **Backend Setup**: See `BACKEND_SETUP.md` for architecture overview

## Support

For issues, questions, or contributions:
1. Check existing documentation in `database/README.md` and `INTEGRATION_GUIDE.md`
2. Review error messages in browser console
3. Verify environment variables are set correctly
4. Check Supabase dashboard for database errors

## License

[Add your license information here]
