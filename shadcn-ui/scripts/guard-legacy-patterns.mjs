#!/usr/bin/env node
/**
 * STEP 2 — Architectural Guard: No new legacy patterns in src/
 *
 * Blocks client-side activity filtering by tech_category or direct
 * technology_activities pivot usage. These patterns must live server-side
 * only (netlify/functions/lib/activities.ts).
 *
 * Allowed exceptions are listed in ALLOWED_FILES — these are known legacy
 * files that will be cleaned up in STEP 4. The guard ensures the debt
 * doesn't GROW.
 *
 * Usage:
 *   node scripts/guard-legacy-patterns.mjs        # check
 *   node scripts/guard-legacy-patterns.mjs --fix   # show file-by-file guidance
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

// ── Known legacy files (STEP 4 will clean these up) ──────────────────────
// Any NEW file using these patterns will fail the guard.
const ALLOWED_FILES = new Set([
  // Legacy hooks (to be removed in STEP 4)
  'src/hooks/usePresetManagement.ts',
  // Canonical pipeline — reads tech_category to build API payload, not for filtering
  'src/hooks/useQuickEstimationV2.ts',
  'src/components/requirements/wizard/WizardStep2.tsx',
  // Canonical helper — ALLOWED to use tech_category as fallback
  'src/lib/technology-helpers.ts',
  // Types — structural definitions, not logic
  'src/types/database.ts',
  'src/types/domain-model.ts',
  // Configuration admin pages — display/CRUD, not estimation logic
  'src/components/configuration/presets/ActivityDialog.tsx',
  'src/components/configuration/presets/AiAssistPanel.tsx',
  'src/components/configuration/presets/PresetPreviewDialog.tsx',
  'src/components/configuration/presets/PresetTableRow.tsx',
  'src/components/configuration/presets/TechnologyDialog.tsx',
  'src/pages/configuration/ConfigurationActivities.tsx',
  'src/pages/configuration/ConfigurationPresets.tsx',
  // List management — display, not estimation
  'src/components/lists/EditListDialog.tsx',
  'src/components/lists/ListTechnologyDialog.tsx',
  // Estimation section — display tech badge
  'src/components/estimation/TechnologySection.tsx',
  // Domain save — persistence, passes through
  'src/lib/domain-save.ts',
  'src/lib/api.ts',
  // Mock data
  'src/lib/mockData.ts',
  // Tests — allowed to test legacy paths
  'src/test/sprint1.test.ts',
  'src/test/aiStructuredOutputs.test.ts',
  'src/test/aiVariance.test.ts',
  'src/test/blueprint-activity-mapper.test.ts',
  'src/test/estimationHistory.test.tsx',
  'src/test/impactMap.test.ts',
  'src/test/provenance-map.test.ts',
  'src/test/requirementUnderstanding.test.ts',
]);

// ── Blocked patterns ────────────────────────────────────────────────────
const BLOCKED_PATTERNS = [
  {
    name: 'client-side tech_category filtering',
    regex: /\.filter\([^)]*tech_category/g,
    message: 'Activity filtering by tech_category must happen server-side (fetchActivitiesServerSide).',
  },
  {
    name: 'tech_category equality check for decisions',
    regex: /(?:\.tech_category\s*===\s*(?!['"]MULTI['"]))/g,
    message: 'Do not branch on tech_category. Use technology_id FK via server-side fetch.',
  },
  {
    name: 'direct technology_activities query',
    regex: /\.from\(['"]technology_activities['"]\)/g,
    message: 'Do not query technology_activities pivot table from client. Use server-side activity fetch.',
  },
  {
    name: 'client-side Supabase activity query with tech_category filter',
    regex: /tech_category\.eq\./g,
    message: 'Do not filter activities by tech_category in Supabase queries. Use technology_id FK server-side.',
  },
];

// ── File walker ─────────────────────────────────────────────────────────
function walkDir(dir, ext) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...walkDir(full, ext));
    } else if (ext.some(e => full.endsWith(e))) {
      results.push(full);
    }
  }
  return results;
}

// ── Main ────────────────────────────────────────────────────────────────
const srcDir = join(process.cwd(), 'src');
const files = walkDir(srcDir, ['.ts', '.tsx']);
const violations = [];

for (const filePath of files) {
  const rel = relative(process.cwd(), filePath).replaceAll('\\', '/');
  if (ALLOWED_FILES.has(rel)) continue;

  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  for (const pattern of BLOCKED_PATTERNS) {
    for (let i = 0; i < lines.length; i++) {
      if (pattern.regex.test(lines[i])) {
        violations.push({
          file: rel,
          line: i + 1,
          pattern: pattern.name,
          message: pattern.message,
          code: lines[i].trim(),
        });
      }
      // Reset regex lastIndex (global flag)
      pattern.regex.lastIndex = 0;
    }
  }
}

// ── Report ──────────────────────────────────────────────────────────────
if (violations.length === 0) {
  console.log('✅ No new legacy patterns found in src/');
  console.log(`   (${ALLOWED_FILES.size} files in allowlist — to be cleaned in STEP 4)`);
  process.exit(0);
} else {
  console.error(`\n🚨 ${violations.length} legacy pattern violation(s) found:\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}`);
    console.error(`    Pattern: ${v.pattern}`);
    console.error(`    Message: ${v.message}`);
    console.error(`    Code:    ${v.code}\n`);
  }
  console.error('─'.repeat(60));
  console.error('These patterns are blocked by architectural policy (STEP 2).');
  console.error('Activity filtering must happen server-side via fetchActivitiesServerSide().');
  console.error('If this is a known legacy file, add it to ALLOWED_FILES in this script.');
  console.error('─'.repeat(60));
  process.exit(1);
}
