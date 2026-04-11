/**
 * Netlify Function: AI Generate Preset
 * 
 * Endpoint for generating technology presets based on user's description and interview answers.
 * This is Stage 2 of the two-stage AI preset generation flow.
 * 
 * HYBRID APPROACH: AI can select activities from catalog OR create new ones.
 * 
 * Enhancements (Phase 2.5):
 *   1. History lookup — fetch similar existing technologies as RAG context
 *   2. Technical depth — prompt tuned for implementation-level activity detail
 *   3. Validation pass — lightweight LLM check on the draft
 *   4. Retry-with-feedback — one corrective pass if quality is below threshold
 * 
 * POST /.netlify/functions/ai-generate-preset
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { createAIHandler } from './lib/handler';
import { getDefaultProvider } from './lib/ai/openai-client';
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

interface SimilarTechnology {
    code: string;
    name: string;
    description: string | null;
    tech_category: string;
    activity_count: number;
    activity_names: string[];
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

// ─────────────────────────────────────────────────────────────────────────────
// History Lookup — RAG: Fetch similar existing technologies for context
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch existing technologies with their activity names as reference context.
 * Prioritises same tech_category, then MULTI.
 */
async function fetchSimilarTechnologies(
    techCategory: string
): Promise<SimilarTechnology[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    try {
        // Fetch technologies + their linked activities
        const { data: techs, error: techErr } = await supabase
            .from('technologies')
            .select('code, name, description, tech_category')
            .order('name');

        if (techErr || !techs || techs.length === 0) return [];

        // Fetch pivot to get activity names for each technology
        const techIds: string[] = [];
        const techById: Record<string, typeof techs[0]> = {};

        // We need IDs — re-fetch with id
        const { data: techsWithId } = await supabase
            .from('technologies')
            .select('id, code, name, description, tech_category')
            .order('name');

        if (!techsWithId) return [];

        for (const t of techsWithId) {
            techIds.push(t.id);
            techById[t.id] = t;
        }

        const { data: pivots } = await supabase
            .from('technology_activities')
            .select('technology_id, activity_id')
            .in('technology_id', techIds);

        // Fetch activity names
        const activityIds = [...new Set((pivots || []).map(p => p.activity_id))];
        let activityNameMap: Record<string, string> = {};

        if (activityIds.length > 0) {
            const { data: acts } = await supabase
                .from('activities')
                .select('id, name')
                .in('id', activityIds);
            if (acts) {
                for (const a of acts) activityNameMap[a.id] = a.name;
            }
        }

        // Build SimilarTechnology array
        const result: SimilarTechnology[] = techsWithId.map(t => {
            const relatedPivots = (pivots || []).filter(p => p.technology_id === t.id);
            return {
                code: t.code,
                name: t.name,
                description: t.description,
                tech_category: t.tech_category,
                activity_count: relatedPivots.length,
                activity_names: relatedPivots
                    .map(p => activityNameMap[p.activity_id])
                    .filter(Boolean)
                    .slice(0, 10), // Cap to keep prompt small
            };
        });

        // Sort: same category first, then MULTI, then others
        result.sort((a, b) => {
            const aScore = a.tech_category === techCategory ? 0 : a.tech_category === 'MULTI' ? 1 : 2;
            const bScore = b.tech_category === techCategory ? 0 : b.tech_category === 'MULTI' ? 1 : 2;
            return aScore - bScore;
        });

        console.log(`[ai-generate-preset] History lookup: ${result.length} existing technologies found`);
        return result.slice(0, 5); // Top 5 most relevant
    } catch (err) {
        console.warn('[ai-generate-preset] History lookup failed:', err);
        return [];
    }
}

/**
 * Format existing technologies as reference context for the prompt
 */
function formatHistoryForPrompt(technologies: SimilarTechnology[]): string {
    if (technologies.length === 0) return '';

    const lines = ['\nEXISTING TECHNOLOGIES (for reference — match style & detail level):'];
    for (const t of technologies) {
        lines.push(`- ${t.name} [${t.tech_category}] — ${t.activity_count} activities`);
        if (t.activity_names.length > 0) {
            lines.push(`  Activities: ${t.activity_names.join(', ')}`);
        }
    }
    return lines.join('\n');
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

// ─────────────────────────────────────────────────────────────────────────────
// Validation-pass prompt — lightweight LLM check on generated draft
// ─────────────────────────────────────────────────────────────────────────────

const VALIDATION_SYSTEM_PROMPT = `You are a senior engineering reviewer. You will receive a JSON preset of activities generated for a technology.
Review ONLY for these issues — respond with JSON:

1. **Invalid group values** — group MUST be one of: ANALYSIS, DEV, TEST, OPS, GOVERNANCE
2. **Duplicate activities** — two activities that cover the same work
3. **Non-technical descriptions** — any activity whose description lacks concrete implementation detail (frameworks, patterns, tools, artifacts)
4. **Unrealistic hours** — estimatedHours < 1 or > 40 for a single activity
5. **Invented codes** — existingCode values that are NOT in the provided catalog codes list


OUTPUT (valid JSON):
{
  "pass": true/false,
  "issues": [
    { "activityIndex": 0, "issue": "description too vague", "suggestion": "Add mention of specific framework/pattern" }
  ],
  "overallNotes": "brief summary"
}`;

/**
 * System prompt for preset generation — tuned for TECHNICAL DEPTH
 */
const SYSTEM_PROMPT = `You are a Senior Technical Estimator creating ACTIVITY PRESETS for estimating SOFTWARE REQUIREMENTS. Respond with JSON only.

**GOAL**:
Generate a list of standard activities for implementing SINGLE REQUIREMENTS using the specified technology.
Focus on ATOMIC WORK UNITS at IMPLEMENTATION LEVEL, not project phases or high-level categories.

**TECHNICAL DEPTH (MANDATORY)**:
Every activity MUST be described at the level a senior developer would use in a Sprint Planning:
- Name specific frameworks, libraries, APIs, design patterns, or infrastructure tools
- Describe concrete deliverables: "REST controller with OpenAPI annotations", not "API development"
- Include the technical *what* and *how*, e.g. "Configurazione Hibernate entities con JPA annotations, mapping relazioni N:M, cascade policies, lazy/eager loading"
- For test activities, specify the test framework and type: "Unit test con JUnit 5 + Mockito, copertura service layer"
- For DevOps, name the tool chain: "Pipeline CI/CD GitHub Actions, build Docker multi-stage, push ECR"

BAD example (too vague):  "Sviluppo backend" / "Testing" / "Deploy"
GOOD example (technical): "Implementazione REST controller Spring Boot con validazione Bean Validation, error handling @ControllerAdvice, DTO mapping MapStruct"

**HYBRID ACTIVITY SELECTION** (IMPORTANT):
1. FIRST check the ACTIVITY CATALOG below — if a suitable activity exists, SELECT IT by code
2. ONLY create NEW activities if nothing in the catalog fits the need
3. For existing activities, you can suggest different hours if context requires it
4. Prefer catalog activities for consistency and reusability

**CONTEXT AWARENESS (LIFECYCLE)**:
- **Greenfield**: Include setup/scaffolding activities (project init, dependency management, CI bootstrap)
- **Brownfield**: Focus on Integration, Refactoring, Extending existing code (backward compatibility, migration scripts)

**ACTIVITY TYPES IN OUTPUT**:
- FOR EXISTING (from catalog): set "existingCode" to the activity code
- FOR NEW (AI-generated): set "isNew": true and provide title/description with FULL TECHNICAL DETAIL

**CRITICAL RULES**:
1. Activities must be REUSABLE building blocks (generic patterns, NOT project-specific entities)
2. Language: SAME AS USER INPUT
3. Select 15-17 activities total (prefer 60%+ from catalog if applicable)
4. **group** MUST be one of: ANALYSIS, DEV, TEST, OPS, GOVERNANCE (never use QA, TESTING, or other values)
5. **existingCode** MUST ONLY use codes actually present in the ACTIVITY CATALOG below — NEVER invent or guess activity codes
6. If the catalog is empty, set "isNew": true for ALL activities
7. Each description MUST be 20-60 words containing at least ONE specific technology/framework/tool/pattern name
8. Each title MUST be 5-12 words, technically precise

**OUTPUT FORMAT (valid JSON)**:
{
  "success": true,
  "preset": {
    "name": "Technology name (max 50 chars)",
    "description": "Tech stack description (80-120 chars)",
    "detailedDescription": "Technical architecture details: frameworks, patterns, deployment model (150-200 words MAX)",
    "techCategory": "FRONTEND" | "BACKEND" | "MULTI" | "POWER_PLATFORM",
    "activities": [
      {
        "existingCode": "CRS_KICKOFF",
        "title": "Kickoff tecnico e allineamento architetturale",
        "description": "Sessione di alignment tecnico: revisione stack tecnologico, definizione convenzioni di codice, branching strategy Git, review architettura a componenti",
        "group": "ANALYSIS",
        "estimatedHours": 4,
        "priority": "core",
        "confidence": 0.9,
        "reasoning": "Selected from catalog — standard kickoff activity"
      },
      {
        "isNew": true,
        "title": "Implementazione service layer con dependency injection",
        "description": "Sviluppo business logic nel service layer: interfacce/implementazioni, inversione delle dipendenze via DI container, transaction management, mapping DTO↔Entity con pattern Mapper",
        "group": "DEV",
        "estimatedHours": 8,
        "priority": "recommended",
        "confidence": 0.7,
        "reasoning": "Created new — no catalog match for DI-based service layer pattern"
      }
    ],
    "driverValues": {"COMPLEXITY": 0.5},
    "riskCodes": ["RISK_TECH"],
    "reasoning": "Why these activities fit this stack — mention key architectural decisions",
    "confidence": 0.8
  }
}`;

/**
 * Main handler using centralized middleware
 */
export const handler = createAIHandler<RequestBody>({
    name: 'ai-generate-preset',
    requireAuth: true,
    requireLLM: true,

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

        // Get default LLM provider
        const provider = getDefaultProvider();
        const requestId = randomUUID();
        const techCategory = body.suggestedTechCategory || 'MULTI';
        const pipelineStart = Date.now();

        // ──────────────────────────────────────────────────
        // Step 1: Parallel context gathering
        //    a) Activity catalog (vector or category-based)
        //    b) Existing technologies history (RAG)
        // ──────────────────────────────────────────────────

        let catalogActivities: CatalogActivity[] = [];
        let searchMethod = 'category-filter';
        let similarTechnologies: SimilarTechnology[] = [];

        // Launch both fetches in parallel
        const [catalogResult, historyResult] = await Promise.allSettled([
            (async () => {
                if (isVectorSearchEnabled()) {
                    try {
                        console.log('[ai-generate-preset] Using vector search for catalog retrieval');
                        const techCategories = [techCategory, 'MULTI'];
                        const searchResult = await searchSimilarActivities(
                            sanitizedDescription,
                            techCategories,
                            40,
                            0.4
                        );
                        if (searchResult.results.length > 0) {
                            return {
                                activities: searchResult.results.map(r => ({
                                    code: r.code,
                                    name: r.name,
                                    description: r.description || '',
                                    base_hours: r.base_hours,
                                    tech_category: r.tech_category,
                                    group: r.group,
                                })),
                                method: searchResult.metrics.usedFallback ? 'vector-fallback' : 'vector' as string,
                            };
                        }
                    } catch (err) {
                        console.warn('[ai-generate-preset] Vector search failed:', err);
                    }
                }
                // Fallback
                return {
                    activities: await fetchCatalogActivities(techCategory),
                    method: 'category-filter' as string,
                };
            })(),
            fetchSimilarTechnologies(techCategory),
        ]);

        if (catalogResult.status === 'fulfilled') {
            catalogActivities = catalogResult.value.activities;
            searchMethod = catalogResult.value.method;
        } else {
            catalogActivities = await fetchCatalogActivities(techCategory);
        }

        if (historyResult.status === 'fulfilled') {
            similarTechnologies = historyResult.value;
        }

        const catalogForPrompt = formatCatalogForPrompt(catalogActivities);
        const historyForPrompt = formatHistoryForPrompt(similarTechnologies);
        const validCatalogCodes = catalogActivities.map(a => a.code);

        console.log('[ai-generate-preset] Context gathered:', {
            requestId,
            catalogSize: catalogActivities.length,
            techCategory,
            searchMethod,
            historyTechnologies: similarTechnologies.length,
        });

        // ──────────────────────────────────────────────────
        // Step 2: Generate preset (first pass)
        // ──────────────────────────────────────────────────

        const userPrompt = `Context Description: ${sanitizedDescription}

Questions & Answers: ${JSON.stringify(body.answers)}
Suggested Category: ${techCategory}

${catalogForPrompt}
${historyForPrompt}

Generate a preset with 15-17 activities. Each activity description MUST include specific frameworks, tools, patterns, or artifacts.
Prefer selecting from the catalog above when appropriate. Return JSON only.`;

        const startTime = Date.now();
        const modelPasses: string[] = [];

        let responseContent = await provider.generateContent({
            model: 'gpt-4o',
            temperature: 0.2,
            maxTokens: 3000,
            options: { timeout: 50000 },
            responseFormat: { type: 'json_object' },
            systemPrompt: SYSTEM_PROMPT,
            userPrompt: userPrompt
        });
        modelPasses.push('gpt-4o:generate');

        const firstPassMs = Date.now() - startTime;

        if (!responseContent) {
            throw new Error('No content in LLM response');
        }

        let result = JSON.parse(responseContent);

        // ──────────────────────────────────────────────────
        // Step 3: Genericness validation (deterministic)
        // ──────────────────────────────────────────────────

        const { validateActivities, logValidationResults } = await import('./lib/validation/activity-genericness-validator');

        let validationResults = result.preset?.activities
            ? validateActivities(
                result.preset.activities.map((a: any) => ({
                    title: a.title || '',
                    description: a.description || ''
                }))
            )
            : null;

        if (validationResults) {
            logValidationResults(validationResults, { requestId, techCategory: body.suggestedTechCategory });
        }

        // ──────────────────────────────────────────────────
        // Step 4: Lightweight LLM validation pass
        // ──────────────────────────────────────────────────

        let validationIssues: Array<{ activityIndex: number; issue: string; suggestion: string }> = [];

        if (result.preset?.activities && Date.now() - pipelineStart < 35000) {
            try {
                const validationPrompt = `Preset activities to review:\n${JSON.stringify(result.preset.activities, null, 2)}\n\nValid catalog codes: ${JSON.stringify(validCatalogCodes)}\n\nReview for issues. Return JSON only.`;

                const validationResponse = await provider.generateContent({
                    model: 'gpt-4o',
                    temperature: 0,
                    maxTokens: 800,
                    options: { timeout: 15000 },
                    responseFormat: { type: 'json_object' },
                    systemPrompt: VALIDATION_SYSTEM_PROMPT,
                    userPrompt: validationPrompt,
                });
                modelPasses.push('gpt-4o:validate');

                if (validationResponse) {
                    const validationResult = JSON.parse(validationResponse);
                    validationIssues = validationResult.issues || [];
                    console.log('[ai-generate-preset] Validation pass:', {
                        passed: validationResult.pass,
                        issueCount: validationIssues.length,
                        notes: validationResult.overallNotes,
                        requestId,
                    });
                }
            } catch (valErr) {
                console.warn('[ai-generate-preset] Validation pass failed (non-blocking):', valErr);
            }
        }

        // ──────────────────────────────────────────────────
        // Step 5: Retry with feedback if quality is low
        //   Triggers when:
        //     a) Genericness score < 70, OR
        //     b) Validation found ≥3 issues, OR
        //     c) >30% activities failed genericness
        // ──────────────────────────────────────────────────

        const failureRate = validationResults
            ? validationResults.summary.failed / (validationResults.summary.passed + validationResults.summary.failed)
            : 0;
        const needsRetry =
            (validationResults && validationResults.averageScore < 70) ||
            validationIssues.length >= 3 ||
            failureRate > 0.3;

        if (needsRetry && Date.now() - pipelineStart < 40000) {
            console.log('[ai-generate-preset] Quality below threshold — running corrective retry', {
                averageScore: validationResults?.averageScore?.toFixed(1),
                validationIssues: validationIssues.length,
                failureRate: (failureRate * 100).toFixed(0) + '%',
                requestId,
            });

            // Build feedback from both sources
            const feedbackLines: string[] = [];

            // From genericness validator
            if (validationResults) {
                const failedActivities = validationResults.results.filter(r => !r.isGeneric);
                for (const f of failedActivities.slice(0, 5)) {
                    feedbackLines.push(
                        `- Activity "${f.activity.title}": ${f.issues.join('; ')}. Suggestions: ${f.suggestions.join('; ')}`
                    );
                }
            }

            // From LLM validation
            for (const issue of validationIssues.slice(0, 5)) {
                feedbackLines.push(
                    `- Activity #${issue.activityIndex}: ${issue.issue}. Fix: ${issue.suggestion}`
                );
            }

            const retryPrompt = `Your previous generation had quality issues. Fix them and regenerate.

FEEDBACK:
${feedbackLines.join('\n')}

IMPORTANT CORRECTIONS:
- Every activity description MUST name specific frameworks, tools, patterns, or concrete deliverables (20-60 words)
- Do NOT use vague titles like "Sviluppo backend" or "Testing" — be technically precise
- group MUST be one of: ANALYSIS, DEV, TEST, OPS, GOVERNANCE
- existingCode MUST only use codes from the catalog: ${validCatalogCodes.slice(0, 20).join(', ')}

Original context: ${sanitizedDescription}
Category: ${techCategory}

${catalogForPrompt}

Regenerate the preset with corrections. Return JSON only.`;

            try {
                const retryResponse = await provider.generateContent({
                    model: 'gpt-4o',
                    temperature: 0.15,
                    maxTokens: 3000,
                    options: { timeout: 25000 },
                    responseFormat: { type: 'json_object' },
                    systemPrompt: SYSTEM_PROMPT,
                    userPrompt: retryPrompt,
                });
                modelPasses.push('gpt-4o:retry');

                if (retryResponse) {
                    const retryResult = JSON.parse(retryResponse);

                    // Re-validate the retry result
                    if (retryResult.preset?.activities) {
                        const retryValidation = validateActivities(
                            retryResult.preset.activities.map((a: any) => ({
                                title: a.title || '',
                                description: a.description || ''
                            }))
                        );

                        console.log('[ai-generate-preset] Retry validation:', {
                            oldScore: validationResults?.averageScore?.toFixed(1),
                            newScore: retryValidation.averageScore.toFixed(1),
                            improved: retryValidation.averageScore > (validationResults?.averageScore || 0),
                            requestId,
                        });

                        // Only use retry if it's actually better
                        if (retryValidation.averageScore > (validationResults?.averageScore || 0)) {
                            result = retryResult;
                            validationResults = retryValidation;
                            console.log('[ai-generate-preset] Using retry result (improved quality)');
                        } else {
                            console.log('[ai-generate-preset] Keeping original (retry did not improve)');
                        }
                    }
                }
            } catch (retryErr) {
                console.warn('[ai-generate-preset] Retry failed (non-blocking):', retryErr);
            }
        }

        // ──────────────────────────────────────────────────
        // Step 6: Finalize metadata & return
        // ──────────────────────────────────────────────────

        const totalGenerationMs = Date.now() - pipelineStart;

        if (result.preset && validationResults) {
            result.preset.validationScore = validationResults.averageScore;
            result.preset.genericityCheck = {
                passed: validationResults.summary.passed,
                failed: validationResults.summary.failed,
                warnings: validationResults.summary.warnings,
            };
        }

        if (result.preset?.activities) {
            const existingCount = result.preset.activities.filter((a: any) => a.existingCode).length;
            const newCount = result.preset.activities.filter((a: any) => a.isNew).length;
            console.log('[ai-generate-preset] Hybrid activity breakdown:', {
                total: result.preset.activities.length,
                fromCatalog: existingCount,
                newlyCreated: newCount,
                catalogPercentage: ((existingCount / result.preset.activities.length) * 100).toFixed(0) + '%',
                requestId,
            });
        }

        console.log('[ai-generate-preset] Pipeline complete:', {
            success: result.success,
            hasPreset: !!result.preset,
            activities: result.preset?.activities?.length,
            validationScore: result.preset?.validationScore?.toFixed(1),
            passes: modelPasses,
            totalGenerationMs,
            requestId,
        });

        return {
            ...result,
            metadata: {
                cached: false,
                attempts: modelPasses.length,
                modelPasses,
                generationTimeMs: totalGenerationMs,
                firstPassMs,
                historyTechnologies: similarTechnologies.length,
                validationIssues: validationIssues.length,
                retried: modelPasses.includes('gpt-4o:retry'),
            },
        };
    }
});
