#!/usr/bin/env node
/**
 * STEP 17b — Architectural Guard: No new local pipeline type declarations
 *
 * Blocks re-declaration of types that now have a canonical definition in
 * pipeline-domain.ts. Only known alias files are allowed to declare these
 * types (via re-export / type alias).
 *
 * Usage:
 *   node scripts/guard-pipeline-types.mjs        # check
 *   node scripts/guard-pipeline-types.mjs --fix   # show guidance
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

// ── Known alias files (allowed to declare these types as aliases) ────────
const ALLOWED_FILES = new Set([
    // Extension types (PipelineLayer + 'ai_pipeline')
    'src/types/estimation-blueprint.ts',
    'src/types/impact-map.ts',
    // Backward-compat source type extensions
    'src/types/domain-model.ts',
    'src/types/requirement-interview.ts',
    // Backend internal types
    'netlify/functions/lib/blueprint-activity-mapper.ts',
    'netlify/functions/lib/candidate-builder.ts',
    // Canonical source of truth
    'netlify/functions/lib/domain/pipeline/pipeline-domain.ts',
]);

// ── Blocked patterns ────────────────────────────────────────────────────
const BLOCKED_PATTERNS = [
    {
        name: 'local BlueprintLayer declaration',
        regex: /\btype\s+BlueprintLayer\s*=/g,
        message: 'BlueprintLayer is defined in estimation-blueprint.ts. Import from there or use PipelineLayer from pipeline-domain.ts.',
    },
    {
        name: 'local ImpactLayer declaration',
        regex: /\btype\s+ImpactLayer\s*=/g,
        message: 'ImpactLayer is defined in impact-map.ts. Import from there or use PipelineLayer from pipeline-domain.ts.',
    },
    {
        name: 'local ImpactAction declaration',
        regex: /\btype\s+ImpactAction\s*=/g,
        message: 'ImpactAction is defined in impact-map.ts. Import from there or use PipelineAction from pipeline-domain.ts.',
    },
    {
        name: 'local CandidateSource declaration',
        regex: /\btype\s+CandidateSource\s*=/g,
        message: 'CandidateSource is defined in domain-model.ts / candidate-builder.ts. Use ProvenanceSource or SignalKind from pipeline-domain.ts.',
    },
    {
        name: 'local ActivityProvenance declaration',
        regex: /\btype\s+ActivityProvenance\s*=/g,
        message: 'ActivityProvenance is removed. Use SignalKind from pipeline-domain.ts.',
    },
];

// ── File walker ─────────────────────────────────────────────────────────
function walkDir(dir, ext) {
    const results = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (entry === 'node_modules' || entry === '.git') continue;
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
const root = process.cwd();
const srcFiles = walkDir(join(root, 'src'), ['.ts', '.tsx']);
const netlifyFiles = walkDir(join(root, 'netlify', 'functions'), ['.ts', '.tsx']);
const files = [...srcFiles, ...netlifyFiles];
const violations = [];

for (const filePath of files) {
    const rel = relative(root, filePath).replaceAll('\\', '/');
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
    console.log('✅ No local pipeline type declarations found outside allowed files.');
    console.log(`   (${ALLOWED_FILES.size} files in allowlist — canonical source: pipeline-domain.ts)`);
    process.exit(0);
} else {
    console.error(`\n🚨 ${violations.length} pipeline type violation(s) found:\n`);
    for (const v of violations) {
        console.error(`  ${v.file}:${v.line}`);
        console.error(`    Pattern: ${v.pattern}`);
        console.error(`    Message: ${v.message}`);
        console.error(`    Code:    ${v.code}\n`);
    }
    console.error('─'.repeat(60));
    console.error('Pipeline types must be imported from pipeline-domain.ts.');
    console.error('If this is a known alias file, add it to ALLOWED_FILES in this script.');
    console.error('─'.repeat(60));
    process.exit(1);
}
