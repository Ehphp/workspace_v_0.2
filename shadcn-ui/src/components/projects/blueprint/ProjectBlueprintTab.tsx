import { useState, useEffect, useCallback, useMemo } from 'react';
import { getLatestProjectTechnicalBlueprint } from '@/lib/project-technical-blueprint-repository';
import { ProjectBlueprintGraph } from './ProjectBlueprintGraph';
import { ProjectBlueprintInspector } from './ProjectBlueprintInspector';
import { buildProjectBlueprintGraph } from '@/lib/projects/project-blueprint-graph';
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
        <div className="flex h-[520px] border rounded-lg overflow-hidden bg-white">
            {/* Graph canvas */}
            <div className="flex-1 min-w-0">
                <ProjectBlueprintGraph
                    blueprint={blueprint}
                    onNodeSelect={handleNodeSelect}
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
    );
}
