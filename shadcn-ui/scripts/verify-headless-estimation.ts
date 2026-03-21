/**
 * verify-headless-estimation.ts
 *
 * Proof that the domain layer can compute a full estimation
 * WITHOUT any UI, React, or browser dependency.
 *
 * Usage:  npx tsx scripts/verify-headless-estimation.ts
 */

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const engine = require('../netlify/functions/lib/domain/estimation/estimation-engine');
const { computeEstimation } = engine;

// ─── Fake domain data (no DB, no UI) ────────────────────────────

const input = {
    activities: [
        { code: 'FE_FORM', baseHours: 16, isAiSuggested: true },
        { code: 'BE_API_SIMPLE', baseHours: 8, isAiSuggested: false },
        { code: 'DB_SCHEMA', baseHours: 4, isAiSuggested: true },
    ],
    drivers: [
        { code: 'TEAM_EXP', value: 'junior', multiplier: 1.3 },
        { code: 'COMPLEXITY', value: 'medium', multiplier: 1.15 },
    ],
    risks: [
        { code: 'THIRD_PARTY_DEP', weight: 8 },
        { code: 'UNCLEAR_SPEC', weight: 5 },
    ],
};

// ─── Run the pure engine ─────────────────────────────────────────

console.log('=== Headless Estimation Verification ===\n');
console.log(`Engine version: ${engine.ENGINE_VERSION ?? '(not exported)'}`);

const result = computeEstimation(input);

console.log('\n--- Input ---');
console.log(`Activities: ${input.activities.length} (${input.activities.map(a => a.code).join(', ')})`);
console.log(`Total base hours: ${input.activities.reduce((s, a) => s + a.baseHours, 0)}h`);
console.log(`Drivers: ${input.drivers.map(d => `${d.code}=${d.multiplier}`).join(', ')}`);
console.log(`Risks: ${input.risks.map(r => `${r.code}(w=${r.weight})`).join(', ')}`);

console.log('\n--- Output ---');
console.log(`Base days:          ${result.baseDays}`);
console.log(`Driver multiplier:  ${result.driverMultiplier}`);
console.log(`Subtotal:           ${result.subtotal}`);
console.log(`Risk score:         ${result.riskScore}`);
console.log(`Contingency %:      ${result.contingencyPercent}%`);
console.log(`Contingency days:   ${result.contingencyDays}`);
console.log(`TOTAL DAYS:         ${result.totalDays}`);

// ─── Assert correctness ──────────────────────────────────────────

const expectedBaseDays = (16 + 8 + 4) / 8;                   // 3.5
const expectedMultiplier = 1.3 * 1.15;                        // 1.495
const expectedSubtotal = expectedBaseDays * expectedMultiplier; // 5.2325
const expectedRiskScore = 8 + 5;                               // 13
const expectedContingency = 0.15;                              // riskScore ∈ (10, 20]
const expectedContDays = expectedSubtotal * expectedContingency;
const expectedTotal = expectedSubtotal + expectedContDays;

let passed = 0;
let failed = 0;

function assert(label: string, actual: number, expected: number) {
    const ok = Math.abs(actual - expected) < 0.01;
    if (ok) {
        console.log(`  ✓ ${label}`);
        passed++;
    } else {
        console.log(`  ✗ ${label}: expected ${expected}, got ${actual}`);
        failed++;
    }
}

console.log('\n--- Assertions ---');
assert('baseDays', result.baseDays, Math.round(expectedBaseDays * 100) / 100);
assert('driverMultiplier', result.driverMultiplier, Math.round(expectedMultiplier * 1000) / 1000);
assert('subtotal', result.subtotal, Math.round(expectedSubtotal * 100) / 100);
assert('riskScore', result.riskScore, expectedRiskScore);
assert('contingencyPercent', result.contingencyPercent, expectedContingency * 100);
assert('contingencyDays', result.contingencyDays, Math.round(expectedContDays * 100) / 100);
assert('totalDays', result.totalDays, Math.round(expectedTotal * 100) / 100);

console.log(`\n${passed} passed, ${failed} failed`);

if (failed > 0) {
    console.log('\n⚠ Some assertions failed — investigate.');
    process.exit(1);
} else {
    console.log('\n✅ Backend estimation works headless. Core is separated.');
    process.exit(0);
}
