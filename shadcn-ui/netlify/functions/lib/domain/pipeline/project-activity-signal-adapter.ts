/**
 * Project Activity Signal Adapter
 *
 * Converts project-scoped activities (from `project_activities` table) into
 * NormalizedSignal[] for the CandidateSynthesizer.
 *
 * Project activities receive the HIGHEST source weight (4.0) because they are
 * domain-calibrated to the specific project and its blueprint.
 *
 * Score is derived from:
 *   - Activity confidence (0–1)
 *   - Blueprint node match bonus (+0.15 when blueprintNodeName matches a
 *     component in the current estimation blueprint)
 *   - Effort modifier relevance (higher modifier → higher complexity relevance)
 *
 * @module project-activity-signal-adapter
 */

import type { ProjectActivity } from '../../activities';
import type { NormalizedSignal, SignalSet } from './signal-types';
import type { PipelineLayer } from './pipeline-domain';

// ─────────────────────────────────────────────────────────────────────────────
// Blueprint node name extraction (for match bonus)
// ─────────────────────────────────────────────────────────────────────────────

function extractBlueprintNodeNames(blueprint?: Record<string, unknown>): Set<string> {
    const names = new Set<string>();
    if (!blueprint || typeof blueprint !== 'object') return names;

    const addNames = (arr: unknown[], key: string) => {
        if (!Array.isArray(arr)) return;
        for (const item of arr) {
            if (item && typeof item === 'object' && (item as any)[key]) {
                names.add(String((item as any)[key]).toLowerCase());
            }
        }
    };

    addNames(blueprint.components as unknown[] ?? [], 'name');
    addNames(blueprint.integrations as unknown[] ?? [], 'systemName');
    addNames(blueprint.dataEntities as unknown[] ?? [], 'name');

    return names;
}

// ─────────────────────────────────────────────────────────────────────────────
// Layer inference from group
// ─────────────────────────────────────────────────────────────────────────────

function inferLayerFromGroup(group: string): PipelineLayer | undefined {
    switch (group) {
        case 'DEV': return 'logic';
        case 'TEST': return 'logic';
        case 'ANALYSIS': return 'frontend';
        case 'OPS': return 'configuration';
        case 'GOVERNANCE': return 'configuration';
        default: return undefined;
    }
}

function inferLayerFromBlueprintNodeType(
    nodeType: 'component' | 'dataDomain' | 'integration' | null,
): PipelineLayer | undefined {
    switch (nodeType) {
        case 'component': return 'frontend';
        case 'dataDomain': return 'data';
        case 'integration': return 'integration';
        default: return undefined;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Adapter
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert project activities into a SignalSet for the CandidateSynthesizer.
 *
 * @param projectActivities - Project-scoped activities (is_enabled=true, ordered by position)
 * @param blueprint - Optional estimation blueprint for node-name matching bonus
 * @returns A SignalSet with source='project-activity'
 */
export function projectActivitiesToSignals(
    projectActivities: ProjectActivity[],
    blueprint?: Record<string, unknown>,
): SignalSet {
    if (projectActivities.length === 0) {
        return {
            signals: [],
            source: 'project-activity',
            diagnostics: { processed: 0, produced: 0, unmapped: [] },
        };
    }

    const blueprintNodes = extractBlueprintNodeNames(blueprint);
    const signals: NormalizedSignal[] = [];

    for (const pa of projectActivities) {
        // Base score from confidence (default 0.7 if null)
        let score = pa.confidence ?? 0.7;

        // Blueprint node match bonus
        const nodeNameLower = pa.blueprint_node_name?.toLowerCase();
        if (nodeNameLower && blueprintNodes.has(nodeNameLower)) {
            score = Math.min(1.0, score + 0.15);
        }

        // Clamp to 0–1
        score = Math.max(0, Math.min(1.0, score));

        // Determine layer: prefer blueprint_node_type, fallback to group
        const layer = inferLayerFromBlueprintNodeType(pa.blueprint_node_type)
            ?? inferLayerFromGroup(pa.group);

        signals.push({
            activityCode: pa.code,
            score,
            kind: 'project-activity-match',
            source: 'project-activity',
            confidence: pa.confidence ?? 0.7,
            contributions: {
                baseConfidence: pa.confidence ?? 0.7,
                blueprintNodeMatch: (nodeNameLower && blueprintNodes.has(nodeNameLower)) ? 0.15 : 0,
                effortModifier: pa.effort_modifier,
            },
            provenance: [
                `project-activity:${pa.code}`,
                pa.source_activity_code ? `source:${pa.source_activity_code}` : '',
                pa.blueprint_node_name ? `node:${pa.blueprint_node_name}` : '',
            ].filter(Boolean),
            layer,
        });
    }

    return {
        signals,
        source: 'project-activity',
        diagnostics: {
            processed: projectActivities.length,
            produced: signals.length,
            unmapped: [],
        },
    };
}
