# Deployment Guide - Estimation History Feature

## Pre-Deployment Checklist

### Database Updates

1. **Apply Optimization Scripts** (Optional but Recommended)
   ```bash
   # Connect to your Supabase database
   # Run: estimation_history_optimizations.sql
   ```
   
   This will add:
   - Performance indexes
   - Utility views
   - Comparison functions
   - Triggers

2. **Verify Existing Schema**
   - Ensure `estimations` table exists with all fields
   - Verify `estimation_activities`, `estimation_drivers`, `estimation_risks` tables
   - Check RLS policies are enabled

### Frontend Build

1. **Install Dependencies** (if needed)
   ```bash
   pnpm install
   ```

2. **Build Application**
   ```bash
   pnpm run build
   ```

3. **Test Locally**
   ```bash
   pnpm run dev:netlify
   ```
   
   Verify:
   - History tab loads without errors
   - Scenario dialog appears on save
   - Timeline renders with mock data
   - Comparison works with 2+ estimations

### Environment Variables

No new environment variables required. Existing setup should work:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_OPENAI_API_KEY` (Netlify Function)

## Deployment Steps

### 1. Database Deployment

#### Via Supabase Dashboard
1. Go to SQL Editor
2. Copy content of `estimation_history_optimizations.sql`
3. Execute
4. Verify no errors

#### Via CLI
```bash
supabase db push
```

### 2. Application Deployment

#### Netlify (Recommended)
```bash
# If using Netlify CLI
netlify deploy --prod

# Or via Git push (if connected)
git push origin main
```

#### Manual Build
```bash
# Build
pnpm run build

# Deploy /dist folder to your hosting
```

### 3. Post-Deployment Verification

1. **Test Basic Flow**
   - [ ] Login as test user
   - [ ] Navigate to a requirement detail
   - [ ] Configure an estimation
   - [ ] Click "Save Estimation"
   - [ ] Verify scenario dialog appears
   - [ ] Save with custom name
   - [ ] Check History tab

2. **Test History Features**
   - [ ] Create 2-3 estimations with different names
   - [ ] Verify all appear in History tab
   - [ ] Check timeline displays correctly
   - [ ] Select 2 estimations in comparison
   - [ ] Verify differences are shown

3. **Performance Check**
   - [ ] Load history with 10+ estimations
   - [ ] Verify page doesn't lag
   - [ ] Check browser console for errors

4. **Cross-Browser Testing**
   - [ ] Chrome/Edge
   - [ ] Firefox
   - [ ] Safari (if available)

## Rollback Plan

If issues arise:

### Database Rollback
```sql
-- Remove indexes (safe, just slower queries)
DROP INDEX IF EXISTS idx_estimations_req_created;
DROP INDEX IF EXISTS idx_estimations_user_created;
DROP INDEX IF EXISTS idx_estimation_activities_composite;
DROP INDEX IF EXISTS idx_estimation_drivers_composite;
DROP INDEX IF EXISTS idx_estimation_risks_composite;

-- Remove view (safe)
DROP VIEW IF EXISTS estimations_with_details;

-- Remove functions (safe)
DROP FUNCTION IF EXISTS compare_estimations;
DROP FUNCTION IF EXISTS get_latest_estimations;

-- Remove trigger (if needed)
DROP TRIGGER IF EXISTS trigger_update_requirement_on_estimation ON estimations;
DROP FUNCTION IF EXISTS update_requirement_timestamp;
```

### Code Rollback
```bash
# Revert to previous commit
git revert HEAD

# Or specific commit
git revert <commit-hash>

# Push
git push origin main
```

### Quick Fix
If only UI issues, you can hide the features:
```typescript
// In RequirementDetail.tsx, comment out:
// - EstimationTimeline component
// - EstimationComparison component
// Keep basic history list working
```

## Monitoring

### What to Monitor

1. **Database Queries**
   - Check Supabase dashboard for slow queries
   - Monitor `estimations` table size
   - Watch for RLS policy violations

2. **Error Logs**
   - Netlify function logs
   - Browser console errors
   - Supabase logs

3. **User Metrics**
   - How many estimations saved per day
   - How often comparison is used
   - Timeline load times

### Alert Thresholds

- **Query Time** > 2 seconds → Investigate indexes
- **Error Rate** > 5% → Check RLS policies
- **Page Load** > 3 seconds → Consider pagination

## Maintenance

### Regular Tasks

**Weekly:**
- Check error logs
- Monitor database size
- Review slow query log

**Monthly:**
- Analyze usage patterns
- Consider archiving old estimations (>1 year)
- Update documentation if needed

**Quarterly:**
- Performance audit
- User feedback review
- Feature enhancement planning

### Database Maintenance

```sql
-- Check table sizes
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check index usage
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- Vacuum if needed
VACUUM ANALYZE estimations;
VACUUM ANALYZE estimation_activities;
VACUUM ANALYZE estimation_drivers;
VACUUM ANALYZE estimation_risks;
```

## Troubleshooting

### Common Issues

#### Issue: "No history loading"
**Symptoms:** History tab shows empty or loading forever  
**Solution:**
1. Check browser console for errors
2. Verify RLS policies allow SELECT on estimations
3. Check network tab for failed requests
4. Verify user is authenticated

#### Issue: "Comparison not working"
**Symptoms:** Dropdown empty or comparison doesn't show  
**Solution:**
1. Ensure at least 2 estimations exist
2. Check that joins are loading (estimation_activities, etc.)
3. Verify activities/drivers/risks arrays are populated

#### Issue: "Save fails silently"
**Symptoms:** Dialog closes but no toast, history doesn't update  
**Solution:**
1. Check browser console for errors
2. Verify all required fields are present
3. Check Supabase logs for insert errors
4. Ensure user has INSERT permission

#### Issue: "Timeline shows wrong data"
**Symptoms:** Numbers don't match, dates wrong  
**Solution:**
1. Check data types in database (DECIMAL vs INTEGER)
2. Verify timezone handling
3. Check calculation logic in component

### Debug Mode

Enable detailed logging:
```typescript
// In RequirementDetail.tsx
const loadEstimationHistory = async () => {
    console.log('[DEBUG] Loading estimation history for:', reqId);
    
    const { data, error } = await supabase
        .from('estimations')
        .select(...)
        
    console.log('[DEBUG] History data:', data);
    console.log('[DEBUG] History error:', error);
    
    // ... rest of function
};
```

## Support

### Getting Help

1. **Check Documentation**
   - `ESTIMATION_HISTORY.md` - User guide
   - `IMPLEMENTATION_SUMMARY.md` - Technical details
   - `CHANGELOG.md` - Recent changes

2. **Database Issues**
   - Supabase dashboard → Database → Logs
   - Check RLS policies
   - Review query performance

3. **Frontend Issues**
   - Browser DevTools → Console
   - Network tab for API calls
   - React DevTools for component state

### Contact

- **Project Lead**: [Your Name]
- **Database Admin**: [DBA Contact]
- **DevOps**: [DevOps Contact]

---

## Deployment Checklist Summary

- [ ] Database optimizations applied
- [ ] Local testing completed
- [ ] Build successful
- [ ] Deployed to production
- [ ] Post-deployment verification passed
- [ ] Monitoring configured
- [ ] Documentation updated
- [ ] Team notified
- [ ] Rollback plan ready

**Deploy Date:** _________________  
**Deployed By:** _________________  
**Status:** ⬜ Success ⬜ Issues ⬜ Rollback
