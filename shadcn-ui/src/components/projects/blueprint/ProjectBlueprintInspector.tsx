import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { NODE_STYLES, type BlueprintGraphNodeData, type BlueprintGraphModel } from '@/lib/projects/project-blueprint-graph';
import type { ProjectTechnicalBlueprint } from '@/types/project-technical-blueprint';

interface ProjectBlueprintInspectorProps {
    blueprint: ProjectTechnicalBlueprint;
    selectedNode: BlueprintGraphNodeData | null;
    selectedNodeId: string | null;
    graphModel: BlueprintGraphModel;
}

const KIND_LABELS: Record<string, string> = {
    component: 'Component',
    integration: 'External System',
    data_domain: 'Data Domain',
};

export function ProjectBlueprintInspector({ blueprint, selectedNode, selectedNodeId, graphModel }: ProjectBlueprintInspectorProps) {
    if (selectedNode && selectedNodeId) {
        return <NodeDetail data={selectedNode} nodeId={selectedNodeId} graphModel={graphModel} />;
    }
    return <BlueprintOverview blueprint={blueprint} />;
}

// ── Node Detail Panel ───────────────────────────────────────────────────────

function NodeDetail({ data, nodeId, graphModel }: {
    data: BlueprintGraphNodeData;
    nodeId: string;
    graphModel: BlueprintGraphModel;
}) {
    const style = NODE_STYLES[data.kind];

    // Find connected nodes
    const connectedIds = graphModel.adjacency.get(nodeId) ?? new Set<string>();
    const connectedNodes = graphModel.nodes
        .filter((n) => connectedIds.has(n.id))
        .map((n) => ({ id: n.id, label: n.data.label, kind: n.data.kind }));

    // Generate "Why this matters" heuristic
    const insights = generateInsights(data);

    return (
        <ScrollArea className="h-full">
            <div className="p-4 space-y-3">
                {/* Header */}
                <div>
                    <div className="flex items-center gap-2 mb-1.5">
                        <Badge className={`${style.badge} text-[10px] px-1.5 py-0 h-4 font-semibold`}>
                            {KIND_LABELS[data.kind] ?? data.kind}
                        </Badge>
                        {data.isPrimary && (
                            <span className="text-[9px] font-bold text-blue-500 uppercase tracking-wider">Core</span>
                        )}
                    </div>
                    <h3 className="text-sm font-bold text-slate-900">{data.label}</h3>
                    {data.typeLabel && data.kind === 'component' && (
                        <p className="text-[11px] text-slate-500 mt-0.5 capitalize">{data.typeLabel}</p>
                    )}
                    {data.typeLabel && data.kind === 'integration' && (
                        <p className="text-[11px] text-slate-500 mt-0.5 capitalize">Direction: {data.typeLabel}</p>
                    )}
                </div>

                {/* Description */}
                {data.description && (
                    <>
                        <Separator />
                        <div>
                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Description</p>
                            <p className="text-sm text-slate-700 leading-relaxed">{data.description}</p>
                        </div>
                    </>
                )}

                {/* Relationships */}
                {connectedNodes.length > 0 && (
                    <>
                        <Separator />
                        <div>
                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Connections</p>
                            <ul className="space-y-1">
                                {connectedNodes.map((cn) => {
                                    const s = NODE_STYLES[cn.kind];
                                    return (
                                        <li key={cn.id} className="flex items-center gap-2 text-sm">
                                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.border }} />
                                            <span className="text-slate-700 truncate">{cn.label}</span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    </>
                )}

                {/* Why This Matters */}
                {insights.length > 0 && (
                    <>
                        <Separator />
                        <div>
                            <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider mb-1.5">Why This Matters</p>
                            <ul className="space-y-1">
                                {insights.map((insight, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                                        <span className="text-amber-500 mt-0.5 flex-shrink-0">&#9672;</span>
                                        <span>{insight}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </>
                )}

                {/* Confidence */}
                {data.confidence != null && (
                    <>
                        <Separator />
                        <div>
                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Confidence</p>
                            <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all"
                                        style={{
                                            width: `${Math.round(data.confidence * 100)}%`,
                                            background: style.border,
                                        }}
                                    />
                                </div>
                                <span className="text-xs text-slate-600 tabular-nums font-medium">
                                    {Math.round(data.confidence * 100)}%
                                </span>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </ScrollArea>
    );
}

// ── "Why This Matters" heuristic (no AI) ────────────────────────────────────

function generateInsights(data: BlueprintGraphNodeData): string[] {
    const insights: string[] = [];
    const kind = data.kind;
    const type = (data.typeLabel ?? '').toLowerCase();

    if (kind === 'component') {
        if (data.isPrimary) {
            insights.push('Core system component — changes here affect the entire architecture');
        }
        if (type === 'frontend') {
            insights.push('Handles user interaction and presentation layer');
        } else if (type === 'backend') {
            insights.push('Central to business logic and workflow orchestration');
        } else if (type === 'database') {
            insights.push('Stores persistent data — critical for data integrity');
        } else if (type === 'security') {
            insights.push('Enforces access control and security policies');
        } else if (type === 'integration') {
            insights.push('Bridges internal systems with external services');
        } else if (type === 'workflow') {
            insights.push('Orchestrates automated processes and business flows');
        } else if (type === 'reporting') {
            insights.push('Provides analytics and reporting capabilities');
        } else if (type === 'infrastructure') {
            insights.push('Supports deployment, scaling, and operational needs');
        }
    } else if (kind === 'integration') {
        const dir = type;
        if (dir === 'inbound') {
            insights.push('Receives data from an external system');
        } else if (dir === 'outbound') {
            insights.push('Sends data to an external system');
        } else if (dir === 'bidirectional') {
            insights.push('Exchanges data in both directions with external system');
        }
        insights.push('External dependency — requires interface stability');
    } else if (kind === 'data_domain') {
        insights.push('Represents a core business data entity');
        insights.push('Changes to this domain may affect multiple components');
    }

    return insights;
}

// ── Blueprint Overview Panel ────────────────────────────────────────────────

function BlueprintOverview({ blueprint }: { blueprint: ProjectTechnicalBlueprint }) {
    return (
        <ScrollArea className="h-full">
            <div className="p-4 space-y-3">
                {/* Header */}
                <div>
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Architecture Overview</p>
                    <h3 className="text-sm font-bold text-slate-900">Project Blueprint</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                        v{blueprint.version}
                        {blueprint.createdAt && (
                            <> &middot; {new Date(blueprint.createdAt).toLocaleDateString()}</>
                        )}
                    </p>
                </div>

                {/* Summary */}
                {blueprint.summary && (
                    <>
                        <Separator />
                        <div>
                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Summary</p>
                            <p className="text-sm text-slate-700 leading-relaxed">{blueprint.summary}</p>
                        </div>
                    </>
                )}

                {/* Composition */}
                <Separator />
                <div>
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Composition</p>
                    <div className="space-y-2">
                        <CountRow label="Components" count={blueprint.components.length} kind="component" />
                        <CountRow label="Data Domains" count={blueprint.dataDomains.length} kind="data_domain" />
                        <CountRow label="External Systems" count={blueprint.integrations.length} kind="integration" />
                    </div>
                </div>

                {/* Confidence */}
                {blueprint.confidence != null && (
                    <>
                        <Separator />
                        <div>
                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Overall Confidence</p>
                            <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-blue-500"
                                        style={{ width: `${Math.round(blueprint.confidence * 100)}%` }}
                                    />
                                </div>
                                <span className="text-xs text-slate-600 tabular-nums font-medium">
                                    {Math.round(blueprint.confidence * 100)}%
                                </span>
                            </div>
                        </div>
                    </>
                )}

                {/* Architectural Notes */}
                {blueprint.architecturalNotes.length > 0 && (
                    <>
                        <Separator />
                        <div>
                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Architectural Notes</p>
                            <ul className="text-sm text-slate-700 space-y-1">
                                {blueprint.architecturalNotes.map((n, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                        <span className="text-blue-400 mt-0.5 flex-shrink-0">&#8226;</span>
                                        <span>{n}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </>
                )}

                {/* Assumptions */}
                {blueprint.assumptions.length > 0 && (
                    <>
                        <Separator />
                        <div>
                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Assumptions</p>
                            <ul className="text-sm text-slate-600 space-y-1">
                                {blueprint.assumptions.map((a, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                        <span className="text-slate-400 mt-0.5 flex-shrink-0">&#8226;</span>
                                        <span>{a}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </>
                )}

                {/* Missing Information */}
                {blueprint.missingInformation.length > 0 && (
                    <>
                        <Separator />
                        <div className="bg-amber-50 -mx-4 px-4 py-3 border-y border-amber-100">
                            <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider mb-1">Missing Information</p>
                            <ul className="text-sm text-amber-800 space-y-1">
                                {blueprint.missingInformation.map((m, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                        <span className="text-amber-500 mt-0.5 flex-shrink-0">&#9888;</span>
                                        <span>{m}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </>
                )}

                {/* Click hint */}
                <div className="pt-1">
                    <p className="text-[11px] text-slate-400 italic text-center">
                        Click a node to inspect its details and relationships
                    </p>
                </div>
            </div>
        </ScrollArea>
    );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function CountRow({ label, count, kind }: { label: string; count: number; kind: string }) {
    const style = NODE_STYLES[kind as keyof typeof NODE_STYLES];
    return (
        <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: style?.border ?? '#94a3b8' }} />
                <span className="text-slate-700">{label}</span>
            </div>
            <span className="font-semibold text-slate-800 tabular-nums">{count}</span>
        </div>
    );
}
