import { useCallback, useMemo, useRef, useState } from 'react';
import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    Panel,
    useNodesState,
    useEdgesState,
    useReactFlow,
    ReactFlowProvider,
    type Node,
    type Edge,
    type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { BlueprintNode } from './BlueprintNode';
import {
    buildProjectBlueprintGraph,
    type BlueprintGraphNodeData,
    type BlueprintGraphModel,
    NODE_STYLES,
    COLUMN_HEADERS,
} from '@/lib/projects/project-blueprint-graph';
import type { ProjectTechnicalBlueprint } from '@/types/project-technical-blueprint';

const nodeTypes = {
    blueprintNode: BlueprintNode,
};

interface ProjectBlueprintGraphProps {
    blueprint: ProjectTechnicalBlueprint;
    onNodeSelect?: (nodeId: string | null, data: BlueprintGraphNodeData | null) => void;
    /** Node IDs to highlight (e.g. from search results) */
    highlightedNodeIds?: Set<string>;
}

function GraphCanvas({ blueprint, onNodeSelect, highlightedNodeIds }: ProjectBlueprintGraphProps) {
    const graphModel = useMemo(() => buildProjectBlueprintGraph(blueprint), [blueprint]);
    const activeModelRef = useRef(graphModel);
    activeModelRef.current = graphModel;

    // Apply search highlighting to nodes
    const initialNodes = useMemo(() => {
        if (!highlightedNodeIds || highlightedNodeIds.size === 0) return graphModel.nodes;
        return graphModel.nodes.map((n) => ({
            ...n,
            data: {
                ...n.data,
                _searchMatch: highlightedNodeIds.has(n.id),
                _dimmed: highlightedNodeIds.size > 0 && !highlightedNodeIds.has(n.id),
            },
        }));
    }, [graphModel.nodes, highlightedNodeIds]);

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(graphModel.edges);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const { fitView } = useReactFlow();

    // ── Highlight relationships ──────────────────────────────────────
    const applyHighlight = useCallback(
        (nodeId: string | null, model: BlueprintGraphModel) => {
            if (!nodeId) {
                // Reset all to normal (skip decoration nodes)
                setNodes((nds) =>
                    nds.map((n) => ({
                        ...n,
                        data: { ...n.data, _dimmed: false },
                    })),
                );
                setEdges((eds) =>
                    eds.map((e) => ({
                        ...e,
                        style: { ...e.style, opacity: 1 },
                        animated: e.id.includes('integ'),
                    })),
                );
                return;
            }

            const connected = model.adjacency.get(nodeId) ?? new Set<string>();
            const activeIds = new Set([nodeId, ...connected]);

            setNodes((nds) =>
                nds.map((n) => {
                    // Don't dim decoration nodes
                    if (n.data._decoration) return n;
                    return {
                        ...n,
                        data: { ...n.data, _dimmed: !activeIds.has(n.id) },
                    };
                }),
            );
            setEdges((eds) =>
                eds.map((e) => {
                    const isActive = activeIds.has(e.source) && activeIds.has(e.target);
                    return {
                        ...e,
                        style: { ...e.style, opacity: isActive ? 1 : 0.12 },
                        animated: isActive && e.id.includes('integ'),
                    };
                }),
            );
        },
        [setNodes, setEdges],
    );

    const handleNodeClick: NodeMouseHandler<Node<BlueprintGraphNodeData>> = useCallback(
        (_event, node) => {
            // Ignore clicks on decoration nodes
            if (node.data._decoration) return;
            setSelectedId(node.id);
            applyHighlight(node.id, activeModelRef.current);
            onNodeSelect?.(node.id, node.data);
        },
        [onNodeSelect, applyHighlight],
    );

    const handlePaneClick = useCallback(() => {
        setSelectedId(null);
        applyHighlight(null, activeModelRef.current);
        onNodeSelect?.(null, null);
    }, [onNodeSelect, applyHighlight]);

    const miniMapNodeColor = useCallback((node: Node<BlueprintGraphNodeData>) => {
        if (node.data._decoration) return 'transparent';
        return NODE_STYLES[node.data.kind]?.border ?? '#94a3b8';
    }, []);

    const handleResetView = useCallback(() => {
        fitView({ padding: 0.15, duration: 400 });
    }, [fitView]);

    return (
        <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={handleNodeClick}
            onPaneClick={handlePaneClick}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.15, duration: 600 }}
            minZoom={0.2}
            maxZoom={2.5}
            proOptions={{ hideAttribution: true }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable
        >
            <Background gap={20} size={1} color="#e2e8f0" />
            <Controls showInteractive={false} position="bottom-left" />
            <MiniMap
                nodeColor={miniMapNodeColor}
                maskColor="rgba(0,0,0,0.08)"
                className="!bg-white/90 !border !border-slate-200 !rounded-lg !shadow-sm"
                pannable
                zoomable
            />

            {/* ── Column headers overlay ─── */}
            <Panel position="top-left" className="!m-0 !p-0 pointer-events-none">
                <div className="flex gap-0" style={{ width: 1040 }}>
                    {COLUMN_HEADERS.map((col) => {
                        const colStyle = NODE_STYLES[col.key];
                        return (
                            <div
                                key={col.key}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-b-lg"
                                style={{
                                    marginLeft: col.x === 0 ? 0 : undefined,
                                    position: 'absolute',
                                    left: col.x - 10,
                                    top: 0,
                                    background: `${colStyle.bg}cc`,
                                    borderBottom: `2px solid ${colStyle.border}40`,
                                }}
                            >
                                <div
                                    className="w-2 h-2 rounded-full"
                                    style={{ background: colStyle.border }}
                                />
                                <span className="text-[11px] font-semibold tracking-wide uppercase" style={{ color: colStyle.border }}>
                                    {col.label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </Panel>

            {/* ── Reset view ─── */}
            <Panel position="top-right">
                <button
                    onClick={handleResetView}
                    className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-sm transition-colors"
                    title="Reset view"
                >
                    Reset View
                </button>
            </Panel>
        </ReactFlow>
    );
}

// Wrap with ReactFlowProvider so useReactFlow works
export function ProjectBlueprintGraph(props: ProjectBlueprintGraphProps) {
    return (
        <div className="w-full h-full" style={{ minHeight: 420 }}>
            <ReactFlowProvider>
                <GraphCanvas {...props} />
            </ReactFlowProvider>
        </div>
    );
}
