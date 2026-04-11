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
    formatActivitiesCatalog,
    type Activity,
    type InterviewAnswerRecord,
} from './lib/activities';
import {
    mapBlueprintToActivities,
    isBlueprintMappable,
    blueprintToNormalizedSignals,
    type BlueprintMappingResult,
    type ActivityProvenance,
} from './lib/blueprint-activity-mapper';
import {
    extractImpactMapSignals,
    impactMapToNormalizedSignals,
} from './lib/impact-map-signal-extractor';
import {
    extractUnderstandingSignals,
    understandingToNormalizedSignals,
} from './lib/understanding-signal-extractor';
import { keywordToNormalizedSignals } from './lib/domain/pipeline/keyword-signal-adapter';
import {
    synthesizeCandidates,
    type SynthesizedCandidateSet,
} from './lib/domain/pipeline/candidate-synthesizer';
import type { SignalSet } from './lib/domain/pipeline/signal-types';
import { buildProvenanceMap, attachProvenance, provenanceBreakdown } from './lib/provenance-map';
import { formatProjectContextBlock } from './lib/ai/prompt-builder';
import { evaluateProjectContextRules } from './lib/domain/estimation/project-context-rules';
import { evaluateProjectTechnicalBlueprintRules } from './lib/domain/estimation/blueprint-rules';
import { mergeProjectAndBlueprintRules } from './lib/domain/estimation/blueprint-context-integration';
import { mergeDriverSuggestions, mergeRiskSuggestions } from './lib/domain/estimation/project-context-integration';
import type { ProjectTechnicalBlueprint } from './lib/domain/project/project-technical-blueprint.types';
import type { EstimationContext } from './lib/domain/types/estimation';
import { formatProjectTechnicalBlueprintBlock } from './lib/ai/formatters/project-blueprint-formatter';
import { runDecisionEngine } from './lib/domain/pipeline/decision-engine';
import { explainDecision, type DecisionExplanation } from './lib/ai/actions/explain-decision';
import type { DecisionExplanationPromptInput } from './lib/ai/prompts/decision-explanation';

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
    /** How the candidate set was generated */
    candidateSource: 'blueprint-mapper' | 'keyword-ranking' | 'vector-search';
    /** Coverage report from blueprint mapper (if used) */
    blueprintCoverage?: {
        componentCoveragePercent: number;
        fromBlueprint: number;
        fromFallback: number;
        missingGroups: string[];
    };
    /** Non-blocking quality warnings from blueprint mapper */
    blueprintWarnings?: Array<{ level: string; code: string; message: string }>;
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
        candidateSource: 'keyword-ranking',
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
    projectType?: string;
    domain?: string;
    scope?: string;
    teamSize?: number;
    deadlinePressure?: string;
    methodology?: string;
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
    /** Optional project technical blueprint — architectural baseline from project creation */
    projectTechnicalBlueprint?: Record<string, unknown>;
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

SCELTA SFORZO (BASATA SULLA COMPLESSITÀ DEL PROGETTO):
- La complessità viene gestita automaticamente dal sistema di moltiplicatori
- NON specificare varianti _SM o _LG nei codici attività
- Usa SOLO i codici base (es. PP_DV_FORM, BE_API_SIMPLE, FE_UI_COMPONENT)

REGOLE DI COERENZA:
- Per lo STESSO tipo di requisito con le STESSE risposte, seleziona SEMPRE le stesse attività
- NON aggiungere attività "per sicurezza" - includi SOLO quelle giustificate dalle risposte
- Il sistema applicherà automaticamente i moltiplicatori di complessità corretti

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
            const actorStr = ru.actors.map((a: any) => {
                const tag = a.type === 'system' ? '[SYSTEM]' : '[HUMAN]';
                const mode = a.interactionMode ? ` (${a.interactionMode})` : '';
                return `${tag} ${a.role}${mode} — ${a.interaction}`;
            }).join('; ');
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

// formatProjectTechnicalBlueprintBlock — imported from lib/ai/formatters/project-blueprint-formatter

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
        // techCategory is optional — projects may have no technology selected
        // Defaults to 'MULTI' in handler if missing
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

        // ─── Project Context Rules (deterministic, pre-AI) ──────────
        const estimationCtx: EstimationContext = {
            technologyId: body.techPresetId ?? null,
            techCategory: body.techCategory ?? null,
            project: body.projectContext ? {
                name: body.projectContext.name,
                description: body.projectContext.description,
                owner: body.projectContext.owner,
                projectType: body.projectContext.projectType as any,
                domain: body.projectContext.domain,
                scope: body.projectContext.scope as any,
                teamSize: body.projectContext.teamSize,
                deadlinePressure: body.projectContext.deadlinePressure as any,
                methodology: body.projectContext.methodology as any,
            } : null,
        };
        const contextRules = evaluateProjectContextRules(estimationCtx);

        // ─── Blueprint deterministic rules ─────────────────────────────
        const blueprintRules = evaluateProjectTechnicalBlueprintRules(
            body.projectTechnicalBlueprint as unknown as ProjectTechnicalBlueprint | undefined,
        );
        const mergedRules = mergeProjectAndBlueprintRules(contextRules, blueprintRules);
        if (mergedRules.notes.length > 0) {
            console.log('[ai-estimate-from-interview] Merged context+blueprint rules:', mergedRules.notes);
        }

        // ─── Candidate Generation: CandidateSynthesizer (multi-signal) ──
        //
        // Pipeline (deterministic):
        //   1. Extract structured signals from artifacts
        //   2. Normalize all signals to canonical NormalizedSignal format
        //   3. Synthesize: weighted merge (blueprint=3.0, impact-map=2.0,
        //      understanding=1.5, keyword=1.0, context=0.5)
        //   4. Conflict + gap detection, provenance throughout
        //

        // Step 1: Run extractors
        const blueprintMappingResult: BlueprintMappingResult | undefined =
            body.estimationBlueprint && isBlueprintMappable(body.estimationBlueprint)
                ? mapBlueprintToActivities(body.estimationBlueprint, fetchResult.activities, techCat)
                : undefined;

        const impactMapResult = body.impactMap && (body.impactMap as any).impacts?.length > 0
            ? extractImpactMapSignals(body.impactMap as any, fetchResult.activities, techCat)
            : undefined;

        const understandingResult = body.requirementUnderstanding
            ? extractUnderstandingSignals(body.requirementUnderstanding as any, fetchResult.activities, techCat)
            : undefined;

        // Step 2: Normalize to SignalSets
        const signalSets: SignalSet[] = [];
        if (blueprintMappingResult) signalSets.push(blueprintToNormalizedSignals(blueprintMappingResult));
        if (impactMapResult) signalSets.push(impactMapToNormalizedSignals(impactMapResult));
        if (understandingResult) signalSets.push(understandingToNormalizedSignals(understandingResult));
        signalSets.push(keywordToNormalizedSignals({
            activities: fetchResult.activities,
            description: sanitizedDescription,
            answers: body.answers,
            topN: 30,
            blueprint: body.estimationBlueprint,
            activityBiases: mergedRules.activityBiases,
        }));

        // Step 3: Synthesize candidates
        const candidateResult: SynthesizedCandidateSet = synthesizeCandidates({
            signalSets,
            catalog: fetchResult.activities,
            techCategory: techCat,
            config: { maxCandidates: 30 },
        });

        const rankedActivities: Activity[] = candidateResult.candidates.map(c => c.activity);

        // Metrics from synthesizer
        metrics.candidateSource = candidateResult.strategy as any;
        if (blueprintMappingResult) {
            metrics.blueprintCoverage = {
                componentCoveragePercent: blueprintMappingResult.coverage.componentCoveragePercent,
                fromBlueprint: blueprintMappingResult.coverage.fromBlueprint,
                fromFallback: blueprintMappingResult.coverage.fromFallback,
                missingGroups: blueprintMappingResult.coverage.missingGroups,
            };
            if (blueprintMappingResult.warnings.length > 0) {
                metrics.blueprintWarnings = blueprintMappingResult.warnings;
            }
        }
        console.log(`[ai-estimate-from-interview] CandidateSynthesizer: strategy=${candidateResult.strategy} | blueprint=${candidateResult.diagnostics.fromBlueprint} | impactMap=${candidateResult.diagnostics.fromImpactMap} | understanding=${candidateResult.diagnostics.fromUnderstanding} | keyword=${candidateResult.diagnostics.fromKeyword} | overlaps=${candidateResult.diagnostics.mergedOverlaps}`);

        metrics.activitiesAfterRanking = rankedActivities.length;

        // ─── Provenance Map: deterministic code → provenance lookup ────
        // Built before agent execution.  Precedence (first wins):
        //   blueprint-component > blueprint-integration > blueprint-data >
        //   blueprint-testing > multi-crosscutting > keyword-fallback
        // Codes discovered at runtime by agent tool-use get 'agent-discovered'.
        const provenanceMap = buildProvenanceMap(blueprintMappingResult, rankedActivities);

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
                    expandedActivityCodes: agentResult.expandedActivityCodes?.length ?? 0,
                });

                if (!agentResult.success) {
                    throw new Error(agentResult.error || 'Agentic pipeline failed');
                }

                metrics.totalDurationMs = Date.now() - pipelineStart;
                metrics.draftDurationMs = agentResult.agentMetadata.totalDurationMs;
                metrics.toolIterations = agentResult.agentMetadata.toolCallCount;
                metrics.reflectionDurationMs = agentResult.agentMetadata.reflectionResult ? (agentResult.agentMetadata.totalDurationMs * 0.2) : 0; // estimate
                metrics.timedOut = false;

                // ─── Provenance re-attachment (deterministic post-processing) ───
                const enrichedActivities = attachProvenance(
                    agentResult.activities,
                    provenanceMap,
                    agentResult.expandedActivityCodes,
                );

                // Provenance breakdown for observability
                console.log('[ai-estimate-from-interview] Provenance breakdown:', provenanceBreakdown(enrichedActivities));

                // ─── Merge project-context rule suggestions with AI output ──
                const mergedDrivers = mergeDriverSuggestions(
                    agentResult.suggestedDrivers,
                    contextRules.suggestedDrivers,
                );
                const mergedRisks = mergeRiskSuggestions(
                    agentResult.suggestedRisks,
                    contextRules.suggestedRisks,
                );
                if (contextRules.suggestedDrivers.length > 0 || contextRules.suggestedRisks.length > 0) {
                    console.log('[ai-estimate-from-interview] Project-context rules merged:', {
                        ruleDrivers: contextRules.suggestedDrivers.map(d => d.code),
                        ruleRisks: contextRules.suggestedRisks.map(r => r.code),
                        finalDriverCount: mergedDrivers.length,
                        finalRiskCount: mergedRisks.length,
                    });
                }

                console.log('[ai-estimate-from-interview] METRICS:', JSON.stringify(metrics));

                // Include candidate provenance from builder (same as legacy path)
                const candidateProvenance = candidateResult.candidates.map(c => ({
                    code: c.activity.code,
                    score: c.score,
                    sources: c.sources,
                    contributions: c.contributions,
                    primarySource: c.primarySource,
                    provenance: c.provenance,
                    confidence: c.confidence,
                }));

                return {
                    success: true,
                    generatedTitle: agentResult.generatedTitle,
                    activities: enrichedActivities,
                    totalBaseDays: agentResult.totalBaseDays,
                    reasoning: agentResult.reasoning,
                    confidenceScore: agentResult.confidenceScore,
                    suggestedDrivers: mergedDrivers,
                    suggestedRisks: mergedRisks.map(r => r.code),
                    candidateProvenance,
                    projectContextNotes: contextRules.notes.length > 0 ? contextRules.notes : undefined,
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

        // ─── Deterministic Pipeline (replaces Legacy Linear Pipeline) ──
        console.log('[ai-estimate-from-interview] Using DETERMINISTIC pipeline');
        metrics.pipelineMode = 'legacy'; // keep backward-compatible metric label
        const legacyStart = Date.now();

        // ── Phase D1: Run DecisionEngine ────────────────────────────────
        const techCatForEngine = techCat || body.techCategory || 'POWER_PLATFORM';
        const decisionResult = runDecisionEngine({
            candidates: candidateResult.candidates,
            answers: body.answers,
            techCategory: techCatForEngine,
            catalog: fetchResult.activities,
            description: sanitizedDescription,
            activityBiases: mergedRules.activityBiases,
        });

        console.log('[ai-estimate-from-interview] DecisionEngine result:', {
            selected: decisionResult.selectedCandidates.length,
            excluded: decisionResult.excludedCandidates.length,
            mandatory: decisionResult.mandatoryInclusions.length,
            gaps: decisionResult.coverageReport.gapLayers,
            confidence: decisionResult.confidence,
        });

        // ── Phase D2: AI Explanation (post-decision commentary) ─────────
        const coverageSummaryLines = Object.entries(decisionResult.coverageReport.byLayer)
            .map(([layer, cov]) => `${layer}: ${cov.covered ? `✓ (${cov.activityCount} attività, top score ${cov.topScore.toFixed(2)})` : '✗ non coperto'}`)
            .join('\n');

        const explanationPromptInput: DecisionExplanationPromptInput = {
            description: sanitizedDescription,
            answers: body.answers,
            selectedActivities: decisionResult.selectedCandidates.map(c => ({
                code: c.activity.code,
                name: c.activity.name,
                score: c.score,
                sources: c.sources,
            })),
            coverageSummary: coverageSummaryLines,
            mandatoryInclusions: decisionResult.mandatoryInclusions.map(m => ({
                code: m.code,
                matchedKeyword: m.matchedKeyword,
            })),
            techCategory: techCatForEngine,
        };

        let explanation: DecisionExplanation;
        try {
            explanation = await explainDecision({ promptInput: explanationPromptInput });
        } catch (explainError: any) {
            console.warn('[ai-estimate-from-interview] explainDecision failed, using fallback:', explainError?.message);
            explanation = {
                reasoning: 'Selezione attività basata su analisi strutturale del requisito e delle risposte.',
                activityExplanations: decisionResult.selectedCandidates.map(c => ({
                    code: c.activity.code,
                    explanation: `Selezionato con score ${c.score.toFixed(2)} da ${c.primarySource}`,
                })),
                warnings: [],
                gaps: decisionResult.coverageReport.gapLayers.map(l => `Layer "${l}" non coperto`),
                suggestedDrivers: [],
                suggestedRisks: [],
            };
        }

        // ── Build activities array (backward-compatible shape) ──────────
        const selectedActivities = decisionResult.selectedCandidates.map(c => {
            const actExplanation = explanation.activityExplanations.find(e => e.code === c.activity.code);
            return {
                code: c.activity.code,
                name: c.activity.name,
                baseHours: c.activity.base_hours,
                reason: actExplanation?.explanation || `Score ${c.score.toFixed(2)} (${c.primarySource})`,
                fromAnswer: '',
                fromQuestionId: '',
            };
        });

        const totalBaseDays = selectedActivities.reduce(
            (sum, a) => sum + (a.baseHours / 8),
            0,
        );

        // ── Provenance re-attachment ────────────────────────────────────
        const enrichedActivities = attachProvenance(selectedActivities, provenanceMap);
        console.log('[ai-estimate-from-interview] Deterministic provenance breakdown:', provenanceBreakdown(enrichedActivities));

        // ── Merge project-context + blueprint rule suggestions ──────────
        const mergedLegacyDrivers = mergeDriverSuggestions(
            explanation.suggestedDrivers.map(d => ({
                code: d.name,
                suggestedValue: 'medium',
                reason: d.rationale,
                fromQuestionId: null,
            })),
            mergedRules.suggestedDrivers,
        );
        const mergedLegacyRisks = mergeRiskSuggestions(
            explanation.suggestedRisks.map(r => r.name),
            mergedRules.suggestedRisks,
        );

        metrics.draftDurationMs = Date.now() - legacyStart;
        metrics.totalDurationMs = Date.now() - pipelineStart;

        console.log('[ai-estimate-from-interview] METRICS:', JSON.stringify(metrics));

        // ── Build candidate provenance (same shape as before) ───────────
        const candidateProvenance = candidateResult.candidates.map(c => ({
            code: c.activity.code,
            score: c.score,
            sources: c.sources,
            contributions: c.contributions,
            primarySource: c.primarySource,
            provenance: c.provenance,
            confidence: c.confidence,
        }));

        return {
            success: true,
            generatedTitle: '',
            activities: enrichedActivities,
            totalBaseDays: Number(totalBaseDays.toFixed(2)),
            reasoning: explanation.reasoning,
            confidenceScore: Number(decisionResult.confidence.toFixed(2)),
            suggestedDrivers: mergedLegacyDrivers,
            suggestedRisks: mergedLegacyRisks.map(r => r.code),
            candidateProvenance,
            projectContextNotes: mergedRules.notes.length > 0 ? mergedRules.notes : undefined,
            // New deterministic pipeline fields (backward-compatible additions)
            decisionTrace: decisionResult.decisionTrace,
            coverageReport: decisionResult.coverageReport,
            explanationWarnings: explanation.warnings.length > 0 ? explanation.warnings : undefined,
            explanationGaps: explanation.gaps.length > 0 ? explanation.gaps : undefined,
            metrics,
        };
    }
});
