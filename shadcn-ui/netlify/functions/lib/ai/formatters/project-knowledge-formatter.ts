/**
 * Project Knowledge Layer formatter + prompt dedup decision matrix.
 */

import type { RelevantProjectContext } from '../../domain/project/project-knowledge-layer.types';

const DEFAULT_RELEVANT_MAX_CHARS = 3200;
const MAX_PROJECT_CONTEXT_CHARS = Number(process.env.AI_PROJECT_CONTEXT_MAX_CHARS ?? 5200);
const MIN_BUDGET_FOR_HYBRID = Number(process.env.AI_PROJECT_CONTEXT_MIN_HYBRID_BUDGET ?? 2200);
const REPLACE_MIN_CONFIDENCE = Number(process.env.AI_PROJECT_CONTEXT_REPLACE_MIN_CONFIDENCE ?? 0.55);
const HYBRID_MIN_CONFIDENCE = Number(process.env.AI_PROJECT_CONTEXT_HYBRID_MIN_CONFIDENCE ?? 0.35);
const MIN_COVERAGE = Number(process.env.AI_PROJECT_CONTEXT_MIN_COVERAGE ?? 0.40);

export interface ProjectKnowledgeDedupDecision {
    modeSelected: 'replace' | 'hybrid' | 'fallback';
    confidence: number;
    coverage: number;
    weakMatch: boolean;
    charUsage: {
        relevantBlock: number;
        ptbBlock: number;
        total: number;
    };
    includedSections: string[];
    downgradeReason?: string;
}

function truncate(text: string, maxChars: number): string {
    if (!text || text.length <= maxChars) return text;
    return text.slice(0, maxChars - 20) + '\n[...troncato]';
}

function compactPTBBlock(fullBlock: string, maxChars: number): string {
    if (!fullBlock) return '';

    // Remove verbose source sections when present.
    const sddCut = fullBlock.split('DIGEST STRUTTURATO DEL PROGETTO')[0];
    const docCut = sddCut.split('DOCUMENTAZIONE PROGETTO')[0];
    const compact = docCut.trim();

    return truncate(compact || fullBlock, maxChars);
}

function baselinePTBBlock(fullBlock: string, maxChars: number): string {
    if (!fullBlock) return '';
    const compact = compactPTBBlock(fullBlock, maxChars);
    const lines = compact.split('\n').slice(0, 5);
    return truncate(lines.join('\n'), maxChars);
}

function formatScoredNodes(title: string, nodes: Array<{ node: { label: string; kind: string }; score: number; reasons: string[] }>): string[] {
    if (nodes.length === 0) return [];

    const lines: string[] = [title];
    for (const n of nodes) {
        const reasons = n.reasons.slice(0, 4).join(', ');
        lines.push(`- ${n.node.label} (${n.node.kind}) score=${n.score.toFixed(2)} reasons=[${reasons}]`);
    }
    return lines;
}

export function formatRelevantProjectKnowledgeBlock(
    context: RelevantProjectContext | undefined,
    maxChars: number = DEFAULT_RELEVANT_MAX_CHARS,
): string {
    if (!context) return '';

    const lines: string[] = [
        '\nRELEVANT PROJECT CONTEXT (selezione deterministica requisito-specifica):',
        `- retrievalConfidence: ${context.retrievalConfidence.toFixed(3)}`,
        `- retrievalCoverage: ${context.retrievalCoverage.toFixed(3)}`,
        `- weakMatch: ${context.weakMatch ? 'true' : 'false'}`,
    ];

    if (context.queryTerms.length > 0) {
        lines.push(`- queryTerms: ${context.queryTerms.slice(0, 20).join(', ')}`);
    }

    lines.push(...formatScoredNodes('Componenti rilevanti:', context.selected.components));
    lines.push(...formatScoredNodes('Integrazioni rilevanti:', context.selected.integrations));
    lines.push(...formatScoredNodes('Domini dati rilevanti:', context.selected.dataDomains));
    lines.push(...formatScoredNodes('Workflow rilevanti:', context.selected.workflows));

    if (context.selected.relations.length > 0) {
        lines.push('Relazioni rilevanti:');
        for (const r of context.selected.relations.slice(0, 10)) {
            lines.push(`- ${r.fromNodeId} ${r.type} ${r.toNodeId}`);
        }
    }

    if (context.warnings.length > 0) {
        lines.push(`Warnings: ${context.warnings.join('; ')}`);
    }

    if (context.qualityFlags.length > 0) {
        lines.push(`Quality flags: ${context.qualityFlags.join('; ')}`);
    }

    return truncate(lines.join('\n'), maxChars);
}

export function selectDeduplicationMode(input: {
    relevantProjectContext?: RelevantProjectContext;
    relevantProjectContextBlock?: string;
    projectTechnicalBlueprintBlock?: string;
    maxProjectContextChars?: number;
}): {
    decision: ProjectKnowledgeDedupDecision;
    blocks: {
        relevantBlock: string;
        ptbBlock: string;
    };
} {
    const maxChars = input.maxProjectContextChars ?? MAX_PROJECT_CONTEXT_CHARS;
    const relevantCtx = input.relevantProjectContext;
    const relevantBlock = input.relevantProjectContextBlock || '';
    const ptbFull = input.projectTechnicalBlueprintBlock || '';

    if (!relevantCtx || !relevantBlock) {
        const ptb = truncate(ptbFull, maxChars);
        return {
            decision: {
                modeSelected: 'fallback',
                confidence: 0,
                coverage: 0,
                weakMatch: true,
                charUsage: { relevantBlock: 0, ptbBlock: ptb.length, total: ptb.length },
                includedSections: ['ptb-full-legacy'],
                downgradeReason: 'missing_relevant_context',
            },
            blocks: {
                relevantBlock: '',
                ptbBlock: ptb,
            },
        };
    }

    const confidence = relevantCtx.retrievalConfidence;
    const coverage = relevantCtx.retrievalCoverage;
    const weakMatch = relevantCtx.weakMatch;

    // Replace mode
    if (confidence >= REPLACE_MIN_CONFIDENCE && coverage >= MIN_COVERAGE && !weakMatch) {
        const ptbBaseline = baselinePTBBlock(ptbFull, 700);
        let relevant = truncate(relevantBlock, Math.max(0, maxChars - ptbBaseline.length));
        let total = relevant.length + ptbBaseline.length;
        if (total > maxChars) {
            relevant = truncate(relevant, Math.max(0, maxChars - ptbBaseline.length));
            total = relevant.length + ptbBaseline.length;
        }
        return {
            decision: {
                modeSelected: 'replace',
                confidence,
                coverage,
                weakMatch,
                charUsage: { relevantBlock: relevant.length, ptbBlock: ptbBaseline.length, total },
                includedSections: ['relevant-full', 'ptb-baseline'],
            },
            blocks: {
                relevantBlock: relevant,
                ptbBlock: ptbBaseline,
            },
        };
    }

    // Hybrid mode
    if (confidence >= HYBRID_MIN_CONFIDENCE && !weakMatch) {
        if (maxChars < MIN_BUDGET_FOR_HYBRID) {
            const ptb = truncate(ptbFull, maxChars);
            return {
                decision: {
                    modeSelected: 'fallback',
                    confidence,
                    coverage,
                    weakMatch,
                    charUsage: { relevantBlock: 0, ptbBlock: ptb.length, total: ptb.length },
                    includedSections: ['ptb-full-legacy'],
                    downgradeReason: 'budget_insufficient_for_hybrid',
                },
                blocks: {
                    relevantBlock: '',
                    ptbBlock: ptb,
                },
            };
        }

        const ptbCompact = compactPTBBlock(ptbFull, Math.min(1400, Math.floor(maxChars * 0.45)));
        const relevantCompact = truncate(relevantBlock, Math.max(0, maxChars - ptbCompact.length));
        const total = Math.min(maxChars, relevantCompact.length + ptbCompact.length);
        return {
            decision: {
                modeSelected: 'hybrid',
                confidence,
                coverage,
                weakMatch,
                charUsage: { relevantBlock: relevantCompact.length, ptbBlock: ptbCompact.length, total },
                includedSections: ['relevant-compact', 'ptb-compact'],
            },
            blocks: {
                relevantBlock: relevantCompact,
                ptbBlock: ptbCompact,
            },
        };
    }

    // Fallback mode
    const ptb = truncate(ptbFull, maxChars);
    return {
        decision: {
            modeSelected: 'fallback',
            confidence,
            coverage,
            weakMatch,
            charUsage: { relevantBlock: 0, ptbBlock: ptb.length, total: ptb.length },
            includedSections: ['ptb-full-legacy'],
            downgradeReason: weakMatch ? 'weak_match' : 'low_confidence',
        },
        blocks: {
            relevantBlock: '',
            ptbBlock: ptb,
        },
    };
}
