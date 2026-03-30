import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { NODE_STYLES, type BlueprintGraphNodeData } from '@/lib/projects/project-blueprint-graph';
import { Badge } from '@/components/ui/badge';

type BlueprintNodeType = Node<BlueprintGraphNodeData, 'blueprintNode'>;

const DIRECTION_LABELS: Record<string, string> = {
    inbound: 'Inbound',
    outbound: 'Outbound',
    bidirectional: 'Bidirectional',
    unknown: '',
};

export const BlueprintNode = memo(function BlueprintNode({
    data,
    selected,
}: NodeProps<BlueprintNodeType>) {
    const style = NODE_STYLES[data.kind];
    const dimmed = (data._dimmed as boolean) ?? false;

    // Visual hierarchy: components are bigger, data domains are compact
    const isComponent = data.kind === 'component';
    const isIntegration = data.kind === 'integration';
    const isDataDomain = data.kind === 'data_domain';
    const isPrimary = data.isPrimary === true;

    const sizeClass = isComponent
        ? 'min-w-[220px] max-w-[260px] px-4 py-3'
        : isIntegration
            ? 'min-w-[180px] max-w-[220px] px-3 py-2.5'
            : 'min-w-[160px] max-w-[200px] px-3 py-2';

    const borderWidth = isPrimary ? 'border-[3px]' : 'border-2';

    return (
        <div
            className={`rounded-xl ${borderWidth} ${sizeClass} shadow-sm transition-all duration-200`}
            style={{
                background: style.bg,
                borderColor: selected ? style.border : `${style.border}99`,
                boxShadow: selected
                    ? `0 0 0 3px ${style.border}30, 0 4px 12px ${style.border}20`
                    : isPrimary
                        ? `0 2px 8px ${style.border}15`
                        : '0 1px 3px rgba(0,0,0,0.06)',
                opacity: dimmed ? 0.25 : 1,
                filter: dimmed ? 'grayscale(0.5)' : 'none',
            }}
        >
            <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-slate-400" />

            {/* ── Component layout ─── */}
            {isComponent && (
                <>
                    <div className="flex items-center gap-1.5 mb-1.5">
                        <Badge className={`${style.badge} text-[10px] px-1.5 py-0 h-4 font-semibold`}>
                            {data.typeLabel ?? 'component'}
                        </Badge>
                        {isPrimary && (
                            <span className="text-[9px] font-bold text-blue-500 uppercase tracking-wider">Core</span>
                        )}
                    </div>
                    <span className={`block font-semibold text-slate-900 truncate leading-snug ${isPrimary ? 'text-sm' : 'text-xs'}`}>
                        {data.label}
                    </span>
                </>
            )}

            {/* ── Integration layout ─── */}
            {isIntegration && (
                <>
                    <span className="block text-xs font-semibold text-slate-800 truncate leading-snug mb-1">
                        {data.label}
                    </span>
                    <div className="flex items-center gap-1">
                        <Badge className={`${style.badge} text-[10px] px-1.5 py-0 h-4 font-medium`}>
                            {DIRECTION_LABELS[data.typeLabel ?? ''] || data.typeLabel || 'external'}
                        </Badge>
                    </div>
                </>
            )}

            {/* ── Data Domain layout ─── */}
            {isDataDomain && (
                <span className="block text-xs font-medium text-slate-700 truncate leading-snug">
                    {data.label}
                </span>
            )}

            <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-slate-400" />
        </div>
    );
});
