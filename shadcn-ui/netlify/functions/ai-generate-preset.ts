/**
 * Netlify Function: AI Generate Preset
 * 
 * Endpoint for generating technology presets based on user's description and interview answers.
 * This is Stage 2 of the two-stage AI preset generation flow.
 * 
 * HYBRID APPROACH: AI can select activities from catalog OR create new ones.
 * 
 * POST /.netlify/functions/ai-generate-preset
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { createAIHandler } from './lib/handler';
import { getOpenAIClient } from './lib/ai/openai-client';
import { searchSimilarActivities, isVectorSearchEnabled } from './lib/ai/vector-search';

interface RequestBody {
    description: string;
    answers: Record<string, any>;
    suggestedTechCategory?: 'FRONTEND' | 'BACKEND' | 'MULTI' | 'POWER_PLATFORM';
}

interface CatalogActivity {
    code: string;
    name: string;
    description: string;
    base_hours: number;
    tech_category: string;
    group: string;
}

/**
 * Initialize Supabase client for fetching activity catalog
 */
function getSupabaseClient() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return null;
    }

    return createClient(supabaseUrl, supabaseKey);
}

/**
 * Fetch activities from catalog filtered by tech category
 * Returns activities for the specified category + MULTI (cross-stack)
 */
async function fetchCatalogActivities(
    techCategory: string
): Promise<CatalogActivity[]> {
    const supabase = getSupabaseClient();
    if (!supabase) {
        console.warn('[ai-generate-preset] Supabase not configured, skipping catalog fetch');
        return [];
    }

    try {
        const categories = [techCategory, 'MULTI'];
        const { data, error } = await supabase
            .from('activities')
            .select('code, name, description, base_hours, tech_category, group')
            .in('tech_category', categories)
            .eq('active', true)
            .order('group')
            .order('base_hours');

        if (error) {
            console.error('[ai-generate-preset] Error fetching activities:', error);
            return [];
        }

        console.log(`[ai-generate-preset] Fetched ${data?.length || 0} activities for categories: ${categories.join(', ')}`);
        return data || [];
    } catch (err) {
        console.error('[ai-generate-preset] Exception fetching activities:', err);
        return [];
    }
}

/**
 * Format activities catalog in compact format for AI prompt
 * Groups by phase (group) and uses compact notation to minimize tokens
 */
function formatCatalogForPrompt(activities: CatalogActivity[]): string {
    if (activities.length === 0) {
        return 'CATALOG: No activities available - create all activities as new.';
    }

    // Group by phase
    const byGroup: Record<string, CatalogActivity[]> = {};
    for (const act of activities) {
        const group = act.group || 'OTHER';
        if (!byGroup[group]) byGroup[group] = [];
        byGroup[group].push(act);
    }

    const lines: string[] = ['ACTIVITY CATALOG (select by code when applicable):'];

    for (const [group, acts] of Object.entries(byGroup)) {
        lines.push(`\n[${group}]`);
        for (const a of acts) {
            // Compact format: CODE|hours|name - description (truncated)
            const desc = a.description?.slice(0, 80) || '';
            lines.push(`- ${a.code}|${a.base_hours}h|${a.name}: ${desc}`);
        }
    }

    return lines.join('\n');
}

/**
 * System prompt for preset generation
 */
const SYSTEM_PROMPT = `You are a Technical Estimator creating ACTIVITY PRESETS for estimating SOFTWARE REQUIREMENTS. Respond with JSON only.

**GOAL**:
Generate a list of standard activities for implementing SINGLE REQUIREMENTS using the specified technology.
Focus on ATOMIC WORK UNITS, not project phases.

**HYBRID ACTIVITY SELECTION** (IMPORTANT):
1. FIRST check the ACTIVITY CATALOG below - if a suitable activity exists, SELECT IT by code
2. ONLY create NEW activities if nothing in the catalog fits the need
3. For existing activities, you can suggest different hours if context requires it
4. Prefer catalog activities for consistency and reusability

**CONTEXT AWARENESS (LIFECYCLE)**:
- **Greenfield**: Include setup/scaffolding activities if relevant
- **Brownfield**: Focus on Integration, Refactoring, Extending existing code

**ACTIVITY TYPES IN OUTPUT**:
- FOR EXISTING (from catalog): set "existingCode" to the activity code
- FOR NEW (AI-generated): set "isNew": true and provide title/description

**CRITICAL RULES**:
1. Activities must be REUSABLE building blocks
2. Language: SAME AS USER INPUT
3. Select 8-15 activities total (prefer 60%+ from catalog if applicable)
4. **group** MUST be one of: ANALYSIS, DEV, TEST, OPS, GOVERNANCE (never use QA, TESTING, or other values)

**OUTPUT FORMAT (valid JSON)**:
{
  "success": true,
  "preset": {
    "name": "Technology name (max 50 chars)",
    "description": "Tech stack description (80-120 chars)",
    "detailedDescription": "Technical details (150-200 words MAX)",
    "techCategory": "FRONTEND" | "BACKEND" | "MULTI" | "POWER_PLATFORM",
    "activities": [
      {
        "existingCode": "PP_DV_FORM_SM",
        "title": "Configurazione form Dataverse (Simple)",
        "description": "Form con pochi campi e layout standard",
        "group": "DEV",
        "estimatedHours": 16,
        "priority": "core",
        "confidence": 0.9,
        "reasoning": "Selected from catalog - matches form requirements"
      },
      {
        "isNew": true,
        "title": "Custom Activity Name",
        "description": "What is done in this activity",
        "group": "TEST",
        "estimatedHours": 8,
        "priority": "recommended",
        "confidence": 0.7,
        "reasoning": "Created new - no catalog match for this specific need"
      }
    ],
    "driverValues": {"COMPLEXITY": 0.5},
    "riskCodes": ["RISK_TECH"],
    "reasoning": "Why these activities fit this stack",
    "confidence": 0.8
  }
}`;

/**
 * Main handler using centralized middleware
 */
export const handler = createAIHandler<RequestBody>({
    name: 'ai-generate-preset',
    requireAuth: true,
    requireOpenAI: true,

    validateBody: (body) => {
        if (!body.description || typeof body.description !== 'string') {
            return 'Missing or invalid description field';
        }
        if (!body.answers || typeof body.answers !== 'object') {
            return 'Missing or invalid answers field';
        }
        return null;
    },

    handler: async (body, ctx) => {
        const sanitizedDescription = ctx.sanitize(body.description);

        if (sanitizedDescription.length < 20) {
            throw new Error('La descrizione deve contenere almeno 20 caratteri.');
        }

        // Initialize OpenAI client with complex preset (50s timeout)
        const openai = getOpenAIClient('complex');
        const requestId = randomUUID();
        const techCategory = body.suggestedTechCategory || 'MULTI';

        // Fetch activity catalog - use vector search for better relevance
        let catalogActivities: CatalogActivity[] = [];
        let searchMethod = 'category-filter';

        if (isVectorSearchEnabled()) {
            try {
                console.log('[ai-generate-preset] Using vector search for catalog retrieval');
                const techCategories = [techCategory, 'MULTI'];
                const searchResult = await searchSimilarActivities(
                    sanitizedDescription,
                    techCategories,
                    40, // Top-40 most similar for preset generation
                    0.4
                );

                if (searchResult.results.length > 0) {
                    catalogActivities = searchResult.results.map(r => ({
                        code: r.code,
                        name: r.name,
                        description: r.description || '',
                        base_hours: r.base_hours,
                        tech_category: r.tech_category,
                        group: r.group,
                    }));
                    searchMethod = searchResult.metrics.usedFallback ? 'vector-fallback' : 'vector';
                    console.log(`[ai-generate-preset] Vector search returned ${catalogActivities.length} activities in ${searchResult.metrics.latencyMs}ms`);
                }
            } catch (err) {
                console.warn('[ai-generate-preset] Vector search failed:', err);
            }
        }

        // Fallback to standard category-based fetch
        if (catalogActivities.length === 0) {
            catalogActivities = await fetchCatalogActivities(techCategory);
            searchMethod = 'category-filter';
        }

        const catalogForPrompt = formatCatalogForPrompt(catalogActivities);

        console.log('[ai-generate-preset] Calling OpenAI for preset generation...', {
            requestId,
            catalogSize: catalogActivities.length,
            techCategory,
            searchMethod
        });

        const userPrompt = `Context Description: ${sanitizedDescription}

Questions & Answers: ${JSON.stringify(body.answers)}
Suggested Category: ${techCategory}

${catalogForPrompt}

Generate a preset with 8-15 activities. Prefer selecting from the catalog above when appropriate. Return JSON only.`;

        const startTime = Date.now();

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            temperature: 0.2,
            max_tokens: 2000,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: userPrompt }
            ],
            response_format: { type: 'json_object' }
        });

        const generationTimeMs = Date.now() - startTime;
        const content = response.choices[0]?.message?.content;

        if (!content) {
            throw new Error('No content in OpenAI response');
        }

        const result = JSON.parse(content);

        // Validate activity genericness (post-generation check)
        if (result.preset && result.preset.activities) {
            const { validateActivities, logValidationResults } = await import('./lib/validation/activity-genericness-validator');

            const validationResults = validateActivities(
                result.preset.activities.map((a: any) => ({
                    title: a.title || '',
                    description: a.description || ''
                }))
            );

            logValidationResults(validationResults, {
                requestId,
                techCategory: body.suggestedTechCategory
            });

            // Add validation metadata to response
            result.preset.validationScore = validationResults.averageScore;
            result.preset.genericityCheck = {
                passed: validationResults.summary.passed,
                failed: validationResults.summary.failed,
                warnings: validationResults.summary.warnings
            };

            // Track hybrid activity breakdown
            const existingCount = result.preset.activities.filter((a: any) => a.existingCode).length;
            const newCount = result.preset.activities.filter((a: any) => a.isNew).length;
            console.log('[ai-generate-preset] Hybrid activity breakdown:', {
                total: result.preset.activities.length,
                fromCatalog: existingCount,
                newlyCreated: newCount,
                catalogPercentage: ((existingCount / result.preset.activities.length) * 100).toFixed(0) + '%',
                requestId
            });
        }

        // Log metadata
        console.log('[ai-generate-preset] Generation complete:', {
            success: result.success,
            hasPreset: !!result.preset,
            activities: result.preset?.activities.length,
            validationScore: result.preset?.validationScore?.toFixed(1),
            generationTimeMs,
            requestId
        });

        return {
            ...result,
            metadata: {
                cached: false,
                attempts: 1,
                modelPasses: ['gpt-4o'],
                generationTimeMs
            }
        };
    }
});
