/**
 * Netlify Function: AI Estimate from Interview
 * 
 * Generates an estimation based on:
 * - Original requirement description
 * - Technical interview answers
 * - Technology preset and available activities
 * 
 * Returns selected activities with reasoning, linking each to specific answers.
 * 
 * POST /.netlify/functions/ai-estimate-from-interview
 */

import { createAIHandler } from './lib/handler';
import { getDefaultProvider } from './lib/ai/openai-client';
import { CircuitOpenError } from './lib/ai/circuit-breaker';
import { getPrompt } from './lib/ai/prompt-registry';
import { searchSimilarActivities, isVectorSearchEnabled } from './lib/ai/vector-search';
import { retrieveRAGContext, getRAGSystemPromptAddition } from './lib/ai/rag';
import { runAgentPipeline, AgentInput } from './lib/ai/agent';
import {
    fetchActivitiesServerSide,
    selectTopActivities,
    formatActivitiesCatalog,
    type Activity,
    type InterviewAnswerRecord,
} from './lib/activities';

// Model configuration - use env variable AI_ESTIMATION_MODEL or default to gpt-4o
// NOTE: gpt-5 has limitations (no custom temperature, no json_schema response_format)
// Use gpt-4o as default for reliable structured output
const AI_MODEL = process.env.AI_ESTIMATION_MODEL || 'gpt-4o';

// ─────────────────────────────────────────────────────────────────────────────
// Metrics type for performance instrumentation
// ─────────────────────────────────────────────────────────────────────────────
interface EstimationMetrics {
    totalDurationMs: number;
    activitiesFetchMs: number;
    vectorSearchMs: number;
    ragRetrievalMs: number;
    draftDurationMs: number;
    reflectionDurationMs: number;
    refineDurationMs: number;
    toolIterations: number;
    model: string;
    promptTokensEstimate: number;
    activitiesCatalogSize: number;
    activitiesAfterRanking: number;
    pipelineMode: 'legacy' | 'agentic';
    timedOut: boolean;
    fallbackUsed: boolean;
}

function createEmptyMetrics(): EstimationMetrics {
    return {
        totalDurationMs: 0,
        activitiesFetchMs: 0,
        vectorSearchMs: 0,
        ragRetrievalMs: 0,
        draftDurationMs: 0,
        reflectionDurationMs: 0,
        refineDurationMs: 0,
        toolIterations: 0,
        model: AI_MODEL,
        promptTokensEstimate: 0,
        activitiesCatalogSize: 0,
        activitiesAfterRanking: 0,
        pipelineMode: 'legacy',
        timedOut: false,
        fallbackUsed: false,
    };
}

// Phase 3: Agentic pipeline feature flag
// Set AI_AGENTIC=true to enable the reflection loop + tool use pipeline
// NOTE: Read at request time inside handler (not module level) so env changes are picked up

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface InterviewAnswer {
    questionId: string;
    category: string;
    value: string | string[] | number;
    timestamp: string;
}

interface ProjectContext {
    name: string;
    description: string;
    owner?: string;
}

/** Pre-estimate from the interview planner (Round 0), used as anchor for coherence */
interface PreEstimate {
    minHours: number;
    maxHours: number;
    confidence: number;
}

interface RequestBody {
    description: string;
    techPresetId: string;
    techCategory: string;
    answers: Record<string, InterviewAnswer>;
    /** @deprecated Activities are now fetched server-side. Kept for backward compat. */
    activities?: Activity[];
    projectContext?: ProjectContext;
    /** Optional pre-estimate from Round 0 planner — used as anchoring context */
    preEstimate?: PreEstimate;
    /** Optional structured understanding from Requirement Understanding step */
    requirementUnderstanding?: Record<string, unknown>;
    /** Optional impact map from Impact Map step */
    impactMap?: Record<string, unknown>;
    /** Optional estimation blueprint — structured technical work model */
    estimationBlueprint?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// System Prompt
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Sei un Tech Lead esperto che deve selezionare le attività per implementare un requisito software.

HAI A DISPOSIZIONE:
1. Descrizione del requisito originale
2. Contesto del progetto (se fornito) - aiuta a capire lo scope generale
3. Risposte a domande tecniche specifiche fornite dallo sviluppatore
4. Catalogo delle attività disponibili per lo stack tecnologico

IL TUO COMPITO:
1. Analizza le risposte per capire la complessità REALE del requisito
2. Seleziona SOLO le attività necessarie dal catalogo fornito
3. Per ogni attività selezionata, spiega PERCHÉ è necessaria
4. Collega ogni attività alla risposta che l'ha triggerata (quando applicabile)
5. Calcola un confidence score basato sulla completezza delle risposte

⚠️ REGOLE DETERMINISTICHE PER RIDURRE VARIANZA ⚠️

SELEZIONE ATTIVITÀ OBBLIGATORIE (se il requisito le richiede):
1. Se menziona "email", "notifica", "invio", "flusso automatico" → INCLUDI attività FLOW (PP_FLOW_* o equivalente)
2. Se menziona "form", "schermata", "interfaccia", "UI" → INCLUDI attività FORM (PP_DV_FORM_* o equivalente)
3. Se menziona "dati", "campi", "tabella", "entità" → INCLUDI attività FIELD/DATA (PP_DV_FIELD_* o equivalente)
4. Se menziona "test", "validazione", "UAT" → INCLUDI attività TEST (PP_E2E_TEST_* o equivalente)
5. Se menziona "deploy", "rilascio", "ambiente" → INCLUDI attività DEPLOY (PP_DEPLOY_* o equivalente)

SCELTA VARIANTE _SM vs _LG (BASATA SULLE RISPOSTE, NON SUL TUO GIUDIZIO):
- Se la risposta indica "semplice", "pochi", "1-2", "base", "minimo" → USA variante _SM
- Se la risposta indica "complesso", "molti", "5+", "avanzato", "multipli" → USA variante _LG  
- Se la risposta è neutra o assente → USA la variante BASE (senza suffisso)

REGOLE DI COERENZA:
- Per lo STESSO tipo di requisito con le STESSE risposte, seleziona SEMPRE le stesse attività
- NON aggiungere attività "per sicurezza" - includi SOLO quelle giustificate dalle risposte
- Se non sei sicuro, usa la variante BASE (senza _SM/_LG)

CONFIDENCE SCORE (DETERMINISTICO):
- 0.90: Tutte le domande hanno risposta chiara e coerente
- 0.80: 80%+ domande con risposta chiara
- 0.70: 60-80% domande con risposta chiara
- 0.60: Meno del 60% domande con risposta chiara

FORMATO OUTPUT (JSON):
{
  "generatedTitle": "Titolo sintetico del requisito (max 60 caratteri, in italiano)",
  "activities": [
    {
      "code": "ACTIVITY_CODE",
      "name": "Nome attività",
      "baseHours": 8,
      "reason": "Perché questa attività è necessaria",
      "fromAnswer": "Valore della risposta che ha triggerato questa selezione",
      "fromQuestionId": "q1_integration"
    }
  ],
  "totalBaseDays": 5.5,
  "reasoning": "Spiegazione complessiva della stima e delle scelte fatte",
  "confidenceScore": 0.85,
  "suggestedDrivers": [
    {
      "code": "DRIVER_CODE",
      "suggestedValue": "HIGH",
      "reason": "Perché suggerisci questo valore",
      "fromQuestionId": "q2_complexity"
    }
  ],
  "suggestedRisks": ["RISK_CODE_1", "RISK_CODE_2"]
}

GENERATED TITLE:
- Deve essere un titolo breve e descrittivo del requisito
- Max 60 caratteri
- In italiano
- Deve catturare l'essenza funzionale del requisito
- Esempio: "Report utilizzo ESM per HR" o "Integrazione API candidature Talentum"

⚠️ IMPORTANTE: Rispondi ESCLUSIVAMENTE con JSON valido. NON usare markdown, NON aggiungere commenti, blocchi \`\`\`json o testo prima/dopo il JSON. La risposta DEVE iniziare con { e terminare con }.`;

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build JSON Schema for structured output with dynamic activity codes
 * 
 * NOTE: We build the schema dynamically to include the enum of valid activity codes.
 * This prevents the AI from inventing codes that don't exist in the catalog.
 */
function buildResponseSchema(validActivityCodes: string[]) {
    return {
        type: 'json_schema' as const,
        json_schema: {
            name: 'estimation_from_interview_response',
            strict: true,
            schema: {
                type: 'object',
                properties: {
                    generatedTitle: { type: 'string' },
                    activities: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                // CRITICAL: Enum constraint to prevent AI from inventing codes
                                code: { type: 'string', enum: validActivityCodes },
                                name: { type: 'string' },
                                baseHours: { type: 'number' },
                                reason: { type: 'string' },
                                fromAnswer: { type: ['string', 'null'] },
                                fromQuestionId: { type: ['string', 'null'] }
                            },
                            required: ['code', 'name', 'baseHours', 'reason', 'fromAnswer', 'fromQuestionId'],
                            additionalProperties: false
                        }
                    },
                    totalBaseDays: { type: 'number' },
                    reasoning: { type: 'string' },
                    confidenceScore: { type: 'number' },
                    suggestedDrivers: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                code: { type: 'string' },
                                suggestedValue: { type: 'string' },
                                reason: { type: 'string' },
                                fromQuestionId: { type: ['string', 'null'] }
                            },
                            required: ['code', 'suggestedValue', 'reason', 'fromQuestionId'],
                            additionalProperties: false
                        }
                    },
                    suggestedRisks: {
                        type: 'array',
                        items: { type: 'string' }
                    }
                },
                required: ['generatedTitle', 'activities', 'totalBaseDays', 'reasoning', 'confidenceScore', 'suggestedDrivers', 'suggestedRisks'],
                additionalProperties: false
            }
        }
    };
}

// NOTE: formatActivitiesCatalog is now imported from './lib/activities' (shared module).

// NOTE: fetchActivitiesServerSide, selectTopActivities, formatActivitiesCatalog,
// and Activity type are now imported from './lib/activities' (shared module).

/**
 * Format interview answers for prompt
 */
function formatInterviewAnswers(answers: Record<string, InterviewAnswer>): string {
    const entries = Object.entries(answers);
    if (entries.length === 0) {
        return 'Nessuna risposta fornita.';
    }

    return entries
        .map(([_, answer]) => {
            const valueStr = Array.isArray(answer.value)
                ? answer.value.join(', ')
                : String(answer.value);
            return `[${answer.category}] ${answer.questionId}: ${valueStr}`;
        })
        .join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Requirement Understanding → compact prompt block (optional enrichment)
// ─────────────────────────────────────────────────────────────────────────────

function formatUnderstandingBlock(ru: Record<string, unknown> | undefined): string {
    if (!ru || typeof ru !== 'object') return '';
    try {
        const lines: string[] = [];
        lines.push('\nCOMPRENSIONE STRUTTURATA DEL REQUISITO (validata dall\'utente — usala per migliorare selezione attività e ragionamento, NON ignorare descrizione e risposte):');
        if (ru.businessObjective) lines.push(`- Obiettivo: ${ru.businessObjective}`);
        if (ru.expectedOutput) lines.push(`- Output atteso: ${ru.expectedOutput}`);
        if (Array.isArray(ru.functionalPerimeter) && ru.functionalPerimeter.length > 0) {
            lines.push(`- Perimetro: ${ru.functionalPerimeter.join('; ')}`);
        }
        if (Array.isArray(ru.exclusions) && ru.exclusions.length > 0) {
            lines.push(`- Esclusioni: ${ru.exclusions.join('; ')}`);
        }
        if (Array.isArray(ru.actors) && ru.actors.length > 0) {
            const actorStr = ru.actors.map((a: any) => `${a.role} (${a.interaction})`).join(', ');
            lines.push(`- Attori: ${actorStr}`);
        }
        const st = ru.stateTransition as any;
        if (st?.initialState && st?.finalState) {
            lines.push(`- Transizione: da "${st.initialState}" a "${st.finalState}"`);
        }
        if (Array.isArray(ru.preconditions) && ru.preconditions.length > 0) {
            lines.push(`- Precondizioni: ${ru.preconditions.join('; ')}`);
        }
        if (Array.isArray(ru.assumptions) && ru.assumptions.length > 0) {
            lines.push(`- Assunzioni: ${ru.assumptions.join('; ')}`);
        }
        const ca = ru.complexityAssessment as any;
        if (ca?.level) {
            lines.push(`- Complessità stimata: ${ca.level}${ca.rationale ? ` — ${ca.rationale}` : ''}`);
        }
        if (typeof ru.confidence === 'number') {
            lines.push(`- Confidenza comprensione: ${Math.round((ru.confidence as number) * 100)}%`);
        }
        return lines.length > 1 ? lines.join('\n') : '';
    } catch {
        return '';
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Impact Map → compact prompt block (optional enrichment)
// ─────────────────────────────────────────────────────────────────────────────

function formatImpactMapBlock(im: Record<string, unknown> | undefined): string {
    if (!im || typeof im !== 'object') return '';
    try {
        const lines: string[] = [];
        lines.push('\nMAPPA IMPATTO ARCHITETTURALE (validata dall\'utente — usala per migliorare selezione attività, copertura layer e ragionamento, NON sostituisce descrizione o risposte):');
        if (im.summary) lines.push(`Sintesi: ${im.summary}`);
        if (typeof im.overallConfidence === 'number') {
            lines.push(`Confidenza complessiva: ${Math.round((im.overallConfidence as number) * 100)}%`);
        }
        if (Array.isArray(im.impacts) && im.impacts.length > 0) {
            lines.push('Impatti:');
            for (const item of im.impacts) {
                if (!item || typeof item !== 'object') continue;
                const layer = item.layer || '?';
                const action = item.action || '?';
                const components = Array.isArray(item.components) ? item.components.join(', ') : '';
                const reason = item.reason || '';
                const conf = typeof item.confidence === 'number' ? ` (${Math.round(item.confidence * 100)}%)` : '';
                lines.push(`- ${layer} [${action}]: ${components} — ${reason}${conf}`);
            }
        }
        return lines.length > 1 ? lines.join('\n') : '';
    } catch {
        return '';
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Estimation Blueprint → compact prompt block (optional enrichment)
// ─────────────────────────────────────────────────────────────────────────────

function formatBlueprintBlock(bp: Record<string, unknown> | undefined): string {
    if (!bp || typeof bp !== 'object') return '';
    try {
        const lines: string[] = [];
        lines.push('\nBLUEPRINT TECNICO (modello strutturale validato dall\'utente — usalo per migliorare selezione attività e copertura componenti, NON sostituisce descrizione o risposte):');
        if (bp.summary) lines.push(`Sintesi: ${bp.summary}`);
        if (typeof bp.overallConfidence === 'number') {
            lines.push(`Confidenza complessiva: ${Math.round((bp.overallConfidence as number) * 100)}%`);
        }
        if (Array.isArray(bp.components) && bp.components.length > 0) {
            lines.push('Componenti:');
            for (const c of bp.components) {
                if (!c || typeof c !== 'object') continue;
                const name = c.name || '?';
                const layer = c.layer || '?';
                const intervention = c.interventionType || '?';
                const complexity = c.complexity || '?';
                lines.push(`- ${name} [${layer}/${intervention}] complessità: ${complexity}`);
            }
        }
        if (Array.isArray(bp.integrations) && bp.integrations.length > 0) {
            lines.push('Integrazioni: ' + bp.integrations.map((i: any) => `${i.systemName || '?'} (${i.direction || '?'})`).join(', '));
        }
        if (Array.isArray(bp.uncertainties) && bp.uncertainties.length > 0) {
            lines.push('Incertezze: ' + bp.uncertainties.join('; '));
        }
        return lines.length > 1 ? lines.join('\n') : '';
    } catch {
        return '';
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────

export const handler = createAIHandler<RequestBody>({
    name: 'ai-estimate-from-interview',
    requireAuth: false, // Allow unauthenticated for Quick Estimate demo
    requireLLM: true,

    validateBody: (body) => {
        if (!body.description || typeof body.description !== 'string') {
            return 'La descrizione del requisito è obbligatoria.';
        }
        if (!body.answers || typeof body.answers !== 'object') {
            return 'Le risposte all\'interview sono obbligatorie.';
        }
        if (!body.techCategory || typeof body.techCategory !== 'string') {
            return 'La categoria tecnologica è obbligatoria.';
        }
        // activities is now optional — fetched server-side
        return null;
    },

    handler: async (body, ctx) => {
        const pipelineStart = Date.now();
        const metrics = createEmptyMetrics();

        // Sanitize description
        const sanitizedDescription = ctx.sanitize(body.description);
        const techCat = body.techCategory || 'MULTI';

        // ─── Server-side activity fetch (replaces client-side fetch) ───
        const fetchResult = await fetchActivitiesServerSide(
            techCat,
            body.techPresetId,
            body.activities // backward compat fallback
        );
        metrics.activitiesFetchMs = fetchResult.fetchMs;
        metrics.activitiesCatalogSize = fetchResult.activities.length;

        if (fetchResult.activities.length === 0) {
            throw new Error('Nessuna attività disponibile per questa tecnologia.');
        }

        // ─── Deterministic ranking: select top 20 most relevant ────────
        const rankedActivities = selectTopActivities(
            fetchResult.activities,
            sanitizedDescription,
            body.answers,
            20,
            body.estimationBlueprint
        );
        metrics.activitiesAfterRanking = rankedActivities.length;

        // ─── Phase 3: Agentic Pipeline ─────────────────────────────────
        const AI_AGENTIC = process.env.AI_AGENTIC === 'true';
        console.log(`[ai-estimate-from-interview] DEBUG AI_AGENTIC=${process.env.AI_AGENTIC} → flag=${AI_AGENTIC}`);
        if (AI_AGENTIC) {
            console.log('[ai-estimate-from-interview] Using AGENTIC pipeline (Phase 3)');
            metrics.pipelineMode = 'agentic';

            // Build activities in agent format (already ranked)
            const agentActivities = rankedActivities.map(a => ({
                code: a.code,
                name: a.name,
                description: a.description ? a.description.substring(0, 80) : '',
                base_hours: a.base_hours,
                group: a.group,
                tech_category: a.tech_category,
            }));
            console.log(`[agentic] Ranked activities for agent: ${agentActivities.length}`);

            const agentInput: AgentInput = {
                description: sanitizedDescription,
                answers: body.answers,
                activities: agentActivities,
                validActivityCodes: agentActivities.map(a => a.code),
                techCategory: body.techCategory || 'MULTI',
                projectContext: body.projectContext ? {
                    name: ctx.sanitize(body.projectContext.name),
                    description: ctx.sanitize(body.projectContext.description),
                    owner: body.projectContext.owner ? ctx.sanitize(body.projectContext.owner) : undefined,
                } : undefined,
                technologyName: body.techCategory,
                userId: ctx.userId, // Pass through from auth (may be undefined for unauthenticated Quick Estimate)
                flags: {
                    reflectionEnabled: process.env.AI_REFLECTION !== 'false',
                    toolUseEnabled: process.env.AI_TOOL_USE !== 'false',
                    maxReflectionIterations: Number(process.env.AI_MAX_REFLECTIONS || 2),
                    reflectionConfidenceThreshold: Number(process.env.AI_REFLECTION_THRESHOLD || 75),
                    autoApproveOnly: false,
                },
            };

            try {
                const agentResult = await runAgentPipeline(agentInput);

                console.log('[ai-estimate-from-interview] Agent pipeline result:', {
                    success: agentResult.success,
                    activities: agentResult.activities.length,
                    totalBaseDays: agentResult.totalBaseDays,
                    confidence: agentResult.confidenceScore,
                    iterations: agentResult.agentMetadata.iterations,
                    toolCalls: agentResult.agentMetadata.toolCallCount,
                    durationMs: agentResult.agentMetadata.totalDurationMs,
                    reflectionAssessment: agentResult.agentMetadata.reflectionResult?.assessment,
                });

                if (!agentResult.success) {
                    throw new Error(agentResult.error || 'Agentic pipeline failed');
                }

                metrics.totalDurationMs = Date.now() - pipelineStart;
                metrics.draftDurationMs = agentResult.agentMetadata.totalDurationMs;
                metrics.toolIterations = agentResult.agentMetadata.toolCallCount;
                metrics.reflectionDurationMs = agentResult.agentMetadata.reflectionResult ? (agentResult.agentMetadata.totalDurationMs * 0.2) : 0; // estimate
                metrics.timedOut = false;

                console.log('[ai-estimate-from-interview] METRICS:', JSON.stringify(metrics));

                return {
                    success: true,
                    generatedTitle: agentResult.generatedTitle,
                    activities: agentResult.activities,
                    totalBaseDays: agentResult.totalBaseDays,
                    reasoning: agentResult.reasoning,
                    confidenceScore: agentResult.confidenceScore,
                    suggestedDrivers: agentResult.suggestedDrivers,
                    suggestedRisks: agentResult.suggestedRisks,
                    // Phase 3 metadata
                    agentMetadata: {
                        executionId: agentResult.agentMetadata.executionId,
                        totalDurationMs: agentResult.agentMetadata.totalDurationMs,
                        iterations: agentResult.agentMetadata.iterations,
                        toolCallCount: agentResult.agentMetadata.toolCallCount,
                        model: agentResult.agentMetadata.model,
                        reflectionAssessment: agentResult.agentMetadata.reflectionResult?.assessment,
                        reflectionConfidence: agentResult.agentMetadata.reflectionResult?.confidence,
                        engineValidation: agentResult.engineValidation,
                    },
                    metrics,
                };
            } catch (agentError: any) {
                // S3-3d: Progressive degradation — agentic → legacy → error
                // If the circuit breaker is open, re-throw immediately so
                // createAIHandler returns 503 with Retry-After.
                if (agentError instanceof CircuitOpenError) {
                    console.warn('[ai-estimate-from-interview] CB open, propagating 503');
                    throw agentError;
                }
                // For other errors (transient LLM failures, parsing, etc.)
                // fall through to the legacy linear pipeline below.
                metrics.fallbackUsed = true;
                console.warn(
                    '[ai-estimate-from-interview] Agentic pipeline failed, falling back to legacy:',
                    agentError?.message || agentError,
                );
            }
        }

        // ─── Legacy Linear Pipeline ────────────────────────────────────
        console.log('[ai-estimate-from-interview] Using LINEAR pipeline (legacy)');
        metrics.pipelineMode = 'legacy';
        const legacyStart = Date.now();

        // Get LLM provider
        const provider = getDefaultProvider();

        // Use vector search for more relevant activities (Phase 2)
        let activitiesToUse: Activity[] = rankedActivities;
        let searchMethod = fetchResult.source === 'server' ? 'server-ranked' : 'client-ranked';

        const vectorSearchStart = Date.now();
        if (isVectorSearchEnabled() && body.techCategory) {
            try {
                console.log('[ai-estimate-from-interview] Using vector search for activity retrieval');
                const techCategories = [body.techCategory, 'MULTI'];
                const searchResult = await searchSimilarActivities(
                    sanitizedDescription,
                    techCategories,
                    20, // Top-20 most relevant activities (reduced from 35)
                    0.45
                );

                if (searchResult.results.length > 0) {
                    activitiesToUse = searchResult.results.map(r => ({
                        code: r.code,
                        name: r.name,
                        description: r.description || '',
                        base_hours: r.base_hours,
                        group: r.group,
                        tech_category: r.tech_category,
                    }));
                    searchMethod = searchResult.metrics.usedFallback ? 'vector-fallback' : 'vector';
                    console.log(`[ai-estimate-from-interview] Vector search returned ${activitiesToUse.length} activities in ${searchResult.metrics.latencyMs}ms`);
                }
            } catch (err) {
                console.warn('[ai-estimate-from-interview] Vector search failed, using ranked activities:', err);
            }
        }
        metrics.vectorSearchMs = Date.now() - vectorSearchStart;

        // Retrieve RAG context (Phase 4: Historical Learning)
        const ragStart = Date.now();
        let ragContext = { hasExamples: false, promptFragment: '', searchLatencyMs: 0 } as any;
        if (isVectorSearchEnabled()) {
            try {
                ragContext = await retrieveRAGContext(sanitizedDescription);
                if (ragContext.hasExamples) {
                    console.log(`[ai-estimate-from-interview] RAG: found ${ragContext.examples?.length || 0} historical examples`);
                }
            } catch (err) {
                console.warn('[ai-estimate-from-interview] RAG retrieval failed:', err);
            }
        }
        metrics.ragRetrievalMs = Date.now() - ragStart;

        // Activities are already filtered and ranked by selectTopActivities above.
        // No additional filtering needed.

        // Format data for prompt
        const activitiesCatalog = formatActivitiesCatalog(activitiesToUse);
        const interviewAnswers = formatInterviewAnswers(body.answers);
        const validActivityCodes = activitiesToUse.map(a => a.code);

        console.log('[ai-estimate-from-interview] Processing:', {
            descriptionLength: sanitizedDescription.length,
            answersCount: Object.keys(body.answers).length,
            activitiesCount: activitiesToUse.length,
            techCategory: body.techCategory,
            hasProjectContext: !!body.projectContext,
            hasRequirementUnderstanding: !!body.requirementUnderstanding,
            hasImpactMap: !!body.impactMap,
            searchMethod,
            ragExamples: ragContext.examples?.length || 0,
            validCodes: validActivityCodes.slice(0, 5).join(', ') + (validActivityCodes.length > 5 ? '...' : ''),
        });

        // Build response schema with valid activity codes enum
        // This is CRITICAL to prevent AI from inventing codes
        const responseSchema = buildResponseSchema(validActivityCodes);

        // Build project context section if available
        let projectContextSection = '';
        if (body.projectContext) {
            projectContextSection = `\nCONTESTO PROGETTO:
- Nome: ${body.projectContext.name}
- Descrizione: ${body.projectContext.description}${body.projectContext.owner ? `\n- Responsabile: ${body.projectContext.owner}` : ''}

NOTA: Usa il contesto del progetto per capire meglio lo scope e le convenzioni già stabilite.\n`;
        }

        // Build user prompt with optional RAG context
        // Include pre-estimate anchor if provided by Round 0 planner
        let preEstimateSection = '';
        if (body.preEstimate) {
            preEstimateSection = `
PRE-STIMA (dal planner, Round 0 — usala come ancora, puoi discostartene se le risposte lo giustificano):
- Range: ${body.preEstimate.minHours}h – ${body.preEstimate.maxHours}h
- Confidence iniziale: ${body.preEstimate.confidence}
`;
        }

        let userPrompt = `REQUISITO:
${sanitizedDescription}
${projectContextSection}${preEstimateSection}${formatUnderstandingBlock(body.requirementUnderstanding)}${formatImpactMapBlock(body.impactMap)}${formatBlueprintBlock(body.estimationBlueprint)}
RISPOSTE INTERVIEW TECNICA:
${interviewAnswers}

CATALOGO ATTIVITÀ DISPONIBILI (usa SOLO questi codici):
${activitiesCatalog}

IMPORTANTE: Puoi usare ESCLUSIVAMENTE i codici attività elencati sopra. Non inventare nuovi codici.

Analizza le risposte e seleziona le attività necessarie per implementare questo requisito.
Collega ogni attività alla risposta che l'ha motivata.`;

        // Add RAG examples if available
        if (ragContext.hasExamples && ragContext.promptFragment) {
            userPrompt = userPrompt + '\n' + ragContext.promptFragment;
        }

        // Build system prompt with optional RAG enhancement
        let systemPrompt = await getPrompt('estimate_from_interview') ?? SYSTEM_PROMPT;
        if (ragContext.hasExamples) {
            systemPrompt = systemPrompt + '\n' + getRAGSystemPromptAddition();
        }

        console.log(`[ai-estimate-from-interview] Using model: ${AI_MODEL}`);

        // Estimate prompt size for metrics (rough: 4 chars ≈ 1 token)
        metrics.promptTokensEstimate = Math.round((systemPrompt.length + userPrompt.length) / 4);

        // Call LLM with dynamic schema containing enum constraint
        // maxTokens: 4096 is sufficient for the JSON output (~2-3k tokens).
        // For reasoning models (gpt-5/o-series), keep higher to allow internal reasoning.
        const isReasoningModel = AI_MODEL.startsWith('gpt-5') || AI_MODEL.startsWith('o1') || AI_MODEL.startsWith('o3') || AI_MODEL.startsWith('o4');
        const maxTokens = isReasoningModel ? 8192 : 4096;

        const draftStart = Date.now();
        const responseContent = await provider.generateContent({
            model: AI_MODEL,
            options: { timeout: 55000 },
            maxTokens,
            systemPrompt: systemPrompt,
            userPrompt: userPrompt,
            responseFormat: responseSchema as any,
        });
        metrics.draftDurationMs = Date.now() - draftStart;

        // Parse response
        if (!responseContent) {
            throw new Error('Empty response from LLM');
        }

        const result = JSON.parse(responseContent);

        // Validate activities are from catalog
        const validatedActivities = result.activities.filter((a: any) =>
            validActivityCodes.includes(a.code)
        );

        // Recalculate total if activities were filtered
        const totalBaseDays = validatedActivities.reduce(
            (sum: number, a: any) => sum + (a.baseHours / 8),
            0
        );

        // Adjust confidence if activities were filtered out
        let confidenceScore = result.confidenceScore;
        if (validatedActivities.length < result.activities.length) {
            console.warn('[ai-estimate-from-interview] Filtered out invalid activities:',
                result.activities.length - validatedActivities.length
            );
            confidenceScore = Math.max(0.3, confidenceScore - 0.1);
        }

        // Log success
        console.log('[ai-estimate-from-interview] Generated estimate:', {
            generatedTitle: result.generatedTitle,
            activitiesCount: validatedActivities.length,
            totalBaseDays: totalBaseDays.toFixed(2),
            confidenceScore: confidenceScore.toFixed(2),
            suggestedDriversCount: result.suggestedDrivers?.length || 0,
            suggestedRisksCount: result.suggestedRisks?.length || 0,
        });

        metrics.totalDurationMs = Date.now() - pipelineStart;

        console.log('[ai-estimate-from-interview] METRICS:', JSON.stringify(metrics));

        // Return successful response (createAIHandler wraps with statusCode/headers)
        return {
            success: true,
            generatedTitle: result.generatedTitle || '',
            activities: validatedActivities,
            totalBaseDays: Number(totalBaseDays.toFixed(2)),
            reasoning: result.reasoning,
            confidenceScore: Number(confidenceScore.toFixed(2)),
            suggestedDrivers: result.suggestedDrivers || [],
            suggestedRisks: result.suggestedRisks || [],
            metrics,
        };
    }
});
