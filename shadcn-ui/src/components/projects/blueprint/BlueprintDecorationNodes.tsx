import { memo } from 'react';
import { type NodeProps, type Node } from '@xyflow/react';
import { RISK_BAND_COLORS, PATTERN_COLORS, type BlueprintGraphNodeData } from '@/lib/projects/project-blueprint-graph';

type DecorationNodeType = Node<BlueprintGraphNodeData, 'blueprintBandHeader' | 'blueprintCluster'>;

// ── Band Header ─────────────────────────────────────────────────────────────

export const BlueprintBandHeader = memo(function BlueprintBandHeader({
    data,
}: NodeProps<DecorationNodeType>) {
    const level = (data._bandLevel as string) ?? 'low';
    const colors = RISK_BAND_COLORS[level] ?? RISK_BAND_COLORS.low;

    return (
        <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg pointer-events-none select-none"
            style={{ background: colors.bg, borderLeft: `3px solid ${colors.border}` }}
        >
            <div className="w-2 h-2 rounded-full" style={{ background: colors.border }} />
            <span
                className="text-[11px] font-bold uppercase tracking-wider"
                style={{ color: colors.text }}
            >
                {data.label}
            </span>
        </div>
    );
});

// ── Cluster Decoration ──────────────────────────────────────────────────────

export const BlueprintClusterNode = memo(function BlueprintClusterNode({
    data,
}: NodeProps<DecorationNodeType>) {
    const patternType = (data._patternType as string) ?? 'cross-component-cluster';
    const colors = PATTERN_COLORS[patternType] ?? PATTERN_COLORS['cross-component-cluster'];

    return (
        <div
            className="w-full h-full rounded-xl pointer-events-none select-none"
            style={{
                background: colors.bg,
                border: `2px dashed ${colors.border}`,
            }}
        >
            <span
                className="absolute top-1 left-3 text-[9px] font-semibold uppercase tracking-wider"
                style={{ color: colors.border }}
            >
                {data.label}
            </span>
        </div>
    );
});
