# Changelog

All notable changes to the Requirements Estimation System will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added - Estimation History & Comparison (2024-11-16)

#### Features
- **Estimation History Persistence**: 
  - Save multiple estimation scenarios for the same requirement
  - Custom scenario names (e.g., "Base Estimate", "With Integration", "Optimistic")
  - Chronological history view with full estimation details
  - Automatic reload after saving new estimations

- **Scenario Naming Dialog**:
  - Interactive dialog when saving estimations
  - Default name "Default" with ability to customize
  - Validation and error handling
  - Toast notifications for success/failure

- **Estimation Comparison**:
  - Side-by-side comparison of two estimations
  - Visual diff of activities (added/removed with badges)
  - Driver value changes displayed (e.g., LOW → HIGH)
  - Risk differences highlighted
  - Percentage change calculations with trend indicators
  - Color-coded visual feedback (red for increases, green for decreases)

- **Timeline Visualization**:
  - Chronological timeline of all estimations
  - Statistics panel (min, max, average, overall trend)
  - Visual progress bars proportional to effort
  - Delta indicators between consecutive estimates
  - Color coding: green (first), blue (latest), gray (intermediate)
  - Detailed breakdown for each estimation point

#### Components
- `EstimationComparison.tsx`: Comparison component with dropdown selection
- `EstimationTimeline.tsx`: Visual timeline with statistics

#### Database
- Enhanced `estimations` table usage with full relationship tracking
- Additional indexes for performance:
  - `idx_estimations_req_created`
  - `idx_estimations_user_created`
  - `idx_estimation_activities_composite`
  - `idx_estimation_drivers_composite`
  - `idx_estimation_risks_composite`
- New SQL functions:
  - `compare_estimations(uuid, uuid)`: Server-side comparison
  - `get_latest_estimations(uuid)`: Get latest estimate per requirement
- New view: `estimations_with_details` for pre-joined data
- Trigger to update `requirements.updated_at` on estimation save

#### UI/UX Improvements
- History tab now fully functional in RequirementDetail page
- Loading states with spinners
- Empty states with helpful messages
- Responsive card layouts for estimation history
- Interactive elements with hover states
- Badge system for visual status indicators

#### Documentation
- `ESTIMATION_HISTORY.md`: Complete user guide and technical documentation
- `IMPLEMENTATION_SUMMARY.md`: Implementation details and architecture
- `estimation_history_optimizations.sql`: Database optimization scripts
- Updated `README.md` with new features

### Changed
- `RequirementDetail.tsx`: Major refactor to support history management
  - Added state management for estimation history
  - Implemented `loadEstimationHistory()` function
  - Modified save flow to include scenario naming
  - Integrated new components in History tab
- Save estimation flow now includes scenario naming step
- History tab redesigned with timeline and comparison features

### Technical Details

#### Performance
- Optimized queries with composite indexes
- Pre-joined views for faster data retrieval
- Lazy loading of history data only when tab is accessed

#### Security
- All queries respect Row Level Security (RLS) policies
- Users can only view/edit their own estimations
- Proper foreign key constraints and cascading deletes

#### Scalability
- Efficient pagination strategy (ready for >100 estimations)
- Indexed sorting for O(log n) performance
- Minimal re-renders with React hooks optimization

### Migration Notes

To apply the database optimizations:
```sql
-- Run estimation_history_optimizations.sql
-- This adds indexes, views, and functions
-- Safe to run on existing databases
```

### Breaking Changes
None - this is a purely additive feature.

### Known Issues
- No pagination yet for very large histories (>100 items)
- Scenario names cannot be edited after saving
- No ability to delete individual estimations
- Comparison limited to 2 estimations at a time

### Future Enhancements
- Export comparison to PDF/Excel
- Restore previous estimation as starting point
- Add comments/notes to estimations
- Email notifications on new estimations
- Advanced filtering (date range, user, scenario)
- Analytics dashboard with accuracy metrics
- Catalog versioning (track which version of activities was used)

---

## [0.1.0] - 2024-11-XX (Phase 1 MVP)

### Added
- Initial release with core estimation features
- Home wizard for quick estimates (no login required)
- AI-assisted activity selection via OpenAI
- Deterministic calculation engine
- Multi-technology support (Power Platform, Backend, Frontend)
- Supabase authentication and database
- Lists management (CRUD operations)
- Row Level Security implementation
- Netlify Functions for secure API calls
- Complete seed data for activities, drivers, risks, presets

### Security
- Environment variables for sensitive keys
- RLS policies on all user data tables
- Secure authentication flow with Supabase
- CORS configuration for API endpoints
