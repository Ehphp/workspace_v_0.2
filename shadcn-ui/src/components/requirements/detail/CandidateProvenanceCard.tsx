/**
 * CandidateProvenanceCard — Debug view for candidate activity provenance.
 *
 * Shows how each activity was selected: score, sources, contributions.
 * Collapsible by default. Only renders when candidate set data exists.
 */

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Bug, Layers } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getLatestCandidateSet, type CandidateSetWithProvenance } from '@/lib/api';

interface ParsedProvenance {
    score: number;
    sources: string[];
    contributions: Record<string, number>;
    provenance: string[];
    primarySource: string;
}

function parseReason(reason?: string): ParsedProvenance | null {
    if (!reason) return null;
    try {
        return JSON.parse(reason) as ParsedProvenance;
    } catch {
        return null;
    }
}

const SOURCE_COLORS: Record<string, string> = {
    blueprint: 'bg-purple-100 text-purple-800',
    'impact-map': 'bg-blue-100 text-blue-800',
    understanding: 'bg-green-100 text-green-800',
    keyword: 'bg-amber-100 text-amber-800',
    ai: 'bg-slate-100 text-slate-700',
    manual: 'bg-emerald-100 text-emerald-800',
    rule: 'bg-orange-100 text-orange-800',
};

function SourceBadge({ source }: { source: string }) {
    const color = SOURCE_COLORS[source] || 'bg-slate-100 text-slate-700';
    return <Badge variant="outline" className={`text-xs ${color}`}>{source}</Badge>;
}

function ContributionBar({ label, value, maxValue }: { label: string; value: number; maxValue: number }) {
    const pct = maxValue > 0 ? Math.min((value / maxValue) * 100, 100) : 0;
    const color = SOURCE_COLORS[label]?.replace('text-', 'bg-').replace('-800', '-400').replace('-700', '-400') || 'bg-slate-400';
    return (
        <div className="flex items-center gap-2 text-xs">
            <span className="w-24 text-slate-500 truncate">{label}</span>
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="w-10 text-right font-mono text-slate-600">{value.toFixed(1)}</span>
        </div>
    );
}

interface CandidateProvenanceCardProps {
    requirementId: string | undefined;
}

export function CandidateProvenanceCard({ requirementId }: CandidateProvenanceCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [candidateSet, setCandidateSet] = useState<CandidateSetWithProvenance | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!requirementId) return;
        setLoading(true);
        getLatestCandidateSet(requirementId)
            .then(setCandidateSet)
            .catch((err) => console.warn('Failed to load candidate set:', err))
            .finally(() => setLoading(false));
    }, [requirementId]);

    // Don't render if no data
    if (!candidateSet || candidateSet.candidates.length === 0) return null;

    // Parse provenance from reason field
    const enrichedCandidates = candidateSet.candidates
        .map(c => ({
            code: c.activity_code,
            source: c.source,
            score: c.score,
            confidence: c.confidence,
            parsed: parseReason(c.reason),
        }))
        .sort((a, b) => (b.parsed?.score ?? b.score) - (a.parsed?.score ?? a.score));

    const hasProvenance = enrichedCandidates.some(c => c.parsed !== null);
    const maxScore = Math.max(...enrichedCandidates.map(c => c.parsed?.score ?? c.score));
    const maxContribution = Math.max(
        ...enrichedCandidates.flatMap(c =>
            c.parsed ? Object.values(c.parsed.contributions) : [0]
        )
    );

    return (
        <div className="border border-slate-200 rounded-lg bg-white">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center justify-between w-full px-4 py-3 hover:bg-slate-50 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <Bug className="h-4 w-4 text-slate-400" />
                    <span className="text-sm font-medium text-slate-700">
                        Candidate Provenance
                    </span>
                    <Badge variant="outline" className="text-xs bg-slate-50">
                        {enrichedCandidates.length} candidates
                    </Badge>
                    {hasProvenance && (
                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                            enriched
                        </Badge>
                    )}
                </div>
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {isExpanded && (
                <div className="border-t border-slate-100 px-4 py-3 space-y-3">
                    {loading && <p className="text-xs text-slate-400">Loading...</p>}

                    {/* Summary row */}
                    <div className="flex gap-4 text-xs text-slate-500">
                        <span>Set ID: <code className="text-slate-600">{candidateSet.id.slice(0, 8)}</code></span>
                        <span>Created: {new Date(candidateSet.created_at).toLocaleString('it-IT')}</span>
                    </div>

                    {/* Candidate list */}
                    <div className="divide-y divide-slate-100">
                        {enrichedCandidates.map((c, i) => (
                            <div key={c.code} className="py-2 first:pt-0 last:pb-0">
                                <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-mono font-medium text-slate-800">
                                            #{i + 1} {c.code}
                                        </span>
                                        <SourceBadge source={c.parsed?.primarySource ?? c.source} />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-mono text-slate-600">
                                            score: {(c.parsed?.score ?? c.score).toFixed(1)}
                                        </span>
                                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-blue-500 rounded-full"
                                                style={{ width: `${maxScore > 0 ? ((c.parsed?.score ?? c.score) / maxScore) * 100 : 0}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {c.parsed && (
                                    <div className="ml-4 space-y-1">
                                        {/* Sources */}
                                        <div className="flex items-center gap-1 flex-wrap">
                                            <Layers className="h-3 w-3 text-slate-400" />
                                            {c.parsed.sources.map((s, j) => (
                                                <Badge key={j} variant="outline" className="text-[10px] py-0 px-1">
                                                    {s}
                                                </Badge>
                                            ))}
                                        </div>

                                        {/* Contributions */}
                                        <div className="space-y-0.5">
                                            {Object.entries(c.parsed.contributions)
                                                .filter(([, v]) => v > 0)
                                                .sort(([, a], [, b]) => b - a)
                                                .map(([key, val]) => (
                                                    <ContributionBar
                                                        key={key}
                                                        label={key}
                                                        value={val}
                                                        maxValue={maxContribution}
                                                    />
                                                ))}
                                        </div>
                                    </div>
                                )}

                                {/* Non-enriched fallback */}
                                {!c.parsed && (
                                    <div className="ml-4 text-xs text-slate-400">
                                        Legacy candidate (no provenance)
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
