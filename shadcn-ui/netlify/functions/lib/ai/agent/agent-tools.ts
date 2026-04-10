/**
 * Agent Tools — Phase 3: Agentic Evolution
 * 
 * Defines the tools available to the AI agent during estimation.
 * These are exposed as OpenAI function-calling definitions and 
 * executed server-side when the model requests them.
 * 
 * Tools:
 * 1. search_catalog       — Search activities via pgvector similarity
 * 2. query_history         — Query similar past estimations (RAG)
 * 3. validate_estimation   — Run through EstimationEngine deterministic check
 * 4. get_activity_details  — Get full details for specific activity codes
 */

import { ToolDefinition, ToolCallRecord, AgentActivity } from './agent-types';
import { searchSimilarActivities, isVectorSearchEnabled } from '../vector-search';
import { retrieveRAGContext } from '../rag';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ─────────────────────────────────────────────────────────────────────────────
// Tool Definitions (OpenAI function calling schema)
// ─────────────────────────────────────────────────────────────────────────────

export const AGENT_TOOL_DEFINITIONS: ToolDefinition[] = [
    {
        type: 'function',
        function: {
            name: 'search_catalog',
            description: 'Search the activity catalog using semantic similarity. Use this when you need to find activities relevant to a specific technical aspect of the requirement that may not be in the initial context.',
            parameters: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'Natural language description of the technical need (e.g., "REST API integration with external ERP system")'
                    },
                    categories: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Technology categories to search within (e.g., ["BACKEND", "MULTI"])'
                    },
                    limit: {
                        type: 'number',
                        description: 'Maximum number of results (default: 15)'
                    }
                },
                required: ['query', 'categories']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'query_history',
            description: 'Query historical estimations for similar requirements. Use this to calibrate your estimate against past validated estimations.',
            parameters: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'Requirement description to find similar historical examples'
                    },
                    userId: {
                        type: 'string',
                        description: 'Optional user ID to prioritize their past estimations'
                    }
                },
                required: ['query']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'validate_estimation',
            description: 'Validate a draft estimation through the deterministic calculation engine. Returns computed totals to verify mathematical consistency. Use this to check if your selected activities produce reasonable day totals.',
            parameters: {
                type: 'object',
                properties: {
                    activities: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                code: { type: 'string' },
                                baseHours: { type: 'number' }
                            },
                            required: ['code', 'baseHours']
                        },
                        description: 'Activities with their base hours'
                    },
                    driverMultiplier: {
                        type: 'number',
                        description: 'Combined driver multiplier (default: 1.0)'
                    },
                    riskScore: {
                        type: 'number',
                        description: 'Combined risk score (default: 0)'
                    }
                },
                required: ['activities']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_activity_details',
            description: 'Get full details (description, group, hours, tech_category) for specific activity codes. Use this when you need more information about activities before selecting them.',
            parameters: {
                type: 'object',
                properties: {
                    codes: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Array of activity codes to look up'
                    }
                },
                required: ['codes']
            }
        }
    }
];

// ─────────────────────────────────────────────────────────────────────────────
// Tool Execution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Runtime context for tool execution — holds references to shared resources
 */
export interface ToolExecutionContext {
    /** Full activity catalog (from input) */
    activitiesCatalog: AgentActivity[];
    /** User ID for personalized RAG */
    userId?: string;
    /** Pre-fetched RAG context (avoids duplicate calls when agent uses query_history) */
    prefetchedRAG?: {
        hasExamples: boolean;
        examples: Array<{
            requirementTitle: string;
            requirementDescription: string;
            similarity: number;
            totalDays: number;
            baseDays: number;
            activities: Array<{ code: string; name: string; baseHours: number }>;
            techPresetName?: string;
        }>;
        searchLatencyMs: number;
    };
}

/**
 * Execute a tool call requested by the AI model.
 * Returns the result as a JSON-serializable object.
 */
export async function executeTool(
    toolName: string,
    args: Record<string, any>,
    ctx: ToolExecutionContext
): Promise<{ result: any; record: ToolCallRecord }> {
    const startTime = Date.now();
    let result: any;
    console.log(`[tools] >>> Esecuzione: ${toolName}`);

    try {
        switch (toolName) {
            case 'search_catalog':
                result = await executeSearchCatalog(args, ctx);
                break;
            case 'query_history':
                result = await executeQueryHistory(args, ctx);
                break;
            case 'validate_estimation':
                result = await executeValidateEstimation(args);
                break;
            case 'get_activity_details':
                result = await executeGetActivityDetails(args, ctx);
                break;
            default:
                result = { error: `Unknown tool: ${toolName}` };
        }
    } catch (error) {
        result = {
            error: `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
        };
    }

    const durationMs = Date.now() - startTime;

    const record: ToolCallRecord = {
        toolName,
        arguments: args,
        result: summarizeResult(result),
        durationMs,
        timestamp: new Date().toISOString()
    };

    console.log(`[tools] <<< ${toolName} completato in ${durationMs}ms`);

    return { result, record };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool Implementations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * search_catalog — Semantic search in activity catalog via pgvector
 */
async function executeSearchCatalog(
    args: Record<string, any>,
    ctx: ToolExecutionContext
): Promise<any> {
    const query = args.query as string;
    const categories = (args.categories as string[]) || ['MULTI'];
    const limit = (args.limit as number) || 15;

    console.log(`[tools]   search_catalog: query="${query}", categories=${JSON.stringify(categories)}, limit=${limit}`);

    if (!isVectorSearchEnabled()) {
        // Fallback: keyword matching against in-memory catalog
        console.log('[tools]   Vector search disabilitato → keyword fallback su catalogo in-memory');
        const fallbackResult = keywordFallbackSearch(query, categories, limit, ctx.activitiesCatalog);
        console.log(`[tools]   Keyword fallback: ${fallbackResult.count} risultati`);
        return fallbackResult;
    }

    try {
        console.log('[tools]   Invocazione pgvector similarity search (threshold=0.4)...');
        const { results, metrics } = await searchSimilarActivities(
            query,
            categories,
            limit,
            0.4 // Lower threshold for broader discovery
        );

        console.log(`[tools]   pgvector: ${results.length} risultati (metodo: ${metrics.method}, ${metrics.latencyMs}ms)`);

        // If vector search fell back (0% similarity), warn clearly and don't return misleading results
        if (metrics.usedFallback) {
            console.warn(`[tools]   search_catalog: vector search returned no semantic matches (fallback reason: ${metrics.fallbackReason}). Using keyword fallback instead.`);
            const kwResult = keywordFallbackSearch(query, categories, limit, ctx.activitiesCatalog);
            if (kwResult.count === 0) {
                return {
                    activities: [],
                    count: 0,
                    method: 'no-match',
                    latencyMs: metrics.latencyMs,
                    note: 'No semantically similar activities found. Activity embeddings may need to be generated. The agent should rely on the pre-ranked catalog provided in the user prompt.'
                };
            }
            return kwResult;
        }

        results.slice(0, 5).forEach((r, i) => {
            console.log(`[tools]     ${i + 1}. ${r.code}: ${r.name} (similarity: ${Math.round((r.similarity || 0) * 100)}%)`);
        });
        if (results.length > 5) console.log(`[tools]     ... e altri ${results.length - 5} risultati`);

        return {
            activities: results.map(r => ({
                code: r.code,
                name: r.name,
                description: r.description || '',
                baseHours: r.base_hours,
                group: r.group,
                techCategory: r.tech_category,
                similarity: r.similarity
            })),
            count: results.length,
            method: metrics.method,
            latencyMs: metrics.latencyMs
        };
    } catch (err) {
        console.warn('[tools]   search_catalog pgvector FALLITO, fallback keyword:', err instanceof Error ? err.message : err);
        return keywordFallbackSearch(query, categories, limit, ctx.activitiesCatalog);
    }
}

/**
 * Keyword-based fallback search when vector search is unavailable
 */
function keywordFallbackSearch(
    query: string,
    categories: string[],
    limit: number,
    catalog: AgentActivity[]
): any {
    const queryLower = query.toLowerCase();
    const keywords = queryLower.split(/\s+/).filter(w => w.length > 2);

    const scored = catalog
        .filter(a => categories.includes(a.tech_category) || a.tech_category === 'MULTI')
        .map(a => {
            const text = `${a.name} ${a.description} ${a.code}`.toLowerCase();
            const matchCount = keywords.filter(kw => text.includes(kw)).length;
            return { ...a, score: matchCount / keywords.length };
        })
        .filter(a => a.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

    return {
        activities: scored.map(a => ({
            code: a.code,
            name: a.name,
            description: a.description,
            baseHours: a.base_hours,
            group: a.group,
            techCategory: a.tech_category,
            similarity: a.score
        })),
        count: scored.length,
        method: 'keyword-fallback',
        latencyMs: 0
    };
}

/**
 * query_history — Retrieve historical estimations for similar requirements
 */
async function executeQueryHistory(
    args: Record<string, any>,
    ctx: ToolExecutionContext
): Promise<any> {
    const query = args.query as string;
    const userId = (args.userId as string) || ctx.userId;

    console.log(`[tools]   query_history: query="${query.substring(0, 100)}...", userId=${userId || 'N/A'}`);

    // Use pre-fetched RAG context if available (avoids duplicate embedding + DB call)
    if (ctx.prefetchedRAG) {
        console.log(`[tools]   query_history: using pre-fetched RAG (${ctx.prefetchedRAG.examples.length} examples, skipping duplicate call)`);
        const pf = ctx.prefetchedRAG;
        if (pf.hasExamples) {
            pf.examples.slice(0, 3).forEach((ex, i) => {
                console.log(`[tools]     ${i + 1}. "${ex.requirementTitle}" — similarity: ${Math.round(ex.similarity * 100)}%, ${ex.totalDays} days`);
            });
        }
        return {
            hasExamples: pf.hasExamples,
            examples: pf.examples.map(ex => ({
                title: ex.requirementTitle,
                description: ex.requirementDescription.substring(0, 300),
                similarity: Math.round(ex.similarity * 100),
                totalDays: ex.totalDays,
                baseDays: ex.baseDays,
                activityCount: ex.activities.length,
                topActivities: ex.activities.slice(0, 5).map(a => ({
                    code: a.code,
                    name: a.name,
                    hours: a.baseHours
                })),
                techStack: ex.techPresetName || 'Unknown'
            })),
            searchLatencyMs: pf.searchLatencyMs,
            _cached: true
        };
    }

    if (!isVectorSearchEnabled()) {
        console.log('[tools]   Vector search disabilitato → nessun esempio storico disponibile');
        return {
            hasExamples: false,
            examples: [],
            reason: 'Vector search not available for historical lookup'
        };
    }

    try {
        console.log('[tools]   Invocazione RAG context...');
        const ragContext = await retrieveRAGContext(query, userId);
        console.log(`[tools]   RAG: ${ragContext.hasExamples ? ragContext.examples.length + ' esempi' : 'nessun esempio'} (${ragContext.searchLatencyMs}ms)`);
        if (ragContext.hasExamples) {
            ragContext.examples.slice(0, 3).forEach((ex, i) => {
                console.log(`[tools]     ${i + 1}. "${ex.requirementTitle}" — similarity: ${Math.round(ex.similarity * 100)}%, ${ex.totalDays} days`);
            });
        }

        return {
            hasExamples: ragContext.hasExamples,
            examples: ragContext.examples.map(ex => ({
                title: ex.requirementTitle,
                description: ex.requirementDescription.substring(0, 300),
                similarity: Math.round(ex.similarity * 100),
                totalDays: ex.totalDays,
                baseDays: ex.baseDays,
                activityCount: ex.activities.length,
                topActivities: ex.activities.slice(0, 5).map(a => ({
                    code: a.code,
                    name: a.name,
                    hours: a.baseHours
                })),
                techStack: ex.techPresetName || 'Unknown'
            })),
            searchLatencyMs: ragContext.searchLatencyMs
        };
    } catch (err) {
        console.warn('[tools]   query_history FALLITO:', err instanceof Error ? err.message : err);
        return {
            hasExamples: false,
            examples: [],
            reason: `Historical lookup failed: ${err instanceof Error ? err.message : String(err)}`
        };
    }
}

/**
 * validate_estimation — Run through EstimationEngine deterministic formulas
 * 
 * Formula: Total Days = (Base/8) * DriversMultiplier * (1+Contingency)
 */
async function executeValidateEstimation(
    args: Record<string, any>
): Promise<any> {
    const activities = args.activities as Array<{ code: string; baseHours: number }>;
    const driverMultiplier = (args.driverMultiplier as number) || 1.0;
    const riskScore = (args.riskScore as number) || 0;

    console.log(`[tools]   validate_estimation: ${activities.length} attività, driverMultiplier=${driverMultiplier}, riskScore=${riskScore}`);

    // Replicate EstimationEngine logic to avoid importing from src/
    // (Netlify functions can't import from src/ at runtime)
    const totalHours = activities.reduce((sum, a) => sum + a.baseHours, 0);
    const baseDays = totalHours / 8.0;
    const subtotal = baseDays * driverMultiplier;

    // Contingency calculation (mirrors EstimationEngine.calculateContingency)
    let contingencyPercent: number;
    if (riskScore <= 0) contingencyPercent = 0.10;
    else if (riskScore <= 10) contingencyPercent = 0.10;
    else if (riskScore <= 20) contingencyPercent = 0.15;
    else if (riskScore <= 30) contingencyPercent = 0.20;
    else contingencyPercent = 0.25;

    const contingencyDays = subtotal * contingencyPercent;
    const totalDays = subtotal + contingencyDays;

    const validationResult = {
        baseDays: Number(baseDays.toFixed(2)),
        totalHours,
        driverMultiplier: Number(driverMultiplier.toFixed(3)),
        subtotal: Number(subtotal.toFixed(2)),
        riskScore,
        contingencyPercent: Number((contingencyPercent * 100).toFixed(2)),
        contingencyDays: Number(contingencyDays.toFixed(2)),
        totalDays: Number(totalDays.toFixed(2)),
        activityCount: activities.length,
        formula: 'Total Days = (Base/8) × DriversMultiplier × (1+Contingency)'
    };
    console.log(`[tools]   Risultato: ${totalHours}h → ${validationResult.baseDays} base days → ${validationResult.totalDays} total days (contingency ${validationResult.contingencyPercent}%)`);
    return validationResult;
}

/**
 * get_activity_details — Lookup full activity info by codes
 */
async function executeGetActivityDetails(
    args: Record<string, any>,
    ctx: ToolExecutionContext
): Promise<any> {
    const codes = args.codes as string[];
    console.log(`[tools]   get_activity_details: ${codes.length} codici richiesti: ${codes.join(', ')}`);

    const found = ctx.activitiesCatalog
        .filter(a => codes.includes(a.code))
        .map(a => ({
            code: a.code,
            name: a.name,
            description: a.description,
            baseHours: a.base_hours,
            group: a.group,
            techCategory: a.tech_category
        }));

    const notFound = codes.filter(c => !found.some(f => f.code === c));

    console.log(`[tools]   Trovate: ${found.length}/${codes.length}`);
    found.forEach(a => console.log(`[tools]     - ${a.code}: ${a.name} (${a.baseHours}h, ${a.group})`));
    if (notFound.length > 0) {
        console.warn(`[tools]   NON trovati: ${notFound.join(', ')}`);
    }

    return {
        activities: found,
        found: found.length,
        notFound: notFound.length > 0 ? notFound : undefined
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Summarize tool result for logging (truncate large payloads)
 */
function summarizeResult(result: any): any {
    if (!result) return result;
    const str = JSON.stringify(result);
    if (str.length <= 500) return result;

    // Return a lightweight summary
    if (result.activities && Array.isArray(result.activities)) {
        return {
            count: result.activities.length,
            method: result.method,
            _truncated: true
        };
    }
    if (result.examples && Array.isArray(result.examples)) {
        return {
            exampleCount: result.examples.length,
            hasExamples: result.hasExamples,
            _truncated: true
        };
    }
    return { _truncated: true, length: str.length };
}
