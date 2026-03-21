/**
 * Tests for provenance-map.ts — deterministic provenance propagation
 *
 * Covers:
 *   1. Blueprint-mapped activity retains provenance after re-attachment
 *   2. Fallback-added activity retains keyword-fallback provenance
 *   3. Dynamically discovered activity gets agent-discovered provenance
 *   4. Duplicate code from multiple sources respects precedence rules
 *   5. Legacy (non-blueprint) path assigns keyword-fallback to all
 *   6. Empty inputs handled safely
 *   7. provenanceBreakdown counts correctly
 */

import { describe, it, expect } from 'vitest';
import {
    buildProvenanceMap,
    attachProvenance,
    provenanceBreakdown,
} from '../../netlify/functions/lib/provenance-map';
import type { BlueprintMappingResult, MappedActivity, ActivityProvenance } from '../../netlify/functions/lib/blueprint-activity-mapper';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeMapped(code: string, provenance: ActivityProvenance): MappedActivity {
    return {
        activity: {
            code,
            name: `Activity ${code}`,
            base_hours: 16,
            description: '',
            group: 'DEV',
            tech_category: 'TEST',
        },
        provenance,
        sourceLabel: 'test',
        confidence: 0.9,
    };
}

function makeBlueprintResult(
    blueprintActivities: MappedActivity[],
    fallbackActivities: MappedActivity[] = [],
): BlueprintMappingResult {
    return {
        blueprintActivities,
        fallbackActivities,
        allActivities: [...blueprintActivities, ...fallbackActivities],
        coverage: {
            coveredGroups: ['DEV'],
            missingGroups: [],
            unmappedComponents: [],
            componentCoveragePercent: 100,
            totalActivities: blueprintActivities.length + fallbackActivities.length,
            fromBlueprint: blueprintActivities.length,
            fromFallback: fallbackActivities.length,
        },
        warnings: [],
    };
}

// ─── buildProvenanceMap ─────────────────────────────────────────────────────

describe('buildProvenanceMap', () => {
    it('maps blueprint activities with correct provenance', () => {
        const result = makeBlueprintResult([
            makeMapped('PP_DV_FORM', 'blueprint-component'),
            makeMapped('PP_FLOW_SIMPLE', 'blueprint-integration'),
        ]);
        const map = buildProvenanceMap(result, []);

        expect(map.get('PP_DV_FORM')).toBe('blueprint-component');
        expect(map.get('PP_FLOW_SIMPLE')).toBe('blueprint-integration');
    });

    it('maps fallback activities with their provenance', () => {
        const result = makeBlueprintResult(
            [makeMapped('PP_DV_FORM', 'blueprint-component')],
            [makeMapped('PP_E2E_TEST', 'keyword-fallback')],
        );
        const map = buildProvenanceMap(result, []);

        expect(map.get('PP_DV_FORM')).toBe('blueprint-component');
        expect(map.get('PP_E2E_TEST')).toBe('keyword-fallback');
    });

    it('blueprint takes precedence over fallback for same code', () => {
        const result = makeBlueprintResult(
            [makeMapped('PP_DV_FORM', 'blueprint-component')],
            [makeMapped('PP_DV_FORM', 'keyword-fallback')], // duplicate code
        );
        const map = buildProvenanceMap(result, []);

        // Blueprint provenance wins (first entry)
        expect(map.get('PP_DV_FORM')).toBe('blueprint-component');
    });

    it('first blueprint entry wins for duplicate codes within blueprint', () => {
        const result = makeBlueprintResult([
            makeMapped('PP_DV_FORM', 'blueprint-component'),
            makeMapped('PP_DV_FORM', 'blueprint-data'), // same code, different provenance
        ]);
        const map = buildProvenanceMap(result, []);

        expect(map.get('PP_DV_FORM')).toBe('blueprint-component');
    });

    it('assigns keyword-fallback to all when no blueprint is present', () => {
        const ranked = [
            { code: 'PP_DV_FORM' },
            { code: 'PP_E2E_TEST' },
            { code: 'PP_DEPLOY' },
        ];
        const map = buildProvenanceMap(null, ranked);

        expect(map.get('PP_DV_FORM')).toBe('keyword-fallback');
        expect(map.get('PP_E2E_TEST')).toBe('keyword-fallback');
        expect(map.get('PP_DEPLOY')).toBe('keyword-fallback');
    });

    it('assigns keyword-fallback when blueprint is undefined', () => {
        const map = buildProvenanceMap(undefined, [{ code: 'X' }]);
        expect(map.get('X')).toBe('keyword-fallback');
    });

    it('handles empty inputs', () => {
        const map = buildProvenanceMap(null, []);
        expect(map.size).toBe(0);
    });

    it('includes multi-crosscutting provenance from blueprint', () => {
        const result = makeBlueprintResult([
            makeMapped('CRS_KICKOFF', 'multi-crosscutting'),
            makeMapped('PP_DV_FORM', 'blueprint-component'),
        ]);
        const map = buildProvenanceMap(result, []);

        expect(map.get('CRS_KICKOFF')).toBe('multi-crosscutting');
    });
});

// ─── attachProvenance ───────────────────────────────────────────────────────

describe('attachProvenance', () => {
    it('re-attaches blueprint provenance to selected activities', () => {
        const provenanceMap = new Map<string, ActivityProvenance>([
            ['PP_DV_FORM', 'blueprint-component'],
            ['PP_FLOW_SIMPLE', 'blueprint-integration'],
        ]);

        const selected = [
            { code: 'PP_DV_FORM', name: 'Form', baseHours: 32, reason: 'test' },
            { code: 'PP_FLOW_SIMPLE', name: 'Flow', baseHours: 32, reason: 'test' },
        ];

        const result = attachProvenance(selected, provenanceMap);

        expect(result[0].provenance).toBe('blueprint-component');
        expect(result[1].provenance).toBe('blueprint-integration');
        // Original fields preserved
        expect(result[0].code).toBe('PP_DV_FORM');
        expect(result[0].baseHours).toBe(32);
    });

    it('assigns agent-discovered to codes found via tool-use', () => {
        const provenanceMap = new Map<string, ActivityProvenance>([
            ['PP_DV_FORM', 'blueprint-component'],
        ]);

        const selected = [
            { code: 'PP_DV_FORM', name: 'Form', baseHours: 32, reason: 'mapped' },
            { code: 'NEW_ACTIVITY', name: 'New', baseHours: 16, reason: 'discovered' },
        ];

        const expandedCodes = ['NEW_ACTIVITY'];
        const result = attachProvenance(selected, provenanceMap, expandedCodes);

        expect(result[0].provenance).toBe('blueprint-component');
        expect(result[1].provenance).toBe('agent-discovered');
    });

    it('assigns agent-discovered to entirely unknown codes', () => {
        const provenanceMap = new Map<string, ActivityProvenance>();

        const selected = [
            { code: 'UNKNOWN_CODE', name: 'Unknown', baseHours: 8, reason: 'mystery' },
        ];

        const result = attachProvenance(selected, provenanceMap);

        expect(result[0].provenance).toBe('agent-discovered');
    });

    it('preserves keyword-fallback for non-blueprint path', () => {
        const provenanceMap = new Map<string, ActivityProvenance>([
            ['PP_DV_FORM', 'keyword-fallback'],
            ['PP_E2E_TEST', 'keyword-fallback'],
        ]);

        const selected = [
            { code: 'PP_DV_FORM', name: 'Form', baseHours: 32, reason: 'ranked' },
            { code: 'PP_E2E_TEST', name: 'Test', baseHours: 64, reason: 'ranked' },
        ];

        const result = attachProvenance(selected, provenanceMap);

        expect(result[0].provenance).toBe('keyword-fallback');
        expect(result[1].provenance).toBe('keyword-fallback');
    });

    it('handles empty activities array', () => {
        const result = attachProvenance([], new Map());
        expect(result).toHaveLength(0);
    });

    it('map provenance always wins over expandedCodes for same code', () => {
        const provenanceMap = new Map<string, ActivityProvenance>([
            ['PP_DV_FORM', 'blueprint-component'],
        ]);

        // A code that's in BOTH the map and expandedCodes
        const selected = [
            { code: 'PP_DV_FORM', name: 'Form', baseHours: 32, reason: 'test' },
        ];

        const expandedCodes = ['PP_DV_FORM']; // also in expanded
        const result = attachProvenance(selected, provenanceMap, expandedCodes);

        // Map wins (blueprint-component), not agent-discovered
        expect(result[0].provenance).toBe('blueprint-component');
    });
});

// ─── provenanceBreakdown ────────────────────────────────────────────────────

describe('provenanceBreakdown', () => {
    it('counts provenance categories correctly', () => {
        const activities = [
            { provenance: 'blueprint-component' as const },
            { provenance: 'blueprint-component' as const },
            { provenance: 'keyword-fallback' as const },
            { provenance: 'agent-discovered' as const },
        ];

        const counts = provenanceBreakdown(activities);

        expect(counts['blueprint-component']).toBe(2);
        expect(counts['keyword-fallback']).toBe(1);
        expect(counts['agent-discovered']).toBe(1);
    });

    it('returns empty object for no activities', () => {
        const counts = provenanceBreakdown([]);
        expect(Object.keys(counts)).toHaveLength(0);
    });
});
