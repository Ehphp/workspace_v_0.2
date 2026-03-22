# Requirements Estimation System - Phase 1 MVP Todo

## Overview
Building a multi-tech requirements estimation system with AI-assisted activity selection and deterministic calculation engine.

## Phase 1 - Core MVP (Priority)

### 1. Database Schema & Seed Data
- [ ] Create Supabase schema SQL file with tables:
  - activities (id, code, description, base_days, technology, group, created_at)
  - drivers (id, code, name, description, values_json, created_at)
  - risks (id, code, name, description, weight, created_at)
  - technology_presets (id, code, name, description, default_drivers_json, created_at)
  - lists (id, user_id, name, description, owner, status, created_at, updated_at)
  - requirements (id, list_id, req_id, title, description, tech_preset_id, priority, state, business_owner, labels, created_at, updated_at)
  - estimations (id, requirement_id, user_id, total_days, base_days, driver_multiplier, risk_score, contingency_percent, created_at)
  - estimation_activities (estimation_id, activity_id, is_ai_suggested)
  - estimation_drivers (estimation_id, driver_id, selected_value)
  - estimation_risks (estimation_id, risk_id)
- [ ] Implement RLS policies (users see only their own lists)
- [ ] Create seed data SQL from provided JSON

### 2. Types & Interfaces
- [ ] src/types/database.ts - Supabase types
- [ ] src/types/estimation.ts - Estimation engine types

### 3. Supabase Client Setup
- [ ] src/lib/supabase.ts - Supabase client configuration
- [ ] Environment variables setup

### 4. Authentication
- [ ] src/pages/Login.tsx - Login page
- [ ] src/pages/Register.tsx - Register page
- [ ] src/components/auth/AuthGuard.tsx - Protected route wrapper
- [ ] Auth context/hooks

### 5. Estimation Engine (Deterministic)
- [ ] src/lib/estimationEngine.ts
  - calculateBaseDays(activities)
  - calculateDriverMultiplier(drivers)
  - calculateRiskScore(risks)
  - calculateContingency(riskScore)
  - calculateTotalDays(baseDays, driverMult, contingency)

### 6. OpenAI Integration
- [ ] src/lib/openai.ts - AI suggestion service
  - suggestActivities(description, preset, activities, drivers, risks)
  - Returns: { activities: string[], drivers: object, risks: string[] }

### 7. Home Wizard (No Login Required)
- [ ] src/pages/Home.tsx - Landing page with wizard
- [ ] src/components/wizard/WizardStep1.tsx - Requirement info (ID, title, description)
- [ ] src/components/wizard/WizardStep2.tsx - Technology preset selection
- [ ] src/components/wizard/WizardStep3.tsx - AI activity suggestion + manual selection
- [ ] src/components/wizard/WizardStep4.tsx - Drivers & Risks selection
- [ ] src/components/wizard/WizardStep5.tsx - Results with breakdown
- [ ] src/hooks/useWizardState.ts - LocalStorage state management
- [ ] Export PDF/CSV functionality

### 8. Lists Management (Authenticated)
- [ ] src/pages/Lists.tsx - Lists overview page
- [ ] src/components/lists/ListCard.tsx - List card component
- [ ] src/components/lists/CreateListDialog.tsx - Create/edit list dialog
- [ ] src/components/lists/ListFilters.tsx - Filter by status
- [ ] CRUD operations for lists

### 9. Requirements Management (Authenticated)
- [ ] src/pages/Requirements.tsx - Requirements list for selected list
- [ ] src/components/requirements/RequirementCard.tsx - Requirement card
- [ ] src/components/requirements/CreateRequirementDialog.tsx - Create/edit requirement
- [ ] src/components/requirements/RequirementFilters.tsx - Filter by tech/priority/state
- [ ] CRUD operations for requirements

### 10. Requirement Detail - Estimation Tab
- [ ] src/pages/RequirementDetail.tsx - Main detail page with tabs
- [ ] src/components/estimation/TechnologySection.tsx - Tech preset + AI recalculate button
- [ ] src/components/estimation/DriversSection.tsx - Driver selects with real-time multiplier
- [ ] src/components/estimation/ActivitiesSection.tsx - Activities checkboxes with AI/Preset badges
- [ ] src/components/estimation/RisksSection.tsx - Risks checkboxes with real-time score
- [ ] src/components/estimation/CalculationSummary.tsx - Real-time calculation display
- [ ] Save estimation functionality

### 11. Shared Components
- [ ] src/components/ui/Badge.tsx - Priority/State/AI badges
- [ ] src/components/layout/Header.tsx - App header with auth
- [ ] src/components/layout/Sidebar.tsx - Navigation sidebar

### 12. Routing
- [ ] Update src/App.tsx with all routes
- [ ] Protected routes for authenticated pages
- [ ] Public routes for home wizard

## File Structure
```
src/
├── types/
│   ├── database.ts
│   └── estimation.ts
├── lib/
│   ├── supabase.ts
│   ├── estimationEngine.ts
│   └── openai.ts
├── hooks/
│   ├── useAuth.ts
│   ├── useWizardState.ts
│   └── useEstimation.ts
├── components/
│   ├── auth/
│   │   └── AuthGuard.tsx
│   ├── wizard/
│   │   ├── WizardStep1.tsx
│   │   ├── WizardStep2.tsx
│   │   ├── WizardStep3.tsx
│   │   ├── WizardStep4.tsx
│   │   └── WizardStep5.tsx
│   ├── lists/
│   │   ├── ListCard.tsx
│   │   ├── CreateListDialog.tsx
│   │   └── ListFilters.tsx
│   ├── requirements/
│   │   ├── RequirementCard.tsx
│   │   ├── CreateRequirementDialog.tsx
│   │   └── RequirementFilters.tsx
│   ├── estimation/
│   │   ├── TechnologySection.tsx
│   │   ├── DriversSection.tsx
│   │   ├── ActivitiesSection.tsx
│   │   ├── RisksSection.tsx
│   │   └── CalculationSummary.tsx
│   └── layout/
│       ├── Header.tsx
│       └── Sidebar.tsx
├── pages/
│   ├── Home.tsx
│   ├── Login.tsx
│   ├── Register.tsx
│   ├── Lists.tsx
│   ├── Requirements.tsx
│   └── RequirementDetail.tsx
└── App.tsx
```

## Dependencies to Add
- @supabase/supabase-js
- openai
- jspdf
- react-hook-form
- zod
- date-fns

## Notes
- AI only suggests activities, never calculates days
- All calculations are deterministic and transparent
- RLS ensures data isolation per user
- LocalStorage for wizard (no login required)
- Real-time calculation updates in estimation tab