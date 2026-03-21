import { getDefaultProvider } from '../openai-client';
import {
    createDescriptivePrompt,
    createActivitySchema,
    createActivitySuggestionSystemPrompt,
    Activity
} from '../prompt-builder';
import { validateAISuggestion } from '../../../../../src/types/ai-validation';
import { validateRequirementDescription } from '../../validation/requirement-validator';
import { searchSimilarActivities, isVectorSearchEnabled } from '../vector-search';
import { retrieveRAGContext, getRAGSystemPromptAddition } from '../rag';
import {
    buildCacheKey,
    getCachedResponse,
    setCachedResponse,
    CACHE_SUGGEST,
} from '../ai-cache';

// Model configuration - use env variable AI_ESTIMATION_MODEL or default to gpt-4o
// NOTE: gpt-5 has limitations (no custom temperature, no json_schema response_format)
// Use gpt-4o as default for reliable structured output
const AI_MODEL = process.env.AI_ESTIMATION_MODEL || 'gpt-5';

export interface Preset {
    id: string;
    name: string;
    description: string;
    tech_category: string;
    /** Canonical FK to technologies.id */
    technology_id?: string;
    /** @deprecated No longer used — AI decides freely */
    default_activity_codes?: string[];
    /** @deprecated Removed */
    default_driver_values?: Record<string, string>;
    /** @deprecated Removed */
    default_risks?: string[];
}

export interface ProjectContext {
    name: string;
    description: string;
    owner?: string;
}

export interface SuggestActivitiesRequest {
    description: string;
    preset: Preset;
    activities: Activity[];
    projectContext?: ProjectContext;
    testMode?: boolean;
}

export interface AIActivitySuggestion {
    isValidRequirement: boolean;
    activityCodes: string[];
    reasoning?: string;
    generatedTitle?: string;
}

/**
 * Suggest activities for a requirement
 * @param request - Request with description, preset, and activities
 * @returns AI activity suggestion
 */
export async function suggestActivities(request: SuggestActivitiesRequest): Promise<AIActivitySuggestion> {
    const { description, preset, activities, projectContext, testMode } = request;

    // Validate requirement description
    const descriptionCheck = validateRequirementDescription(description);
    if (!descriptionCheck.isValid) {
        console.warn('Requirement rejected by deterministic validation:', descriptionCheck.reason);
        return {
            isValidRequirement: false,
            activityCodes: [],
            reasoning: descriptionCheck.reason || 'Requirement description is too vague or looks like test data',
        };
    }

    // ── Cache lookup (skip in testMode) ──────────────────────────────
    const activityCodes = activities.map(a => a.code).sort().join(',');
    const suggestCacheKey = buildCacheKey(
        [description.slice(0, 200), preset.id, activityCodes],
        CACHE_SUGGEST,
    );
    if (!testMode) {
        const cached = await getCachedResponse<AIActivitySuggestion>(suggestCacheKey, CACHE_SUGGEST);
        if (cached) return cached;
    }

    // Filter activities relevant to the preset's tech category
    // Try vector search first for more accurate results (Phase 2)
    let relevantActivities: Activity[] = [];
    let vectorSearchMetrics: { method: string; latencyMs: number; usedFallback: boolean } | undefined;

    if (isVectorSearchEnabled()) {
        try {
            console.log('[suggest-activities] Using vector search for activity retrieval');
            const techCategories = [preset.tech_category, 'MULTI'];
            const searchResult = await searchSimilarActivities(
                description,
                techCategories,
                30, // Top-30 most similar activities
                0.45 // Lower threshold for broader matches
            );

            vectorSearchMetrics = {
                method: searchResult.metrics.method,
                latencyMs: searchResult.metrics.latencyMs,
                usedFallback: searchResult.metrics.usedFallback,
            };

            if (searchResult.results.length > 0) {
                // Map search results to Activity format
                // NOTE: Do NOT intersect with preset-allowed activities here.
                // Vector search may correctly suggest activities outside the preset
                // (e.g. PP_FLOW_SIMPLE when preset only has PP_FLOW_COMPLEX).
                // The frontend handles mapping against all tech_category activities.
                relevantActivities = searchResult.results.map(r => ({
                    code: r.code,
                    name: r.name,
                    description: r.description || '',
                    base_hours: r.base_hours,
                    group: r.group,
                    tech_category: r.tech_category,
                }));
                console.log(`[suggest-activities] Vector search returned ${relevantActivities.length} activities in ${searchResult.metrics.latencyMs}ms`);
            }
        } catch (err) {
            console.warn('[suggest-activities] Vector search failed, using fallback:', err);
        }
    }

    // Fallback: use provided activities filtered by technology
    // Uses technology_id FK when available, falls back to tech_category string
    if (relevantActivities.length === 0) {
        relevantActivities = activities.filter(
            (a: any) => {
                if (a.technology_id) {
                    return a.technology_id === preset.id || a.tech_category === 'MULTI';
                }
                return a.tech_category === preset.tech_category || a.tech_category === 'MULTI';
            }
        );
        console.log('[suggest-activities] Using technology filter, activities:', relevantActivities.length);
    }

    console.log('Filtered activities:', relevantActivities?.length);

    const relevantActivityCodes = relevantActivities.map(a => a.code);

    // Retrieve RAG context (Phase 4: Historical Learning)
    let ragContext = { hasExamples: false, promptFragment: '', searchLatencyMs: 0 } as any;
    if (isVectorSearchEnabled()) {
        try {
            ragContext = await retrieveRAGContext(description);
            if (ragContext.hasExamples) {
                console.log(`[suggest-activities] RAG: found ${ragContext.examples?.length || 0} historical examples`);
            }
        } catch (err) {
            console.warn('[suggest-activities] RAG retrieval failed:', err);
        }
    }

    // Build DESCRIPTIVE system prompt with full activity details
    console.log('Creating descriptive prompt with full activity details...');
    const descriptiveData = createDescriptivePrompt(relevantActivities);
    console.log('Descriptive prompt created, length:', descriptiveData?.length);

    // Build system prompt with optional RAG enhancement
    let systemPrompt = createActivitySuggestionSystemPrompt(
        preset.name,
        preset.tech_category,
        descriptiveData
    );

    // Add RAG system prompt addition if we have historical data
    if (ragContext.hasExamples) {
        systemPrompt = systemPrompt + '\n' + getRAGSystemPromptAddition();
    }

    // Build project context section if available
    let projectContextSection = '';
    if (projectContext) {
        projectContextSection = `\n\nCONTESTO PROGETTO:\n- Nome: ${projectContext.name}\n- Descrizione: ${projectContext.description}${projectContext.owner ? `\n- Responsabile: ${projectContext.owner}` : ''}\n\nUsa il contesto del progetto per capire meglio lo scope e le convenzioni già stabilite.\n`;
    }

    // Include RAG examples in user prompt
    let userPrompt = description.substring(0, 1000) + projectContextSection; // Limit description to 1000 chars
    if (ragContext.hasExamples && ragContext.promptFragment) {
        userPrompt = userPrompt + '\n' + ragContext.promptFragment;
    }

    console.log('Calling OpenAI API with structured outputs...');
    console.log(`[suggest-activities] Using model: ${AI_MODEL}`);
    console.log('Test mode:', testMode ? 'enabled (temp=0.7, no cache)' : 'disabled (temp=0.0, cached)');

    // Generate strict JSON schema with enum of valid activity codes
    const responseSchema = createActivitySchema(relevantActivityCodes);
    console.log('Using structured outputs with', relevantActivities.length, 'valid activity codes in enum');

    // Call OpenAI API with structured outputs
    const provider = getDefaultProvider();
    const temperature = testMode ? 0.7 : 0.0;
    // gpt-5 uses internal reasoning tokens that count against max_output_tokens,
    // so we need a generous budget even though the JSON output is ~300 tokens.
    const responseContent = await provider.generateContent({
        model: AI_MODEL,
        temperature,
        maxTokens: 4096,
        options: { timeout: 85000 },
        responseFormat: responseSchema as any,
        systemPrompt: systemPrompt,
        userPrompt: userPrompt
    });

    console.log('Using temperature:', temperature, '(determinism level:', temperature === 0 ? 'maximum' : 'test mode', ')');
    console.log('LLM response received');

    if (!responseContent) {
        throw new Error('No response from LLM');
    }

    // Parse structured output
    let suggestion: any;
    try {
        suggestion = JSON.parse(responseContent);
    } catch (parseError) {
        console.error('JSON parse error:', parseError);
        throw new Error('Invalid JSON response from AI');
    }

    console.log('Structured output received and parsed');

    // Zod validation + activity code filtering (essential when json_schema
    // is downgraded to json_object for gpt-5 — AI may return invalid codes)
    const validatedSuggestion = validateAISuggestion(
        suggestion,
        relevantActivityCodes,
        [],
        []
    );

    const finalSuggestion: AIActivitySuggestion = validatedSuggestion.isValidRequirement
        ? {
            isValidRequirement: validatedSuggestion.isValidRequirement,
            activityCodes: validatedSuggestion.activityCodes,
            reasoning: validatedSuggestion.reasoning
        }
        : {
            isValidRequirement: validatedSuggestion.isValidRequirement,
            activityCodes: [],
            reasoning: validatedSuggestion.reasoning || 'Requirement description is invalid or too vague',
        };

    console.log('Validated suggestion:', JSON.stringify(finalSuggestion, null, 2));

    // ── Cache store (skip in testMode) ───────────────────────────────
    if (!testMode && finalSuggestion.isValidRequirement) {
        await setCachedResponse(suggestCacheKey, finalSuggestion, CACHE_SUGGEST);
    }

    return finalSuggestion;
}
