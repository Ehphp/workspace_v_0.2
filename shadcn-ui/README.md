# Requirements Estimation System - Phase 1 MVP

## 🎯 Overview

A multi-tech requirements estimation system with AI-assisted activity selection and deterministic calculation engine. Built with React, TypeScript, Shadcn-UI, Supabase, and OpenAI.

## ✨ Features (Phase 1)

### Core Functionality
- ✅ **Home Wizard (No Login Required)**: 5-step estimation wizard accessible without authentication
- ✅ **AI-Assisted Activity Selection**: OpenAI suggests relevant activities based on requirement description
- ✅ **Deterministic Calculation Engine**: Transparent formula for effort calculation
- ✅ **Multi-Technology Support**: Power Platform, Backend API, Frontend React, and more
- ✅ **Authentication**: Supabase Auth with email/password
- ✅ **Lists Management**: Create and manage estimation projects
- ✅ **Row Level Security**: Users see only their own data

### Estimation Formula
```
Base Days = Σ(selected activities' base_days)
Driver Multiplier = Π(selected drivers' multipliers)
Subtotal = Base Days × Driver Multiplier
Risk Score = Σ(selected risks' weights)
Contingency % = f(Risk Score)  // 10%, 15%, 20%, or 25%
Total Days = Subtotal × (1 + Contingency %)
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and pnpm
- Supabase account
- OpenAI API key

### 1. Clone and Install

```bash
cd /workspace/shadcn-ui
pnpm install
```

### 2. Database Setup

#### A. Create Supabase Project
1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the project to be ready
3. Get your project URL and anon key from Settings > API

#### B. Execute Database Schema
1. In Supabase dashboard, go to SQL Editor
2. Copy the contents of `supabase_schema.sql`
3. Execute the SQL to create all tables, indexes, RLS policies, and triggers

#### C. Load Seed Data
1. In SQL Editor, copy the contents of `supabase_seed.sql`
2. Execute the SQL to populate:
   - 27 activities (Power Platform, Backend, Frontend, Multi-stack)
   - 5 drivers (Complexity, Environments, Reuse, Stakeholders, Regulation)
   - 8 risks (Integration, Performance, Audit, Migration, etc.)
   - 4 technology presets (PP Basic, PP HR, Backend API, Frontend React)

### 3. Environment Configuration

Create a `.env` file in the root directory:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# OpenAI Configuration
VITE_OPENAI_API_KEY=sk-your-openai-key
```

**Important**: Replace the placeholder values with your actual credentials.

### 4. Start Development Server

```bash
pnpm run dev
```

The application will be available at `http://localhost:5173`

## 📁 Project Structure

```
src/
├── types/
│   ├── database.ts          # Supabase database types
│   └── estimation.ts        # Estimation engine types
├── lib/
│   ├── supabase.ts          # Supabase client & auth helpers
│   ├── estimationEngine.ts  # Deterministic calculation engine
│   └── openai.ts            # AI activity suggestion service
├── hooks/
│   ├── useAuth.ts           # Authentication hook
│   └── useWizardState.ts    # Wizard state management (localStorage)
├── components/
│   ├── auth/
│   │   └── AuthGuard.tsx    # Protected route wrapper
│   ├── wizard/
│   │   ├── WizardStep1.tsx  # Requirement info
│   │   ├── WizardStep2.tsx  # Technology selection
│   │   ├── WizardStep3.tsx  # AI activity suggestions
│   │   ├── WizardStep4.tsx  # Drivers & risks
│   │   └── WizardStep5.tsx  # Results & export
│   └── lists/
│       └── CreateListDialog.tsx
├── pages/
│   ├── Home.tsx             # Landing page + wizard
│   ├── Login.tsx            # Authentication
│   ├── Register.tsx         # User registration
│   └── Lists.tsx            # Projects management
└── App.tsx                  # Main app with routing
```

## 🎮 Usage Guide

### For Anonymous Users (No Login)

1. **Visit Home Page**: Click "Start Free Estimation"
2. **Step 1**: Enter requirement ID, title, and description
3. **Step 2**: Select technology preset (e.g., "Power Platform - HR")
4. **Step 3**: Click "Get AI Suggestions" to auto-select activities, or select manually
5. **Step 4**: Configure drivers (complexity, environments, etc.) and select risks
6. **Step 5**: View estimation results with breakdown
   - Download PDF/CSV (coming soon)
   - Create account to save estimation

### For Authenticated Users

1. **Sign Up/Login**: Create account or sign in
2. **Create Project**: Click "New Project" to create a list
3. **Add Requirements**: (Coming in next iteration)
4. **View Dashboard**: (Phase 2 feature)

## 🔐 Security

### Row Level Security (RLS)
- All user data tables have RLS enabled
- Users can only access their own lists and requirements
- Catalog tables (activities, drivers, risks, presets) are public read-only

### Authentication
- Email/password authentication via Supabase Auth
- Protected routes with AuthGuard component
- Session management with automatic refresh

## 🧪 Testing

```bash
# Run linter
pnpm run lint

# Build for production
pnpm run build
```

## 📊 Database Schema

### Core Catalog Tables
- `activities`: Development activities with base days
- `drivers`: Estimation multipliers
- `risks`: Risk factors with weights
- `technology_presets`: Technology-specific configurations

### User Data Tables
- `lists`: Projects/sprints container
- `requirements`: Individual requirements
- `estimations`: Estimation snapshots
- `estimation_activities`: Selected activities per estimation
- `estimation_drivers`: Selected driver values per estimation
- `estimation_risks`: Selected risks per estimation

## 🛠 Technology Stack

- **Frontend**: React 18, TypeScript, Vite
- **UI**: Shadcn-UI, Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **AI**: OpenAI GPT-4o-mini
- **State Management**: React hooks, localStorage
- **Routing**: React Router v6
- **Forms**: React Hook Form (planned)

## 🚧 Phase 2 Roadmap

- [ ] Requirements CRUD (create, edit, delete)
- [ ] Requirement Detail page with Estimation tab
- [ ] Estimation history and comparison
- [ ] 3-column dashboard (lists, requirements, treemap)
- [ ] Interactive treemap visualization
- [ ] PDF/CSV export implementation
- [ ] Filters and search
- [ ] Bulk import requirements

## 📝 Notes

### AI Behavior
- AI **only suggests** which activities to include
- AI **does not calculate** effort or days
- Calculation is always done by the deterministic engine
- Users can override AI suggestions at any time

### Contingency Calculation
- Risk Score 0-10: 10% contingency
- Risk Score 11-20: 15% contingency
- Risk Score 21-30: 20% contingency
- Risk Score 31+: 25% contingency

### Wizard State
- Wizard data is stored in localStorage
- Data persists across page refreshes
- Reset when starting a new estimation

## 🐛 Troubleshooting

### "Missing Supabase environment variables"
- Ensure `.env` file exists with correct `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Restart dev server after adding environment variables

### "AI suggestions not working"
- Check `VITE_OPENAI_API_KEY` in `.env`
- Verify OpenAI API key is valid and has credits
- Check browser console for error messages
- System falls back to preset defaults if AI fails

### "Cannot read properties of null"
- Ensure database schema and seed data are properly executed
- Check Supabase dashboard for table creation
- Verify RLS policies are enabled

### "User cannot see their lists"
- Check RLS policies in Supabase
- Ensure user is authenticated
- Verify `user_id` matches in database

## 📄 License

This project is part of the MGX platform development.

## 🤝 Contributing

This is Phase 1 MVP. Phase 2 features coming soon!