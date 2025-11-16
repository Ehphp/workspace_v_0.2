# Requirements Estimation System - Setup Guide

## 📋 Prerequisites Checklist

Before starting, ensure you have:

- [ ] Node.js 18 or higher installed
- [ ] pnpm package manager installed
- [ ] A Supabase account (free tier works)
- [ ] An OpenAI API key with available credits
- [ ] A modern web browser (Chrome, Firefox, Safari, Edge)

## 🗄️ Database Setup (Detailed Steps)

### Step 1: Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Click "Start your project" or "New Project"
3. Sign in or create an account
4. Click "New Project"
5. Fill in:
   - **Name**: `requirements-estimation` (or your preferred name)
   - **Database Password**: Create a strong password (save it!)
   - **Region**: Choose closest to your location
   - **Pricing Plan**: Free tier is sufficient for MVP
6. Click "Create new project"
7. Wait 2-3 minutes for project initialization

### Step 2: Get API Credentials

1. In your Supabase project dashboard, click "Settings" (gear icon)
2. Click "API" in the left sidebar
3. You'll see two important values:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJhbGc...` (long string)
4. Copy both values - you'll need them for the `.env` file

### Step 3: Execute Database Schema

1. In Supabase dashboard, click "SQL Editor" in the left sidebar
2. Click "New query"
3. Open the file `supabase_schema.sql` from this project
4. Copy **all** the contents
5. Paste into the SQL Editor
6. Click "Run" (or press Ctrl/Cmd + Enter)
7. Wait for execution to complete
8. You should see "Success. No rows returned"

**What this creates:**
- 10 tables (activities, drivers, risks, technology_presets, lists, requirements, estimations, and junction tables)
- Indexes for performance
- Row Level Security (RLS) policies
- Triggers for automatic timestamp updates

### Step 4: Load Seed Data

1. Still in SQL Editor, click "New query"
2. Open the file `supabase_seed.sql` from this project
3. Copy **all** the contents
4. Paste into the SQL Editor
5. Click "Run"
6. Wait for execution to complete
7. You should see "Success. No rows returned"

**What this loads:**
- 27 activities across Power Platform, Backend, Frontend, and Multi-stack
- 5 drivers (Complexity, Environments, Reuse, Stakeholders, Regulation)
- 8 risks (Integration, Performance, Audit, Migration, Legacy, Scope, Security, Dependencies)
- 4 technology presets (PP Basic, PP HR, Backend API, Frontend React)

### Step 5: Verify Database Setup

1. In Supabase dashboard, click "Table Editor"
2. You should see all these tables:
   - activities
   - drivers
   - risks
   - technology_presets
   - lists
   - requirements
   - estimations
   - estimation_activities
   - estimation_drivers
   - estimation_risks
3. Click on "activities" - you should see 27 rows
4. Click on "drivers" - you should see 5 rows
5. Click on "risks" - you should see 8 rows
6. Click on "technology_presets" - you should see 4 rows

If you see all the data, your database is ready! ✅

## 🔑 OpenAI API Setup

### Step 1: Get OpenAI API Key

1. Go to [https://platform.openai.com](https://platform.openai.com)
2. Sign in or create an account
3. Click your profile icon (top right)
4. Select "API keys"
5. Click "Create new secret key"
6. Give it a name (e.g., "Requirements Estimation")
7. Click "Create secret key"
8. **IMPORTANT**: Copy the key immediately - you won't see it again!
9. The key looks like: `sk-proj-xxxxx...`

### Step 2: Add Credits (if needed)

1. In OpenAI platform, go to "Billing"
2. Add a payment method if you haven't already
3. For this MVP, $5-10 should be more than enough
4. The app uses GPT-4o-mini which is very cost-effective (~$0.01 per estimation)

## ⚙️ Application Configuration

### Step 1: Create Environment File

1. In the project root (`/workspace/shadcn-ui/`), create a file named `.env`
2. Copy the contents from `.env.example`
3. Fill in your actual values:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# OpenAI Configuration
VITE_OPENAI_API_KEY=sk-proj-xxxxx...
```

**Replace:**
- `your-project-id` with your actual Supabase project ID
- The `VITE_SUPABASE_ANON_KEY` with your actual anon key
- The `VITE_OPENAI_API_KEY` with your actual OpenAI key

### Step 2: Install Dependencies

```bash
cd /workspace/shadcn-ui
pnpm install
```

This will install all required packages (~2-3 minutes).

### Step 3: Start Development Server

```bash
pnpm run dev
```

You should see:
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

### Step 4: Test the Application

1. Open your browser to `http://localhost:5173`
2. You should see the landing page with "Requirements Estimation System"
3. Click "Start Free Estimation"
4. Fill in Step 1 (Requirement info)
5. Click Next, select a technology in Step 2
6. Click "Get AI Suggestions" in Step 3
7. If AI works, you'll see activities auto-selected with "AI" badges ✅

## 🧪 Testing Your Setup

### Test 1: Database Connection
```bash
# In browser console (F12), run:
# This should not show any errors
```

### Test 2: Authentication
1. Click "Sign Up" in the top right
2. Enter an email and password
3. Click "Sign Up"
4. You should see "Account created successfully!"
5. You'll be redirected to login
6. Sign in with your credentials
7. You should see the "My Projects" page ✅

### Test 3: Create a Project
1. After logging in, click "New Project"
2. Fill in:
   - Name: "Test Project"
   - Description: "Testing the system"
   - Owner: Your name
   - Status: Active
3. Click "Create Project"
4. You should see your project in the list ✅

### Test 4: AI Suggestions
1. Go back to home (click logo or navigate to `/`)
2. Click "Start Free Estimation"
3. Fill in:
   - ID: TEST-001
   - Title: "Email notification system"
   - Description: "Send automated emails when users complete actions"
4. Click Next
5. Select "Backend - REST API"
6. Click Next
7. Click "Get AI Suggestions"
8. Wait 2-3 seconds
9. You should see activities auto-selected with AI badges ✅

## 🚨 Common Issues & Solutions

### Issue: "Missing Supabase environment variables"
**Solution:**
- Check that `.env` file exists in project root
- Verify variable names start with `VITE_`
- Restart the dev server after creating `.env`

### Issue: "Failed to fetch" or CORS errors
**Solution:**
- Check Supabase project is running (not paused)
- Verify the URL in `.env` is correct
- Check your internet connection

### Issue: AI suggestions not working
**Solution:**
- Verify OpenAI API key is correct in `.env`
- Check OpenAI account has credits
- Look at browser console (F12) for error messages
- The system will fall back to preset defaults if AI fails

### Issue: "Row Level Security policy violation"
**Solution:**
- Ensure you executed `supabase_schema.sql` completely
- Check RLS policies in Supabase dashboard under "Authentication" > "Policies"
- Try signing out and signing back in

### Issue: No data in dropdown/selects
**Solution:**
- Verify you executed `supabase_seed.sql`
- Check Table Editor in Supabase to confirm data exists
- Try refreshing the page

## 📞 Getting Help

If you encounter issues not covered here:

1. Check browser console (F12) for error messages
2. Check Supabase logs in dashboard under "Logs"
3. Verify all environment variables are set correctly
4. Ensure database schema and seed data were executed successfully

## ✅ Setup Complete!

If all tests pass, your Requirements Estimation System is ready to use! 🎉

You can now:
- Create estimations without logging in
- Sign up and manage projects
- Use AI to suggest activities
- Get deterministic effort calculations

Next: Read the main README.md for usage guide and Phase 2 roadmap.