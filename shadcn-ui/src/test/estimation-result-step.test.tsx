/**
 * Tests for EstimationResultStep UI — blueprint provenance badges,
 * coverage summary, and warning display.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EstimationResultStep } from '@/components/estimation/interview/EstimationResultStep';
import type { EstimationFromInterviewResponse } from '@/types/requirement-interview';

// ─── Helpers ────────────────────────────────────────────────────────────────

function baseResult(
    overrides: Partial<EstimationFromInterviewResponse> = {}
): EstimationFromInterviewResponse {
    return {
        success: true,
        activities: [
            {
                code: 'PP_DV_FORM',
                name: 'Config form Dataverse',
                baseHours: 32,
                reason: 'Need form config',
                provenance: 'blueprint-component',
            },
            {
                code: 'PP_FLOW_SIMPLE',
                name: 'Flow semplice',
                baseHours: 32,
                reason: 'Integration flow',
                provenance: 'blueprint-integration',
            },
            {
                code: 'PP_E2E_TEST',
                name: 'Test e2e',
                baseHours: 64,
                reason: 'Gap fill',
                provenance: 'keyword-fallback',
            },
        ],
        totalBaseDays: 16,
        reasoning: 'Test reasoning',
        confidenceScore: 0.85,
        ...overrides,
    };
}

const noop = () => { };

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('EstimationResultStep — provenance badges', () => {
    it('renders provenance badges when provenance is present', () => {
        render(
            <EstimationResultStep
                result={baseResult()}
                onConfirm={noop}
                onAdjust={noop}
                onBack={noop}
            />
        );

        // "blueprint-component" → label "component"
        expect(screen.getByText('component')).toBeInTheDocument();
        // "blueprint-integration" → label "integration"
        expect(screen.getByText('integration')).toBeInTheDocument();
        // "keyword-fallback" → label "keyword fallback"
        expect(screen.getByText('keyword fallback')).toBeInTheDocument();
    });

    it('does not render provenance badge when provenance is absent', () => {
        const result = baseResult({
            activities: [
                {
                    code: 'PP_DV_FORM',
                    name: 'Config form Dataverse',
                    baseHours: 32,
                    reason: 'Legacy path',
                },
            ],
        });

        render(
            <EstimationResultStep
                result={result}
                onConfirm={noop}
                onAdjust={noop}
                onBack={noop}
            />
        );

        // Activity code should still render
        expect(screen.getByText('PP_DV_FORM')).toBeInTheDocument();
        // No provenance labels
        expect(screen.queryByText('component')).not.toBeInTheDocument();
        expect(screen.queryByText('keyword fallback')).not.toBeInTheDocument();
    });

    it('renders agent-discovered badge with blue styling', () => {
        const result = baseResult({
            activities: [
                {
                    code: 'NEW_ACT',
                    name: 'Discovered Activity',
                    baseHours: 16,
                    reason: 'Found via tool-use',
                    provenance: 'agent-discovered',
                },
            ],
        });

        render(
            <EstimationResultStep
                result={result}
                onConfirm={noop}
                onAdjust={noop}
                onBack={noop}
            />
        );

        // "agent-discovered" → label "agent discovered"
        expect(screen.getByText('agent discovered')).toBeInTheDocument();
    });
});

describe('EstimationResultStep — blueprint coverage summary', () => {
    it('renders coverage card when candidateSource is blueprint-mapper', () => {
        const result = baseResult({
            metrics: {
                totalMs: 100,
                pipeline: 'agentic',
                candidateSource: 'blueprint-mapper',
                blueprintCoverage: {
                    componentCoveragePercent: 80,
                    fromBlueprint: 5,
                    fromFallback: 2,
                    missingGroups: ['TEST'],
                },
            },
        });

        render(
            <EstimationResultStep
                result={result}
                onConfirm={noop}
                onAdjust={noop}
                onBack={noop}
            />
        );

        expect(screen.getByText('Blueprint Coverage')).toBeInTheDocument();
        expect(screen.getByText('80% components covered')).toBeInTheDocument();
        expect(screen.getByText('5 from blueprint')).toBeInTheDocument();
        expect(screen.getByText('2 from fallback')).toBeInTheDocument();
        expect(screen.getByText('Unmapped: TEST')).toBeInTheDocument();
    });

    it('does not render coverage card when candidateSource is not blueprint-mapper', () => {
        const result = baseResult({
            metrics: {
                totalMs: 100,
                pipeline: 'legacy',
                candidateSource: 'keyword-ranking',
            },
        });

        render(
            <EstimationResultStep
                result={result}
                onConfirm={noop}
                onAdjust={noop}
                onBack={noop}
            />
        );

        expect(screen.queryByText('Blueprint Coverage')).not.toBeInTheDocument();
    });

    it('does not render coverage card when metrics is absent', () => {
        const result = baseResult({ metrics: undefined });

        render(
            <EstimationResultStep
                result={result}
                onConfirm={noop}
                onAdjust={noop}
                onBack={noop}
            />
        );

        expect(screen.queryByText('Blueprint Coverage')).not.toBeInTheDocument();
    });

    it('hides fallback count when zero', () => {
        const result = baseResult({
            metrics: {
                totalMs: 100,
                pipeline: 'agentic',
                candidateSource: 'blueprint-mapper',
                blueprintCoverage: {
                    componentCoveragePercent: 100,
                    fromBlueprint: 8,
                    fromFallback: 0,
                    missingGroups: [],
                },
            },
        });

        render(
            <EstimationResultStep
                result={result}
                onConfirm={noop}
                onAdjust={noop}
                onBack={noop}
            />
        );

        expect(screen.getByText('8 from blueprint')).toBeInTheDocument();
        expect(screen.queryByText(/from fallback/)).not.toBeInTheDocument();
    });
});

describe('EstimationResultStep — blueprint warnings', () => {
    it('renders warning messages when blueprintWarnings is present', () => {
        const result = baseResult({
            metrics: {
                totalMs: 100,
                pipeline: 'agentic',
                blueprintWarnings: [
                    { level: 'warn', code: 'LOW_COVERAGE', message: 'Coverage below threshold at 45%' },
                    { level: 'info', code: 'UNMAPPED_COMPONENTS', message: '1 component(s) could not be mapped: AI' },
                ],
            },
        });

        render(
            <EstimationResultStep
                result={result}
                onConfirm={noop}
                onAdjust={noop}
                onBack={noop}
            />
        );

        expect(screen.getByText('Mapping Notes')).toBeInTheDocument();
        expect(screen.getByText('Coverage below threshold at 45%')).toBeInTheDocument();
        expect(screen.getByText('1 component(s) could not be mapped: AI')).toBeInTheDocument();
    });

    it('does not render warnings section when no warnings', () => {
        const result = baseResult({
            metrics: {
                totalMs: 100,
                pipeline: 'agentic',
                blueprintWarnings: [],
            },
        });

        render(
            <EstimationResultStep
                result={result}
                onConfirm={noop}
                onAdjust={noop}
                onBack={noop}
            />
        );

        expect(screen.queryByText('Mapping Notes')).not.toBeInTheDocument();
    });
});
