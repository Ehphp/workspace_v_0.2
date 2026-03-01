/**
 * RAG (Retrieval-Augmented Generation) Module
 * 
 * Phase 4: Uses historical estimations to improve AI accuracy.
 * Retrieves similar past requirements and their validated estimations
 * to provide as few-shot examples in prompts.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { searchSimilarRequirements, isVectorSearchEnabled } from './vector-search';
import { recordRAGCall } from './rag-metrics';

// RAG configuration
const MAX_HISTORICAL_EXAMPLES = 3;
const MIN_SIMILARITY_FOR_RAG = 0.6;

export interface HistoricalExample {
    requirementId: string;
    requirementTitle: string;
    requirementDescription: string;
    similarity: number;
    totalDays: number;
    baseDays: number;
    activities: Array<{
        code: string;
        name: string;
        baseHours: number;
    }>;
    techPresetName?: string;
    // ── S4-1: RAG Feedback Loop ─────────────────────────
    actualHours?: number;          // real hours from estimation.actual_hours
    deviationPercent?: number;     // % deviation calculated inline
    hasActuals: boolean;           // flag for conditional template rendering
}

export interface RAGContext {
    hasExamples: boolean;
    examples: HistoricalExample[];
    promptFragment: string;
    searchLatencyMs: number;
}

/**
 * Get Supabase client for RAG queries
 */
function getSupabaseClient(): SupabaseClient | null {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return null;
    }

    return createClient(supabaseUrl, supabaseKey);
}

/**
 * Fetch historical estimation data for a requirement
 */
async function fetchEstimationHistory(
    supabase: SupabaseClient,
    requirementId: string
): Promise<{
    totalDays: number;
    baseDays: number;
    activities: Array<{ code: string; name: string; baseHours: number }>;
    techPresetName?: string;
    actualHours?: number;
    deviationPercent?: number;
    hasActuals: boolean;
} | null> {
    try {
        // Fetch the most recent estimation for this requirement
        // S4-1: include actual_hours for RAG feedback loop
        const { data: estimation, error: estimationError } = await supabase
            .from('estimations')
            .select(`
                total_days,
                base_days,
                actual_hours,
                estimation_activities (
                    activity_id,
                    activities (code, name, base_hours)
                )
            `)
            .eq('requirement_id', requirementId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (estimationError || !estimation) {
            return null;
        }

        // Fetch tech preset name
        const { data: requirement } = await supabase
            .from('requirements')
            .select(`
                technology_id,
                technologies (name)
            `)
            .eq('id', requirementId)
            .single();

        // Map activities
        const activities = (estimation.estimation_activities || [])
            .map((ea: any) => ea.activities)
            .filter(Boolean)
            .map((a: any) => ({
                code: a.code,
                name: a.name,
                baseHours: a.base_hours,
            }));

        // Handle technologies - Supabase returns differently based on relationship
        let techPresetName: string | undefined;
        const techs: any = requirement?.technologies;
        if (techs) {
            if (Array.isArray(techs) && techs.length > 0) {
                techPresetName = techs[0]?.name;
            } else if (typeof techs === 'object' && techs.name) {
                techPresetName = techs.name;
            }
        }

        // S4-1: compute deviation when actuals are available
        const actualHours = estimation.actual_hours ?? undefined;
        const deviationPercent = (actualHours != null && estimation.total_days > 0)
            ? Math.round(((actualHours / 8 - estimation.total_days) / estimation.total_days) * 1000) / 10
            : undefined;

        return {
            totalDays: estimation.total_days,
            baseDays: estimation.base_days,
            activities,
            techPresetName,
            actualHours,
            deviationPercent,
            hasActuals: actualHours != null,
        };
    } catch (err) {
        console.error('[rag] Failed to fetch estimation history:', err);
        return null;
    }
}

/**
 * Retrieve similar historical requirements with their estimations
 * 
 * @param queryText - The requirement description to search for
 * @param userId - Optional user ID to prioritize user's own history
 * @returns RAG context with historical examples
 */
export async function retrieveRAGContext(
    queryText: string,
    userId?: string
): Promise<RAGContext> {
    const startTime = Date.now();
    const context: RAGContext = {
        hasExamples: false,
        examples: [],
        promptFragment: '',
        searchLatencyMs: 0,
    };

    if (!isVectorSearchEnabled()) {
        console.log(JSON.stringify({ module: 'rag', action: 'skip', reason: 'vector_search_disabled' }));
        return context;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
        console.log(JSON.stringify({ module: 'rag', action: 'skip', reason: 'supabase_not_configured' }));
        return context;
    }

    try {
        // Search for similar requirements
        const { results: similarReqs, metrics } = await searchSimilarRequirements(
            queryText,
            userId,
            MAX_HISTORICAL_EXAMPLES * 2 // Fetch more to filter by quality
        );

        console.log(JSON.stringify({ module: 'rag', action: 'search', similarCount: similarReqs.length }));

        // Fetch estimation data for each similar requirement
        const examples: HistoricalExample[] = [];

        for (const req of similarReqs) {
            if (req.similarity < MIN_SIMILARITY_FOR_RAG) {
                continue; // Skip low-similarity matches
            }

            const history = await fetchEstimationHistory(supabase, req.id);
            if (!history || history.activities.length === 0) {
                continue; // Skip requirements without estimations
            }

            examples.push({
                requirementId: req.id,
                requirementTitle: req.title,
                requirementDescription: req.description || '',
                similarity: req.similarity,
                totalDays: history.totalDays,
                baseDays: history.baseDays,
                activities: history.activities,
                techPresetName: history.techPresetName,
                actualHours: history.actualHours,
                deviationPercent: history.deviationPercent,
                hasActuals: history.hasActuals,
            });
        }

        // S4-1: prioritize examples with actual data, then by similarity
        examples.sort((a, b) => {
            if (a.hasActuals && !b.hasActuals) return -1;
            if (!a.hasActuals && b.hasActuals) return 1;
            return b.similarity - a.similarity;
        });
        context.examples = examples.slice(0, MAX_HISTORICAL_EXAMPLES);
        context.hasExamples = examples.length > 0;
        context.searchLatencyMs = Date.now() - startTime;

        if (context.hasExamples) {
            context.promptFragment = buildRAGPromptFragment(examples);
        }

        // Record metrics for observability (S2-4)
        const avgSim = context.examples.length > 0
            ? context.examples.reduce((s, e) => s + e.similarity, 0) / context.examples.length
            : 0;

        // S4-1: track examples with actuals for observability
        recordRAGCall({
            hasExamples: context.hasExamples,
            exampleCount: context.examples.length,
            examplesWithActuals: context.examples.filter(e => e.hasActuals).length,
            avgSimilarity: avgSim,
            latencyMs: context.searchLatencyMs,
        });

        console.log(JSON.stringify({
            module: 'rag',
            action: 'retrieveContext',
            examples: context.examples.length,
            latencyMs: context.searchLatencyMs,
            avgSimilarity: Math.round(avgSim * 100) / 100,
        }));
        return context;
    } catch (err) {
        console.error('[rag] Error retrieving context:', err);
        context.searchLatencyMs = Date.now() - startTime;
        return context;
    }
}

/**
 * Build a prompt fragment from historical examples for few-shot learning
 */
function buildRAGPromptFragment(examples: HistoricalExample[]): string {
    if (examples.length === 0) {
        return '';
    }

    const lines: string[] = [
        '',
        '--- HISTORICAL EXAMPLES (for reference, similar past requirements) ---',
        '',
    ];

    for (let i = 0; i < examples.length; i++) {
        const ex = examples[i];
        const activitiesList = ex.activities
            .slice(0, 5) // Limit to top 5 activities
            .map(a => `  - ${a.code}: ${a.name} (${a.baseHours}h)`)
            .join('\n');

        lines.push(
            `Example ${i + 1} (${Math.round(ex.similarity * 100)}% similar):`,
            `Title: ${ex.requirementTitle}`,
            `Description: ${ex.requirementDescription.substring(0, 200)}${ex.requirementDescription.length > 200 ? '...' : ''}`,
            `Tech Stack: ${ex.techPresetName || 'Unknown'}`,
            `Total Estimate: ${ex.totalDays} days (base: ${ex.baseDays} days)`,
        );

        // S4-1: Accuracy feedback when actuals are available
        if (ex.hasActuals && ex.actualHours != null) {
            const actualDays = (ex.actualHours / 8).toFixed(1);
            const emoji = (ex.deviationPercent ?? 0) > 20 ? '⚠️' : '✅';
            lines.push(
                `${emoji} ACTUAL: ${actualDays} days (${ex.actualHours}h) — deviation: ${ex.deviationPercent}%`,
            );
        }

        lines.push(
            `Activities selected:`,
            activitiesList,
            ''
        );
    }

    lines.push('--- END EXAMPLES ---');
    lines.push('');
    lines.push('Use these examples as reference for similar requirement patterns.');
    lines.push('');

    return lines.join('\n');
}

/**
 * Get RAG-enhanced system prompt addition
 */
export function getRAGSystemPromptAddition(): string {
    return `
**HISTORICAL LEARNING**:
When provided with HISTORICAL EXAMPLES of similar past requirements:
1. Use them as reference for activity selection patterns
2. Consider their hour estimates as calibration data
3. **When ACTUAL data is provided**, compare estimated vs actual days. If estimates were too high/low, adjust your prediction accordingly
4. Weight examples with actual data more heavily — they represent ground truth
5. Adapt based on specific differences in the current requirement
6. Focus on activities that consistently appear in similar requirements
`;
}
