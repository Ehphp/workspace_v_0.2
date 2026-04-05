import { useState, useEffect, useCallback, useMemo } from 'react';
import { getLatestProjectTechnicalBlueprint } from '@/lib/project-technical-blueprint-repository';
import { ProjectBlueprintGraph } from './ProjectBlueprintGraph';
import { ProjectBlueprintInspector } from './ProjectBlueprintInspector';
import { buildProjectBlueprintGraph } from '@/lib/projects/project-blueprint-graph';
import { searchBlueprint, type BlueprintSearchResult } from '@/lib/projects/blueprint-search';
import type { ProjectTechnicalBlueprint } from '@/types/project-technical-blueprint';
import type { BlueprintGraphNodeData } from '@/lib/projects/project-blueprint-graph';

interface ProjectBlueprintTabProps {
    projectId: string;
}

export function ProjectBlueprintTab({ projectId }: ProjectBlueprintTabProps) {
    const [blueprint, setBlueprint] = useState<ProjectTechnicalBlueprint | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedNode, setSelectedNode] = useState<BlueprintGraphNodeData | null>(null);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Search results — recomputed on every query change
    const searchResults = useMemo<BlueprintSearchResult[]>(() => {
        if (!blueprint || searchQuery.trim().length < 2) return [];
        return searchBlueprint(blueprint, searchQuery);
    }, [blueprint, searchQuery]);

    // Set of matching graph node IDs for highlighting
    const highlightedNodeIds = useMemo<Set<string>>(
        () => new Set(searchResults.map((r) => r.graphNodeId).filter(Boolean) as string[]),
        [searchResults],
    );

    useEffect(() => {
        let cancelled = false;

        async function load() {
            setLoading(true);
            setError(null);
            try {
                const bp = await getLatestProjectTechnicalBlueprint(projectId);
                if (!cancelled) {
                    setBlueprint(bp);
                }
            } catch (err: any) {
                if (!cancelled) {
                    setError(err.message ?? 'Failed to load blueprint');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();
        return () => { cancelled = true; };
    }, [projectId]);

    const graphModel = useMemo(
        () => blueprint ? buildProjectBlueprintGraph(blueprint) : null,
        [blueprint],
    );

    const handleNodeSelect = useCallback(
        (nodeId: string | null, data: BlueprintGraphNodeData | null) => {
            setSelectedNode(data);
            setSelectedNodeId(nodeId);
        },
        [],
    );

    // ── Loading state ───────────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-[460px] text-center space-y-3">
                <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
                <p className="text-sm text-slate-500">Loading technical blueprint…</p>
            </div>
        );
    }

    // ── Error state ─────────────────────────────────────────────────
    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-[460px] text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                </div>
                <div>
                    <p className="text-sm font-medium text-slate-700">Failed to load blueprint</p>
                    <p className="text-xs text-slate-500 mt-1">{error}</p>
                </div>
            </div>
        );
    }

    // ── Empty state (FASE 8) ────────────────────────────────────────
    if (!blueprint) {
        return (
            <div className="flex flex-col items-center justify-center h-[460px] text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                    <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 7.125C2.25 6.504 2.754 6 3.375 6h6c.621 0 1.125.504 1.125 1.125v3.75c0 .621-.504 1.125-1.125 1.125h-6a1.125 1.125 0 01-1.125-1.125v-3.75zM14.25 8.625c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v8.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-8.25zM3.75 16.125c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-2.25z" />
                    </svg>
                </div>
                <div>
                    <p className="text-sm font-semibold text-slate-700">No technical blueprint available</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                        Generate a blueprint by creating the project from source documentation.
                        The blueprint maps components, data domains, and external integrations.
                    </p>
                </div>
            </div>
        );
    }

    // ── Blueprint exists but is empty ───────────────────────────────
    const isEmpty =
        blueprint.components.length === 0 &&
        blueprint.dataDomains.length === 0 &&
        blueprint.integrations.length === 0;

    if (isEmpty) {
        return (
            <div className="flex flex-col items-center justify-center h-[460px] text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center">
                    <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                </div>
                <div>
                    <p className="text-sm font-semibold text-slate-700">Blueprint contains no elements</p>
                    <p className="text-xs text-slate-500 mt-1">
                        Version {blueprint.version}
                        {blueprint.createdAt && (
                            <> &middot; {new Date(blueprint.createdAt).toLocaleDateString()}</>
                        )}
                    </p>
                </div>
            </div>
        );
    }

    // ── Graph + Inspector ───────────────────────────────────────────
    return (
        <div className="flex flex-col h-[560px]">
            {/* Search bar */}
            <div className="flex items-center gap-2 px-3 py-2 border-b bg-white">
                <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search components, domains, integrations…"
                    className="flex-1 text-sm bg-transparent outline-none placeholder:text-slate-400"
                />
                {searchQuery.length > 0 && (
                    <button
                        onClick={() => setSearchQuery('')}
                        className="text-xs text-slate-400 hover:text-slate-600"
                    >
                        ✕
                    </button>
                )}
                {searchResults.length > 0 && (
                    <span className="text-[10px] text-slate-500 tabular-nums">
                        {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                    </span>
                )}
            </div>

            {/* Search results list (shown when searching) */}
            {searchResults.length > 0 && (
                <div className="border-b bg-slate-50/80 max-h-[140px] overflow-y-auto">
                    {searchResults.slice(0, 20).map((r) => (
                        <button
                            key={r.nodeId}
                            onClick={() => {
                                if (r.graphNodeId) {
                                    const gNode = graphModel?.nodes.find((n) => n.id === r.graphNodeId);
                                    if (gNode) {
                                        handleNodeSelect(r.graphNodeId, gNode.data);
                                    }
                                }
                            }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-blue-50 transition-colors"
                        >
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                r.kind === 'component' ? 'bg-blue-500' :
                                r.kind === 'data_domain' ? 'bg-emerald-500' :
                                r.kind === 'integration' ? 'bg-violet-500' :
                                'bg-indigo-500'
                            }`} />
                            <span className="text-xs font-medium text-slate-700 truncate">{r.label}</span>
                            <span className="text-[10px] text-slate-400 ml-auto flex-shrink-0">
                                {r.matchSnippet.substring(0, 40)}
                            </span>
                        </button>
                    ))}
                </div>
            )}

            {/* Graph + Inspector */}
            <div className="flex flex-1 min-h-0 border rounded-b-lg overflow-hidden bg-white">
                {/* Graph canvas */}
                <div className="flex-1 min-w-0">
                    <ProjectBlueprintGraph
                        blueprint={blueprint}
                        onNodeSelect={handleNodeSelect}
                        highlightedNodeIds={highlightedNodeIds}
                    />
                </div>

                {/* Inspector sidebar */}
                <div className="w-[280px] border-l bg-slate-50/60 flex-shrink-0">
                    <ProjectBlueprintInspector
                        blueprint={blueprint}
                        selectedNode={selectedNode}
                        selectedNodeId={selectedNodeId}
                        graphModel={graphModel!}
                    />
                </div>
            </div>
        </div>
    );
}
