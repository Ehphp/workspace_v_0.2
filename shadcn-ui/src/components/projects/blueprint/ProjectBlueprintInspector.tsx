import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { NODE_STYLES, type BlueprintGraphNodeData, type BlueprintGraphModel } from '@/lib/projects/project-blueprint-graph';
import type { ProjectTechnicalBlueprint, EvidenceRef, BlueprintRelation } from '@/types/project-technical-blueprint';

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
    workflow: 'Workflow',
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

    // v2: typed relations involving this node
    const nodeRelations = graphModel.relations.filter(
        (r) => r.fromNodeId === data.nodeId || r.toNodeId === data.nodeId,
    );

    // v2: evidence
    const evidence = (data.evidence as EvidenceRef[] | undefined) ?? [];

    // v2: review status
    const reviewStatus = data.reviewStatus;

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
                        {reviewStatus && reviewStatus !== 'draft' && (
                            <Badge className={`text-[9px] px-1 py-0 h-3.5 ${reviewStatus === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                                }`}>
                                {reviewStatus}
                            </Badge>
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

                {/* v2: Evidence */}
                {evidence.length > 0 && (
                    <>
                        <Separator />
                        <div>
                            <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider mb-1.5">Evidence ({evidence.length})</p>
                            <div className="space-y-1">
                                {evidence.map((ev, i) => (
                                    <div key={i} className="text-xs text-slate-600 bg-blue-50/50 rounded px-2 py-1.5 border-l-2 border-blue-300 italic leading-relaxed">
                                        "{ev.snippet}"
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}
                {evidence.length === 0 && (
                    <>
                        <Separator />
                        <div className="bg-amber-50 -mx-4 px-4 py-2">
                            <p className="text-[11px] text-amber-600 flex items-center gap-1">
                                <span className="text-amber-500">&#9888;</span>
                                No evidence — this node was inferred without direct textual support
                            </p>
                        </div>
                    </>
                )}

                {/* v2: Criticality / Impact / Change Likelihood */}
                {(data.businessCriticality || data.estimationImpact || data.changeLikelihood) && (
                    <>
                        <Separator />
                        <div>
                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Impact on Estimation</p>
                            <div className="space-y-1">
                                {data.businessCriticality && (
                                    <MetricRow label="Business Criticality" value={data.businessCriticality as string} />
                                )}
                                {data.estimationImpact && (
                                    <MetricRow label="Estimation Impact" value={data.estimationImpact as string} />
                                )}
                                {data.changeLikelihood && (
                                    <MetricRow label="Change Likelihood" value={data.changeLikelihood as string} />
                                )}
                            </div>
                        </div>
                    </>
                )}

                {/* v2: Typed Relations */}
                {nodeRelations.length > 0 && (
                    <>
                        <Separator />
                        <div>
                            <p className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wider mb-1.5">Relations ({nodeRelations.length})</p>
                            <ul className="space-y-1">
                                {nodeRelations.map((rel, ri) => {
                                    const isSource = rel.fromNodeId === data.nodeId;
                                    const otherNodeId = isSource ? rel.toNodeId : rel.fromNodeId;
                                    const otherNode = graphModel.nodes.find((n) => n.data.nodeId === otherNodeId);
                                    return (
                                        <li key={ri} className="flex items-center gap-1.5 text-xs text-slate-600">
                                            <span className="text-indigo-400 text-[10px]">
                                                {isSource ? '→' : '←'}
                                            </span>
                                            <Badge className="text-[9px] px-1 py-0 h-3.5 bg-indigo-50 text-indigo-600 font-normal">
                                                {rel.type}
                                            </Badge>
                                            <span className="truncate">{otherNode?.data.label ?? otherNodeId}</span>
                                            {rel.confidence != null && (
                                                <span className="text-[10px] text-slate-400 tabular-nums ml-auto">
                                                    {Math.round(rel.confidence * 100)}%
                                                </span>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    </>
                )}

                {/* Connections (structural) */}
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

// ── Metric display helper ───────────────────────────────────────────────────

function MetricRow({ label, value }: { label: string; value: string }) {
    const color = value === 'high' ? 'text-red-600' : value === 'medium' ? 'text-amber-600' : 'text-slate-500';
    return (
        <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600">{label}</span>
            <span className={`font-medium capitalize ${color}`}>{value}</span>
        </div>
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
    } else if (kind === 'workflow') {
        insights.push('Operational workflow — defines end-to-end business process');
        insights.push('Orchestrates multiple components and data domains');
    }

    return insights;
}

// ── Blueprint Overview Panel ────────────────────────────────────────────────

function BlueprintOverview({ blueprint }: { blueprint: ProjectTechnicalBlueprint }) {
    const reviewedCount = [
        ...blueprint.components,
        ...blueprint.dataDomains,
        ...blueprint.integrations,
        ...(blueprint.workflows ?? []),
    ].filter((n) => n.reviewStatus === 'approved' || n.reviewStatus === 'reviewed').length;
    const totalNodes = blueprint.components.length + blueprint.dataDomains.length + blueprint.integrations.length + (blueprint.workflows ?? []).length;

    return (
        <ScrollArea className="h-full">
            <div className="p-4 space-y-3">
                {/* Header */}
                <div>
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Architecture Overview</p>
                    <h3 className="text-sm font-bold text-slate-900">Project Blueprint</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-slate-500">
                            v{blueprint.version}
                            {blueprint.createdAt && (
                                <> &middot; {new Date(blueprint.createdAt).toLocaleDateString()}</>
                            )}
                        </p>
                        {blueprint.reviewStatus && blueprint.reviewStatus !== 'draft' && (
                            <Badge className={`text-[9px] px-1 py-0 h-3.5 ${blueprint.reviewStatus === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                                }`}>
                                {blueprint.reviewStatus}
                            </Badge>
                        )}
                    </div>
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
                        <CountRow label="Workflows" count={(blueprint.workflows ?? []).length} kind="workflow" />
                        <CountRow label="External Systems" count={blueprint.integrations.length} kind="integration" />
                        {(blueprint.relations?.length ?? 0) > 0 && (
                            <div className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                                    <span className="text-slate-700">Relations</span>
                                </div>
                                <span className="font-semibold text-slate-800 tabular-nums">{blueprint.relations!.length}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* v2: Confidence + Coverage */}
                {(blueprint.confidence != null || blueprint.coverage != null) && (
                    <>
                        <Separator />
                        <div className="space-y-2">
                            {blueprint.confidence != null && (
                                <div>
                                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Confidence</p>
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
                            )}
                            {blueprint.coverage != null && (
                                <div>
                                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Coverage</p>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                                            <div
                                                className="h-full rounded-full bg-emerald-500"
                                                style={{ width: `${Math.round(blueprint.coverage * 100)}%` }}
                                            />
                                        </div>
                                        <span className="text-xs text-slate-600 tabular-nums font-medium">
                                            {Math.round(blueprint.coverage * 100)}%
                                        </span>
                                    </div>
                                </div>
                            )}
                            {blueprint.qualityScore != null && (
                                <div>
                                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Quality Score</p>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${blueprint.qualityScore >= 0.85 ? 'bg-emerald-500' :
                                                    blueprint.qualityScore >= 0.65 ? 'bg-blue-500' :
                                                        blueprint.qualityScore >= 0.45 ? 'bg-amber-500' :
                                                            'bg-red-500'
                                                    }`}
                                                style={{ width: `${Math.round(blueprint.qualityScore * 100)}%` }}
                                            />
                                        </div>
                                        <span className="text-xs text-slate-600 tabular-nums font-medium">
                                            {Math.round(blueprint.qualityScore * 100)}%
                                        </span>
                                        <Badge className={`text-[9px] px-1 py-0 h-3.5 ${blueprint.qualityScore >= 0.85 ? 'bg-emerald-100 text-emerald-700' :
                                            blueprint.qualityScore >= 0.65 ? 'bg-blue-100 text-blue-700' :
                                                blueprint.qualityScore >= 0.45 ? 'bg-amber-100 text-amber-700' :
                                                    'bg-red-100 text-red-700'
                                            }`}>
                                            {blueprint.qualityScore >= 0.85 ? 'excellent' :
                                                blueprint.qualityScore >= 0.65 ? 'good' :
                                                    blueprint.qualityScore >= 0.45 ? 'fair' : 'poor'}
                                        </Badge>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* v2: Review progress */}
                {totalNodes > 0 && (
                    <>
                        <Separator />
                        <div>
                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Review Progress</p>
                            <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-emerald-400"
                                        style={{ width: `${Math.round((reviewedCount / totalNodes) * 100)}%` }}
                                    />
                                </div>
                                <span className="text-xs text-slate-600 tabular-nums font-medium">
                                    {reviewedCount}/{totalNodes}
                                </span>
                            </div>
                        </div>
                    </>
                )}

                {/* v2: Quality Flags */}
                {blueprint.qualityFlags && blueprint.qualityFlags.length > 0 && (
                    <>
                        <Separator />
                        <div className="bg-amber-50 -mx-4 px-4 py-3 border-y border-amber-100">
                            <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider mb-1">Quality Flags ({blueprint.qualityFlags.length})</p>
                            <div className="flex flex-wrap gap-1">
                                {blueprint.qualityFlags.map((flag, i) => (
                                    <Badge key={i} variant="secondary" className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0 h-4">
                                        {flag.replace(/_/g, ' ')}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    </>
                )}

                {/* v2: Diff from previous */}
                {blueprint.diffFromPrevious && (
                    <>
                        <Separator />
                        <div>
                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Changes from Previous</p>
                            {blueprint.diffFromPrevious.breakingArchitecturalChanges && (
                                <p className="text-xs text-red-600 font-medium mb-1">&#9888; Breaking architectural changes</p>
                            )}
                            <p className="text-xs text-slate-600 leading-relaxed">
                                {blueprint.changeSummary ?? 'No summary available'}
                            </p>
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
