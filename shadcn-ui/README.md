# Requirements Estimation System - Enterprise Edition

## 🎯 Overview

An **enterprise-grade** multi-technology requirements estimation system with AI-assisted activity selection and deterministic calculation engine. Built with React 19, TypeScript, Shadcn-UI, Supabase, and OpenAI GPT-4.

The system provides transparent, repeatable effort estimation for software requirements across multiple technology stacks (Power Platform, Backend APIs, Frontend React, Multi-stack), combining AI intelligence for activity suggestions with a deterministic calculation engine for consistent results.

## ✨ Features

### Core Functionality
- ✅ **Home Wizard (No Login Required)**: 5-step estimation wizard accessible without authentication for quick demos
- ✅ **AI-Assisted Activity Selection**: OpenAI GPT-4 suggests relevant activities based on requirement description + technology context
- ✅ **Deterministic Calculation Engine**: Transparent, repeatable formula for effort calculation
- ✅ **Multi-Technology Support**: Power Platform, Backend API, Frontend React, Multi-stack presets
- ✅ **Authentication**: Supabase Auth with email/password and Row Level Security
- ✅ **Lists Management**: Create and manage estimation projects/sprints
- ✅ **Requirements CRUD**: Complete create, read, update, delete operations for requirements
- ✅ **Multiple Estimation Scenarios**: Save multiple estimates per requirement with custom scenario names

### Import/Export Features
- ✅ **Excel/CSV Import**: Bulk import requirements from Excel or CSV files
  - Multi-sheet support with sheet selection
  - Intelligent column mapping with auto-detection
  - Multi-column merge for complex descriptions
  - AI-generated titles for missing titles
  - Validation and duplicate detection
  - Preview before import with error reporting
  - Downloadable template file
- ✅ **PDF Export**: Export estimates with detailed breakdown (jsPDF + jsPDF-AutoTable)
- ✅ **Excel Export**: Multi-sheet workbook (requirements + estimations + KPI)

### Advanced Estimation Features
- ✅ **Estimation History**: Complete audit trail with chronological history of all estimates
- ✅ **Scenario Management**: Save multiple estimation versions (e.g., "Base", "Optimistic", "With Integration")
- ✅ **Comparison Tool**: Side-by-side comparison of two estimates with diff visualization
- ✅ **Timeline Visualization**: Visual evolution of estimates over time with statistics
- ✅ **Bulk Estimation**: Estimate multiple requirements in batch with AI suggestions
- ✅ **Real-time Calculation**: Live updates as activities, drivers, and risks are selected

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
- OpenAI API key (for AI suggestions - handled securely via Netlify Functions)

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

# OpenAI Configuration (Server-side only for Netlify Functions)
# This key is NOT exposed to the browser
OPENAI_API_KEY=sk-your-openai-key
```

**Important**: 
- Replace the placeholder values with your actual credentials
- The `OPENAI_API_KEY` (no VITE_ prefix) is used only by Netlify Functions
- In production, set `OPENAI_API_KEY` in your hosting provider's environment variables

### 4. Start Development Server

```bash
pnpm run dev
```

The application will be available at `http://localhost:5173`

## 📁 Project Structure

```
src/
├── types/
│   ├── database.ts              # Supabase database types
│   ├── estimation.ts            # Estimation engine types
│   └── ai-validation.ts         # AI input sanitization
├── lib/
│   ├── supabase.ts              # Supabase client & auth helpers
│   ├── estimationEngine.ts      # ⭐ Deterministic calculation engine
│   ├── excelParser.ts           # ⭐ Excel/CSV parsing with XLSX library
│   ├── openai.ts                # ⭐ AI proxy: suggest activities + generate titles
│   └── constants.ts             # App constants (priority/state variants)
├── hooks/
│   ├── useAuth.ts               # Authentication hook
│   ├── useWizardState.ts        # Wizard state management (Zustand)
│   ├── useEstimationData.ts     # Fetch catalogs (activities/drivers/risks)
│   ├── useEstimationHistory.ts  # Fetch estimation history
│   ├── useEstimationState.ts    # Estimation calculation state
│   └── useRequirement.ts        # CRUD operations for requirements
├── components/
│   ├── auth/
│   │   └── AuthGuard.tsx        # Protected route wrapper
│   ├── wizard/
│   │   ├── WizardStep1.tsx      # Requirement info input
│   │   ├── WizardStep2.tsx      # Technology preset selection
│   │   ├── WizardStep3.tsx      # AI activity suggestions
│   │   ├── WizardStep4.tsx      # Drivers & risks selection
│   │   └── WizardStep5.tsx      # Results & breakdown display
│   ├── estimation/
│   │   ├── EstimationComparison.tsx  # ⭐ Compare two estimates
│   │   ├── EstimationTimeline.tsx    # ⭐ Timeline visualization
│   │   ├── ActivitiesSection.tsx     # Activities selection UI
│   │   ├── DriversSection.tsx        # Drivers configuration
│   │   ├── RisksSection.tsx          # Risks selection
│   │   ├── TechnologySection.tsx     # Technology preset picker
│   │   └── CalculationSummary.tsx    # Real-time calculation display
│   ├── requirements/
│   │   ├── ImportRequirementsDialog.tsx  # ⭐ Excel import wizard
│   │   ├── BulkEstimateDialog.tsx        # Bulk estimation tool
│   │   ├── CreateRequirementDialog.tsx   # Create new requirement
│   │   └── DeleteRequirementDialog.tsx   # Delete confirmation
│   ├── lists/
│   │   ├── CreateListDialog.tsx      # Create new list
│   │   └── ClearListDialog.tsx       # Clear list confirmation
│   └── ui/                       # Shadcn-UI components (buttons, dialogs, etc.)
├── pages/
│   ├── Home.tsx                  # Landing page + public wizard
│   ├── Login.tsx                 # Authentication
│   ├── Register.tsx              # User registration
│   ├── Lists.tsx                 # Projects/lists management
│   ├── Requirements.tsx          # ⭐ Requirements list + import/export
│   └── RequirementDetail.tsx     # ⭐ Requirement detail + estimation + history
└── App.tsx                       # Main app with routing

netlify/functions/
└── ai-suggest.ts                 # ⭐ Serverless OpenAI proxy with caching

SQL files:
├── supabase_schema.sql                      # ⭐ Complete DB schema + RLS + triggers
├── supabase_seed.sql                        # ⭐ Seed data (27 activities + 5 drivers + 8 risks + 4 presets)
└── estimation_history_optimizations.sql     # Performance indexes + views
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

#### Creating and Managing Lists (Projects)
1. **Sign Up/Login**: Create account or sign in
2. **Create List**: Click "New List" to create a project/sprint container
3. **Configure List**: Set name, description, owner, and default technology preset

#### Managing Requirements
1. **Add Single Requirement**: Click "+ New Requirement" to create one requirement
   - Enter ID, title, description, priority, state, business owner
   - Select technology preset
   - Add labels for categorization

2. **Bulk Import from Excel/CSV**: Click "Import from Excel"
   - Upload .xlsx, .xls, or .csv file
   - Select sheet (if multiple sheets)
   - Map columns to requirement fields:
     - **Intelligent auto-detection**: system suggests column mappings
     - **Multi-column merge**: combine multiple columns into description
     - **AI title generation**: generates titles from descriptions if missing
   - Preview imported data with validation
   - Confirm import (duplicates are automatically skipped)
   - Download template file for reference

#### Estimating Requirements
1. **Single Estimation**:
   - Click on a requirement to open detail page
   - Go to "Estimation" tab
   - Click "Suggest Activities with AI" or select manually
   - Configure drivers (Complexity, Environments, Reuse, Stakeholders, Regulation)
   - Select applicable risks
   - Review real-time calculation
   - Save with custom scenario name (e.g., "Base", "Optimistic", "With API Integration")

2. **Bulk Estimation**:
   - Select multiple requirements (checkbox)
   - Click "Bulk Estimate"
   - System runs AI suggestions for all selected requirements in parallel
   - Review and adjust estimates
   - Save all at once

3. **View Estimation History**:
   - Go to "History" tab in requirement detail
   - See chronological list of all saved estimates
   - View timeline visualization with trend analysis
   - Compare any two estimates to see differences

#### Exporting Data
- **Export PDF**: Download individual estimate with breakdown
- **Export Excel**: Download multi-sheet workbook with requirements, estimations, and KPI

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

- **Frontend**: React 19, TypeScript, Vite
- **UI**: Shadcn-UI (Radix UI + Tailwind CSS)
- **Database**: Supabase (PostgreSQL with Row Level Security)
- **Authentication**: Supabase Auth (email/password)
- **AI**: OpenAI GPT-4 (via Netlify Functions serverless proxy)
- **State Management**: Zustand (local state) + React Query (server state)
- **Routing**: React Router v6
- **Forms**: React Hook Form + Zod validation
- **Excel/CSV**: XLSX library for parsing and generation
- **PDF Export**: jsPDF + jsPDF-AutoTable
- **Deployment**: Netlify with serverless functions

## ✅ Implemented Features (Phase 1 Complete)

### Core Features
- [x] **Home Wizard**: Public estimation wizard (no login required)
- [x] **Authentication**: Email/password with Supabase Auth
- [x] **Lists Management**: CRUD operations for projects/sprints
- [x] **Requirements Management**: Complete CRUD with filtering and search
- [x] **Deterministic Estimation Engine**: Transparent calculation formula
- [x] **AI Activity Suggestions**: OpenAI GPT-4 integration via serverless functions
- [x] **Row Level Security**: PostgreSQL RLS policies for multi-tenancy

### Import/Export
- [x] **Excel/CSV Import**: Bulk import with intelligent column mapping and AI title generation
- [x] **PDF Export**: Individual estimate export with breakdown
- [x] **Excel Export**: Multi-sheet workbook (requirements + estimations + KPI)
- [x] **Template Download**: Sample Excel template for bulk import

### Estimation Features
- [x] **Multiple Scenarios**: Save multiple estimates per requirement with custom names
- [x] **Estimation History**: Chronological audit trail of all estimates
- [x] **Comparison Tool**: Side-by-side diff of two estimates
- [x] **Timeline Visualization**: Evolution graph with statistics (min/max/avg/trend)
- [x] **Bulk Estimation**: Batch estimate multiple requirements with AI
- [x] **Real-time Calculation**: Live updates during estimation configuration

### Advanced Features
- [x] **AI Caching**: In-memory cache (5 min TTL) to reduce API costs
- [x] **Input Sanitization**: Anti-injection protection for AI prompts
- [x] **Fallback Mechanisms**: Graceful degradation if AI unavailable
- [x] **Responsive Design**: Mobile-friendly UI
- [x] **Performance Optimization**: React Query caching, lazy loading

📖 **Documentation**: See [ESTIMATION_HISTORY.md](./ESTIMATION_HISTORY.md) for detailed estimation history features and usage examples.

## 🚧 Future Enhancements (Phase 2)

- [ ] **Dashboard Analytics**: Advanced KPI visualizations
- [ ] **Treemap Visualization**: Interactive effort distribution by technology/group
- [ ] **Parent-Child Requirements**: Hierarchical requirement structure
- [ ] **Workflow Approvals**: Multi-level approval process
- [ ] **Email Notifications**: Automated alerts for key events
- [ ] **Custom Templates**: User-defined requirement templates
- [ ] **Public API**: REST API for external integrations
- [ ] **Custom Activity Catalog**: List-specific activity overrides
- [ ] **Multi-tenant Workspaces**: Shared team workspaces
- [ ] **Audit Log**: Complete change tracking
- [ ] **Gantt Chart Export**: Timeline planning view

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
- Check `OPENAI_API_KEY` in `.env` (no VITE_ prefix - server-side only)
- For local dev with Netlify Functions: use `pnpm run dev:netlify` instead of `pnpm run dev`
- Verify OpenAI API key is valid and has available credits
- Check browser console and Netlify function logs for detailed errors
- System automatically falls back to preset defaults if AI service fails gracefully

### "Excel import not parsing correctly"
- Ensure file is .xlsx, .xls, or .csv format
- Check that first row contains column headers
- Verify ID column exists (required field)
- Use column mapping UI to manually assign columns if auto-detection fails
- Download the template file for reference structure
- Check browser console for detailed parsing errors

### "Bulk estimation taking too long"
- AI processes requests in parallel but may take time for large batches
- Check network connectivity and OpenAI API rate limits
- Consider splitting into smaller batches (10-20 requirements at a time)
- Monitor progress bar for status updates

### "Cannot read properties of null"
- Ensure database schema and seed data are properly executed
- Check Supabase dashboard for table creation
- Verify RLS policies are enabled

### "User cannot see their lists"
- Check RLS policies in Supabase
- Ensure user is authenticated
- Verify `user_id` matches in database

## 📊 Key Highlights

### Excel Import System (Enterprise-Grade)
- **Robust Parsing**: XLSX library for multi-format support (.xlsx, .xls, .csv)
- **Intelligent Mapping**: Auto-detects columns using pattern matching algorithms
- **Multi-Column Merge**: Combine multiple Excel columns into single description field
- **AI Fallback**: Automatically generates titles from descriptions using GPT-4
- **Validation**: Pre-import validation with error reporting and duplicate detection
- **Template Support**: Downloadable sample template for users

### AI Integration (Cost-Optimized)
- **Compact Prompts**: ~60-70% token reduction for cost efficiency
- **In-Memory Caching**: 5-minute TTL cache reduces redundant API calls
- **Graceful Fallback**: Uses preset defaults if AI service unavailable
- **Input Sanitization**: Anti-injection protection for secure prompt handling
- **Serverless Architecture**: Netlify Functions keep API keys secure server-side

### Estimation History (Complete Audit Trail)
- **Named Scenarios**: Track different estimate versions with descriptive names
- **Timeline Visualization**: Visual evolution graph with trend analysis
- **Diff Viewer**: Granular comparison showing added/removed/changed items
- **Statistics**: Aggregate metrics (min/max/average/trend percentage)
- **Performance Optimized**: Dedicated database indexes and views for fast queries

### Security & Performance
- **Row Level Security**: PostgreSQL RLS for secure multi-tenancy
- **React Query Caching**: Automatic cache invalidation and background refetching
- **Lazy Loading**: Code-splitting for optimal bundle size
- **Debounced Operations**: Search and filter optimizations
- **Vite Build Optimization**: Fast builds and hot module replacement

## 📄 License

This project is part of the MGX platform development.

## 🤝 Contributing

Phase 1 MVP completed with all core features implemented. Phase 2 enhancements planned for Q1 2026.