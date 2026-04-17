import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { NODE_STYLES, type BlueprintGraphNodeData, type BlueprintNodeKind } from '@/lib/projects/project-blueprint-graph';
import type { ProjectTechnicalBlueprint } from '@/types/project-technical-blueprint';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface TreeMapItem {
    id: string;
    weight: number;
    label: string;
    kind: BlueprintNodeKind;
    nodeData: BlueprintGraphNodeData;
    riskBand: 'high' | 'medium' | 'low';
}

interface TreeMapRect {
    item: TreeMapItem;
    x: number;
    y: number;
    w: number;
    h: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Squarified TreeMap Layout Algorithm
// ─────────────────────────────────────────────────────────────────────────────

function worstAspectRatio(areas: number[], sideLength: number): number {
    const totalArea = areas.reduce((s, a) => s + a, 0);
    if (totalArea <= 0 || sideLength <= 0) return Infinity;
    const rowLen = totalArea / sideLength;
    let worst = 0;
    for (const area of areas) {
        const itemLen = area / rowLen;
        const ratio = Math.max(rowLen / itemLen, itemLen / rowLen);
        if (ratio > worst) worst = ratio;
    }
    return worst;
}

function squarify(
    items: { id: string; area: number }[],
    x: number, y: number, w: number, h: number,
): { id: string; x: number; y: number; w: number; h: number }[] {
    if (items.length === 0) return [];
    if (items.length === 1) return [{ id: items[0].id, x, y, w, h }];
    if (w <= 0 || h <= 0) return [];

    const results: { id: string; x: number; y: number; w: number; h: number }[] = [];
    let remaining = [...items];
    let rx = x, ry = y, rw = w, rh = h;

    while (remaining.length > 0) {
        if (rw <= 0 || rh <= 0) break;

        const isWide = rw >= rh;
        const shortSide = isWide ? rh : rw;

        // Build the best row greedily
        const row: typeof items = [remaining[0]];
        let rowAreas = [remaining[0].area];
        let bestWorst = worstAspectRatio(rowAreas, shortSide);

        for (let i = 1; i < remaining.length; i++) {
            const candidateAreas = [...rowAreas, remaining[i].area];
            const candidateWorst = worstAspectRatio(candidateAreas, shortSide);
            if (candidateWorst <= bestWorst) {
                row.push(remaining[i]);
                rowAreas = candidateAreas;
                bestWorst = candidateWorst;
            } else {
                break;
            }
        }

        // Lay out the row
        const rowTotalArea = row.reduce((s, item) => s + item.area, 0);

        if (isWide) {
            const rowWidth = Math.min(rowTotalArea / rh, rw);
            let cy = ry;
            for (const item of row) {
                const itemHeight = item.area / rowWidth;
                results.push({ id: item.id, x: rx, y: cy, w: rowWidth, h: itemHeight });
                cy += itemHeight;
            }
            rx += rowWidth;
            rw -= rowWidth;
        } else {
            const rowHeight = Math.min(rowTotalArea / rw, rh);
            let cx = rx;
            for (const item of row) {
                const itemWidth = item.area / rowHeight;
                results.push({ id: item.id, x: cx, y: ry, w: itemWidth, h: rowHeight });
                cx += itemWidth;
            }
            ry += rowHeight;
            rh -= rowHeight;
        }

        remaining = remaining.slice(row.length);
    }

    return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const BAND_CONFIG: Record<string, { bg: string; border: string; text: string; label: string }> = {
    high: { bg: '#fef2f2', border: '#ef4444', text: '#dc2626', label: 'HIGH RISK' },
    medium: { bg: '#fffbeb', border: '#f59e0b', text: '#d97706', label: 'MEDIUM RISK' },
    low: { bg: '#f0fdf4', border: '#22c55e', text: '#16a34a', label: 'LOW RISK' },
};

const BAND_HEADER_HEIGHT = 28;
const BAND_GAP = 8;
const CELL_PAD = 2;

const COUPLING_COLORS: Record<string, string> = {
    tight: '#ef4444',
    moderate: '#f59e0b',
    loose: '#22c55e',
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface BlueprintTreeMapProps {
    blueprint: ProjectTechnicalBlueprint;
    onNodeSelect?: (nodeId: string | null, data: BlueprintGraphNodeData | null) => void;
}

export function BlueprintTreeMap({ blueprint, onNodeSelect }: BlueprintTreeMapProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ width: 0, height: 0 });
    const [selectedId, setSelectedId] = useState<string | null>(null);

    // ── Observe container size ──────────────────────────────────────
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const ro = new ResizeObserver(([entry]) => {
            if (entry) {
                setSize({
                    width: entry.contentRect.width,
                    height: entry.contentRect.height,
                });
            }
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    // ── Build tree map items from blueprint ─────────────────────────
    const items = useMemo<TreeMapItem[]>(() => {
        const result: TreeMapItem[] = [];

        const makeWeight = (data: BlueprintGraphNodeData) => {
            const relations = data.structuralSignals?.relationsCount ?? 0;
            const wfPart = data.structuralSignals?.workflowParticipation ?? 0;
            const surfaceBonus = data.estimationSignals?.changeSurface === 'broad' ? 3
                : data.estimationSignals?.changeSurface === 'moderate' ? 2 : 1;
            return Math.max(1, relations * 2 + wfPart + surfaceBonus);
        };

        const makeRiskBand = (data: BlueprintGraphNodeData): 'high' | 'medium' | 'low' => {
            return (data.estimationSignals?.modificationCost ?? 'low') as 'high' | 'medium' | 'low';
        };

        blueprint.components.forEach((comp, i) => {
            const nodeData: BlueprintGraphNodeData = {
                kind: 'component', label: comp.name || 'Unnamed',
                description: comp.description, confidence: comp.confidence,
                typeLabel: comp.type, sourceIndex: i,
                nodeId: comp.id, evidence: comp.evidence,
                businessCriticality: comp.businessCriticality,
                estimationImpact: comp.estimationImpact,
                changeLikelihood: comp.changeLikelihood,
                reviewStatus: comp.reviewStatus,
                hasNoEvidence: !comp.evidence || comp.evidence.length === 0,
                structuralSignals: comp.structuralSignals,
                estimationSignals: comp.estimationSignals,
            };
            result.push({
                id: `comp-${i}`, weight: makeWeight(nodeData),
                label: comp.name || 'Unnamed', kind: 'component',
                nodeData, riskBand: makeRiskBand(nodeData),
            });
        });

        blueprint.dataDomains.forEach((dd, i) => {
            const nodeData: BlueprintGraphNodeData = {
                kind: 'data_domain', label: dd.name || 'Unnamed',
                description: dd.description, confidence: dd.confidence,
                typeLabel: 'Data Domain', sourceIndex: i,
                nodeId: dd.id, evidence: dd.evidence,
                businessCriticality: dd.businessCriticality,
                estimationImpact: dd.estimationImpact,
                changeLikelihood: dd.changeLikelihood,
                reviewStatus: dd.reviewStatus,
                hasNoEvidence: !dd.evidence || dd.evidence.length === 0,
                structuralSignals: dd.structuralSignals,
                estimationSignals: dd.estimationSignals,
            };
            result.push({
                id: `dd-${i}`, weight: makeWeight(nodeData),
                label: dd.name || 'Unnamed', kind: 'data_domain',
                nodeData, riskBand: makeRiskBand(nodeData),
            });
        });

        blueprint.integrations.forEach((integ, i) => {
            const nodeData: BlueprintGraphNodeData = {
                kind: 'integration', label: integ.systemName || 'Unnamed',
                description: integ.description, confidence: integ.confidence,
                typeLabel: integ.direction ?? 'unknown', sourceIndex: i,
                nodeId: integ.id, evidence: integ.evidence,
                businessCriticality: integ.businessCriticality,
                estimationImpact: integ.estimationImpact,
                changeLikelihood: integ.changeLikelihood,
                reviewStatus: integ.reviewStatus,
                hasNoEvidence: !integ.evidence || integ.evidence.length === 0,
                structuralSignals: integ.structuralSignals,
                estimationSignals: integ.estimationSignals,
            };
            result.push({
                id: `integ-${i}`, weight: makeWeight(nodeData),
                label: integ.systemName || 'Unnamed', kind: 'integration',
                nodeData, riskBand: makeRiskBand(nodeData),
            });
        });

        (blueprint.workflows ?? []).forEach((wf, i) => {
            const nodeData: BlueprintGraphNodeData = {
                kind: 'workflow', label: wf.name || 'Unnamed',
                description: wf.description, confidence: wf.confidence,
                typeLabel: wf.trigger ?? 'workflow', sourceIndex: i,
                nodeId: wf.id, evidence: wf.evidence,
                businessCriticality: wf.complexity as BlueprintGraphNodeData['businessCriticality'],
                reviewStatus: wf.reviewStatus,
                hasNoEvidence: !wf.evidence || wf.evidence.length === 0,
                structuralSignals: wf.structuralSignals,
                estimationSignals: wf.estimationSignals,
            };
            result.push({
                id: `wf-${i}`, weight: makeWeight(nodeData),
                label: wf.name || 'Unnamed', kind: 'workflow',
                nodeData, riskBand: makeRiskBand(nodeData),
            });
        });

        return result;
    }, [blueprint]);

    // ── Group by risk band ──────────────────────────────────────────
    const bands = useMemo(() => {
        const grouped: Record<string, TreeMapItem[]> = { high: [], medium: [], low: [] };
        for (const item of items) grouped[item.riskBand].push(item);
        return grouped;
    }, [items]);

    // ── Compute layout rects and band headers ───────────────────────
    const { rects, headers } = useMemo<{ rects: TreeMapRect[]; headers: { key: string; y: number; count: number }[] }>(() => {
        if (size.width <= 0 || size.height <= 0) return { rects: [], headers: [] };

        const activeBands = (['high', 'medium', 'low'] as const).filter((k) => bands[k].length > 0);
        if (activeBands.length === 0) return { rects: [], headers: [] };

        const totalHeaderSpace = activeBands.length * BAND_HEADER_HEIGHT + Math.max(0, activeBands.length - 1) * BAND_GAP;
        const availableHeight = size.height - totalHeaderSpace;
        if (availableHeight <= 0) return { rects: [], headers: [] };

        const bandWeights: Record<string, number> = {};
        let totalWeight = 0;
        for (const key of activeBands) {
            bandWeights[key] = bands[key].reduce((s, i) => s + i.weight, 0);
            totalWeight += bandWeights[key];
        }

        const resultRects: TreeMapRect[] = [];
        const resultHeaders: { key: string; y: number; count: number }[] = [];
        let currentY = 0;

        for (const bandKey of activeBands) {
            resultHeaders.push({ key: bandKey, y: currentY, count: bands[bandKey].length });
            currentY += BAND_HEADER_HEIGHT;

            const bandHeight = Math.max(40, (bandWeights[bandKey] / totalWeight) * availableHeight);
            const bandItems = bands[bandKey];
            const totalBandWeight = bandWeights[bandKey];
            const totalBandArea = size.width * bandHeight;

            const areaItems = bandItems
                .map((item) => ({
                    id: item.id,
                    area: (item.weight / totalBandWeight) * totalBandArea,
                }))
                .sort((a, b) => b.area - a.area);

            const layoutRects = squarify(areaItems, 0, currentY, size.width, bandHeight);

            for (const rect of layoutRects) {
                const item = bandItems.find((i) => i.id === rect.id);
                if (item) {
                    resultRects.push({
                        item,
                        x: rect.x + CELL_PAD,
                        y: rect.y + CELL_PAD,
                        w: Math.max(0, rect.w - 2 * CELL_PAD),
                        h: Math.max(0, rect.h - 2 * CELL_PAD),
                    });
                }
            }

            currentY += bandHeight + BAND_GAP;
        }

        return { rects: resultRects, headers: resultHeaders };
    }, [bands, size]);

    // ── Click handlers ──────────────────────────────────────────────
    const handleCellClick = useCallback((item: TreeMapItem) => {
        setSelectedId(item.id);
        onNodeSelect?.(item.id, item.nodeData);
    }, [onNodeSelect]);

    const handleBackgroundClick = useCallback(() => {
        setSelectedId(null);
        onNodeSelect?.(null, null);
    }, [onNodeSelect]);

    return (
        <div
            ref={containerRef}
            className="w-full h-full relative overflow-hidden bg-slate-50/30"
            onClick={handleBackgroundClick}
        >
            {/* Band headers */}
            {headers.map((bh) => {
                const config = BAND_CONFIG[bh.key];
                return (
                    <div
                        key={bh.key}
                        className="absolute left-0 right-0 flex items-center gap-2 px-3 pointer-events-none"
                        style={{ top: bh.y, height: BAND_HEADER_HEIGHT }}
                    >
                        <div className="w-2 h-2 rounded-full" style={{ background: config.border }} />
                        <span
                            className="text-[10px] font-bold uppercase tracking-wider"
                            style={{ color: config.text }}
                        >
                            {config.label}
                        </span>
                        <span className="text-[10px] text-slate-400">({bh.count})</span>
                    </div>
                );
            })}

            {/* Treemap cells */}
            {rects.map((rect) => (
                <TreeMapCell
                    key={rect.item.id}
                    rect={rect}
                    isSelected={selectedId === rect.item.id}
                    onClick={handleCellClick}
                />
            ))}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// TreeMap Cell Component
// ─────────────────────────────────────────────────────────────────────────────

function TreeMapCell({
    rect,
    isSelected,
    onClick,
}: {
    rect: TreeMapRect;
    isSelected: boolean;
    onClick: (item: TreeMapItem) => void;
}) {
    const { item, x, y, w, h } = rect;
    const { nodeData, riskBand } = item;

    const bandConfig = BAND_CONFIG[riskBand];
    const kindStyle = NODE_STYLES[item.kind];
    const coupling = nodeData.structuralSignals?.couplingDegree ?? 'loose';
    const couplingColor = COUPLING_COLORS[coupling] ?? COUPLING_COLORS.loose;
    const isFragile = nodeData.estimationSignals?.fragile === true;
    const isReusable = nodeData.estimationSignals?.reusable === true;
    const isHighCost = nodeData.estimationSignals?.modificationCost === 'high';

    // Adaptive content based on cell size
    const showLabels = w >= 60 && h >= 32;
    const showDetails = w >= 100 && h >= 52;
    const showCouplingBar = w >= 80 && h >= 64;

    const relationsCount = nodeData.structuralSignals?.relationsCount ?? 0;
    const couplingPct = coupling === 'tight' ? 100 : coupling === 'moderate' ? 60 : 25;

    return (
        <div
            className="absolute rounded-lg cursor-pointer transition-all duration-150 overflow-hidden"
            style={{
                left: x,
                top: y,
                width: w,
                height: h,
                background: isFragile ? '#fef2f2' : isReusable ? '#f0fdf4' : bandConfig.bg,
                borderWidth: isSelected ? 3 : isHighCost ? 2 : 1,
                borderStyle: 'solid',
                borderColor: isSelected ? bandConfig.border : `${bandConfig.border}60`,
                borderLeftWidth: 4,
                borderLeftColor: couplingColor,
                boxShadow: isSelected
                    ? `0 0 0 2px ${bandConfig.border}30, 0 4px 12px ${bandConfig.border}15`
                    : '0 1px 2px rgba(0,0,0,0.04)',
            }}
            onClick={(e) => {
                e.stopPropagation();
                onClick(item);
            }}
        >
            {showLabels && (
                <div className="px-2 py-1.5 h-full flex flex-col">
                    {/* Header row */}
                    <div className="flex items-center gap-1 min-w-0">
                        <span className="text-xs font-semibold text-slate-900 truncate flex-1">
                            {item.label}
                        </span>
                        {isHighCost && (
                            <span className="text-[8px] bg-red-100 text-red-600 rounded px-0.5 font-bold flex-shrink-0">$$</span>
                        )}
                        {isFragile && (
                            <span className="text-[8px] flex-shrink-0">⚠️</span>
                        )}
                        {isReusable && (
                            <span className="text-[8px] flex-shrink-0">♻️</span>
                        )}
                    </div>

                    {showDetails && (
                        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                            <Badge className={`${kindStyle.badge} text-[8px] px-1 py-0 h-3 font-medium`}>
                                {item.kind === 'data_domain' ? 'domain' : item.kind}
                            </Badge>
                            <Badge
                                className="text-[8px] px-1 py-0 h-3 font-medium"
                                style={{ background: `${couplingColor}18`, color: couplingColor }}
                            >
                                {coupling}
                            </Badge>
                        </div>
                    )}

                    {showCouplingBar && (
                        <div className="flex items-center gap-1 mt-auto">
                            <div className="flex-1 h-1 rounded-full bg-slate-100 overflow-hidden">
                                <div
                                    className="h-full rounded-full"
                                    style={{ width: `${couplingPct}%`, background: couplingColor }}
                                />
                            </div>
                            <span className="text-[8px] text-slate-400 tabular-nums">{relationsCount}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
